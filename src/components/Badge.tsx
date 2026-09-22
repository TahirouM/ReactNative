import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, typography } from "../theme/tokens";

/**
 * Pastille d'état — transposition de `Badge` de `ui.tsx` (web).
 *
 * Deux règles reprises telles quelles du système web :
 *   - la pastille porte une BORDURE en plus du fond teinté (c'est ce qui la
 *     rattache au style « planning » plutôt qu'à une étiquette pleine) ;
 *   - la couleur ne porte jamais l'information seule : le texte la nomme
 *     toujours, pour rester lisible en cas de daltonisme.
 *
 * Le `tone` désigne un RÔLE, pas une couleur : un même statut garde donc la
 * même teinte dans toute l'app, et l'adaptation clair/sombre se fait ici.
 */
export type BadgeTone = "neutral" | "accent" | "go" | "warn" | "stop" | "court";

export function Badge({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: string;
}) {
  const theme = useTheme();

  const tones: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
    neutral: { bg: theme.cardAlt, fg: theme.muted, border: theme.border },
    accent: { bg: theme.brandSoft, fg: theme.onBrandSoft, border: theme.brand },
    go: { bg: theme.goSoft, fg: theme.go, border: theme.go },
    warn: { bg: theme.warningSoft, fg: theme.warning, border: theme.warning },
    stop: { bg: theme.dangerSoft, fg: theme.danger, border: theme.danger },
    court: { bg: theme.courtSoft, fg: theme.court, border: theme.court },
  };

  const { bg, fg, border } = tones[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {icon ? `${icon} ` : ""}
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    // `rounded-full` : le web réserve le plein rond aux pastilles d'état.
    borderRadius: radius.pill,
    // Bordure semi-transparente côté web (`border-go/30`) : sur mobile on
    // l'approche par une bordure fine de la même teinte.
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-start",
  },
  text: {
    ...typography.tiny,
    fontSize: 12,
  },
});
