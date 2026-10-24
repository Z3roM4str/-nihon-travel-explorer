import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { firebaseConfig } from "./firebase-config";

const env = { VITE_FIREBASE_API_KEY: "test", VITE_FIREBASE_AUTH_DOMAIN: "test.invalid", VITE_FIREBASE_PROJECT_ID: "demo-nihon", VITE_FIREBASE_APP_ID: "test", VITE_FIREBASE_TRIP_ID: "shared" };

/**
 * TripSync reads import.meta.env once at module load, and Vite/Vitest fill it from app/.env.local
 * when that file exists. Stub every variable for this test and load a fresh module so the result
 * never depends on the developer's local environment.
 */
async function renderTripSyncWith(values: Record<string, string>) {
  for (const key of Object.keys(env)) vi.stubEnv(key, values[key] ?? "");
  vi.resetModules();
  const { TripSync } = await import("../components/TripSync");
  return renderToStaticMarkup(createElement(TripSync));
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it("uses local-only behavior for every missing or blank required variable", async () => {
  expect(firebaseConfig({})).toBeNull();
  for (const key of Object.keys(env)) {
    expect(firebaseConfig({ ...env, [key]: "" })).toBeNull();
    expect(firebaseConfig({ ...env, [key]: " " })).toBeNull();
    expect(firebaseConfig({ ...env, [key]: undefined })).toBeNull();
  }
  expect(await renderTripSyncWith({})).toBe("");
  expect(await renderTripSyncWith({ ...env, VITE_FIREBASE_TRIP_ID: " " })).toBe("");
});
it("accepts complete configuration and rejects a trip path", () => {
  expect(firebaseConfig(env)).toMatchObject({ tripId: "shared", options: { projectId: "demo-nihon" } });
  expect(firebaseConfig({ ...env, VITE_FIREBASE_TRIP_ID: "trips/shared" })).toBeNull();
});
it("shows the shared trip section only when the configuration is complete", async () => {
  expect(await renderTripSyncWith(env)).toContain("Viaje compartido");
});
