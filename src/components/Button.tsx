import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { MIN_TOUCH, radius, spacing, typography } from "../theme/tokens";

/**
 * Bouton — transposition de `Button` de `ui.tsx` (web).
 *
 * Les quatre variantes reprennent celles du web :
 *   primary   → fond accent (ocre), texte `accent-ink`
 *   secondary → fond surface + BORDURE nette (`border-rule-strong`)
 *   quiet     → sans fond, texte atténué
 *   danger    → lavis « stop » + bordure de la même teinte
 *
 * Exigences mobiles ajoutées : hauteur minimale 44pt (recommandation Apple),
 * retour visuel au toucher, état de chargement qui empêche le double envoi,
 * et attributs d'accessibilité pour VoiceOver.
 */

type Variant = "primary" | "secondary" | "quiet" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
  style,
}: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const variants: Record<
    Variant,
    { bg: string; fg: string; border: string | null }
  > = {
    primary: { bg: theme.brand, fg: theme.brandText, border: null },
    secondary: { bg: theme.card, fg: theme.text, border: theme.borderStrong },
    quiet: { bg: "transparent", fg: theme.muted, border: null },
    danger: { bg: theme.dangerSoft, fg: theme.danger, border: theme.danger },
  };

  const { bg, fg, border } = variants[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border ?? "transparent",
          borderWidth: border ? StyleSheet.hairlineWidth : 0,
          // `disabled:opacity-45` côté web.
          opacity: isDisabled ? 0.45 : pressed ? 0.86 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          paddingHorizontal: fullWidth ? spacing.lg : spacing.xl,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH + 4,
    // `rounded-lg` (8px) : la forme des boutons du web, franche.
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    ...typography.heading,
    fontSize: 15,
  },
});
