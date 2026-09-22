import { useCallback, useMemo, useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import {
  ErrorState,
  InfoBanner,
  LoadingState,
} from "../../src/components/States";
import { useAuth } from "../../src/features/auth/AuthProvider";
import { useLocation } from "../../src/features/location/useLocation";
import { useApiResource } from "../../src/hooks/useApiResource";
import { bookingsApi, sessionsApi } from "../../src/services/clubsport";
import { ApiError } from "../../src/services/http";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";
import {
  formatCountdown,
  formatDateTime,
  formatDistance,
  formatRange,
  isWithinCheckInWindow,
} from "../../src/utils/format";

/**
 * Détail d'une séance — route dynamique `/session/[id]`.
 *
 * L'API mobile n'expose pas de route « une séance par identifiant » : on
 * réutilise `/api/sessions/nearby` (large rayon) et la liste des réservations,
 * puis on retrouve la séance demandée. Choix assumé : ça évite d'ajouter un
 * endpoint côté Next.js pour une donnée déjà transmise, au prix d'un filtrage
 * côté client sur une liste bornée à 100 entrées.
 *
 * L'écran couvre les deux situations : séance réservable (bouton Réserver) et
 * séance déjà réservée (rappel du pointage, annulation possible).
 */

/** Rayon volontairement large : on cherche une séance précise, pas une liste. */
const LOOKUP_RADIUS_KM = 100;

export default function SessionDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, refreshProfile } = useAuth();
  const { effectiveCoords } = useLocation();

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Position de repli : sans localisation, on interroge depuis le centre de
  // Paris, ce qui couvre les salles du club. Les distances affichées sont
  // alors sans objet et masquées.
  const origin = effectiveCoords ?? { latitude: 48.8566, longitude: 2.3522 };

  const fetcher = useCallback(
    async (signal: AbortSignal) => {
      const [nearby, mine] = await Promise.all([
        sessionsApi.nearby(origin, LOOKUP_RADIUS_KM, signal),
        bookingsApi.list({ limit: 50 }, signal),
      ]);
      return { nearby, mine };
    },
    // Primitives et non l'objet `origin`, recréé à chaque rendu : sans ça la
    // requête repartirait en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin.latitude, origin.longitude],
  );

  const { data, loading, error, refresh } = useApiResource(fetcher, [
    id,
    origin.latitude,
    origin.longitude,
  ]);

  const session = useMemo(
    () => data?.nearby.sessions.find((s) => s.id === id) ?? null,
    [data, id],
  );

  /** Réservation existante du membre pour cette séance, s'il y en a une. */
  const booking = useMemo(
    () =>
      data?.mine.bookings.find(
        (b) => b.session.id === id && b.status !== "CANCELLED",
      ) ?? null,
    [data, id],
  );

  const membershipActive = profile?.membership?.status === "ACTIVE";

  const book = async () => {
    if (!id) return;
    setSubmitting(true);
    setActionError(null);
    setActionOk(null);
    try {
      await bookingsApi.create(id);
      setActionOk("Votre place est réservée.");
      refresh();
      void refreshProfile();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Réservation impossible.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!booking) return;
    setSubmitting(true);
    setActionError(null);
    setActionOk(null);
    try {
      await bookingsApi.cancel(booking.id);
      setActionOk("Réservation annulée.");
      refresh();
      void refreshProfile();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Annulation impossible.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** Ouvre l'itinéraire dans l'app de cartes du téléphone. */
  const openMaps = (latitude: number, longitude: number, label: string) => {
    const query = encodeURIComponent(label);
    const url = Platform.select({
      ios: `maps://?daddr=${latitude},${longitude}&q=${query}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${query})`,
      default: `https://maps.google.com/?q=${latitude},${longitude}`,
    });
    void Linking.openURL(url as string);
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <LoadingState label="Chargement de la séance…" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <ErrorState message={error} onRetry={refresh} />
      </View>
    );
  }

  // La séance peut avoir disparu (annulée, déjà passée) : cas normal, traité.
  const source = session ?? booking?.session ?? null;
  if (!source) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <ErrorState
          title="Séance introuvable"
          message="Cette séance n'est plus programmée ou a déjà eu lieu."
          onRetry={() => router.back()}
          retryLabel="Revenir"
        />
      </View>
    );
  }

  const activityName =
    session?.activity ?? booking?.session.activity.name ?? "Séance";
  const level = session?.level ?? booking?.session.activity.level ?? "all";
  const site = session?.site ?? booking?.session.site ?? null;
  const distance = session?.distanceKm ?? null;
  const seats = session?.remainingSeats ?? null;
  const checkInOpen = isWithinCheckInWindow(source.startsAt);
  const isPast = new Date(source.startsAt) <= new Date();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.text }]}>{activityName}</Text>
        <View style={styles.headBadges}>
          {checkInOpen ? <Badge label="Pointage ouvert" tone="accent" icon="📲" /> : null}
          {booking ? <Badge label="Vous êtes inscrit" tone="court" /> : null}
          {level !== "all" ? <Badge label={level} tone="neutral" /> : null}
        </View>
      </View>

      {actionOk ? <InfoBanner tone="court" message={actionOk} /> : null}
      {actionError ? <InfoBanner tone="stop" message={actionError} /> : null}

      <Card>
        <Row label="Date" value={formatDateTime(source.startsAt)} theme={theme} />
        <Divider theme={theme} />
        <Row
          label="Horaire"
          value={formatRange(source.startsAt, source.endsAt)}
          theme={theme}
        />
        <Divider theme={theme} />
        <Row
          label="Début"
          value={isPast ? "séance commencée" : formatCountdown(source.startsAt)}
          theme={theme}
        />
        {seats !== null ? (
          <>
            <Divider theme={theme} />
            <Row
              label="Places restantes"
              value={seats > 0 ? String(seats) : "complet"}
              theme={theme}
              highlight={seats <= 3}
            />
          </>
        ) : null}
        {booking?.session.coach ? (
          <>
            <Divider theme={theme} />
            <Row label="Coach" value={booking.session.coach} theme={theme} />
          </>
        ) : null}
      </Card>

      {site ? (
        <Card>
          <Text style={[styles.sectionLabel, { color: theme.faint }]}>SALLE</Text>
          <Text style={[styles.siteName, { color: theme.text }]}>{site.name}</Text>
          <Text style={[styles.siteMeta, { color: theme.muted }]}>
            {"address" in site ? `${site.address}, ` : ""}
            {site.city}
          </Text>
          {distance !== null ? (
            <Text style={[styles.siteDistance, { color: theme.brand }]}>
              {formatDistance(distance)} de votre position
            </Text>
          ) : null}

          <Button
            label="Ouvrir l'itinéraire"
            onPress={() => openMaps(site.latitude, site.longitude, site.name)}
            variant="secondary"
            style={{ marginTop: spacing.lg }}
          />
        </Card>
      ) : null}

      {/* Rappel du pointage quand la séance est imminente. */}
      {booking && checkInOpen ? (
        <Card style={{ borderColor: theme.brand, borderWidth: 1.5 }}>
          <Text style={[styles.pointTitle, { color: theme.text }]}>
            Vous pouvez pointer
          </Text>
          <Text style={[styles.pointBody, { color: theme.muted }]}>
            Approchez votre téléphone de la borne à l’entrée de {site?.name ?? "la salle"}.
          </Text>
          <Button
            label="Pointer ma présence"
            onPress={() => router.push("/(tabs)/scan")}
            style={{ marginTop: spacing.lg }}
          />
        </Card>
      ) : null}

      {/* Action principale : dépend de l'état réel côté serveur. */}
      {booking ? (
        booking.status === "ATTENDED" ? (
          <InfoBanner
            tone="court"
            message={`Présence validée${
              booking.checkInMethod === "nfc" ? " par NFC" : ""
            }${booking.checkedInAt ? ` le ${formatDateTime(booking.checkedInAt)}` : ""}.`}
          />
        ) : isPast ? null : (
          <Button
            label="Annuler ma réservation"
            onPress={cancel}
            variant="danger"
            loading={submitting}
          />
        )
      ) : isPast ? (
        <InfoBanner tone="warn" message="Cette séance est déjà passée." />
      ) : seats !== null && seats <= 0 ? (
        <InfoBanner
          tone="warn"
          message="Cette séance est complète. Réessayez plus tard : des places se libèrent souvent."
        />
      ) : !membershipActive ? (
        <InfoBanner
          tone="warn"
          message="Votre adhésion doit être active pour réserver. Contactez l'accueil du club."
        />
      ) : (
        <Button label="Réserver ma place" onPress={book} loading={submitting} />
      )}
    </ScrollView>
  );
}

function Row({
  label,
  value,
  theme,
  highlight = false,
}: {
  label: string;
  value: string;
  theme: { muted: string; text: string; warning: string };
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.muted }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: highlight ? theme.warning : theme.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Divider({ theme }: { theme: { border: string } }) {
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
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
    gap: spacing.md,
  },
  title: {
    ...typography.display,
  },
  headBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md - 2,
  },
  rowLabel: {
    ...typography.small,
  },
  rowValue: {
    ...typography.small,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    ...typography.tiny,
    marginBottom: spacing.sm,
  },
  siteName: {
    ...typography.heading,
  },
  siteMeta: {
    ...typography.small,
    marginTop: 2,
  },
  siteDistance: {
    ...typography.small,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  pointTitle: {
    ...typography.heading,
  },
  pointBody: {
    ...typography.small,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});
