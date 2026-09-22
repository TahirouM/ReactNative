import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge } from "./Badge";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, typography } from "../theme/tokens";
import { formatCountdown, formatDistance, formatRange } from "../utils/format";

/**
 * Carte d'une séance.
 *
 * Reprend la grammaire du planning web : l'HEURE est l'élément d'entrée,
 * posée à gauche en chasse fixe (classe `.nums` côté web → IBM Plex Mono
 * ici), puis un filet vertical, puis le contenu de la séance. C'est la même
 * lecture que le rail d'heures du dashboard.
 *
 * `memo` : ces cartes sont rendues dans une FlatList qui se met à jour à
 * chaque rafraîchissement de position. Sans mémoïsation, faire défiler la
 * liste re-rendrait toutes les cartes visibles à chaque changement d'état du
 * parent — c'est le « re-render évident » que l'énoncé proscrit.
 */

type Props = {
  activity: string;
  level: string;
  siteName: string;
  city: string;
  startsAt: string;
  endsAt: string;
  remainingSeats: number;
  distanceKm: number | null;
  /** Séance dans la fenêtre de pointage : mise en avant visuelle. */
  checkInOpen?: boolean;
  onPress: () => void;
};

function SessionCardComponent({
  activity,
  level,
  siteName,
  city,
  startsAt,
  endsAt,
  remainingSeats,
  distanceKm,
  checkInOpen = false,
  onPress,
}: Props) {
  const theme = useTheme();
  const distance = formatDistance(distanceKm);
  const full = remainingSeats <= 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${activity} à ${siteName}, ${formatRange(startsAt, endsAt)}, ${
        full ? "complet" : `${remainingSeats} places restantes`
      }`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.card,
          // La séance pointable se signale par un filet accentué : l'ocre est
          // réservé à l'action, donc à ce qu'on peut faire maintenant.
          borderColor: checkInOpen ? theme.brand : theme.border,
          borderWidth: checkInOpen ? 1 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {/* Colonne d'heures : le « spine » du planning, en chasse fixe. */}
        <View style={styles.timeColumn}>
          <Text style={[styles.hour, { color: theme.text }]}>
            {formatRange(startsAt, endsAt).split(" – ")[0]}
          </Text>
          <Text style={[styles.endHour, { color: theme.faint }]}>
            {formatRange(startsAt, endsAt).split(" – ")[1]}
          </Text>
        </View>

        {/* Filet vertical, comme le rail du planning mural. */}
        <View style={[styles.rail, { backgroundColor: theme.border }]} />

        <View style={styles.main}>
          <Text style={[styles.activity, { color: theme.text }]} numberOfLines={1}>
            {activity}
          </Text>
          <Text style={[styles.site, { color: theme.muted }]} numberOfLines={1}>
            {siteName} · {city}
          </Text>
          <Text style={[styles.countdown, { color: theme.faint }]}>
            {formatCountdown(startsAt)}
            {distance ? ` · ${distance}` : ""}
          </Text>

          <View style={styles.badges}>
            {checkInOpen ? <Badge label="Pointage ouvert" tone="accent" /> : null}
            {full ? (
              <Badge label="Complet" tone="stop" />
            ) : (
              <Badge
                label={`${remainingSeats} place${remainingSeats > 1 ? "s" : ""}`}
                tone={remainingSeats <= 3 ? "warn" : "neutral"}
              />
            )}
            {level !== "all" ? <Badge label={level} tone="court" /> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export const SessionCard = memo(SessionCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.md,
  },
  timeColumn: {
    width: 46,
    paddingTop: 1,
  },
  hour: {
    ...typography.monoLarge,
    letterSpacing: -0.4,
  },
  endHour: {
    ...typography.mono,
    fontSize: 12,
    marginTop: 2,
  },
  rail: {
    width: 2,
    borderRadius: radius.xs,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  activity: {
    ...typography.heading,
  },
  site: {
    ...typography.small,
  },
  countdown: {
    ...typography.small,
    fontSize: 12,
    marginTop: 1,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm - 2,
    marginTop: spacing.md - 2,
  },
});
