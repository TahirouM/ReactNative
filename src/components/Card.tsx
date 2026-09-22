import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/tokens";

/**
 * Bloc de contenu — transposition de `Panel` de `ui.tsx` (web).
 *
 * Parti pris hérité du web : ce n'est pas une « carte flottante ». C'est un
 * bloc POSÉ, délimité par un filet net, et l'ombre est réservée aux éléments
 * réellement superposés (aucune ici). `sunk` correspond à `bg-surface-sunk`,
 * pour les zones secondaires et les encarts.
 */
export function Card({
  children,
  style,
  padded = true,
  sunk = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  sunk?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: sunk ? theme.cardAlt : theme.card,
          borderColor: theme.border,
          // `p-5` côté web.
          padding: padded ? spacing.xl - 4 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // `rounded-xl` (12px) : le rayon des blocs de contenu du web.
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
