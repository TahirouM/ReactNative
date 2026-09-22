import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../services/http";
import { readCache, writeCache } from "../storage/cache";

/**
 * Chargement d'une ressource distante avec les quatre états attendus, plus le
 * repli hors ligne.
 *
 * Écrire ça une fois évite que chaque écran réimplémente son `useEffect` +
 * `loading` + `error` + « annuler si démonté », avec les bugs que ça implique.
 *
 * Comportement notable : en cas d'échec réseau, si un cache existe, on affiche
 * la donnée en cache SANS écran d'erreur, et on signale simplement qu'elle
 * date (`staleAt`). C'est ce que l'énoncé appelle « gestion offline minimale ».
 */

type State<T> = {
  data: T | null;
  loading: boolean;
  /** Vrai seulement pendant un « tirer pour rafraîchir ». */
  refreshing: boolean;
  error: string | null;
  /** Date de la donnée quand elle vient du cache, sinon null. */
  staleAt: string | null;
};

type Options<T> = {
  /** Clé de cache. Absente → pas de repli hors ligne pour cette ressource. */
  cacheKey?: string;
  /** Ne lance pas la requête tant que faux (ex. position pas encore connue). */
  enabled?: boolean;
  /** Transforme la réponse avant stockage (ex. extraire un tableau). */
  select?: (raw: unknown) => T;
};

export function useApiResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  options: Options<T> = {},
) {
  const { cacheKey, enabled = true } = options;

  const [state, setState] = useState<State<T>>({
    data: null,
    loading: enabled,
    refreshing: false,
    error: null,
    staleAt: null,
  });

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // `fetcher` est recréé à chaque rendu par l'appelant : on le garde dans une
  // ref pour que `load` ne change pas d'identité à chaque rendu (ce qui
  // relancerait la requête en boucle).
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const load = useCallback(
    async (mode: "initial" | "refresh", signal: AbortSignal) => {
      if (!enabled) return;

      // `await null` cède la main avant le premier setState : l'effet qui
      // appelle `load` se termine sans déclencher de rendu en cascade
      // (règle react-hooks/set-state-in-effect).
      await null;
      if (signal.aborted || !mounted.current) return;

      setState((prev) => ({
        ...prev,
        loading: mode === "initial" && prev.data === null,
        refreshing: mode === "refresh",
        error: null,
      }));

      try {
        const data = await fetcherRef.current(signal);
        if (signal.aborted || !mounted.current) return;

        setState({
          data,
          loading: false,
          refreshing: false,
          error: null,
          staleAt: null,
        });
        if (cacheKey) await writeCache(cacheKey, data);
      } catch (error) {
        if (signal.aborted || !mounted.current) return;

        const isNetwork = error instanceof ApiError && error.isNetwork;
        const message =
          error instanceof ApiError ? error.message : "Chargement impossible.";

        // Hors ligne mais cache disponible : on préfère une donnée datée à un
        // écran d'erreur. L'interface affichera un bandeau « hors ligne ».
        if (isNetwork && cacheKey) {
          const cached = await readCache<T>(cacheKey);
          if (cached && mounted.current) {
            setState({
              data: cached.data,
              loading: false,
              refreshing: false,
              error: null,
              staleAt: cached.cachedAt,
            });
            return;
          }
        }

        setState((prev) => ({
          data: prev.data,
          loading: false,
          refreshing: false,
          error: message,
          staleAt: prev.staleAt,
        }));
      }
    },
    [cacheKey, enabled],
  );

  // Chargement initial et rechargement quand les dépendances changent.
  useEffect(() => {
    const controller = new AbortController();
    void load("initial", controller.signal);
    // Annule la requête en vol si l'écran est quitté ou si les dépendances
    // changent : évite d'appliquer une réponse obsolète.
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  const refresh = useCallback(() => {
    const controller = new AbortController();
    void load("refresh", controller.signal);
  }, [load]);

  return { ...state, refresh };
}
