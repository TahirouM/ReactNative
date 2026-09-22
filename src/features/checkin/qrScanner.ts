/*
  `Camera` porte les fonctions de permission. `expo-camera` ne les exporte pas
  individuellement : seuls cet objet et le hook `useCameraPermissions` le sont.
  Le hook ne convient pas ici — ce module est du code non-React, appelé depuis
  `useCheckIn` au moment où l'utilisateur agit, pas au rendu d'un composant.
*/
import { Camera } from "expo-camera";

/**
 * Couche d'accès au lecteur de QR code.
 *
 * ## Pourquoi ce fichier existe, alors qu'`expo-camera` suffirait
 *
 * Il isole l'écran de scan des détails de la caméra, exactement comme le
 * faisait l'ancien module NFC. L'écran n'a besoin que de deux choses : « le
 * scan est-il possible ici ? » et « voici un identifiant de borne ». Le reste
 * — permission, lecture de plusieurs codes à la suite, contenu illisible —
 * est traité ici.
 *
 * ## Le QR remplace le NFC, pas le parcours
 *
 * Ce qui change : la façon de lire l'identifiant de la borne.
 * Ce qui ne change pas : l'identifiant lui-même, la validation serveur, la
 * position GPS croisée, la trace locale.
 *
 * Le gain est concret : là où le NFC exigeait un module natif absent d'Expo
 * Go, un development build, et — sur iOS — un entitlement Apple accordé au
 * cas par cas, la caméra est disponible sur TOUS les téléphones et fonctionne
 * dans Expo Go. La démonstration du parcours métier ne dépend plus d'une
 * chaîne de compilation.
 *
 * La contrepartie est assumée : un QR code se photographie, donc se recopie
 * plus facilement qu'une puce NFC. C'est précisément pourquoi le serveur
 * croise le code avec la POSITION du téléphone et la fenêtre horaire de la
 * réservation — un code photographié puis présenté depuis le canapé est
 * rejeté.
 */

export type ScannerAvailability =
  /** Permission refusée durablement : seuls les réglages système la rendront. */
  | "DENIED"
  /** Permission jamais demandée, ou refusée une fois et redemandable. */
  | "UNDETERMINED"
  | "READY";

/**
 * Formats acceptés. Volontairement limité au QR : accepter les codes-barres
 * de caisse ferait réagir la caméra à n'importe quel emballage présent dans
 * le champ, et produirait des tentatives de pointage absurdes.
 */
export const BARCODE_TYPES = ["qr"] as const;

/** Erreur de lecture porteuse d'un code exploitable par l'interface. */
export class ScanError extends Error {
  code: "PERMISSION_DENIED" | "EMPTY_CODE" | "FAILED";

  constructor(code: ScanError["code"], message: string) {
    super(message);
    this.name = "ScanError";
    this.code = code;
  }
}

/**
 * État courant de la permission caméra, sans jamais l'afficher à l'utilisateur.
 *
 * Distinguer « jamais demandée » de « refusée » est ce qui permet d'afficher
 * le bon bouton : demander la permission dans le premier cas, renvoyer vers
 * les réglages du téléphone dans le second — une seconde demande système
 * n'apparaîtrait plus, et un bouton sans effet est pire que pas de bouton.
 */
export async function getScannerAvailability(): Promise<ScannerAvailability> {
  try {
    const { status, canAskAgain } = await Camera.getCameraPermissionsAsync();
    if (status === "granted") return "READY";
    return canAskAgain ? "UNDETERMINED" : "DENIED";
  } catch {
    // Un échec ici signifie que le module caméra n'est pas exploitable :
    // on le traite comme un refus, l'écran proposera la saisie du code.
    return "DENIED";
  }
}

/**
 * Demande la permission caméra.
 *
 * Appelée UNIQUEMENT sur geste explicite (l'utilisateur appuie sur « Scanner »),
 * jamais au lancement : la demande arrive alors accompagnée de son contexte,
 * ce qui est à la fois plus honnête et plus efficace.
 */
export async function requestScannerPermission(): Promise<ScannerAvailability> {
  try {
    const { status, canAskAgain } = await Camera.requestCameraPermissionsAsync();
    if (status === "granted") return "READY";
    return canAskAgain ? "UNDETERMINED" : "DENIED";
  } catch {
    return "DENIED";
  }
}

/**
 * Normalise le contenu d'un QR code en identifiant de borne.
 *
 * Deux formes acceptées, dans cet ordre :
 *
 *   1. l'identifiant nu — `nfc-bastille-entree` — c'est ce que le générateur
 *      d'affiches du back-office produit aujourd'hui ;
 *   2. une URL portant l'identifiant en paramètre (`?tag=` ou `?code=`), ou
 *      un lien profond `clubsport://check-in?tag=…`.
 *
 * Pourquoi accepter la seconde forme alors qu'elle n'est pas générée : une
 * affiche produite plus tard, ou par un autre outil, pourrait vouloir être
 * scannable par l'appareil photo natif du téléphone (qui ouvre les URL). En
 * acceptant les deux, une affiche « URL » resterait lisible par l'app sans
 * qu'il faille republier une version. Le coût est de quelques lignes.
 *
 * Le serveur reste seul juge dans tous les cas : il cherche le site
 * correspondant et refuse un identifiant inconnu.
 */
export function normalizeScannedValue(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) return null;

  // Forme URL : on en extrait le paramètre, sinon le dernier segment.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const param =
        url.searchParams.get("tag") ?? url.searchParams.get("code");
      if (param && param.trim().length > 0) return param.trim();

      const segments = url.pathname.split("/").filter(Boolean);
      const last = segments[segments.length - 1];
      return last && last.length > 0 ? decodeURIComponent(last) : null;
    } catch {
      // URL malformée : on retombe sur le traitement en texte brut.
    }
  }

  /*
    Garde-fou de longueur. Un QR quelconque rencontré dans la nature (billet
    de train, étiquette produit, lien wifi) peut contenir des centaines de
    caractères : les envoyer au serveur ne servirait à rien et polluerait le
    journal des tentatives. Un identifiant de borne est court.
  */
  if (value.length > 128) return null;

  return value;
}
