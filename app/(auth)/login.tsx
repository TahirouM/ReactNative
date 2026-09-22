import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../src/components/Button";
import { InfoBanner } from "../../src/components/States";
import { useAuth } from "../../src/features/auth/AuthProvider";
import { API_URL } from "../../src/services/config";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, spacing, typography } from "../../src/theme/tokens";

/**
 * Écran de connexion.
 *
 * Points d'ergonomie mobile traités ici :
 *   - `KeyboardAvoidingView` : le clavier ne recouvre jamais le bouton ;
 *   - `keyboardType="email-address"` et `autoCapitalize="none"` : saisie
 *     d'e-mail sans majuscule parasite ;
 *   - `returnKeyType="next"` puis `"go"` : on enchaîne au clavier ;
 *   - `textContentType` : propose le trousseau iOS ;
 *   - comptes de démonstration remplissables en un toucher, pour la soutenance.
 */

/**
 * Comptes du jeu de données de démonstration (`npm run db:seed` côté Next.js).
 * Les trois couvrent les cas que l'app doit savoir afficher : adhésion active
 * (réservation autorisée), adhésion non active (refus expliqué par le serveur),
 * et rôle coach.
 */
const DEMO_ACCOUNTS = [
  { label: "Membre · adhésion active", email: "nouveau@clubsport.fr" },
  { label: "Membre · adhésion suspendue", email: "membre@clubsport.fr" },
  { label: "Coach", email: "coach@clubsport.fr" },
];
const DEMO_PASSWORD = "Password123!";

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signingIn, error, clearError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState<"email" | "password" | null>(null);

  const canSubmit = email.trim().length > 3 && password.length > 0 && !signingIn;

  const submit = async () => {
    if (!canSubmit) return;
    await signIn(email, password);
  };

  const fillDemo = (demoEmail: string) => {
    clearError();
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  };

  const inputStyle = (field: "email" | "password") => [
    styles.input,
    {
      backgroundColor: theme.card,
      color: theme.text,
      borderColor: focused === field ? theme.brand : theme.border,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      // `padding` sur iOS remonte le contenu ; `height` convient à Android.
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <View style={[styles.logo, { backgroundColor: theme.brand }]}>
            <Text style={[styles.logoText, { color: theme.brandText }]}>CS</Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>ClubSport</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Vos séances, vos salles, et le pointage de présence sans passer par
            l’accueil.
          </Text>
        </View>

        {error ? (
          <View style={styles.bannerWrap}>
            <InfoBanner tone="stop" message={error} />
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={[styles.label, { color: theme.muted }]}>Adresse e-mail</Text>
          <TextInput
            value={email}
            onChangeText={(value) => {
              clearError();
              setEmail(value);
            }}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused(null)}
            placeholder="vous@exemple.fr"
            placeholderTextColor={theme.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            style={inputStyle("email")}
            accessibilityLabel="Adresse e-mail"
          />

          <Text style={[styles.label, { color: theme.muted, marginTop: spacing.lg }]}>
            Mot de passe
          </Text>
          <TextInput
            value={password}
            onChangeText={(value) => {
              clearError();
              setPassword(value);
            }}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            placeholder="••••••••"
            placeholderTextColor={theme.faint}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            style={inputStyle("password")}
            accessibilityLabel="Mot de passe"
          />

          <Button
            label="Se connecter"
            onPress={submit}
            loading={signingIn}
            disabled={!canSubmit}
            style={{ marginTop: spacing.xl }}
          />
        </View>

        <View style={styles.demoBlock}>
          <Text style={[styles.demoTitle, { color: theme.faint }]}>
            COMPTES DE DÉMONSTRATION
          </Text>
          {DEMO_ACCOUNTS.map((account) => (
            <Pressable
              key={account.email}
              onPress={() => fillDemo(account.email)}
              accessibilityRole="button"
              accessibilityLabel={`Remplir avec ${account.label}`}
              style={({ pressed }) => [
                styles.demoRow,
                {
                  backgroundColor: pressed ? theme.cardAlt : theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.demoLabel, { color: theme.text }]}>
                  {account.label}
                </Text>
                <Text style={[styles.demoEmail, { color: theme.faint }]}>
                  {account.email}
                </Text>
              </View>
              <Text style={[styles.demoArrow, { color: theme.brand }]}>Remplir</Text>
            </Pressable>
          ))}

          {/* Diagnostic affiché en développement : la première cause d'échec
              sur téléphone réel est une mauvaise URL d'API. */}
          {__DEV__ ? (
            <Text style={[styles.apiHint, { color: theme.faint }]}>
              API : {API_URL}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  brandBlock: {
    alignItems: "center",
    gap: spacing.md,
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    ...typography.display,
    fontSize: 23,
  },
  title: {
    ...typography.display,
  },
  subtitle: {
    ...typography.small,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  bannerWrap: {
    marginTop: -spacing.sm,
  },
  form: {
    gap: spacing.xs,
  },
  label: {
    ...typography.tiny,
    marginBottom: spacing.sm,
  },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    ...typography.body,
  },
  demoBlock: {
    gap: spacing.sm,
  },
  demoTitle: {
    ...typography.tiny,
    marginBottom: spacing.xs,
  },
  demoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 58,
  },
  demoLabel: {
    ...typography.small,
    fontWeight: "700",
  },
  demoEmail: {
    ...typography.small,
    marginTop: 2,
  },
  demoArrow: {
    ...typography.tiny,
  },
  apiHint: {
    ...typography.small,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
