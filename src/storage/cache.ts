import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Cache de lecture, pour que l'app reste utilisable hors ligne.
 *
 * Exigence de l'énoncé : « gestion offline minimale », « reprise propre après
 * redémarrage ». Concrètement, si le membre ouvre l'app dans un sous-sol sans
 * réseau, il doit au moins revoir ses prochaines séances et sa dernière
 * position connue, avec la date de la donnée affichée.
 *
 * AsyncStorage (et non SecureStore) : ces données ne sont pas sensibles, et
 * SecureStore est limité en taille et plus lent.
 */

export type Cached<T> = { data: T; cachedAt: string };

export async function writeCache<T>(key: string, data: T) {
  try {
    const payload: Cached<T> = { data, cachedAt: new Date().toISOString() };
    await AsyncStorage.setItem(`cache:${key}`, JSON.stringify(payload));
  } catch {
    // Un cache qui n'écrit pas dégrade l'expérience, il ne casse pas l'app.
  }
}

export async function readCache<T>(key: string): Promise<Cached<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache:${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as Cached<T>;
  } catch {
    // JSON corrompu (mise à jour de format, écriture interrompue) : on ignore.
    return null;
  }
}

export async function clearCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith("cache:"));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    // Sans effet sur la correction de l'app.
  }
}
