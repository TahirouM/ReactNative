import { apiRequest } from "./http";
import type {
  Booking,
  BookingsResponse,
  CheckInResponse,
  LoginResponse,
  MeResponse,
  NearbyResponse,
  SitesResponse,
} from "../types/api";

/**
 * Accès à l'API ClubSport, regroupé par domaine métier.
 *
 * Les écrans appellent ces fonctions et ignorent tout du transport : ni URL,
 * ni en-tête, ni code HTTP ne remontent jusqu'à eux. Si une route change côté
 * Next.js, seul ce fichier bouge.
 */

export const authApi = {
  login(email: string, password: string) {
    return apiRequest<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      anonymous: true,
    });
  },

  me(signal?: AbortSignal) {
    return apiRequest<MeResponse>("/api/auth/me", { signal });
  },

  logout() {
    return apiRequest<{ ok: true }>("/api/auth/logout", { method: "POST" });
  },
};

export const sessionsApi = {
  /**
   * Séances à venir triées par distance. Le rayon est volontairement un
   * paramètre : l'écran laisse le membre l'élargir quand il n'y a rien près
   * de lui, plutôt que de renvoyer une liste vide sans recours.
   */
  nearby(
    position: { latitude: number; longitude: number },
    radiusKm: number,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      lat: String(position.latitude),
      lng: String(position.longitude),
      radius: String(radiusKm),
    });
    return apiRequest<NearbyResponse>(`/api/sessions/nearby?${params}`, { signal });
  },
};

export const sitesApi = {
  list(
    position: { latitude: number; longitude: number } | null,
    signal?: AbortSignal,
  ) {
    const params = position
      ? `?${new URLSearchParams({
          lat: String(position.latitude),
          lng: String(position.longitude),
        })}`
      : "";
    return apiRequest<SitesResponse>(`/api/sites${params}`, { signal });
  },
};

export const bookingsApi = {
  list(
    options: { scope?: "upcoming" | "past"; limit?: number; cursor?: string } = {},
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams();
    if (options.scope) params.set("scope", options.scope);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return apiRequest<BookingsResponse>(
      `/api/bookings${query ? `?${query}` : ""}`,
      { signal },
    );
  },

  create(sessionId: string) {
    return apiRequest<{ ok: true; booking: Booking }>("/api/bookings", {
      method: "POST",
      body: { sessionId },
    });
  },

  cancel(bookingId: string) {
    return apiRequest<{ ok: true }>(`/api/bookings/${bookingId}`, {
      method: "DELETE",
    });
  },
};

export const checkInApi = {
  /**
   * Valide la présence à partir de l'identifiant lu sur l'affiche de la borne.
   *
   * La position est envoyée quand elle est disponible : le serveur refuse le
   * pointage si le téléphone est loin de la salle (code photographié puis
   * présenté ailleurs). Si le membre a refusé la géolocalisation, l'appel part
   * sans coordonnées et le code seul fait foi — la fonctionnalité reste
   * utilisable.
   *
   * Le champ de la requête s'appelle toujours `nfcTagId`, du nom de la colonne
   * `Site.nfcTagId` côté serveur. C'est l'identifiant de LA BORNE d'une salle ;
   * seule la façon de le lire a changé.
   */
  submit(
    nfcTagId: string,
    position: { latitude: number; longitude: number } | null,
    /**
     * Comment l'identifiant a été obtenu. Le serveur le consigne dans
     * `Booking.checkInMethod` : le club distingue ainsi un code scanné sur
     * place d'un pointage de démonstration.
     */
    source: "qr" | "simulated" | "manual" = "qr",
  ) {
    return apiRequest<CheckInResponse>("/api/check-in", {
      method: "POST",
      body: {
        nfcTagId,
        method: source,
        ...(position
          ? { latitude: position.latitude, longitude: position.longitude }
          : {}),
      },
    });
  },
};
