import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, type BadgeTone } from "../../src/components/Badge";
import { Card } from "../../src/components/Card";
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  SkeletonCard,
} from "../../src/components/States";
import { useApiResource } from "../../src/hooks/useApiResource";
import { bookingsApi } from "../../src/services/clubsport";
import { ApiError } from "../../src/services/http";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, spacing, typography } from "../../src/theme/tokens";
import type { Booking, BookingStatus } from "../../src/types/api";
import {
  BOOKING_LABELS,
  formatDateTime,
  formatRange,
} from "../../src/utils/format";

/**
 * Mes séances — réservations à venir et historique.
 *
 * Deux onglets internes plutôt que deux écrans : le membre bascule entre
 * « ce qui m'attend » et « ce que j'ai fait » sans quitter la vue.
 *
 * L'historique est paginé au défilement (curseur renvoyé par l'API) : on ne
 * charge pas 200 réservations pour en afficher 5.
 */

type Scope = "upcoming" | "past";

export default function BookingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [scope, setScope] = useState<Scope>("upcoming");
  /** Pages suivantes, ajoutées au défilement. */
  const [extra, setExtra] = useState<Booking[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetcher = useCallback(
    (signal: AbortSignal) => bookingsApi.list({ scope, limit: 15 }, signal),
    [scope],
  );

  const { data, loading, refreshing, error, staleAt, refresh } = useApiResource(
    fetcher,
    [scope],
    { cacheKey: `bookings-${scope}` },
  );

  /** Réinitialise la pagination quand on change d'onglet ou qu'on rafraîchit. */
  const resetPaging = useCallback(() => {
    setExtra([]);
    setCursor(null);
  }, []);

  const changeScope = (next: Scope) => {
    if (next === scope) return;
    resetPaging();
    setActionError(null);
    setScope(next);
  };

  const onRefresh = useCallback(() => {
    resetPaging();
    refresh();
  }, [refresh, resetPaging]);

  const firstPage = data?.bookings ?? [];
  const items = [...firstPage, ...extra];
  const nextCursor = cursor ?? data?.nextCursor ?? null;

  /** Page suivante au défilement. Gardes multiples pour éviter les doublons. */
  const loadMore = useCallback(async () => {
    if (loadingMore || !nextCursor || loading) return;

    setLoadingMore(true);
    try {
      const page = await bookingsApi.list({ scope, limit: 15, cursor: nextCursor });
      setExtra((prev) => [...prev, ...page.bookings]);
      setCursor(page.nextCursor);
    } catch {
      // Pagination : un échec ne doit pas effacer ce qui est déjà affiché.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, loading, scope]);

  const cancel = useCallback(
    async (booking: Booking) => {
      setCancelling(booking.id);
      setActionError(null);
      try {
        await bookingsApi.cancel(booking.id);
        resetPaging();
        refresh();
      } catch (err) {
        setActionError(
          err instanceof ApiError ? err.message : "Annulation impossible.",
        );
      } finally {
        setCancelling(null);
      }
    },
    [refresh, resetPaging],
  );

  const renderItem = useCallback(
    ({ item }: { item: Booking }) => (
      <BookingRow
        booking={item}
        cancelling={cancelling === item.id}
        onOpen={() => router.push(`/session/${item.session.id}`)}
        onCancel={() => void cancel(item)}
      />
    ),
    [cancel, cancelling, router],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={[styles.title, { color: theme.text }]}>Mes séances</Text>

        <View style={[styles.segment, { backgroundColor: theme.cardAlt }]}>
          {(
            [
              { key: "upcoming", label: "À venir" },
              { key: "past", label: "Historique" },
            ] as const
          ).map((tab) => {
            const active = tab.key === scope;
            return (
              <Pressable
                key={tab.key}
                onPress={() => changeScope(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[
                  styles.segmentItem,
                  active && { backgroundColor: theme.card },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? theme.text : theme.muted },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: spacing.xxl }]}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews
        onEndReached={() => void loadMore()}
        // 0.4 : déclenche le chargement avant d'atteindre le bas, pour que la
        // page suivante soit prête quand l'utilisateur y arrive.
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brand}
          />
        }
        ListHeaderComponent={
          staleAt || actionError ? (
            <View style={styles.listHeader}>
              {staleAt ? (
                <InfoBanner
                  tone="warn"
                  message={`Hors ligne — données du ${formatDateTime(staleAt)}.`}
                  action={{ label: "Réessayer", onPress: onRefresh }}
                />
              ) : null}
              {actionError ? (
                <InfoBanner tone="stop" message={actionError} />
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.list}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : error ? (
            <Card>
              <ErrorState message={error} onRetry={onRefresh} />
            </Card>
          ) : (
            <Card>
              <EmptyState
                emoji={scope === "upcoming" ? "🗓️" : "📜"}
                title={
                  scope === "upcoming"
                    ? "Aucune séance à venir"
                    : "Pas encore d'historique"
                }
                message={
                  scope === "upcoming"
                    ? "Réservez une séance depuis l'onglet « Proches » pour la voir apparaître ici."
                    : "Vos séances passées et vos pointages de présence s'afficheront ici."
                }
                action={
                  scope === "upcoming"
                    ? {
                        label: "Trouver une séance",
                        onPress: () => router.push("/(tabs)/nearby"),
                      }
                    : undefined
                }
              />
            </Card>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={theme.brand} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

/** Ligne de réservation. Séparée pour rester lisible et mémoïsable. */
function BookingRow({
  booking,
  cancelling,
  onOpen,
  onCancel,
}: {
  booking: Booking;
  cancelling: boolean;
  onOpen: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const { session, status } = booking;

  // « go » pour une présence constatée, « court » (bleu terrain) pour une
  // réservation en attente : mêmes rôles sémantiques que le web.
  const tones: Record<BookingStatus, BadgeTone> = {
    BOOKED: "court",
    CONFIRMED: "court",
    ATTENDED: "go",
    NO_SHOW: "warn",
    CANCELLED: "neutral",
  };

  // Seule une réservation encore active et à venir peut être annulée.
  const cancellable =
    (status === "BOOKED" || status === "CONFIRMED") &&
    new Date(session.startsAt) > new Date();

  return (
    <Card>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${session.activity.name}, ${BOOKING_LABELS[status]}`}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={styles.rowHead}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
              {session.activity.name}
            </Text>
            <Text style={[styles.rowMeta, { color: theme.muted }]} numberOfLines={1}>
              {session.site.name} · {session.site.city}
            </Text>
          </View>
          <Badge label={BOOKING_LABELS[status] ?? status} tone={tones[status]} />
        </View>

        <View style={[styles.rowTime, { borderTopColor: theme.border }]}>
          <Text style={[styles.rowDate, { color: theme.text }]}>
            {formatDateTime(session.startsAt)}
          </Text>
          <Text style={[styles.rowRange, { color: theme.faint }]}>
            {formatRange(session.startsAt, session.endsAt)}
          </Text>
        </View>

        {/* Trace du pointage : c'est la preuve visible de l'action NFC. */}
        {booking.checkedInAt ? (
          <View style={[styles.checkIn, { backgroundColor: theme.brandSoft }]}>
            <Text style={[styles.checkInText, { color: theme.onBrandSoft }]}>
              {booking.checkInMethod === "nfc" ? "📲 Pointé par NFC" : "✓ Pointé"}
              {" · "}
              {formatDateTime(booking.checkedInAt)}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {cancellable ? (
        <Pressable
          onPress={onCancel}
          disabled={cancelling}
          accessibilityRole="button"
          accessibilityLabel="Annuler cette réservation"
          style={({ pressed }) => [
            styles.cancel,
            {
              borderTopColor: theme.border,
              opacity: cancelling ? 0.5 : pressed ? 0.7 : 1,
            },
          ]}
        >
          {cancelling ? (
            <ActivityIndicator color={theme.danger} size="small" />
          ) : (
            <Text style={[styles.cancelText, { color: theme.danger }]}>
              Annuler ma réservation
            </Text>
          )}
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  title: {
    ...typography.display,
  },
  segment: {
    flexDirection: "row",
    borderRadius: radius.md,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.sm + 1,
    alignItems: "center",
    minHeight: 40,
    justifyContent: "center",
  },
  segmentText: {
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
  footer: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  rowTitle: {
    ...typography.heading,
  },
  rowMeta: {
    ...typography.small,
    marginTop: 2,
  },
  rowTime: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowDate: {
    ...typography.body,
    fontWeight: "700",
  },
  rowRange: {
    ...typography.small,
  },
  checkIn: {
    marginTop: spacing.md,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  checkInText: {
    ...typography.small,
    fontWeight: "700",
  },
  cancel: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  cancelText: {
    ...typography.small,
    fontWeight: "700",
  },
});
