import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

import { readCache, writeCache } from "../../storage/cache";

/**
 * Accès à la position du téléphone.
 *
 * Principes imposés par l'énoncé et appliqués ici :
 *
 *   - la permission n'est PAS demandée au lancement de l'app. Elle l'est au
 *     moment où l'utilisateur demande « les séances près de moi », geste qui
 *     explique de lui-même à quoi sert la position ;
 *   - le refus est un état normal, pas une erreur : l'app continue de
 *     fonctionner avec un repli (voir `status: "denied"`) ;
 *   - la position n'est PAS suivie en continu. Un `watchPosition` viderait la
 *     batterie sans rien apporter : on lit une position ponctuelle, et
 *     l'utilisateur rafraîchit quand il se déplace.
 */

export type Coords = { latitude: number; longitude: number };

export type LocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  /** Service de localisation coupé au niveau du téléphone. */
  | "disabled"
  | "error";

const CACHE_KEY = "last-position";

export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<Coords | null>(null);
  /** Position issue du cache : sert de repli tant qu'aucune lecture récente. */
  const [lastKnown, setLastKnown] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Dernière position connue, relue au montage : permet d'afficher une liste
  // pertinente immédiatement, avant toute demande de permission.
  useEffect(() => {
    (async () => {
      const cached = await readCache<Coords>(CACHE_KEY);
      if (cached && mounted.current) setLastKnown(cached.data);
    })();
  }, []);

  /**
   * Demande la permission si nécessaire puis lit la position.
   * Retourne les coordonnées, ou `null` si l'utilisateur a refusé.
   */
  const request = useCallback(async (): Promise<Coords | null> => {
    setStatus("requesting");
    setError(null);

    try {
      // Le service peut être désactivé globalement : le message doit alors
      // parler des réglages du téléphone, pas d'un refus de l'utilisateur.
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        if (mounted.current) {
          setStatus("disabled");
          setError(
            "La localisation est désactivée sur votre téléphone. Activez-la dans Réglages pour voir les séances proches.",
          );
        }
        return null;
      }

      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== "granted") {
        if (mounted.current) {
          setStatus("denied");
          setError(
            "Sans votre position, ClubSport ne peut pas trier les séances par distance. Vous pouvez choisir une salle manuellement.",
          );
        }
        return null;
      }

      // `Balanced` suffit largement : on compare des distances en kilomètres
      // entre des salles séparées de plusieurs rues. Demander `BestForNavigation`
      // serait plus lent et plus coûteux en batterie pour aucun gain.
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const next: Coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      if (mounted.current) {
        setCoords(next);
        setLastKnown(next);
        setStatus("granted");
      }
      await writeCache(CACHE_KEY, next);
      return next;
    } catch {
      if (mounted.current) {
        setStatus("error");
        setError("Position introuvable. Réessayez près d'une fenêtre.");
      }
      return null;
    }
  }, []);

  /**
   * Lit la position uniquement si la permission est DÉJÀ accordée.
   * Utilisé par le pointage NFC : on ne veut pas ouvrir une demande de
   * permission au milieu d'un scan, mais on profite de la position si elle
   * est disponible pour renforcer la validation côté serveur.
   */
  const getIfAlreadyGranted = useCallback(async (): Promise<Coords | null> => {
    try {
      const { status: permission } = await Location.getForegroundPermissionsAsync();
      if (permission !== "granted") return null;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next: Coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      if (mounted.current) {
        setCoords(next);
        setLastKnown(next);
      }
      await writeCache(CACHE_KEY, next);
      return next;
    } catch {
      return null;
    }
  }, []);

  return {
    status,
    coords,
    lastKnown,
    error,
    request,
    getIfAlreadyGranted,
    /** Position exploitable : lecture fraîche, sinon dernière connue. */
    effectiveCoords: coords ?? lastKnown,
  };
}
