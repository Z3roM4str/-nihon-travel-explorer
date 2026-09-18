/**
 * Content and persistence for the first-run explainer, kept out of the component so the
 * component file exports nothing but a component (the project's fast-refresh lint rule) and so
 * the steps can be asserted on directly in tests.
 */

export const ONBOARDING_STORAGE_KEY = "nihon.onboarding.seen.v1";

export type OnboardingStep = {
  icon: string;
  title: string;
  body: string;
};

/**
 * Three cards, no more. The explainer states the product's whole loop — explore, mark what you
 * like, compare afterwards — and then gets out of the way. It is not a tour: it never points at
 * a moving control and never depends on the state of the app behind it.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    icon: "🗺",
    title: "Explora Japón",
    body: "Elige una zona y ve pasando tarjetas. Cada una dice qué es el lugar, por qué vale la pena y cuánto tiempo pide.",
  },
  {
    icon: "♥",
    title: "Marca lo que te gustaría ver",
    body: "Pulsa el corazón de cualquier tarjeta. No hay que decidir nada todavía: guarda de más, que luego se recorta.",
  },
  {
    icon: "🧭",
    title: "Después comparamos",
    body: "Con la lista de “Quiero ir” hecha, se comparan las elecciones, se depuran juntas y solo al final se arma el itinerario.",
  },
] as const;

/** Returns false whenever storage is unavailable — a blocked profile sees the explainer once
 * per session rather than never, which is the harmless side of the trade. */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
  } catch {
    /* storage unavailable — the explainer simply reappears next session */
  }
}
