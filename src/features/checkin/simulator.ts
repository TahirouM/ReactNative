import type { Site } from "../../types/api";

/**
 * Simulateur de lecture — mode démonstration.
 *
 * ## Ce qui est simulé, et ce qui ne l'est PAS
 *
 * Le simulateur remplace UNE SEULE étape du parcours : la lecture du QR code
 * par la caméra. Il produit un identifiant de borne, exactement comme un scan
 * réel le ferait.
 *
 * Tout le reste du parcours demeure réel :
 *   - la position GPS est lue sur le vrai capteur ;
 *   - l'identifiant part au vrai serveur (`POST /api/check-in`) ;
 *   - le serveur applique ses vraies règles (salle, réservation, créneau,
 *     distance) et peut donc REFUSER le pointage simulé ;
 *   - la réservation est vraiment passée en `ATTENDED` en base ;
 *   - la trace est vraiment écrite dans l'historique local.
 *
 * Autrement dit : ce n'est pas une fausse donnée, c'est un vrai pointage dont
 * seule la lecture du code est remplacée. C'est la différence entre un mode de
 * test honnête et le « scan simulé sans usage métier » que le cahier des
 * charges sanctionne.
 *
 * ## Pourquoi ce mode existe encore
 *
 * Du temps du NFC, il compensait une impossibilité technique : le module natif
 * est absent d'Expo Go. Avec le QR code, la caméra fonctionne partout — ce
 * mode n'est donc plus un palliatif, mais un outil de démonstration :
 *
 *   - dérouler le parcours sans être physiquement devant l'affiche ;
 *   - montrer le refus d'une borne inconnue, qu'aucune affiche ne produit ;
 *   - présenter le parcours sur un simulateur iOS, dépourvu de caméra.
 *
 * Il s'annonce toujours comme une simulation, jusque dans le journal et sur
 * l'écran de succès : une capture d'écran ne doit pas pouvoir tromper.
 */

/** Une borne proposée à la simulation. */
export type SimulatedTag = {
  /** Identifiant envoyé au serveur — c'est ce que l'affiche contient. */
  tagId: string;
  /** Libellé affiché sur le bouton. */
  label: string;
  /** Ce que ce choix permet de démontrer. */
  purpose: string;
  /** Position de la salle, pour expliquer un éventuel refus GPS. */
  coords: { latitude: number; longitude: number } | null;
};

/**
 * Identifiant volontairement absent de la base : démontre la gestion du cas
 * « borne inconnue » (404 `UNKNOWN_TAG`), que l'énoncé demande de traiter.
 */
export const UNKNOWN_TAG_ID = "nfc-borne-non-enregistree";

/**
 * Construit la liste des bornes simulables à partir des salles RÉELLES
 * renvoyées par l'API. Les identifiants ne sont donc jamais codés en dur :
 * si un administrateur change le tag d'une salle côté web, la simulation
 * suit automatiquement.
 */
export function buildSimulatedTags(sites: Site[]): SimulatedTag[] {
  const fromSites = sites
    // Une salle sans borne installée n'a rien à simuler.
    .filter((site) => site.nfcTagId !== null)
    .map<SimulatedTag>((site) => ({
      tagId: site.nfcTagId as string,
      label: site.name.replace(/^ClubSport\s+/, ""),
      purpose:
        site.upcomingSessions > 0
          ? `${site.upcomingSessions} séance${site.upcomingSessions > 1 ? "s" : ""} à venir`
          : "aucune séance programmée",
      coords: { latitude: site.latitude, longitude: site.longitude },
    }));

  return [
    ...fromSites,
    {
      tagId: UNKNOWN_TAG_ID,
      label: "Borne inconnue",
      purpose: "démontre le refus d'un tag non enregistré",
      coords: null,
    },
  ];
}

/**
 * Simule la lecture d'un QR code.
 *
 * Le délai reproduit le temps réel d'un scan : viser l'affiche, laisser la
 * caméra faire la mise au point, obtenir la lecture. Sans lui, la
 * démonstration passerait directement à l'état « validation », ce qui
 * masquerait l'étape de lecture et donnerait une idée fausse du parcours.
 */
const READ_DELAY_MS = 600;

export function simulateTagRead(tagId: string): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(tagId), READ_DELAY_MS);
  });
}
