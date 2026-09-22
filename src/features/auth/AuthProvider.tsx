import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { authApi } from "../../services/clubsport";
import { ApiError, setUnauthorizedHandler } from "../../services/http";
import { clearCache } from "../../storage/cache";
import { clearSession, readToken, saveSession } from "../../storage/secureStore";
import type { MeResponse, User } from "../../types/api";

/**
 * Source de vérité de la session mobile.
 *
 * Cycle de vie couvert (exigences « session gérée proprement » et « survivre
 * aux interruptions ») :
 *
 *   1. démarrage      → on relit le jeton du trousseau et on le VALIDE auprès
 *                       du serveur ; un jeton révoqué depuis le web est donc
 *                       détecté avant d'afficher quoi que ce soit ;
 *   2. connexion      → le jeton est écrit dans le trousseau ;
 *   3. 401 en cours   → `setUnauthorizedHandler` déconnecte l'app ;
 *   4. retour au 1er  → on rafraîchit le profil (l'adhésion a pu changer
 *      plan                pendant que l'app était en arrière-plan) ;
 *   5. déconnexion    → révocation serveur + nettoyage local.
 */

type Status = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: Status;
  user: User | null;
  profile: MeResponse | null;
  /** Message d'erreur de la dernière tentative de connexion. */
  error: string | null;
  signingIn: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  /** Évite un `setState` après démontage lors des allers-retours d'écran. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applySignedOut = useCallback(async () => {
    await clearSession();
    await clearCache();
    if (!mounted.current) return;
    setProfile(null);
    setStatus("unauthenticated");
  }, []);

  // Un 401 sur n'importe quel appel signifie que la session n'est plus valide.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void applySignedOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [applySignedOut]);

  /** Valide le jeton stocké au lancement de l'app. */
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      const token = await readToken();
      if (!token) {
        if (mounted.current) setStatus("unauthenticated");
        return;
      }

      try {
        const me = await authApi.me(controller.signal);
        if (!mounted.current) return;
        setProfile(me);
        setStatus("authenticated");
      } catch (err) {
        if (controller.signal.aborted) return;

        // Panne réseau : le jeton n'est pas en cause. On laisse l'utilisateur
        // entrer dans l'app avec les données en cache plutôt que de le
        // déconnecter à tort parce que le Wi-Fi du club est tombé.
        if (err instanceof ApiError && err.isNetwork) {
          if (mounted.current) setStatus("authenticated");
          return;
        }
        await applySignedOut();
      }
    })();

    return () => controller.abort();
  }, [applySignedOut]);

  const refreshProfile = useCallback(async () => {
    try {
      const me = await authApi.me();
      if (mounted.current) setProfile(me);
    } catch {
      // Un 401 est déjà traité par le gestionnaire global ; toute autre erreur
      // laisse simplement le profil précédent affiché.
    }
  }, []);

  // Retour au premier plan : les données peuvent avoir vieilli (séance
  // réservée depuis le web, adhésion réactivée par un admin).
  useEffect(() => {
    if (status !== "authenticated") return;

    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void refreshProfile();
    });
    return () => subscription.remove();
  }, [status, refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setSigningIn(true);
    setError(null);
    try {
      const result = await authApi.login(email.trim(), password);
      await saveSession(result.token, result.expiresAt);

      // On recharge le profil complet : le login ne renvoie pas l'adhésion.
      try {
        const me = await authApi.me();
        if (mounted.current) setProfile(me);
      } catch {
        // Profil indisponible : on entre quand même, avec l'utilisateur du login.
        if (mounted.current) {
          setProfile({
            user: result.user,
            membership: null,
            preferredSite: null,
            stats: { bookings: 0, attended: 0 },
          });
        }
      }

      if (mounted.current) setStatus("authenticated");
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Connexion impossible. Réessayez.";
      if (mounted.current) setError(message);
      return false;
    } finally {
      if (mounted.current) setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    // Révocation serveur d'abord : elle invalide le jeton même s'il a fuité.
    // En cas d'échec réseau, on nettoie quand même l'appareil.
    try {
      await authApi.logout();
    } catch {
      // Sans conséquence : la session expirera côté serveur.
    }
    await applySignedOut();
  }, [applySignedOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: profile?.user ?? null,
      profile,
      error,
      signingIn,
      signIn,
      signOut,
      refreshProfile,
      clearError: () => setError(null),
    }),
    [status, profile, error, signingIn, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>.");
  return ctx;
}
