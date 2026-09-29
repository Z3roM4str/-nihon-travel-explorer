import type { IconName } from "../icons/Icon";

/**
 * Content and persistence for the first-run explainer, kept out of the component so the
 * component file exports nothing but a component (the project's fast-refresh lint rule) and so
 * the steps can be asserted on directly in tests.
 */

export const ONBOARDING_STORAGE_KEY = "nihon.onboarding.seen.v1";

export type OnboardingStep = {
  /** Bloque 17 (B1): nombre de un icono de línea propio — "Ninguna pantalla del explicador
   * usa emoji" (`docs/design/05 §1`). */
  icon: IconName;
  title: string;
  body: string;
};

/**
 * Los cuatro pasos editoriales previos a la configuración de identidad de `05 §1`.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    icon: "mapa",
    title: "Nihon es vuestro viaje",
    body: "Un lugar para descubrir Japón, guardar lo que os interesa y decidir juntos sin que la aplicación decida por vosotros.",
  },
  {
    icon: "mapa",
    title: "Explora Japón",
    body: "Elige una ciudad y ve pasando tarjetas. Cada una dice qué es el lugar, por qué vale la pena y cuánto tiempo pide.",
  },
  {
    icon: "corazon",
    title: "Marca lo que te gustaría ver",
    body: "Pulsa el corazón de cualquier tarjeta. No hay que decidir nada todavía: guarda de más, que luego se recorta.",
  },
  {
    icon: "explorar",
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
