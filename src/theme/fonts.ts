import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  useFonts,
} from "@expo-google-fonts/archivo";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from "@expo-google-fonts/ibm-plex-mono";

/**
 * Polices du produit — les mêmes que le site web.
 *
 * **Archivo** pour tout le texte. Le web l'exploite sur son axe de LARGEUR
 * (`wdth`) : titres en large, texte courant en normal, ce qui rappelle les
 * typographies peintes sur les murs de gymnase et les dossards. Les polices
 * variables n'étant pas chargeables par axe dans React Native, on restitue
 * cette hiérarchie par les GRAISSES statiques (600/700 pour les titres).
 *
 * **IBM Plex Mono** uniquement là où des caractères doivent s'aligner en
 * colonne : heures, identifiants de bornes NFC, coordonnées GPS. C'est la
 * même règle que le web, où la classe `.nums` passe en chasse fixe.
 */

/** Noms de familles à passer dans `fontFamily`. */
export const fontFamily = {
  regular: "Archivo_400Regular",
  medium: "Archivo_500Medium",
  semibold: "Archivo_600SemiBold",
  bold: "Archivo_700Bold",
  /** Chiffres comparables — équivalent de `.nums` côté web. */
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
} as const;

/**
 * Charge les polices au démarrage. Retourne `true` quand elles sont prêtes.
 *
 * Tant que c'est `false`, le layout racine maintient l'écran de démarrage :
 * afficher le texte en police système puis le voir sauter en Archivo une
 * fraction de seconde plus tard est plus dérangeant qu'une attente courte.
 */
export function useAppFonts() {
  const [loaded, error] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  // En cas d'échec de chargement (réseau coupé au premier lancement), on
  // laisse l'app démarrer avec la police système plutôt que de la bloquer.
  return loaded || error !== null;
}
