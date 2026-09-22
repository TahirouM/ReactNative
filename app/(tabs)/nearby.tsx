import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { SessionCard } from "../../src/components/SessionCard";
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  SkeletonCard,
} from "../../src/components/States";
import { useLocation } from "../../src/features/location/useLocation";
import { useApiResource } from "../../src/hooks/useApiResource";
import { sessionsApi } from "../../src/services/clubsport";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, spacing, typography } from "../../src/theme/tokens";
import type { NearbySession } from "../../src/types/api";
import { formatDateTime, isWithinCheckInWindow } from "../../src/utils/format";

/**
 * Écran « Séances proches » — usage mobile de la géolocalisation.
 *
 * Pourquoi cette valeur n'existe pas sur le web : depuis un ordinateur, on
 * consulte un planning et on lit des adresses. Ici, le téléphone sait OÙ on
 * est, donc la question devient « qu'est-ce qui commence bientôt, près de moi,
 * et où reste-t-il une place ? ». Le tri par distance est fait côté serveur
 * (formule de Haversine) à partir de la position envoyée.
 *
 * La permission n'est demandée qu'au toucher du bouton : l'écran explique
 * d'abord à quoi elle sert. Le refus n'est pas une impasse — on propose la
 * liste des salles pour choisir manuellement.
 */

/** Rayons proposés : un piéton, un cycliste, puis « tout Paris ». */
const RADII = [2, 5, 10, 25];

export default function NearbyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { status, effectiveCoords, error: locationError, request } = useLocation();
  const [radius, setRadiusKm] = useState(5);

  // Une position est nécessaire avant d'interroger l'API : `enabled` empêche
  // un appel réseau inutile tant qu'on ne l'a pas.
  const fetcher = useCallback(
    (signal: AbortSignal) => {
      if (!effectiveCoords) throw new Error("Position requise.");
      return sessionsApi.nearby(effectiveCoords, radius, signal);
    },
    [effectiveCoords, radius],
  );

  const { data, loading, refreshing, error, staleAt, refresh } = useApiResource(
    fetcher,
    [effectiveCoords?.latitude, effectiveCoords?.longitude, radius],
    { cacheKey: "nearby-sessions", enabled: effectiveCoords !== null },
  );

  // Demande la position dès l'arrivée sur CET écran (et non au lancement de
  // l'app) : le geste de l'utilisateur — ouvrir « Proches » — est la
  // justification de la permission.
  useEffect(() => {
    if (status === "idle" && !effectiveCoords) void request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const sessions = data?.sessions ?? [];

  const renderItem = useCallback(
    ({ item }: { item: NearbySession }) => (
      <SessionCard
        activity={item.activity}
        level={item.level}
        siteName={item.site.name}
        city={item.site.city}
        startsAt={item.startsAt}
        endsAt={item.endsAt}
        remainingSeats={item.remainingSeats}
        distanceKm={item.distanceKm}
        checkInOpen={isWithinCheckInWindow(item.startsAt)}
        onPress={() => router.push(`/session/${item.id}`)}
      />
    ),
    [router],
  );

  /** Permission refusée ou service coupé : l'app reste utilisable. */
  const locationBlocked = status === "denied" || status === "disabled" || status === "error";

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={[styles.title, { color: theme.text }]}>Près de moi</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          {effectiveCoords
            ? `Séances à venir dans un rayon de ${radius} km`
            : "Activez la position pour trier les séances par distance"}
        </Text>

        {/* Sélecteur de rayon : réponse directe à une liste vide. */}
        {effectiveCoords ? (
          <View style={styles.radiusRow}>
            {RADII.map((value) => {
              const active = value === radius;
              return (
                <Pressable
                  key={value}
                  onPress={() => setRadiusKm(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Rayon de ${value} kilomètres`}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: active ? theme.brand : theme.card,
                      borderColor: active ? theme.brand : theme.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? theme.brandText : theme.muted },
                    ]}
                  >
                    {value} km
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: spacing.xxl }]}
        // Performance : une liste de séances peut être longue. Ces réglages
        // limitent le nombre de cartes montées simultanément.
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews
        refreshControl={
          effectiveCoords ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={theme.brand}
            />
          ) : undefined
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {staleAt ? (
              <InfoBanner
                tone="warn"
                message={`Hors ligne — liste du ${formatDateTime(staleAt)}.`}
                action={{ label: "Réessayer", onPress: refresh }}
              />
            ) : null}

            {/* Repli quand la position est refusée : l'app ne se bloque pas. */}
            {locationBlocked ? (
              <Card>
                <Text style={[styles.blockTitle, { color: theme.text }]}>
                  Position indisponible
                </Text>
                <Text style={[styles.blockBody, { color: theme.muted }]}>
                  {locationError ??
                    "ClubSport n'a pas accès à votre position."}
                </Text>
                <View style={styles.blockActions}>
                  <Button
                    label="Autoriser la position"
                    onPress={() => void request()}
                    variant="secondary"
                  />
                  <Button
                    label="Choisir une salle manuellement"
                    onPress={() => router.push("/sites")}
                    variant="quiet"
                  />
                </View>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          status === "requesting" || loading ? (
            <View style={styles.list}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : error ? (
            <Card>
              <ErrorState message={error} onRetry={refresh} />
            </Card>
          ) : locationBlocked ? null : !effectiveCoords ? (
            <Card>
              <EmptyState
                emoji="📍"
                title="Où êtes-vous ?"
                message="ClubSport utilise votre position pour afficher d'abord les séances de la salle la plus proche. Elle n'est jamais enregistrée sur nos serveurs."
                action={{ label: "Activer la position", onPress: () => void request() }}
              />
            </Card>
          ) : (
            <Card>
              <EmptyState
                emoji="🔍"
                title={`Rien dans ${radius} km`}
                message="Aucune séance programmée dans ce rayon. Élargissez la recherche pour voir les autres salles du club."
                action={
                  radius < 25
                    ? {
                        label: "Élargir à 25 km",
                        onPress: () => setRadiusKm(25),
                      }
                    : undefined
                }
              />
            </Card>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.display,
  },
  subtitle: {
    ...typography.small,
  },
  radiusRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
  },
  chipText: {
    ...typography.small,
    fontWeight: "700",
  },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  listHeader: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  blockTitle: {
    ...typography.heading,
    marginBottom: spacing.sm,
  },
  blockBody: {
    ...typography.small,
    lineHeight: 20,
  },
  blockActions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
