import { useCallback, useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { SessionCard } from "../../src/components/SessionCard";
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  SkeletonCard,
} from "../../src/components/States";
import { useAuth } from "../../src/features/auth/AuthProvider";
import { useApiResource } from "../../src/hooks/useApiResource";
import { bookingsApi } from "../../src/services/clubsport";
import { useTheme } from "../../src/theme/ThemeProvider";
import { spacing, typography } from "../../src/theme/tokens";
import {
  MEMBERSHIP_LABELS,
  formatDateTime,
  formatDayLabel,
  isWithinCheckInWindow,
} from "../../src/utils/format";

/**
 * Écran d'accueil — « qu'est-ce qui m'attend maintenant ? »
 *
 * Ce n'est pas le tableau de bord du site web transposé. Le web affiche des
 * compteurs et des tableaux ; ici on répond à une seule question, celle qu'on
 * se pose en poussant la porte de la salle : quelle est ma prochaine séance,
 * et puis-je pointer tout de suite ?
 *
 * Quand une séance est dans la fenêtre de pointage (±30 min), un raccourci
 * vers le scan NFC apparaît en tête d'écran.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, user } = useAuth();

  // `useCallback` : sans ça, une nouvelle fonction à chaque rendu relancerait
  // la requête en boucle via les dépendances du hook.
  const fetcher = useCallback(
    (signal: AbortSignal) =>
      bookingsApi.list({ scope: "upcoming", limit: 10 }, signal),
    [],
  );

  const { data, loading, refreshing, error, staleAt, refresh } = useApiResource(
    fetcher,
    [],
    { cacheKey: "upcoming-bookings" },
  );

  // Mémoïsé : sans ça, `?? []` crée un nouveau tableau à chaque rendu, ce qui
  // invaliderait le `useMemo` ci-dessous en permanence.
  const bookings = useMemo(() => data?.bookings ?? [], [data]);

  /** Séance pointable maintenant : c'est elle qui déclenche le raccourci NFC. */
  const checkInNow = useMemo(
    () =>
      bookings.find(
        (b) =>
          isWithinCheckInWindow(b.session.startsAt) &&
          (b.status === "BOOKED" || b.status === "CONFIRMED"),
      ) ?? null,
    [bookings],
  );

  const next = bookings[0] ?? null;
  const membershipStatus = profile?.membership?.status ?? null;
  const membershipActive = membershipStatus === "ACTIVE";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxl },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={theme.brand}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.muted }]}>
            {greeting()}
          </Text>
          <Text style={[styles.name, { color: theme.text }]}>
            {user?.firstName ?? "Membre"}
          </Text>
        </View>
        {membershipStatus ? (
          <Badge
            label={MEMBERSHIP_LABELS[membershipStatus] ?? membershipStatus}
            tone={membershipActive ? "accent" : "warn"}
          />
        ) : null}
      </View>

      {staleAt ? (
        <InfoBanner
          tone="warn"
          message={`Hors ligne — données du ${formatDateTime(staleAt)}.`}
          action={{ label: "Réessayer", onPress: refresh }}
        />
      ) : null}

      {/* Adhésion non active : on le dit ICI, avant que le membre tente une
          réservation et se heurte à un refus serveur. */}
      {membershipStatus && !membershipActive ? (
        <InfoBanner
          tone="warn"
          message={`${MEMBERSHIP_LABELS[membershipStatus]} — la réservation de séances est bloquée. Contactez l'accueil du club.`}
        />
      ) : null}

      {/* Raccourci de pointage : l'action du moment, mise au premier plan. */}
      {checkInNow ? (
        <Card style={{ borderColor: theme.brand, borderWidth: 1.5 }}>
          <Badge label="C'est maintenant" tone="accent" icon="⏱" />
          <Text style={[styles.checkInTitle, { color: theme.text }]}>
            {checkInNow.session.activity.name}
          </Text>
          <Text style={[styles.checkInMeta, { color: theme.muted }]}>
            {checkInNow.session.site.name} · {formatDateTime(checkInNow.session.startsAt)}
          </Text>
          <Button
            label="Pointer ma présence"
            onPress={() => router.push("/(tabs)/scan")}
            style={{ marginTop: spacing.lg }}
          />
        </Card>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Mes prochaines séances
        </Text>
        {bookings.length > 0 ? (
          <Text style={[styles.sectionCount, { color: theme.faint }]}>
            {bookings.length}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={refresh} />
        </Card>
      ) : bookings.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🏃"
            title="Aucune séance réservée"
            message="Trouvez une séance près de vous et réservez votre place en deux touchers."
            action={{
              label: "Voir les séances proches",
              onPress: () => router.push("/(tabs)/nearby"),
            }}
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {bookings.map((booking) => (
            <View key={booking.id}>
              <Text style={[styles.dayLabel, { color: theme.faint }]}>
                {formatDayLabel(booking.session.startsAt).toUpperCase()}
              </Text>
              <SessionCard
                activity={booking.session.activity.name}
                level={booking.session.activity.level}
                siteName={booking.session.site.name}
                city={booking.session.site.city}
                startsAt={booking.session.startsAt}
                endsAt={booking.session.endsAt}
                // Une réservation existante n'expose pas les places restantes :
                // la place du membre est déjà prise, l'information n'a pas de sens.
                remainingSeats={1}
                distanceKm={null}
                checkInOpen={isWithinCheckInWindow(booking.session.startsAt)}
                onPress={() => router.push(`/session/${booking.session.id}`)}
              />
            </View>
          ))}
        </View>
      )}

      {next ? (
        <Card style={{ backgroundColor: theme.cardAlt }}>
          <Text style={[styles.tipTitle, { color: theme.text }]}>
            Comment ça marche sur place
          </Text>
          <Text style={[styles.tipBody, { color: theme.muted }]}>
            À votre arrivée, approchez le téléphone de la borne ClubSport posée à
            l’entrée. Votre présence est validée automatiquement — plus besoin de
            passer par l’accueil.
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

/** Salutation selon l'heure : détail qui rend l'app moins générique. */
function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  greeting: {
    ...typography.small,
  },
  name: {
    ...typography.display,
    marginTop: 2,
  },
  checkInTitle: {
    ...typography.title,
    marginTop: spacing.md,
  },
  checkInMeta: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.title,
  },
  sectionCount: {
    ...typography.heading,
  },
  list: {
    gap: spacing.md,
  },
  dayLabel: {
    ...typography.tiny,
    marginBottom: spacing.sm,
  },
  tipTitle: {
    ...typography.heading,
    marginBottom: spacing.sm,
  },
  tipBody: {
    ...typography.small,
    lineHeight: 21,
  },
});
