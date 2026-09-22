import { useCallback } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { ErrorState, LoadingState } from "../../src/components/States";
import { useLocation } from "../../src/features/location/useLocation";
import { useApiResource } from "../../src/hooks/useApiResource";
import { sitesApi } from "../../src/services/clubsport";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";
import { formatDistance } from "../../src/utils/format";

/**
 * Détail d'une salle — route dynamique `/site/[id]`.
 *
 * Utilité mobile : on y arrive depuis la liste des salles pour savoir comment
 * s'y rendre, ce qu'on y pratique, et quel est l'identifiant de la borne NFC
 * de l'entrée (information utile en soutenance et en cas de doute sur place).
 */
export default function SiteDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { effectiveCoords } = useLocation();

  const fetcher = useCallback(
    (signal: AbortSignal) => sitesApi.list(effectiveCoords, signal),
    // Les coordonnées primitives, et non l'objet : `effectiveCoords` est
    // recréé à chaque rendu, ce qui relancerait la requête en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveCoords?.latitude, effectiveCoords?.longitude],
  );

  const { data, loading, error, refresh } = useApiResource(fetcher, [
    effectiveCoords?.latitude,
    effectiveCoords?.longitude,
  ], { cacheKey: "sites" });

  const site = data?.sites.find((s) => s.id === id) ?? null;

  const openMaps = () => {
    if (!site) return;
    const query = encodeURIComponent(`${site.name}, ${site.address}, ${site.city}`);
    const url = Platform.select({
      ios: `maps://?daddr=${site.latitude},${site.longitude}&q=${query}`,
      android: `geo:${site.latitude},${site.longitude}?q=${query}`,
      default: `https://maps.google.com/?q=${site.latitude},${site.longitude}`,
    });
    void Linking.openURL(url as string);
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <LoadingState label="Chargement de la salle…" />
      </View>
    );
  }

  if (error || !site) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <ErrorState
          title={site ? undefined : "Salle introuvable"}
          message={error ?? "Cette salle n'existe pas ou n'est plus active."}
          onRetry={error ? refresh : () => router.back()}
          retryLabel={error ? "Réessayer" : "Revenir"}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.text }]}>{site.name}</Text>
        <Text style={[styles.address, { color: theme.muted }]}>
          {site.address}, {site.postalCode} {site.city}
        </Text>
        <View style={styles.badges}>
          {site.distanceKm !== null ? (
            <Badge label={formatDistance(site.distanceKm) ?? ""} tone="accent" icon="📍" />
          ) : null}
          <Badge
            label={`${site.upcomingSessions} séance${site.upcomingSessions > 1 ? "s" : ""} à venir`}
            tone="neutral"
          />
        </View>
      </View>

      <Button label="Ouvrir l'itinéraire" onPress={openMaps} />

      {site.activities.length > 0 ? (
        <Card>
          <Text style={[styles.sectionLabel, { color: theme.faint }]}>
            ACTIVITÉS PROPOSÉES
          </Text>
          <View style={styles.activities}>
            {site.activities.map((activity) => (
              <Badge key={activity.slug} label={activity.name} tone="neutral" />
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.sectionLabel, { color: theme.faint }]}>
          BORNE DE POINTAGE
        </Text>
        {site.nfcTagId ? (
          <>
            <Text style={[styles.tag, { color: theme.text }]}>{site.nfcTagId}</Text>
            <Text style={[styles.tagHint, { color: theme.muted }]}>
              Identifiant de la borne NFC installée à l’entrée. Approchez-y votre
              téléphone le jour de votre séance pour valider votre présence.
            </Text>
            <Button
              label="Aller au pointage"
              onPress={() => router.push("/(tabs)/scan")}
              variant="secondary"
              style={{ marginTop: spacing.lg }}
            />
          </>
        ) : (
          <Text style={[styles.tagHint, { color: theme.muted }]}>
            Cette salle n’est pas encore équipée de borne NFC. Présentez-vous à
            l’accueil pour valider votre présence.
          </Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  head: {
    gap: spacing.sm,
  },
  title: {
    ...typography.display,
  },
  address: {
    ...typography.small,
    lineHeight: 20,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    ...typography.tiny,
    marginBottom: spacing.md,
  },
  activities: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tag: {
    // Identifiant de borne : IBM Plex Mono, comme le web (`font-mono`).
    ...typography.monoLarge,
    marginBottom: spacing.sm,
  },
  tagHint: {
    ...typography.small,
    lineHeight: 20,
  },
});
