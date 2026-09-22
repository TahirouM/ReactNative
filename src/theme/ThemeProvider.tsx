import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { darkTheme, lightTheme, type Theme } from "./tokens";

/**
 * Fournit le thème à toute l'application en suivant le réglage du téléphone.
 *
 * Le thème CLAIR est l'identité du produit : c'est celui que le site web
 * impose (`data-theme="light"` sur `<html>`), et la référence visuelle —
 * un planning imprimé punaisé dans un hall — est claire par nature.
 *
 * Le thème sombre existe dans le CSS du web mais y est neutralisé. Sur mobile
 * on l'active, car une app ouverte dans une salle en soirée en a un vrai
 * besoin que le site vitrine n'a pas. `useColorScheme()` réagit au changement
 * système : basculer iOS en mode sombre repeint l'app sans redémarrage.
 */

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  // `useColorScheme` peut renvoyer null au premier rendu : on retombe alors
  // sur le thème clair, identité par défaut du produit.
  const theme = useMemo(() => (scheme === "dark" ? darkTheme : lightTheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
