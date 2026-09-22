/**
 * Formatage des dates et distances pour l'affichage mobile.
 *
 * Tout est en français et volontairement court : sur un écran de téléphone,
 * « Auj. 18:30 » est plus lisible que « mercredi 17 septembre 2026 à 18:30 ».
 */

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Ex. « Auj. 18:30 », « Demain 09:00 », « mer. 17 sept. 18:30 ». */
export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (isSameDay(d, now)) return `Auj. ${formatTime(iso)}`;
  if (isSameDay(d, tomorrow)) return `Demain ${formatTime(iso)}`;

  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${formatTime(iso)}`;
}

/** Ex. « Aujourd'hui », « Demain », « mercredi 17 sept. » — en-têtes de liste. */
export function formatDayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (isSameDay(d, now)) return "Aujourd'hui";
  if (isSameDay(d, tomorrow)) return "Demain";

  const long = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  return `${long[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Créneau « 18:30 – 19:30 ». */
export function formatRange(startIso: string, endIso: string) {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

/** Sous le kilomètre, les mètres parlent plus à un piéton. */
export function formatDistance(km: number | null) {
  if (km === null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Compte à rebours court : « dans 25 min », « dans 3 h », « passée ». */
export function formatCountdown(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "en cours ou passée";

  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `dans ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `dans ${hours} h`;

  const days = Math.round(hours / 24);
  return `dans ${days} j`;
}

/**
 * Le pointage n'est ouvert qu'autour de l'heure de début — mêmes bornes que
 * le serveur (±30 min). L'app s'en sert pour mettre en avant la séance
 * pointable du moment, sans jamais décider à la place du serveur.
 */
const CHECK_IN_WINDOW_MIN = 30;

export function isWithinCheckInWindow(startIso: string) {
  const diffMin = Math.abs(new Date(startIso).getTime() - Date.now()) / 60_000;
  return diffMin <= CHECK_IN_WINDOW_MIN;
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Étiquettes lisibles des statuts de réservation. */
export const BOOKING_LABELS: Record<string, string> = {
  BOOKED: "Réservée",
  CONFIRMED: "Confirmée",
  ATTENDED: "Présence validée",
  NO_SHOW: "Absence",
  CANCELLED: "Annulée",
};

export const MEMBERSHIP_LABELS: Record<string, string> = {
  ACTIVE: "Adhésion active",
  PENDING: "Adhésion en attente",
  SUSPENDED: "Adhésion suspendue",
  EXPIRED: "Adhésion expirée",
};
