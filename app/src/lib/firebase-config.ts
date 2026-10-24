export function firebaseConfig(env: Record<string, unknown>) {
  const names = ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "APP_ID", "TRIP_ID"] as const;
  if (names.some((name) => typeof env[`VITE_FIREBASE_${name}`] !== "string" || !String(env[`VITE_FIREBASE_${name}`]).trim())) return null;
  const tripId = String(env.VITE_FIREBASE_TRIP_ID).trim();
  if (tripId.includes("/")) return null;
  return {
    options: {
      apiKey: String(env.VITE_FIREBASE_API_KEY).trim(),
      authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN).trim(),
      projectId: String(env.VITE_FIREBASE_PROJECT_ID).trim(),
      appId: String(env.VITE_FIREBASE_APP_ID).trim(),
    },
    tripId,
  };
}
