import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";

import { checkInApi } from "../../services/clubsport";
import { ApiError } from "../../services/http";
import { appendCheckIn } from "./history";
import {
  getScannerAvailability,
  normalizeScannedValue,
  requestScannerPermission,
  type ScannerAvailability,
} from "./qrScanner";
import { simulateTagRead } from "./simulator";
import { useLocation } from "../location/useLocation";
import type { CheckInResponse } from "../../types/api";

/**
 * Orchestration du pointage de présence — le cœur métier de l'app mobile.
 *
 * Enchaînement (parcours demandé par l'énoncé) :
 *
 *   scan du QR code de la borne
 *     → position GPS si déjà autorisée (second facteur, optionnel)
 *       → validation par le serveur (réservation + salle + fenêtre horaire)
 *         → retour haptique et visuel
 *           → trace locale dans l'historique
 *
 * Aucune décision n'est prise sur le téléphone : il transmet ce qu'il a lu.
 * C'est le serveur qui accepte ou refuse, donc un client modifié n'obtient
 * rien de plus.
 *
 * Le hook ne connaît pas la caméra : il expose des ÉTATS et des intentions
 * (`openScanner`, `handleScan`, `submitTag`). C'est l'écran qui affiche la
 * vue caméra quand `phase === "scanning"`.
 */

export type CheckInPhase = "idle" | "scanning" | "submitting" | "success" | "error";

/**
 * Comment l'identifiant de borne a été obtenu. Portée jusqu'à l'interface et
 * jusqu'au journal : une démonstration ne doit jamais pouvoir se faire passer
 * pour un vrai scan.
 */
export type TagSource = "qr" | "simulated" | "manual";

export type CheckInState = {
  phase: CheckInPhase;
  result: CheckInResponse | null;
  error: string | null;
  /** Code renvoyé par l'API : permet un message d'aide contextuel. */
  errorCode: string | null;
  /** Provenance de l'identifiant traité, `null` à l'état initial. */
  source: TagSource | null;
};

const INITIAL: CheckInState = {
  phase: "idle",
  result: null,
  error: null,
  errorCode: null,
  source: null,
};

export function useCheckIn() {
  const [state, setState] = useState<CheckInState>(INITIAL);
  const [availability, setAvailability] = useState<ScannerAvailability | null>(
    null,
  );
  const { getIfAlreadyGranted } = useLocation();

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Verrou de lecture. La caméra émet `onBarcodeScanned` en CONTINU tant que
   * le code reste dans le champ — plusieurs fois par seconde. Sans ce verrou,
   * un seul scan déclencherait une rafale d'appels réseau identiques.
   *
   * C'est une `ref` et non un état : il doit être posé SYNCHRONIQUEMENT dans
   * le callback de la caméra. Un `setState` est asynchrone, et les événements
   * suivants passeraient avant que la valeur ne soit à jour.
   */
  const locked = useRef(false);

  // Diagnostic de la permission caméra au montage de l'écran : c'est ce qui
  // permet d'afficher le bon message AVANT que l'utilisateur appuie sur un
  // bouton. On ne DEMANDE rien ici, on se contente de lire l'état.
  useEffect(() => {
    (async () => {
      const result = await getScannerAvailability();
      if (mounted.current) setAvailability(result);
    })();
  }, []);

  const reset = useCallback(() => {
    locked.current = false;
    setState(INITIAL);
  }, []);

  /**
   * Soumet un identifiant de borne au serveur.
   *
   * Exporté séparément du scan : l'écran de secours (saisie manuelle du code
   * de la borne, utile quand la caméra est refusée ou l'affiche abîmée)
   * réutilise exactement la même validation serveur.
   */
  const submitTag = useCallback(
    async (tagId: string, source: TagSource = "manual") => {
      setState({
        phase: "submitting",
        result: null,
        error: null,
        errorCode: null,
        source,
      });

      // Position lue seulement si la permission est déjà accordée : on
      // n'interrompt pas le pointage par une demande système.
      const position = await getIfAlreadyGranted();

      try {
        const result = await checkInApi.submit(tagId, position, source);

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await appendCheckIn({
          at: result.booking.checkedInAt,
          site: result.site,
          activity: result.session.activity,
          outcome: "success",
          message: result.message,
          distanceKm: result.distanceKm,
          tagId,
          source,
        });

        if (mounted.current) {
          setState({
            phase: "success",
            result,
            error: null,
            errorCode: null,
            source,
          });
        }
        return true;
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : "Validation impossible. Réessayez.";
        const code = error instanceof ApiError ? (error.code ?? null) : null;

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        // On trace aussi les échecs : un membre qui scanne hors créneau doit
        // pouvoir montrer qu'il est passé.
        await appendCheckIn({
          at: new Date().toISOString(),
          site: null,
          activity: null,
          outcome: "error",
          message,
          distanceKm: null,
          tagId,
          source,
        });

        if (mounted.current) {
          setState({
            phase: "error",
            result: null,
            error: message,
            errorCode: code,
            source,
          });
        }
        return false;
      }
    },
    [getIfAlreadyGranted],
  );

  /**
   * Ouvre la vue caméra, en demandant la permission si elle ne l'a jamais été.
   *
   * La demande part d'un geste explicite de l'utilisateur, jamais du montage
   * de l'écran : elle arrive donc avec son contexte (« je viens d'appuyer sur
   * Scanner »), ce qui est plus honnête et fait moins de refus.
   */
  const openScanner = useCallback(async () => {
    let status = availability ?? (await getScannerAvailability());

    if (status === "UNDETERMINED") {
      status = await requestScannerPermission();
    }
    if (mounted.current) setAvailability(status);

    if (status !== "READY") {
      if (mounted.current) {
        setState({
          phase: "error",
          result: null,
          error:
            "ClubSport n’a pas accès à l’appareil photo, nécessaire pour lire le QR code de la borne.",
          errorCode: "PERMISSION_DENIED",
          source: "qr",
        });
      }
      return false;
    }

    locked.current = false;
    if (mounted.current) {
      setState({
        phase: "scanning",
        result: null,
        error: null,
        errorCode: null,
        source: "qr",
      });
    }
    return true;
  }, [availability]);

  /** Ferme la vue caméra sans rien valider (bouton « Annuler »). */
  const cancelScan = useCallback(() => {
    locked.current = false;
    if (mounted.current) setState(INITIAL);
  }, []);

  /**
   * Reçoit une lecture de la caméra.
   *
   * Le verrou est posé AVANT tout traitement asynchrone : la caméra continue
   * d'émettre pendant que la requête part, et sans lui le même code partirait
   * en boucle. Il n'est relâché qu'à `reset()` ou `cancelScan()`, donc après
   * que l'utilisateur a vu le résultat.
   */
  const handleScan = useCallback(
    async (rawValue: string) => {
      if (locked.current) return false;
      locked.current = true;

      const tagId = normalizeScannedValue(rawValue);

      if (!tagId) {
        // Un QR lisible mais vide de sens : on le dit sans envoyer au serveur
        // un contenu qui n'a aucune chance d'être une borne.
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (mounted.current) {
          setState({
            phase: "error",
            result: null,
            error: "Ce QR code n’est pas un code de borne ClubSport.",
            errorCode: "UNREADABLE_CODE",
            source: "qr",
          });
        }
        return false;
      }

      // Même retour haptique que la lecture d'une carte NFC : le téléphone
      // confirme la lecture avant même la réponse du serveur, ce qui permet
      // de baisser le bras sans attendre l'écran.
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return submitTag(tagId, "qr");
    },
    [submitTag],
  );

  /**
   * Mode démonstration : remplace UNIQUEMENT la lecture du QR code.
   *
   * L'identifiant choisi part ensuite dans le même `submitTag` que le vrai
   * scan — donc vraie position GPS, vraie validation serveur, vraie trace.
   * Le serveur peut parfaitement refuser un pointage simulé, et c'est
   * précisément ce qui rend la démonstration honnête.
   *
   * Contrairement à la version NFC, ce mode n'est PAS réservé aux
   * environnements dégradés : la caméra fonctionne partout, y compris dans
   * Expo Go. Il reste utile pour dérouler le parcours sans être physiquement
   * devant l'affiche — en soutenance, ou pour montrer le refus d'une borne
   * inconnue — et il s'annonce toujours comme une simulation.
   */
  const simulateAndSubmit = useCallback(
    async (tagId: string) => {
      locked.current = true;
      setState({
        phase: "scanning",
        result: null,
        error: null,
        errorCode: null,
        source: "simulated",
      });

      const simulated = await simulateTagRead(tagId);
      if (!mounted.current) return false;

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return submitTag(simulated, "simulated");
    },
    [submitTag],
  );

  return {
    state,
    availability,
    openScanner,
    cancelScan,
    handleScan,
    simulateAndSubmit,
    submitTag,
    reset,
    /** La caméra est-elle utilisable sans nouvelle demande de permission ? */
    scannerReady: availability === "READY",
  };
}
