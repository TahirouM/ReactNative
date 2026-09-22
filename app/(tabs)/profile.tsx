import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/States";
import { useAuth } from "../../src/features/auth/AuthProvider";
import {
  clearCheckInHistory,
  readCheckInHistory,
  type CheckInEntry,
} from "../../src/features/checkin/history";
import { API_URL } from "../../src/services/config";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, spacing, typography } from "../../src/theme/tokens";
import {
  MEMBERSHIP_LABELS,
  formatDateTime,
  formatDistance,
  initials,
} from "../../src/utils/format";

/**
 * Profil — identité, adhésion, et journal des pointages.
 *
 * Le journal local est la « trace de l'action scan / GPS » demandée par
 * l'énoncé : il persiste dans AsyncStorage, survit à la fermeture de l'app, et
 * conserve AUSSI les tentatives refusées (que le serveur ne garde pas). C'est
 * ce qui permet à un membre de montrer qu'il est bien passé, même si le
 * pointage a échoué.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, user, signOut, refreshProfile } = useAuth();

  const [history, setHistory] = useState<CheckInEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadHistory = useCallback(async () => {
    const entries = await readCheckInHistory();
    setHistory(entries);
  }, []);

  // `useFocusEffect` et non `useEffect` : le journal doit se recharger au
  // retour depuis l'écran de scan, pas seulement au premier montage.
  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), loadHistory()]);
    setRefreshing(false);
  }, [refreshProfile, loadHistory]);

  const confirmSignOut = () => {
    // Confirmation native : la déconnexion efface la session de l'appareil.
    Alert.alert("Se déconnecter", "Vous devrez saisir à nouveau votre mot de passe.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          await signOut();
          // Pas de navigation manuelle : le layout racine détecte la session
          // fermée et renvoie lui-même vers l'écran de connexion.
        },
      },
    ]);
  };

  const confirmClearHistory = () => {
    Alert.alert(
      "Effacer le journal",
      "Les pointages restent enregistrés côté club. Seule la trace locale de cet appareil est supprimée.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: async () => {
            await clearCheckInHistory();
            await loadHistory();
          },
        },
      ],
    );
  };

  const membership = profile?.membership;
  const stats = profile?.stats;

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
          onRefresh={() => void onRefresh()}
          tintColor={theme.brand}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: theme.brand }]}>
            <Text style={[styles.avatarText, { color: theme.brandText }]}>
              {user ? initials(user.firstName, user.lastName) : "—"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {user ? `${user.firstName} ${user.lastName}` : "Membre"}
            </Text>
            <Text style={[styles.email, { color: theme.muted }]} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </View>

        <View style={styles.badges}>
          {membership ? (
            <Badge
              label={MEMBERSHIP_LABELS[membership.status] ?? membership.status}
              tone={membership.status === "ACTIVE" ? "accent" : "warn"}
            />
          ) : (
            <Badge label="Aucune adhésion" tone="warn" />
          )}
          {user?.role && user.role !== "MEMBER" ? (
            <Badge label={user.role} tone="court" />
          ) : null}
          {membership ? (
            <Badge label={`Formule ${membership.plan}`} tone="neutral" />
          ) : null}
        </View>

        {stats ? (
          <View style={[styles.stats, { borderTopColor: theme.border }]}>
            <Stat label="Réservations" value={stats.bookings} theme={theme} />
            <Stat label="Présences" value={stats.attended} theme={theme} />
          </View>
        ) : null}
      </Card>

      {profile?.preferredSite ? (
        <Card>
          <Text style={[styles.sectionLabel, { color: theme.faint }]}>
            SALLE HABITUELLE
          </Text>
          <Text style={[styles.siteName, { color: theme.text }]}>
            {profile.preferredSite.name}
          </Text>
          <Text style={[styles.siteCity, { color: theme.muted }]}>
            {profile.preferredSite.city}
          </Text>
        </Card>
      ) : null}

      {/* Journal local des pointages : la trace exigée par l'énoncé. */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Journal des pointages
        </Text>
        {history.length > 0 ? (
          <Pressable
            onPress={confirmClearHistory}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[styles.clear, { color: theme.muted }]}>Effacer</Text>
          </Pressable>
        ) : null}
      </View>

      {history.length === 0 ? (
        <Card>
          <EmptyState
            emoji="📲"
            title="Aucun pointage enregistré"
            message="Chaque scan de borne — validé ou refusé — sera consigné ici, sur cet appareil."
            action={{
              label: "Pointer maintenant",
              onPress: () => router.push("/(tabs)/scan"),
            }}
          />
        </Card>
      ) : (
        <Card padded={false}>
          {history.map((entry, index) => (
            <View
              key={`${entry.at}-${index}`}
              style={[
                styles.entry,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.entryDot,
                  {
                    backgroundColor:
                      entry.outcome === "success" ? theme.brand : theme.danger,
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.entryTitle, { color: theme.text }]}>
                  {entry.outcome === "success"
                    ? `${entry.activity ?? "Séance"} — ${entry.site ?? "salle"}`
                    : "Pointage refusé"}
                </Text>
                <Text style={[styles.entryMessage, { color: theme.muted }]}>
                  {entry.message}
                </Text>
                <View style={styles.entryMeta}>
                  <Text style={[styles.entryTime, { color: theme.faint }]}>
                    {formatDateTime(entry.at)}
                  </Text>
                  {/* On ne mentionne la provenance que lorsqu'elle s'écarte
                      du scan normal : une ligne « · scanné » sur chaque entrée
                      serait du bruit. `source` est absente des entrées écrites
                      avant l'ajout du champ — on n'affiche alors rien plutôt
                      qu'une provenance devinée. */}
                  {entry.source && entry.source !== "qr" ? (
                    <Text style={[styles.entryTime, { color: theme.warning }]}>
                      · {sourceLabel(entry.source)}
                    </Text>
                  ) : null}
                  {entry.distanceKm !== null ? (
                    <Text style={[styles.entryTime, { color: theme.faint }]}>
                      · {formatDistance(entry.distanceKm)}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.entryTag, { color: theme.faint }]}
                    numberOfLines={1}
                  >
                    · {entry.tagId}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}

      <Card style={{ backgroundColor: theme.cardAlt }}>
        <Text style={[styles.sectionLabel, { color: theme.faint }]}>
          À PROPOS
        </Text>
        <Text style={[styles.aboutText, { color: theme.muted }]}>
          Les réservations, adhésions et validations de présence sont gérées par
          le serveur ClubSport. Cette application ne stocke localement que votre
          jeton de session (chiffré par le système) et le journal ci-dessus.
        </Text>
        {__DEV__ ? (
          <Text style={[styles.apiHint, { color: theme.faint }]}>{API_URL}</Text>
        ) : null}
      </Card>

      <Button
        label="Se déconnecter"
        onPress={confirmSignOut}
        variant="danger"
        loading={signingOut}
      />
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  theme,
}: {
  label: string;
  value: number;
  theme: { text: string; muted: string; border: string };
}) {
  return (
    <View style={[styles.stat, { borderLeftColor: theme.border }]}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

/**
 * Libellé de provenance d'un pointage, pour le journal.
 *
 * `nfc` apparaît encore : ce sont les pointages effectués avant le passage au
 * QR code. On les nomme pour ce qu'ils étaient plutôt que de réécrire
 * l'historique du téléphone.
 */
function sourceLabel(source: "qr" | "nfc" | "simulated" | "manual"): string {
  switch (source) {
    case "simulated":
      return "simulé";
    case "manual":
      return "code saisi";
    case "nfc":
      return "badge NFC";
    default:
      return "scanné";
  }
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...typography.title,
    fontSize: 19,
  },
  name: {
    ...typography.title,
  },
  email: {
    ...typography.small,
    marginTop: 2,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  stats: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    flex: 1,
    // Barre verticale à gauche du chiffre : signature de `Stat` (web).
    borderLeftWidth: 2,
    paddingLeft: spacing.md,
    gap: 2,
  },
  statValue: {
    // `.nums font-display text-3xl` côté web : chasse fixe pour que les
    // chiffres s'alignent, et corps large car c'est l'élément visuel.
    ...typography.monoLarge,
    fontSize: 26,
  },
  statLabel: {
    ...typography.small,
  },
  sectionLabel: {
    ...typography.tiny,
    marginBottom: spacing.sm,
  },
  siteName: {
    ...typography.heading,
  },
  siteCity: {
    ...typography.small,
    marginTop: 2,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.title,
  },
  clear: {
    ...typography.small,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  entry: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  entryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  entryTitle: {
    ...typography.small,
    fontWeight: "700",
  },
  entryMessage: {
    ...typography.small,
    marginTop: 2,
    lineHeight: 19,
  },
  entryMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: spacing.sm,
  },
  entryTime: {
    ...typography.mono,
    fontSize: 11,
  },
  entryTag: {
    // Identifiant de borne : `font-mono` côté web.
    ...typography.mono,
    fontSize: 11,
    flexShrink: 1,
  },
  aboutText: {
    ...typography.small,
    lineHeight: 20,
  },
  apiHint: {
    ...typography.small,
    fontSize: 12,
    marginTop: spacing.md,
  },
});
