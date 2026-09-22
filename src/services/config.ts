import Constants from "expo-constants";

/**
 * Résolution de l'URL de l'API.
 *
 * Problème concret : sur un téléphone réel, `localhost` désigne le téléphone
 * lui-même, pas le Mac qui fait tourner `next dev`. Il faut donc l'adresse de
 * la machine sur le réseau Wi-Fi.
 *
 * Expo connaît déjà cette adresse : c'est celle du serveur Metro auquel le
 * téléphone est connecté (`hostUri`, ex. "192.168.1.20:8081"). On en extrait
 * l'hôte et on lui accole le port du serveur Next.js. Le développeur n'a donc
 * rien à configurer pour tester en local, et aucune IP n'est codée en dur.
 *
 * `EXPO_PUBLIC_API_URL` reste prioritaire : c'est ce qui permet de pointer vers
 * l'application déployée (Vercel) ou vers un autre poste.
 *
 * Note sécurité : seule une URL publique vit ici. Aucune clé secrète n'est
 * embarquée dans l'app — tout ce qui est sensible (AUTH_SECRET, accès base)
 * reste côté serveur Next.js. Un binaire mobile est décompilable.
 */

const DEV_API_PORT = 3005;

function inferHostFromExpo(): string | null {
  // Selon la version d'Expo et le mode de lancement, l'hôte apparaît à
  // différents endroits : on essaie les emplacements connus dans l'ordre.
  const candidates = [
    Constants.expoConfig?.hostUri,
    // Champ historique d'Expo Go, conservé comme second recours.
    (Constants.manifest2 as { extra?: { expoGo?: { developer?: { host?: string } } } } | null)
      ?.extra?.expoGo?.developer?.host,
    Constants.expoGoConfig?.debuggerHost,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      const host = candidate.split("://").pop()?.split(":")[0];
      if (host) return host;
    }
  }
  return null;
}

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const host = inferHostFromExpo();
  if (host) return `http://${host}:${DEV_API_PORT}`;

  // Dernier recours : utile sur simulateur iOS, où localhost fonctionne.
  return `http://localhost:${DEV_API_PORT}`;
}

export const API_URL = resolveApiUrl();

/** Au-delà, on considère le réseau comme indisponible plutôt que d'attendre. */
export const REQUEST_TIMEOUT_MS = 12_000;
