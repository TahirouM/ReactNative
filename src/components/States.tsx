import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "./Button";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, typography } from "../theme/tokens";

/**
 * États d'interface — transposition de `EmptyState`, `ErrorState`, `Skeleton`
 * et `Alert` de `ui.tsx` (web).
 *
 * Les quatre états exigés par l'énoncé (loading / error / empty / success) sont
 * ici, avec les mêmes partis pris visuels que le web :
 *   - l'écran vide a une bordure EN POINTILLÉS sur fond creusé
 *     (`border-dashed border-rule-strong bg-surface-sunk`) ;
 *   - l'erreur est cerclée de la teinte « stop » sur son propre lavis ;
 *   - un vide n'est jamais une impasse : on explique la situation ET on
 *     propose l'action suivante.
 */

/** Squelette animé — équivalent de `Skeleton` (`animate-pulse`). */
export function SkeletonCard() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.skeleton,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={[styles.line, { backgroundColor: theme.cardAlt, width: "45%" }]} />
      <View style={[styles.line, { backgroundColor: theme.cardAlt, width: "72%" }]} />
      <View style={[styles.line, { backgroundColor: theme.cardAlt, width: "35%" }]} />
    </View>
  );
}

export function LoadingState({ label = "Chargement…" }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered} accessibilityRole="progressbar">
      <ActivityIndicator color={theme.brand} />
      <Text style={[styles.caption, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

/**
 * Erreur récupérable. Toujours accompagnée d'une action : un message d'erreur
 * sans bouton « Réessayer » laisse l'utilisateur sans issue.
 */
export function ErrorState({
  title = "Chargement impossible",
  message,
  onRetry,
  retryLabel = "Réessayer",
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.errorBlock,
        { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
      ]}
    >
      <Text style={[styles.title, { color: theme.danger }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.danger }]}>{message}</Text>
      {onRetry ? (
        <Button
          label={retryLabel}
          onPress={onRetry}
          variant="secondary"
          fullWidth={false}
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
    </View>
  );
}

/** Liste vide légitime — à distinguer d'une erreur. */
export function EmptyState({
  title,
  message,
  action,
}: {
  /** Conservé pour compatibilité d'appel ; le web n'utilise pas d'emoji ici. */
  emoji?: string;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.emptyBlock,
        { backgroundColor: theme.cardAlt, borderColor: theme.borderStrong },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.muted }]}>{message}</Text>
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
          fullWidth={false}
          style={{ marginTop: spacing.xl }}
        />
      ) : null}
    </View>
  );
}

/**
 * Bandeau d'information — équivalent d'`Alert` (web) : bordure + lavis de la
 * teinte sémantique. Sert aux données en cache, permissions refusées, etc.
 */
export function InfoBanner({
  tone = "court",
  message,
  action,
}: {
  tone?: "court" | "warn" | "stop" | "go";
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  const theme = useTheme();

  const tones = {
    court: { bg: theme.courtSoft, fg: theme.court },
    warn: { bg: theme.warningSoft, fg: theme.warning },
    stop: { bg: theme.dangerSoft, fg: theme.danger },
    go: { bg: theme.goSoft, fg: theme.go },
  };
  const { bg, fg } = tones[tone];

  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: fg }]}>
      <Text style={[styles.bannerText, { color: fg }]}>{message}</Text>
      {action ? (
        <Text
          onPress={action.onPress}
          suppressHighlighting
          accessibilityRole="button"
          style={[styles.bannerAction, { color: fg }]}
        >
          {action.label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
  },
  caption: {
    ...typography.small,
  },
  emptyBlock: {
    borderRadius: radius.lg,
    // `border-dashed` : signature de l'écran vide côté web.
    borderWidth: 1,
    borderStyle: "dashed",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl + spacing.md,
    alignItems: "center",
  },
  errorBlock: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  title: {
    ...typography.heading,
    textAlign: "center",
    marginBottom: spacing.sm - 2,
  },
  body: {
    ...typography.small,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 340,
  },
  skeleton: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl - 4,
    gap: spacing.md,
  },
  line: {
    height: 12,
    borderRadius: radius.md,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
  },
  bannerText: {
    ...typography.small,
    flex: 1,
    lineHeight: 19,
  },
  bannerAction: {
    ...typography.tiny,
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
