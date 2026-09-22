import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "../src/components/Button";
import { useTheme } from "../src/theme/ThemeProvider";
import { spacing, typography } from "../src/theme/tokens";

/**
 * Route inconnue. Atteignable par un lien profond obsolète
 * (`clubsport://session/xxx`) : mieux vaut une sortie claire qu'un écran vide.
 */
export default function NotFoundScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={styles.emoji}>🧭</Text>
      <Text style={[styles.title, { color: theme.text }]}>Page introuvable</Text>
      <Text style={[styles.body, { color: theme.muted }]}>
        Ce lien ne correspond à aucun écran de l’application.
      </Text>
      <Button
        label="Revenir à l'accueil"
        onPress={() => router.replace("/(tabs)")}
        fullWidth={false}
        style={{ marginTop: spacing.xl }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emoji: {
    fontSize: 40,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.small,
    textAlign: "center",
    lineHeight: 20,
  },
});
