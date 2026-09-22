/**
 * Formes de données renvoyées par l'API ClubSport (projet Next.js).
 *
 * Ces types sont écrits à la main plutôt que générés : ils documentent le
 * contrat que l'app consomme réellement, et font échouer la compilation si un
 * écran lit un champ que le serveur n'envoie pas.
 */

export type Role = "MEMBER" | "COACH" | "ADMIN";

export type MembershipStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "EXPIRED";

export type BookingStatus =
  | "BOOKED"
  | "CONFIRMED"
  | "ATTENDED"
  | "NO_SHOW"
  | "CANCELLED";

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  onboarded: boolean;
  preferredSiteId: string | null;
};

export type LoginResponse = {
  token: string;
  expiresAt: string;
  user: User;
};

export type Membership = {
  plan: string;
  status: MembershipStatus;
  startsAt: string;
  endsAt: string;
} | null;

export type MeResponse = {
  user: User;
  membership: Membership;
  preferredSite: { id: string; name: string; city: string } | null;
  stats: { bookings: number; attended: number };
};

/** Séance renvoyée par /api/sessions/nearby : déjà triée par distance. */
export type NearbySession = {
  id: string;
  activity: string;
  level: string;
  startsAt: string;
  endsAt: string;
  remainingSeats: number;
  site: {
    name: string;
    city: string;
    latitude: number;
    longitude: number;
    nfcTagId: string | null;
  };
  distanceKm: number;
};

export type NearbyResponse = {
  position: { latitude: number; longitude: number };
  radiusKm: number;
  count: number;
  sessions: NearbySession[];
};

export type Site = {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  nfcTagId: string | null;
  upcomingSessions: number;
  activities: { name: string; slug: string }[];
  distanceKm: number | null;
};

export type SitesResponse = {
  sites: Site[];
  position: { latitude: number; longitude: number } | null;
};

export type Booking = {
  id: string;
  status: BookingStatus;
  checkedInAt: string | null;
  checkInMethod: string | null;
  createdAt: string;
  session: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    activity: { name: string; slug: string; level: string };
    site: {
      id: string;
      name: string;
      city: string;
      address: string;
      latitude: number;
      longitude: number;
      nfcTagId: string | null;
    };
    coach: string | null;
  };
};

export type BookingsResponse = {
  bookings: Booking[];
  nextCursor: string | null;
};

/** Réponse de /api/check-in en cas de succès. */
export type CheckInResponse = {
  ok: true;
  message: string;
  booking: {
    id: string;
    status: BookingStatus;
    checkedInAt: string;
    checkInMethod: string;
  };
  site: string;
  distanceKm: number | null;
  session: { id: string; startsAt: string; activity: string };
};
