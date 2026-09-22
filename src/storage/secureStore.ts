import * as SecureStore from "expo-secure-store";

/**
 * Stockage du jeton de session.
 *
 * `expo-secure-store` s'appuie sur le Keychain (iOS) et le Keystore (Android) :
 * le jeton est chiffré par le système et n'est pas lisible par une autre app,
 * contrairement à AsyncStorage qui écrit en clair. C'est l'exigence
 * « stockage sécurisé du token » de l'énoncé.
 *
 * Toutes les fonctions encapsulent leurs erreurs : sur un appareil sans code de
 * déverrouillage, ou si l'utilisateur réinitialise le trousseau, la lecture
 * peut échouer. Dans ce cas on se comporte comme si aucune session n'existait,
 * plutôt que de faire planter le démarrage de l'app.
 */

const TOKEN_KEY = "clubsport.session.token";
const EXPIRY_KEY = "clubsport.session.expiresAt";

export async function saveSession(token: string, expiresAt: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(EXPIRY_KEY, expiresAt);
}

export async function readToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return null;

    // Expiration connue localement : inutile d'appeler le serveur pour
    // apprendre qu'un jeton de plus de 7 jours est périmé.
    const expiresAt = await SecureStore.getItemAsync(EXPIRY_KEY);
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      await clearSession();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export async function clearSession() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(EXPIRY_KEY);
  } catch {
    // Rien à faire : l'objectif est que le jeton ne soit plus utilisable.
  }
}
