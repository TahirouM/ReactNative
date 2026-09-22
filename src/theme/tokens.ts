/**
 * Jetons de design — repris du système visuel du site web ClubSport.
 *
 * Les valeurs ne sont PAS inventées : elles sont transposées une à une depuis
 * `../nextjs/src/app/globals.css`, pour que l'app mobile et le web soient
 * manifestement le même produit.
 *
 * Référence visuelle (identique au web) : le planning imprimé punaisé dans le
 * hall d'un gymnase, et les lignes peintes au sol d'un terrain. Trois partis
 * pris qui en découlent :
 *   - des blocs posés séparés par des filets nets, pas des cartes flottantes ;
 *   - un seul accent chaud (ocre vernis / laiton) réservé à l'action ;
 *   - le rayon d'arrondi encode la hiérarchie — faible pour les surfaces,
 *     plein rond seulement pour les pastilles d'état.
 *
 * Adaptation mobile assumée : le web s'appuie sur `backdrop-filter` pour son
 * effet « verre ». React Native ne le propose pas de façon fiable sur une
 * liste défilante (coût de rendu). On restitue donc les surfaces avec leur
 * équivalent OPAQUE (`--surface-solid`), ce que le web lui-même prévoit
 * explicitement dans son `@supports not (backdrop-filter)`.
 */

/** Thème clair — c'est le seul actif sur le site public (`data-theme="light"`). */
export const lightTheme = {
  mode: "light" as const,

  /* Fond papier : le web y superpose deux halos radiaux très diffus.
     `bgTintA` (froid) et `bgTintB` (chaud) servent aux dégradés d'en-tête. */
  bg: "#f4f6fa",
  bgTintA: "#e8eef7",
  bgTintB: "#faf3ec",

  /* Surfaces — équivalents opaques des plaques translucides du web. */
  card: "#ffffff",
  cardAlt: "#e9eef6",

  /* Encre : gris-bleu profond, plus juste que le noir sur un fond froid. */
  text: "#16202e",
  muted: "#5a6678",
  faint: "#8b95a5",

  /* Filets nets — la séparation structurante du planning. */
  border: "#dfe4ec",
  borderStrong: "#c3cad6",

  /* Accent : vernis de parquet / laiton. Réservé à l'action. */
  brand: "#a8560f",
  brandHover: "#8e4709",
  brandText: "#fffdf9",
  brandSoft: "#f7e7d5",
  onBrandSoft: "#8e4709",

  /* Bleu terrain : information et liens secondaires. */
  court: "#1f4e79",
  courtSoft: "#e4ecf4",

  /* États sémantiques. La couleur ne porte jamais l'information seule. */
  go: "#1a6b45",
  goSoft: "#e2efe8",
  warning: "#8a5a08",
  warningSoft: "#f6eddb",
  danger: "#a32b21",
  dangerSoft: "#f6e3e1",

  overlay: "rgba(22, 32, 46, 0.45)",
  shadow: "#16202e",
};

/**
 * Thème sombre — « gymnase le soir : parquet sombre, pas de noir d'encre ».
 *
 * Présent et complet dans le CSS du web, mais neutralisé sur le site public.
 * Sur mobile on l'active : une app ouverte dans une salle en soirée a un vrai
 * besoin que le site vitrine n'a pas.
 */
export const darkTheme = {
  mode: "dark" as const,

  bg: "#14161a",
  bgTintA: "#161d29",
  bgTintB: "#1e1a16",

  card: "#1b1e23",
  cardAlt: "#22262e",

  text: "#f0ede7",
  muted: "#a3a8b0",
  faint: "#7c828c",

  border: "#2b2f37",
  borderStrong: "#3c414b",

  brand: "#e2913f",
  brandHover: "#f0a458",
  brandText: "#1a1207",
  brandSoft: "#2e2114",
  onBrandSoft: "#e2913f",

  court: "#7aa9d6",
  courtSoft: "#1b2733",

  go: "#6cc196",
  goSoft: "#16281f",
  warning: "#e0b45c",
  warningSoft: "#2a2213",
  danger: "#ef9891",
  dangerSoft: "#2e1917",

  overlay: "rgba(0, 0, 0, 0.6)",
  shadow: "#000000",
};

/**
 * Le type décrit les deux palettes : `mode` est l'union des deux valeurs.
 * Sans cet élargissement, TypeScript inférerait `mode: "light"` depuis
 * `lightTheme` et refuserait le thème sombre.
 */
export type Theme = Omit<typeof lightTheme, "mode"> & {
  mode: "light" | "dark";
};

/** Échelle d'espacement : multiples de 4, pour un rythme vertical régulier. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Rayons — transposés de l'échelle Tailwind utilisée par le web.
 * Le web emploie surtout `rounded-sm` (2px) et `rounded-xl` (12px) : des
 * formes franches, très loin des grands arrondis. `pill` est réservé aux
 * pastilles d'état, comme dans `ui.tsx`.
 */
export const radius = {
  xs: 2,   // rounded-sm  — filets, cases à cocher
  sm: 6,   // rounded-md
  md: 8,   // rounded-lg  — boutons, champs
  lg: 12,  // rounded-xl  — blocs de contenu
  xl: 16,  // rounded-2xl — surfaces mises en avant
  pill: 999,
} as const;

/**
 * Typographie.
 *
 * Le web utilise **Archivo** sur son axe de largeur (`wdth`) : titres en
 * large, texte courant en normal — le lettrage rappelle les typographies
 * peintes sur les murs de gymnase et les dossards. **IBM Plex Mono**
 * n'intervient que là où des caractères doivent s'aligner en colonne :
 * heures, identifiants de bornes NFC, coordonnées GPS.
 *
 * `fontFamily` est appliqué via `useFonts` (voir src/theme/fonts.ts) ; ces
 * définitions ne portent que tailles, graisses et interlettrage.
 */
export const typography = {
  display: {
    fontFamily: "Archivo_700Bold",
    fontSize: 30,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: "Archivo_700Bold",
    fontSize: 21,
    letterSpacing: -0.3,
  },
  heading: {
    fontFamily: "Archivo_600SemiBold",
    fontSize: 16,
    letterSpacing: -0.1,
  },
  body: { fontFamily: "Archivo_400Regular", fontSize: 15 },
  small: { fontFamily: "Archivo_400Regular", fontSize: 13 },
  tiny: {
    fontFamily: "Archivo_500Medium",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  /** Chiffres alignés en colonne — heures, tags NFC, coordonnées. */
  mono: { fontFamily: "IBMPlexMono_400Regular", fontSize: 13 },
  monoLarge: { fontFamily: "IBMPlexMono_500Medium", fontSize: 15 },
} as const;

/**
 * Cible tactile minimale recommandée par Apple et Google (44pt / 48dp).
 * Utilisée par tous les composants pressables de l'app.
 */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const MIN_TOUCH = 44;
