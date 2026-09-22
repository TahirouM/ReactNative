import { Tabs } from "expo-router";
import { Platform, StyleSheet, Text, View, type ColorValue } from "react-native";

import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, typography } from "../../src/theme/tokens";

/**
 * Barre d'onglets — navigation principale de l'app.
 *
 * Cinq destinations, chacune répondant à un besoin mobile distinct :
 *   Accueil   → que dois-je faire maintenant ?
 *   Proches   → où puis-je aller, trié par distance (GÉOLOCALISATION)
 *   Pointer   → valider ma présence (QR code) — bouton central mis en avant
 *   Séances   → mes réservations à venir
 *   Profil    → adhésion, historique des pointages, déconnexion
 *
 * L'onglet central est visuellement surélevé : c'est l'action qu'on vient
 * faire en arrivant à la salle, pouce sur l'écran, sans chercher.
 */

/**
 * Icônes dessinées en texte plutôt qu'avec une librairie d'icônes : zéro
 * dépendance supplémentaire, rendu identique sur iOS et Android.
 */
function TabIcon({
  glyph,
  color,
  focused,
}: {
  glyph: string;
  // `ColorValue` et non `string` : c'est le type que la barre d'onglets passe.
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <Text
      style={[
        styles.icon,
        { color, opacity: focused ? 1 : 0.65, fontSize: focused ? 21 : 19 },
      ]}
    >
      {glyph}
    </Text>
  );
}

/**
 * Onglet de pointage : l'action principale du produit, donc le seul à porter
 * l'accent ocre. Un bloc carré à filet net plutôt qu'une pastille flottante —
 * le système visuel du web réserve l'ombre aux éléments réellement superposés.
 */
function ScanIcon({ focused }: { focused: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.scanButton,
        {
          backgroundColor: focused ? theme.brand : theme.brandSoft,
          borderColor: theme.brand,
        },
      ]}
    >
      <Text
        style={[
          styles.scanGlyph,
          { color: focused ? theme.brandText : theme.onBrandSoft },
        ]}
      >
        ◉
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.faint,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          // Hauteur généreuse : la barre d'onglets tombe dans la zone du pouce,
          // et iOS y ajoute l'encoche du bas (gérée par `Tabs`).
          height: Platform.OS === "ios" ? 88 : 66,
          paddingTop: 8,
        },
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon glyph="⌂" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: "Proches",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon glyph="◎" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Pointer",
          tabBarIcon: ({ focused }) => <ScanIcon focused={focused} />,
          tabBarAccessibilityLabel: "Pointer ma présence en scannant le QR code de la borne",
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Séances",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon glyph="☰" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon glyph="◍" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontWeight: "700",
  },
  label: {
    ...typography.tiny,
    fontSize: 10,
    marginTop: 2,
  },
  scanButton: {
    width: 44,
    height: 30,
    // `rounded-md` : forme franche, cohérente avec les boutons du web.
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  scanGlyph: {
    fontSize: 17,
  },
});
