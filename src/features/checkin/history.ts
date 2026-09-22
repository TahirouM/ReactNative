import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Journal local des tentatives de pointage.
 *
 * L'énoncé exige une « trace de l'action scan / GPS » qui survive à la
 * fermeture de l'app. La source de vérité reste le serveur (statut ATTENDED de
 * la réservation), mais ce journal apporte ce que le serveur ne garde pas :
 *
 *   - les tentatives REFUSÉES (mauvaise salle, hors créneau, trop loin) ;
 *   - la distance mesurée au moment du scan ;
 *   - l'identifiant de borne présenté.
 *
 * C'est donc un journal de bord d'appareil, consultable hors ligne.
 */

/*
  La clé de stockage garde son nom historique `nfc:history`. La renommer
  ferait disparaître, à la mise à jour de l'app, les pointages déjà consignés
  sur le téléphone des membres — un journal qui s'efface tout seul ne vaut
  rien comme trace. Le contenu, lui, a bien changé de nature.
*/
const KEY = "nfc:history";
/** Borne haute : un journal illimité finirait par ralentir la lecture. */
const MAX_ENTRIES = 50;

export type CheckInEntry = {
  at: string;
  site: string | null;
  activity: string | null;
  outcome: "success" | "error";
  message: string;
  distanceKm: number | null;
  tagId: string;
  /**
   * Provenance de l'identifiant. Conservée dans le journal pour que rien ne
   * puisse se faire passer pour autre chose :
   *   `qr`        — QR code réellement lu par la caméra ;
   *   `nfc`       — carte lue par l'antenne du téléphone (entrées d'avant le
   *                 passage au QR code : on ne réécrit pas l'histoire) ;
   *   `simulated` — mode démonstration (lecture remplacée, reste réel) ;
   *   `manual`    — code saisi au clavier.
   *
   * Optionnelle : les entrées écrites avant l'ajout de ce champ n'en ont pas.
   * L'interface les affiche alors sans mention de provenance.
   */
  source?: "qr" | "nfc" | "simulated" | "manual";
};

export async function appendCheckIn(entry: CheckInEntry) {
  try {
    const current = await readCheckInHistory();
    const next = [entry, ...current].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Le pointage lui-même a réussi côté serveur : ne pas le faire échouer
    // parce que le journal local n'a pas pu être écrit.
  }
}

export async function readCheckInHistory(): Promise<CheckInEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CheckInEntry[]) : [];
  } catch {
    return [];
  }
}

export async function clearCheckInHistory() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Sans conséquence fonctionnelle.
  }
}
