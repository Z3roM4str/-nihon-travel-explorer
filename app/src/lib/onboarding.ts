import type { IconName } from "../icons/Icon";
import type { Place, PlaceImage } from "../types";

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
 * Three cards, no more. The explainer states the product's whole loop — explore, mark what you
 * like, compare afterwards — and then gets out of the way. It is not a tour: it never points at
 * a moving control and never depends on the state of the app behind it.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
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
    title: "Después comparáis",
    body: "Con la lista de “Quiero ir” hecha, se comparan las elecciones, se depuran juntas y solo al final se arma el itinerario.",
  },
] as const;

/**
 * B26 (`05 §1`): la secuencia normativa es Hola · Explora Japón · Marca lo que te gustaría ver ·
 * Después comparáis · ¿Quiénes sois?. Los tres pasos del medio son `ONBOARDING_STEPS`, con su
 * texto conservado; el primero y el último los añade el componente.
 */
export const ONBOARDING_INTRO = {
  title: "Nihon",
  tagline: "El cuaderno de vuestro viaje a Japón",
  cta: "Empezar",
} as const;

export const ONBOARDING_IDENTITY = {
  title: "¿Quiénes sois?",
  body: "Poned el nombre de cada persona. Podéis cambiarlo cuando queráis en Nosotros.",
  whoHoldsLegend: "¿Quién tiene este teléfono?",
  cta: "Entrar",
} as const;

/** Total de pasos visibles: Hola + los explicativos + ¿Quiénes sois?. */
export const ONBOARDING_TOTAL_STEPS = ONBOARDING_STEPS.length + 2;

/**
 * Fotografía del paso «Hola»: la de un lugar de grado S del catálogo (`05 §1`: «nunca un color
 * plano»). Determinista —el primer lugar S, en el orden del dataset, que tiene fotografía— para
 * que la primera pantalla no cambie de una apertura a otra. `null` si el catálogo no trae ninguna.
 */
export function pickOnboardingHero(
  places: readonly Place[],
  imagesFor: (place: Place) => readonly PlaceImage[]
): { place: Place; image: PlaceImage } | null {
  for (const place of places) {
    if (place.grade !== "S") continue;
    const image = imagesFor(place).find((entry) => Boolean(entry.url) && Boolean(entry.alt));
    if (image) return { place, image };
  }
  return null;
}

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
