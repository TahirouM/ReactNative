import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { QrScannerView } from "../../src/components/QrScannerView";
import { SimulationPanel } from "../../src/components/SimulationPanel";
import { InfoBanner } from "../../src/components/States";
import { useCheckIn } from "../../src/features/checkin/useCheckIn";
import { buildSimulatedTags } from "../../src/features/checkin/simulator";
import { useApiResource } from "../../src/hooks/useApiResource";
import { sitesApi } from "../../src/services/clubsport";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, spacing, typography } from "../../src/theme/tokens";
import { formatDistance, formatTime } from "../../src/utils/format";

/**
 * Écran de pointage par QR code — la raison d'être de l'application mobile.
 *
 * Le parcours complet exigé par l'énoncé se joue ici :
 *   affiche de la salle → scan du QR → position GPS → validation serveur →
 *   retour utilisateur (visuel + haptique) → trace dans l'historique.
 *
 * L'écran est un automate à quatre états (`idle`, `scanning`, `submitting`,
 * `success`/`error`) : à aucun moment l'utilisateur ne fait face à un écran
 * figé sans savoir ce qui se passe.
 *
 * ## Pourquoi le QR code plutôt que le NFC
 *
 * Le NFC imposait un module natif absent d'Expo Go, un development build, et
 * sur iOS un entitlement Apple accordé au cas par cas — le scan était donc
 * indisponible pour une grande partie des utilisateurs, et la démonstration
 * du parcours métier dépendait d'une chaîne de compilation.
 *
 * La caméra est présente sur tous les téléphones et fonctionne dans Expo Go.
 * Côté club, une affiche s'imprime depuis le back-office (/admin/bornes) et
 * se remplace pour le prix d'une feuille de papier, là où une borne NFC est
 * un achat de matériel.
 *
 * La contrepartie — un QR se photographie, donc se recopie — est traitée là
 * où elle doit l'être : le serveur croise le code avec la POSITION du
 * téléphone et la fenêtre horaire de la réservation.
 */
export default function ScanScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    state,
    availability,
    openScanner,
    cancelScan,
    handleScan,
    simulateAndSubmit,
    submitTag,
    reset,
    scannerReady,
  } = useCheckIn();

  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");

  // Les bornes simulables viennent des salles RÉELLES du club : aucun
  // identifiant n'est codé en dur dans l'app.
  const sitesFetcher = useCallback(
    (signal: AbortSignal) => sitesApi.list(null, signal),
    [],
  );
  const { data: sitesData, loading: sitesLoading } = useApiResource(
    sitesFetcher,
    [],
    { cacheKey: "sites" },
  );

  const simulatedTags = useMemo(
    () => buildSimulatedTags(sitesData?.sites ?? []),
    [sitesData],
  );

  const busy = state.phase === "scanning" || state.phase === "submitting";

  /**
   * Message d'aide quand la caméra n'est pas utilisable.
   *
   * Seul le refus DÉFINITIF mérite une explication permanente : tant que la
   * permission n'a jamais été demandée, le bouton « Scanner » la demandera
   * lui-même, et afficher un avertissement par avance inquiéterait pour rien.
   */
  const unavailableMessage =
    availability === "DENIED"
      ? "ClubSport n’a pas accès à l’appareil photo. Autorisez-le dans les réglages de votre téléphone (Réglages → ClubSport → Appareil photo) pour scanner la borne. En attendant, la saisie du code ci-dessous permet de valider votre présence."
      : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/*
        La vue caméra est un `Modal` : elle se superpose à cet écran quand on
        scanne, et se démonte à la fermeture (caméra réellement relâchée).
      */}
      <QrScannerView
        visible={state.phase === "scanning" && state.source === "qr"}
        onScan={(value) => void handleScan(value)}
        onCancel={cancelScan}
        busy={state.phase === "submitting"}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Pointer</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Scannez le QR code affiché à l’entrée de la salle.
          </Text>
        </View>

        {/* ── Succès ─────────────────────────────────────────────────────── */}
        {state.phase === "success" && state.result ? (
          <Card style={{ borderColor: theme.brand, borderWidth: 1.5 }}>
            <View style={styles.successHead}>
              <View style={[styles.successIcon, { backgroundColor: theme.goSoft }]}>
                <Text style={[styles.successGlyph, { color: theme.go }]}>✓</Text>
              </View>
              <Badge label="Présence validée" tone="go" />
              {/* Une présence obtenue en mode démo est étiquetée comme telle :
                  la capture d'écran ne doit pas pouvoir tromper. */}
              {state.source === "simulated" ? (
                <Badge label="Simulé" tone="warn" />
              ) : null}
              {state.source === "manual" ? (
                <Badge label="Code saisi" tone="warn" />
              ) : null}
            </View>

            <Text style={[styles.successTitle, { color: theme.text }]}>
              {state.result.session.activity}
            </Text>
            <Text style={[styles.successMeta, { color: theme.muted }]}>
              {state.result.site} · pointé à{" "}
              {formatTime(state.result.booking.checkedInAt)}
            </Text>

            {/* Preuve que les deux signaux ont bien été croisés. */}
            <View style={[styles.proofBox, { backgroundColor: theme.cardAlt }]}>
              <ProofRow
                label="Borne"
                value={
                  state.source === "qr"
                    ? "QR code lu et reconnu"
                    : state.source === "simulated"
                      ? "identifiant simulé, reconnu"
                      : "code saisi, reconnu"
                }
                theme={theme}
              />
              <ProofRow
                label="Position"
                value={
                  state.result.distanceKm === null
                    ? "non transmise"
                    : `${formatDistance(state.result.distanceKm)} de la salle`
                }
                theme={theme}
              />
              <ProofRow
                label="Enregistrement"
                value="validé par le serveur"
                theme={theme}
              />
            </View>

            <View style={styles.successActions}>
              <Button
                label="Voir mes séances"
                onPress={() => {
                  reset();
                  router.push("/(tabs)/bookings");
                }}
              />
              <Button label="Pointer à nouveau" onPress={reset} variant="quiet" />
            </View>
          </Card>
        ) : null}

        {/* ── Échec ──────────────────────────────────────────────────────── */}
        {state.phase === "error" ? (
          <Card style={{ borderColor: theme.danger, borderWidth: 1 }}>
            <Badge label="Pointage refusé" tone="stop" icon="✕" />
            <Text style={[styles.errorTitle, { color: theme.text }]}>
              {state.error}
            </Text>

            {/* Aide contextuelle : le message seul ne dit pas quoi faire. */}
            <Text style={[styles.errorHelp, { color: theme.muted }]}>
              {errorHelp(state.errorCode)}
            </Text>

            <Button
              label="Réessayer"
              onPress={() => {
                // Après un refus de permission, réessayer le scan rouvrirait
                // la même impasse : on revient à l'écran, qui propose la
                // saisie du code.
                if (state.errorCode === "PERMISSION_DENIED") reset();
                else void openScanner();
              }}
              variant="secondary"
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        ) : null}

        {/* ── Zone de scan ───────────────────────────────────────────────── */}
        {state.phase !== "success" ? (
          <Card>
            <Pressable
              onPress={() => void openScanner()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir l’appareil photo pour scanner le QR code de la borne"
              accessibilityState={{ disabled: busy, busy }}
              style={({ pressed }) => [
                styles.target,
                {
                  borderColor: theme.brand,
                  backgroundColor: pressed ? theme.cardAlt : "transparent",
                  opacity: busy ? 0.6 : 1,
                },
              ]}
            >
              {busy ? (
                <>
                  <ActivityIndicator color={theme.brand} size="large" />
                  <Text style={[styles.targetLabel, { color: theme.text }]}>
                    Validation en cours…
                  </Text>
                  <Text style={[styles.targetHint, { color: theme.faint }]}>
                    Vérification de votre réservation
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.targetGlyph}>⬚</Text>
                  <Text style={[styles.targetLabel, { color: theme.text }]}>
                    Scanner le QR code
                  </Text>
                  <Text style={[styles.targetHint, { color: theme.faint }]}>
                    {scannerReady
                      ? "L’appareil photo s’ouvre à votre demande"
                      : "L’accès à l’appareil photo vous sera demandé"}
                  </Text>
                </>
              )}
            </Pressable>

            {availability === null ? (
              <Text style={[styles.checking, { color: theme.faint }]}>
                Vérification de l’appareil photo…
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* ── Caméra refusée : explication + repli ───────────────────────── */}
        {unavailableMessage ? (
          <InfoBanner tone="court" message={unavailableMessage} />
        ) : null}

        {/* Mode démonstration. Contrairement à la version NFC, il reste
            disponible même quand la caméra fonctionne : il sert à montrer le
            refus d'une borne inconnue et à dérouler le parcours sans être
            devant l'affiche. Il s'annonce toujours comme une simulation. */}
        {state.phase !== "success" ? (
          <SimulationPanel
            tags={simulatedTags}
            loading={sitesLoading}
            disabled={busy}
            onSimulate={(tagId) => void simulateAndSubmit(tagId)}
          />
        ) : null}

        {/* Saisie manuelle du code de borne. Déclenche la même route serveur
            que le scan : c'est un mode de secours, pas un contournement — le
            serveur exige toujours une réservation et le bon créneau. */}
        {state.phase !== "success" ? (
          <Card>
            <Pressable
              onPress={() => setManualOpen((open) => !open)}
              accessibilityRole="button"
              style={styles.manualHeader}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.manualTitle, { color: theme.text }]}>
                  Saisir le code de la borne
                </Text>
                <Text style={[styles.manualHint, { color: theme.faint }]}>
                  Si l’affiche est abîmée ou l’appareil photo indisponible
                </Text>
              </View>
              <Text style={[styles.chevron, { color: theme.muted }]}>
                {manualOpen ? "▾" : "▸"}
              </Text>
            </Pressable>

            {manualOpen ? (
              <View style={styles.manualBody}>
                <TextInput
                  value={manualCode}
                  onChangeText={setManualCode}
                  placeholder="nfc-bastille-entree"
                  placeholderTextColor={theme.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={() => {
                    if (manualCode.trim()) void submitTag(manualCode.trim());
                  }}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.bg,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  accessibilityLabel="Code de la borne"
                />
                <Button
                  label="Valider ma présence"
                  onPress={() => void submitTag(manualCode.trim())}
                  disabled={manualCode.trim().length === 0}
                  loading={state.phase === "submitting"}
                />
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card style={{ backgroundColor: theme.cardAlt }}>
          <Text style={[styles.ruleTitle, { color: theme.text }]}>
            Ce que vérifie le serveur
          </Text>
          {[
            "Le QR code correspond à une salle du club.",
            "Vous avez une réservation dans CETTE salle.",
            "La séance commence dans les 30 minutes (avant ou après).",
            "Votre position, si autorisée, est cohérente avec la salle.",
          ].map((rule) => (
            <View key={rule} style={styles.ruleRow}>
              <Text style={[styles.ruleBullet, { color: theme.brand }]}>•</Text>
              <Text style={[styles.ruleText, { color: theme.muted }]}>{rule}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Ligne de « preuve » affichée après un pointage réussi. */
function ProofRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: { muted: string; text: string };
}) {
  return (
    <View style={styles.proofRow}>
      <Text style={[styles.proofLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.proofValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

/** Traduit un code d'erreur en conseil actionnable. */
function errorHelp(code: string | null): string {
  switch (code) {
    case "UNKNOWN_TAG":
      return "Ce QR code n'est associé à aucune salle du club. Vérifiez que vous scannez bien l'affiche de l'entrée.";
    case "NO_BOOKING":
      return "Le pointage n'est possible que pour une séance réservée dans cette salle, dans les 30 minutes autour de son début.";
    case "TOO_FAR":
      return "La position de votre téléphone ne correspond pas à celle de la salle. Le pointage à distance n'est pas autorisé.";
    case "UNREADABLE_CODE":
      return "Le code lu ne ressemble pas à un identifiant de borne ClubSport. Scannez l'affiche posée à l'entrée de la salle.";
    case "PERMISSION_DENIED":
      return "Autorisez l'appareil photo dans les réglages de votre téléphone, ou saisissez le code inscrit sous le QR de l'affiche.";
    case "UNAUTHENTICATED":
      return "Votre session a expiré. Reconnectez-vous pour pointer.";
    default:
      return "Réessayez. Si le problème persiste, présentez-vous à l'accueil du club.";
  }
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    ...typography.display,
  },
  subtitle: {
    ...typography.small,
    lineHeight: 20,
  },
  target: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: radius.xl,
    paddingVertical: spacing.xxl + spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    minHeight: 190,
  },
  targetGlyph: {
    fontSize: 44,
  },
  targetLabel: {
    ...typography.heading,
  },
  targetHint: {
    ...typography.small,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  checking: {
    ...typography.small,
    textAlign: "center",
    marginTop: spacing.md,
  },
  successHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  successGlyph: {
    ...typography.title,
    fontSize: 21,
  },
  successTitle: {
    ...typography.title,
    marginTop: spacing.lg,
  },
  successMeta: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  proofBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  proofRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  proofLabel: {
    ...typography.small,
  },
  proofValue: {
    ...typography.small,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  successActions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  errorTitle: {
    ...typography.heading,
    marginTop: spacing.md,
    lineHeight: 23,
  },
  errorHelp: {
    ...typography.small,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  manualHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 44,
  },
  manualTitle: {
    ...typography.heading,
  },
  manualHint: {
    ...typography.small,
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
  },
  manualBody: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    ...typography.body,
  },
  ruleTitle: {
    ...typography.heading,
    marginBottom: spacing.md,
  },
  ruleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  ruleBullet: {
    ...typography.small,
    fontWeight: "900",
  },
  ruleText: {
    ...typography.small,
    flex: 1,
    lineHeight: 20,
  },
});
