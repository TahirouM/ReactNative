import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";

import { AuthProvider, useAuth } from "../src/features/auth/AuthProvider";
import { OnboardingRequired } from "../src/features/auth/OnboardingRequired";
import { useAppFonts } from "../src/theme/fonts";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";

/**
 * Racine de la navigation.
 *
 * Deux responsabilités, volontairement séparées :
 *   - `RootLayout` installe les fournisseurs (thème, session, Safe Area) ;
 *   - `RootNavigator` décide QUEL groupe de routes est accessible selon
 *     l'état de la session.
 *
 * L'écran de démarrage (splash) reste affiché tant que la session n'est pas
 * tranchée : sans ça, l'utilisateur verrait l'écran de connexion clignoter
 * avant d'être redirigé vers l'accueil alors qu'il était déjà connecté.
 */

// Empêche le masquage automatique : c'est `RootNavigator` qui décide du moment.
void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();
  const fontsReady = useAppFonts();

  useEffect(() => {
    if (status === "loading" || !fontsReady) return;

    void SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === "(auth)";

    // Garde de navigation : on ne rend pas un écran protégé puis on redirige,
    // on remplace la route. `replace` évite qu'un retour arrière ramène sur
    // un écran auquel l'utilisateur n'a plus droit.
    if (status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (status === "authenticated" && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [status, segments, router, fontsReady]);

  // Afficher le texte en police système puis le voir sauter en Archivo est
  // plus dérangeant qu'une attente courte : on garde le splash.
  if (status === "loading" || !fontsReady) {
    return (
      <View style={[styles.splash, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.brand} size="large" />
      </View>
    );
  }

  /*
    Compte authentifié mais onboarding inachevé.

    Le serveur refuse toutes les routes métier dans cet état (403
    ONBOARDING_REQUIRED) : laisser entrer dans les onglets produirait une
    erreur sur chaque écran, sans jamais dire comment en sortir. On bloque
    donc ici, avec la marche à suivre.

    Ce n'est PAS une redirection : l'écran remplace la navigation tant que la
    condition tient, et disparaît de lui-même dès que `onboarded` passe à vrai
    (au retour du navigateur, ou au rafraîchissement du profil).
  */
  if (status === "authenticated" && user && !user.onboarded) {
    return (
      <>
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <OnboardingRequired />
      </>
    );
  }

  return (
    <>
      {/* La barre d'état suit le thème : texte clair sur fond sombre. */}
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: "700" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
          // Geste de retour natif iOS : attendu sur mobile.
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Route dynamique : détail d'une séance, ouvert depuis les listes. */}
        <Stack.Screen
          name="session/[id]"
          options={{ title: "Séance", presentation: "card" }}
        />
        <Stack.Screen
          name="site/[id]"
          options={{ title: "Salle", presentation: "card" }}
        />
        <Stack.Screen name="sites" options={{ title: "Les salles du club" }} />
        <Stack.Screen name="+not-found" options={{ title: "Introuvable" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
