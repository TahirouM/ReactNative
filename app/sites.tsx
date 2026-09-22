import { useCallback } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Badge } from "../src/components/Badge";
import { Card } from "../src/components/Card";
import { EmptyState, ErrorState, SkeletonCard } from "../src/components/States";
import { useLocation } from "../src/features/location/useLocation";
import { useApiResource } from "../src/hooks/useApiResource";
import { sitesApi } from "../src/services/clubsport";
import { useTheme } from "../src/theme/ThemeProvider";
import { radius, spacing, typography } from "../src/theme/tokens";
import type { Site } from "../src/types/api";
import { formatDistance } from "../src/utils/format";

/**
 * Liste des salles du club.
 *
 * Sert de repli quand la géolocalisation est refusée : le membre choisit sa
 * salle à la main au lieu de se voir refuser l'accès à l'information. Quand la
 * position est disponible, la liste est triée par distance côté serveur.
 */
export default function SitesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { effectiveCoords } = useLocation();

  const fetcher = useCallback(
    (signal: AbortSignal) => sitesApi.list(effectiveCoords, signal),
    // Les coordonnées primitives, et non l'objet : `effectiveCoords` est
    // recréé à chaque rendu, ce qui relancerait la requête en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveCoords?.latitude, effectiveCoords?.longitude],
  );

  const { data, loading, refreshing, error, refresh } = useApiResource(
    fetcher,
    [effectiveCoords?.latitude, effectiveCoords?.longitude],
    { cacheKey: "sites" },
  );

  const renderItem = useCallback(
    ({ item }: { item: Site }) => (
      <Pressable
        onPress={() => router.push(`/site/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.city}`}
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
      >
        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.city, { color: theme.muted }]} numberOfLines={1}>
                {item.address}, {item.city}
              </Text>
            </View>
            {item.distanceKm !== null ? (
              <View style={[styles.distance, { backgroundColor: theme.cardAlt }]}>
                <Text style={[styles.distanceText, { color: theme.text }]}>
                  {formatDistance(item.distanceKm)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.badges}>
            <Badge
              label={`${item.upcomingSessions} séance${item.upcomingSessions > 1 ? "s" : ""}`}
              tone={item.upcomingSessions > 0 ? "accent" : "neutral"}
            />
            {item.nfcTagId ? <Badge label="Borne NFC" tone="court" icon="📲" /> : null}
          </View>
        </Card>
      </Pressable>
    ),
    [router, theme],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={data?.sites ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.brand}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: spacing.md }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : error ? (
            <Card>
              <ErrorState message={error} onRetry={refresh} />
            </Card>
          ) : (
            <Card>
              <EmptyState
                emoji="🏢"
                title="Aucune salle"
                message="Le club n'a pas encore de salle enregistrée."
              />
            </Card>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  name: {
    ...typography.heading,
  },
  city: {
    ...typography.small,
    marginTop: 2,
  },
  distance: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  distanceText: {
    ...typography.tiny,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
