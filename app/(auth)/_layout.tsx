import { Stack } from "expo-router";

/** Le groupe d'authentification n'a pas d'en-tête : chaque écran se suffit. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
