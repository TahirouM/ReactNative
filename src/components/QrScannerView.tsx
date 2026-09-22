import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { CameraView, type BarcodeScanningResult } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BARCODE_TYPES } from "../features/checkin/qrScanner";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing, typography } from "../theme/tokens";

/**
 * Vue de scan plein écran.
 *
 * ## Pourquoi un `Modal` plein écran, et pas une caméra encastrée dans la page
 *
 * Viser un QR code est un geste : on lève le téléphone, on cadre, on attend le
 * déclic. Une petite fenêtre caméra au milieu d'une page qui défile rendrait
 * ce geste pénible et la lecture peu fiable. Le plein écran donne le champ le
 * plus large possible et supprime toute distraction pendant la visée.
 *
 * Un `Modal` — plutôt qu'un rendu conditionnel — garantit aussi que la caméra
 * est DÉMONTÉE à la fermeture. Une vue caméra laissée montée continue de
 * consommer batterie et capteur en arrière-plan, ce qui se voit dans
 * l'indicateur d'utilisation de l'appareil photo du système.
 *
 * ## Le viseur n'est pas décoratif
 *
 * Le cadre au centre dit où placer le code. Sans repère, l'utilisateur
 * présente le QR n'importe où dans le champ et se demande pourquoi rien ne se
 * passe. Le trait qui balaie le cadre signale, lui, que l'app CHERCHE —
 * pendant les quelques dixièmes de seconde où rien n'a encore été trouvé, une
 * image figée donnerait l'impression d'un plantage.
 */
export function QrScannerView({
  visible,
  onScan,
  onCancel,
  busy,
}: {
  visible: boolean;
  onScan: (value: string) => void;
  onCancel: () => void;
  /** Vrai pendant la validation serveur : on gèle le viseur et on l'annonce. */
  busy: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Viseur carré, borné : plein écran sur petit téléphone, raisonnable sur
  // une tablette où un cadre de 700 px n'aiderait personne à viser.
  const frameSize = Math.min(width * 0.7, 280);

  /*
    `useState` avec initialiseur paresseux, et non `useRef` : la valeur animée
    doit être créée UNE fois et rester stable entre les rendus, mais elle est
    ensuite lue pendant le rendu (par `interpolate` ci-dessous). Lire un ref
    pendant le rendu est précisément ce que React déconseille, et ce que le
    compilateur React signale. On ne garde donc que le setter inutilisé.
  */
  const [sweep] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible || busy) return;

    /*
      `useNativeDriver` : l'animation tourne sur le thread natif, donc elle
      reste fluide alors que le thread JS décode les images de la caméra —
      c'est précisément le moment où le JS est le plus occupé.
    */
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [visible, busy, sweep]);

  const translateY = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [0, frameSize - 2],
  });

  const handleBarcode = (result: BarcodeScanningResult) => {
    // Le verrou anti-rafale vit dans `useCheckIn` : la caméra émet en continu
    // tant que le code est dans le champ, et c'est là-bas que la première
    // lecture gagne. On se contente ici de transmettre.
    onScan(result.data);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      // Android : la flèche « retour » doit fermer le scanner, pas l'app.
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          // Formats restreints au QR : la caméra ignore les codes-barres
          // d'emballages qui traîneraient dans le champ.
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          // Pendant la validation serveur, on cesse d'écouter : inutile de
          // décoder des images dont on ne fera rien.
          onBarcodeScanned={busy ? undefined : handleBarcode}
        />

        {/*
          Voile sombre par-dessus la caméra. Il fait ressortir le viseur et le
          texte, et il est purement décoratif : `pointerEvents="none"` évite
          qu'il n'intercepte les appuis destinés aux boutons.
        */}
        <View style={styles.veil} pointerEvents="none" />

        <View
          style={[
            styles.content,
            { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
          ]}
        >
          <View style={styles.header} pointerEvents="none">
            <Text style={styles.title}>
              {busy ? "Validation en cours…" : "Scannez le QR code de la borne"}
            </Text>
            <Text style={styles.subtitle}>
              {busy
                ? "Vérification de votre réservation"
                : "L’affiche est posée à l’entrée de la salle"}
            </Text>
          </View>

          {/*
            Le viseur. `accessibilityRole="image"` + un libellé : un lecteur
            d'écran annonce la zone de visée au lieu d'un cadre muet.
          */}
          <View
            style={[styles.frame, { width: frameSize, height: frameSize }]}
            accessibilityRole="image"
            accessibilityLabel="Zone de visée : placez le QR code de la borne dans ce cadre"
          >
            {/* Quatre équerres plutôt qu'un cadre plein : elles cadrent sans
                masquer les bords du code, qui doivent rester visibles. */}
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />

            {!busy && (
              <Animated.View
                style={[
                  styles.sweep,
                  { backgroundColor: theme.brand, transform: [{ translateY }] },
                ]}
              />
            )}
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Fermer le scanner"
              style={({ pressed }) => [
                styles.cancel,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.cancelLabel}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/*
  Couleurs en dur, volontairement hors du thème : cette vue est posée SUR un
  flux caméra, pas sur le fond de l'app. Le texte doit rester lisible quelle
  que soit la scène filmée — un mur clair comme un hall sombre — et suivre le
  thème clair/sombre le rendrait illisible une fois sur deux.
*/
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  veil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    ...typography.heading,
    color: "#ffffff",
    textAlign: "center",
  },
  subtitle: {
    ...typography.small,
    color: "rgba(255, 255, 255, 0.75)",
    textAlign: "center",
  },
  frame: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 34,
    height: 34,
    borderColor: "#ffffff",
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: radius.lg,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: radius.lg,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: radius.lg,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: radius.lg,
  },
  sweep: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    height: 2,
    borderRadius: 1,
    // L'ombre portée donne au trait l'aspect d'un faisceau plutôt que d'une
    // simple barre posée sur l'image.
    shadowColor: "#ffffff",
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: Platform.OS === "android" ? 4 : 0,
  },
  footer: {
    width: "100%",
    alignItems: "center",
  },
  cancel: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.5)",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  cancelLabel: {
    ...typography.heading,
    fontSize: 15,
    color: "#ffffff",
  },
});
