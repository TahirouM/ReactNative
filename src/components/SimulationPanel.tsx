import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge } from "./Badge";
import { Card } from "./Card";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, typography } from "../theme/tokens";
import type { SimulatedTag } from "../features/checkin/simulator";

/**
 * Panneau de démonstration du pointage.
 *
 * Permet de dérouler le parcours métier complet sans être physiquement devant
 * l'affiche de la salle, et de montrer le refus d'une borne inconnue —
 * qu'aucune affiche réelle ne produit.
 *
 * Choix d'interface important : le panneau ANNONCE ce qu'il est. Il porte la
 * mention « mode démonstration », explique quelle étape est remplacée, et
 * rappelle que la validation reste celle du serveur. Une simulation déguisée
 * en vrai scan serait malhonnête — et l'énoncé sanctionne explicitement le
 * « scan simulé sans usage métier ».
 */
export function SimulationPanel({
  tags,
  loading,
  onSimulate,
  disabled,
}: {
  tags: SimulatedTag[];
  loading: boolean;
  onSimulate: (tagId: string) => void;
  disabled: boolean;
}) {
  const theme = useTheme();

  return (
    <Card sunk>
      <View style={styles.header}>
        <Badge label="Mode démonstration" tone="warn" />
      </View>

      <Text style={[styles.title, { color: theme.text }]}>
        Simuler le scan d’une borne
      </Text>
      <Text style={[styles.body, { color: theme.muted }]}>
        Seule la lecture du QR code est remplacée. La position GPS, la
        validation par le serveur et l’enregistrement de la présence sont
        réels — le pointage peut donc être refusé.
      </Text>

      {loading ? (
        <Text style={[styles.loading, { color: theme.faint }]}>
          Chargement des bornes du club…
        </Text>
      ) : tags.length === 0 ? (
        <Text style={[styles.loading, { color: theme.faint }]}>
          Aucune borne disponible. Vérifiez que le serveur est accessible.
        </Text>
      ) : (
        <View style={styles.list}>
          {tags.map((tag) => (
            <Pressable
              key={tag.tagId}
              onPress={() => onSimulate(tag.tagId)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Simuler la borne ${tag.label}`}
              accessibilityState={{ disabled }}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? theme.cardAlt : theme.card,
                  borderColor: theme.border,
                  opacity: disabled ? 0.45 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>
                  {tag.label}
                </Text>
                <Text style={[styles.rowPurpose, { color: theme.faint }]}>
                  {tag.purpose}
                </Text>
                {/* Identifiant en chasse fixe : c'est un code, comme côté web. */}
                <Text style={[styles.rowTag, { color: theme.faint }]} numberOfLines={1}>
                  {tag.tagId}
                </Text>
              </View>
              <Text style={[styles.arrow, { color: theme.brand }]}>◉</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
  },
  body: {
    ...typography.small,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  loading: {
    ...typography.small,
    marginTop: spacing.lg,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 58,
  },
  rowLabel: {
    ...typography.heading,
    fontSize: 15,
  },
  rowPurpose: {
    ...typography.small,
    fontSize: 12,
    marginTop: 1,
  },
  rowTag: {
    ...typography.mono,
    fontSize: 11,
    marginTop: 3,
  },
  arrow: {
    fontSize: 17,
  },
});
