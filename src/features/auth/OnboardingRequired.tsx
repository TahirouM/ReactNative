import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { useAuth } from "./AuthProvider";
import { API_URL } from "../../services/config";
import { useTheme } from "../../theme/ThemeProvider";
import { spacing, typography } from "../../theme/tokens";

/**
 * Écran affiché quand le compte n'a pas terminé son onboarding.
 *
 * ## Pourquoi cet écran existe
 *
 * Le serveur refuse TOUTES les routes métier tant que `user.onboarded` est
 * faux — sites, séances, réservations, pointage — avec un 403
 * `ONBOARDING_REQUIRED` (voir `lib/api-auth.ts` côté Next.js). C'est
 * délibéré : un membre sans salle de rattachement ni formule d'adhésion ne
 * peut pas réserver.
 *
 * Sans cet écran, l'app laissait l'utilisateur entrer puis échouer sur chaque
 * onglet avec un « Onboarding non terminé. » brut, sans jamais dire quoi
 * faire. C'est un cul-de-sac : le message décrit l'obstacle sans indiquer la
 * sortie. On préfère bloquer TÔT et expliquer, plutôt que laisser découvrir le
 * refus écran par écran.
 *
 * ## Pourquoi on renvoie vers le web
 *
 * Le formulaire d'onboarding (choix de la salle, formule, téléphone) vit sur
 * le site Next.js. Le reproduire dans l'app dupliquerait une validation
 * métier à deux endroits, pour un parcours qu'on ne traverse qu'une fois dans
 * la vie d'un compte. On ouvre donc le navigateur système sur la bonne page,
 * puis on rafraîchit le profil au retour.
 *
 * `openAuthSessionAsync` plutôt que `openBrowserAsync` : la première partage
 * les cookies avec le navigateur du téléphone, donc l'utilisateur déjà
 * connecté sur le site n'a pas à ressaisir son mot de passe.
 */
export function OnboardingRequired() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  const openOnboarding = useCallback(async () => {
    setBusy(true);
    try {
      await WebBrowser.openAuthSessionAsync(
        `${API_URL}/fr/onboarding`,
        // Pas de redirection de retour : l'utilisateur ferme l'onglet
        // lui-même. On ne peut donc pas se fier à la valeur retournée, d'où
        // la revérification explicite ci-dessous.
        `${API_URL}/fr/dashboard`,
      );
    } catch {
      // Navigateur indisponible : le bouton « J'ai terminé » reste la sortie.
    } finally {
      setBusy(false);
    }
    // Au retour, on redemande le profil : si l'onboarding est allé au bout,
    // `onboarded` passe à vrai et le navigateur racine bascule tout seul.
    await refreshProfile();
    setChecked(true);
  }, [refreshProfile]);

  const recheck = useCallback(async () => {
    setBusy(true);
    await refreshProfile();
    setChecked(true);
    setBusy(false);
  }, [refreshProfile]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>
        Encore une étape
      </Text>
      <Text style={[styles.intro, { color: theme.muted }]}>
        {user?.firstName ? `${user.firstName}, votre` : "Votre"} compte est bien
        créé, mais votre inscription n’est pas terminée : il reste à choisir
        votre salle et votre formule d’adhésion.
      </Text>

      <Card>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Pourquoi c’est nécessaire
        </Text>
        {[
          "Votre salle de rattachement détermine les séances qui vous sont proposées.",
          "Votre formule d’adhésion conditionne le droit de réserver.",
          "Sans ces deux informations, la réservation et le pointage sont impossibles.",
        ].map((line) => (
          <View key={line} style={styles.row}>
            <Text style={[styles.bullet, { color: theme.brand }]}>•</Text>
            <Text style={[styles.rowText, { color: theme.muted }]}>{line}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.actions}>
        <Button
          label="Terminer mon inscription"
          onPress={() => void openOnboarding()}
          loading={busy}
        />
        {/* Sortie de secours : si l'utilisateur a fini l'inscription sur un
            autre appareil, rien ne doit l'obliger à repasser par le bouton
            ci-dessus pour que l'app s'en aperçoive. */}
        <Button
          label="J’ai déjà terminé, vérifier"
          onPress={() => void recheck()}
          variant="secondary"
          disabled={busy}
        />
        <Button
          label="Se déconnecter"
          onPress={() => void signOut()}
          variant="quiet"
          disabled={busy}
        />
      </View>

      {/* N'apparaît qu'APRÈS une vérification infructueuse : afficher d'emblée
          « toujours pas terminé » accuserait l'utilisateur de ne rien avoir
          fait avant qu'il ait eu l'occasion d'essayer. */}
      {checked && user && !user.onboarded ? (
        <Text style={[styles.note, { color: theme.warning }]}>
          L’inscription n’est toujours pas enregistrée. Terminez le formulaire
          jusqu’à la dernière étape, puis revenez ici.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    ...typography.display,
  },
  intro: {
    ...typography.body,
    lineHeight: 23,
  },
  cardTitle: {
    ...typography.heading,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bullet: {
    ...typography.small,
    fontWeight: "900",
  },
  rowText: {
    ...typography.small,
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.sm,
  },
  note: {
    ...typography.small,
    lineHeight: 20,
    textAlign: "center",
  },
});
