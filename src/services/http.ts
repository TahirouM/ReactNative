import { API_URL, REQUEST_TIMEOUT_MS } from "./config";
import { readToken } from "../storage/secureStore";

/**
 * Client HTTP unique de l'application.
 *
 * Règle d'architecture de l'énoncé : « pas d'API dans les screens ». Tous les
 * appels réseau passent par ici, ce qui centralise en un seul endroit :
 *
 *   - l'ajout du jeton (`Authorization: Bearer`) ;
 *   - le délai d'attente maximal (un téléphone perd le réseau sans prévenir) ;
 *   - la distinction entre panne réseau, erreur métier et session expirée ;
 *   - la notification d'un 401 pour déconnecter l'app proprement.
 */

/** Erreur portant le code HTTP et le code métier renvoyé par l'API. */
export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: unknown;

  constructor(message: string, status: number, code?: string, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }

  /** Vrai quand la requête n'a jamais atteint le serveur. */
  get isNetwork() {
    return this.status === 0;
  }
}

/**
 * Abonnement au 401. Le `AuthProvider` s'y branche au montage : quand le
 * serveur refuse le jeton (session révoquée depuis le web, expiration,
 * réinitialisation de la base), l'app efface la session et revient à l'écran
 * de connexion — sans qu'aucun écran ait à gérer ce cas.
 */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: unknown;
  /** Requête publique (login) : ne pas exiger de jeton. */
  anonymous?: boolean;
  signal?: AbortSignal;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, anonymous = false, signal } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (!anonymous) {
    const token = await readToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Un `fetch` sans garde-fou peut rester suspendu très longtemps sur un
  // réseau mobile dégradé : on coupe nous-mêmes au bout du délai imparti.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // On combine l'abandon du composant (démontage) et celui du délai.
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    // Abandon volontaire par l'appelant : on laisse remonter tel quel pour que
    // le composant démonté ne déclenche pas un message d'erreur inutile.
    if (signal?.aborted) throw error;

    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ApiError(
      aborted
        ? "Le serveur ne répond pas. Vérifiez votre connexion."
        : "Impossible de joindre ClubSport. Vérifiez votre connexion.",
      0,
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
  }

  // 204 et corps vide : rien à décoder.
  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Le serveur a renvoyé du HTML (page d'erreur, portail Wi-Fi captif).
      if (!response.ok) {
        throw new ApiError(
          `Réponse inattendue du serveur (${response.status}).`,
          response.status,
        );
      }
    }
  }

  if (!response.ok) {
    const data = (parsed ?? {}) as { error?: string; code?: string };

    if (response.status === 401) {
      // Signale la session morte à l'app entière avant de propager l'erreur.
      onUnauthorized?.();
    }

    throw new ApiError(
      data.error ?? `Erreur ${response.status}.`,
      response.status,
      data.code,
      parsed,
    );
  }

  return parsed as T;
}
