import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { MAX_TRAVELLERS, freshTravellersDocument, withActiveTraveller, withNewTraveller, withStance, withTravellerLabel, withTravellerReset, withoutTraveller } from "./lib/travellers";
import {
  ONBOARDING_IDENTITY,
  ONBOARDING_INTRO,
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
  pickOnboardingHero,
} from "./lib/onboarding";
import { summarizePhotography } from "./lib/sources-summary";
import { APP_VERSION } from "./lib/app-version";
import { getAllPlaces } from "./data/store";
import { placeImages, resolvePlaceImages } from "./data/place-images";
import type { PlaceImage } from "./types";

/**
 * B26 (B8 «Nosotros», `05 §11`, `05 §1`). Las invariantes de comportamiento real —Chromium y
 * WebKit— viven en `scripts/b26-nosotros-check.mjs`; aquí, lo que se puede afirmar sin navegador:
 * contrato de identidad (puro), onboarding, fuentes/licencias, versión y estructura.
 */

function read(path: string): Promise<string> {
  return readFile(new URL(`./${path}`, import.meta.url), "utf8");
}
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

let counter = 0;
const nextId = () => `id-${++counter}`;

describe("B26 — identidad: cambiar de persona activa no toca preferencias", () => {
  const base = freshTravellersDocument(nextId);
  const [a, b] = base.travellers;
  const marked = withStance(withStance(base, "JP-001", a.id, "interested"), "JP-002", b.id, "not-interested");

  it("cambiar la persona activa deja las posturas exactamente como estaban", () => {
    const switched = withActiveTraveller(marked, b.id);
    expect(switched.activeTravellerId).toBe(b.id);
    expect(switched.interests).toBe(marked.interests);
    expect(switched.travellers).toBe(marked.travellers);
  });

  it("renombrar conserva id y preferencias", () => {
    const renamed = withTravellerLabel(marked, a.id, "  Marta  ");
    expect(renamed.travellers[0]).toEqual({ id: a.id, label: "Marta" });
    expect(renamed.interests).toBe(marked.interests);
    expect(renamed.activeTravellerId).toBe(marked.activeTravellerId);
  });

  it("un nombre en blanco no se guarda", () => {
    expect(withTravellerLabel(marked, a.id, "   ")).toBe(marked);
  });

  it("reiniciar borra sólo lo de esa persona y conserva a la persona", () => {
    const reset = withTravellerReset(marked, a.id);
    expect(reset.travellers).toEqual(marked.travellers);
    expect(reset.interests.some((i) => i.stances.some((s) => s.travellerId === a.id))).toBe(false);
    expect(reset.interests.some((i) => i.stances.some((s) => s.travellerId === b.id))).toBe(true);
  });

  it("quitar no reatribuye nada y pasa la persona activa a quien queda", () => {
    const removed = withoutTraveller(marked, a.id);
    expect(removed.travellers.map((t) => t.id)).toEqual([b.id]);
    expect(removed.activeTravellerId).toBe(b.id);
    expect(removed.interests.some((i) => i.stances.some((s) => s.travellerId === a.id))).toBe(false);
  });

  it("no se excede MAX_TRAVELLERS", () => {
    expect(MAX_TRAVELLERS).toBe(2);
    expect(withNewTraveller(marked, "Tercera", nextId)).toBe(marked);
  });
});

describe("B26 — onboarding de cinco pasos (05 §1)", () => {
  it("Hola · Explora Japón · Marca lo que te gustaría ver · Después comparáis · ¿Quiénes sois?", () => {
    expect(ONBOARDING_TOTAL_STEPS).toBe(5);
    expect(ONBOARDING_INTRO.title).toBe("Nihon");
    expect(ONBOARDING_INTRO.tagline).toBe("El cuaderno de vuestro viaje a Japón");
    expect(ONBOARDING_STEPS.map((step) => step.title)).toEqual([
      "Explora Japón",
      "Marca lo que te gustaría ver",
      "Después comparáis",
    ]);
    expect(ONBOARDING_IDENTITY.title).toBe("¿Quiénes sois?");
    expect(ONBOARDING_IDENTITY.whoHoldsLegend).toBe("¿Quién tiene este teléfono?");
    expect(ONBOARDING_IDENTITY.cta).toBe("Entrar");
  });

  it("la fotografía de «Hola» es real y de un lugar de grado S del catálogo", () => {
    const hero = pickOnboardingHero(getAllPlaces(), (place) => resolvePlaceImages(place.id, place.images));
    expect(hero).not.toBeNull();
    expect(hero!.place.grade).toBe("S");
    expect(hero!.image.url).toMatch(/\.webp$/);
    expect(hero!.image.alt.length).toBeGreaterThan(10);
  });

  it("no inventa fotografía: sin imágenes, no hay héroe", () => {
    expect(pickOnboardingHero(getAllPlaces(), () => [])).toBeNull();
  });

  it("escribe en useTravellers (mismo almacén) y no crea un segundo estado de nombres", async () => {
    const onboarding = code(await read("components/Onboarding.tsx"));
    expect(onboarding).toContain("onSaveIdentity(drafts, holderId)");
    expect(onboarding).not.toMatch(/localStorage|nihon\.names|setItem/);
    const hook = code(await read("useTravellers.ts"));
    expect(hook).toContain("withTravellerLabel(next, id, label)");
    expect(hook).toContain("withActiveTraveller(next, activeId)");
    expect(hook.match(/useState\s*[<(]/g) ?? []).toHaveLength(1);
  });

  it("Escape, ×, fondo y Saltar cierran y marcan visto sin escribir identidad; sólo «Entrar» la escribe", async () => {
    const onboarding = code(await read("components/Onboarding.tsx"));
    // `close` no llama a onSaveIdentity; `enter` sí y luego cierra.
    expect(onboarding).toMatch(/const close = useCallback\(\(\) => \{\s*markOnboardingSeen\(\);\s*onClose\(\);/);
    expect(onboarding).toMatch(/const enter = useCallback\(\(\) => \{\s*onSaveIdentity\(drafts, holderId\);\s*close\(\);/);
    expect(onboarding.match(/onSaveIdentity\(/g) ?? []).toHaveLength(1);
  });

  it("no usa emoji en ninguna pantalla del explicador", async () => {
    const source = (await read("components/Onboarding.tsx")) + (await read("lib/onboarding.ts"));
    expect(source).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("B26 — Fuentes y licencias, Acerca de", () => {
  it("resume la fotografía con lo que el catálogo registra, sin inventar licencias", () => {
    const summary = summarizePhotography(placeImages);
    const total = summary.licenses.reduce((n, g) => n + g.imageCount, 0) + summary.withoutLicenseCount;
    expect(total).toBe(summary.imageCount);
    expect(summary.imageCount).toBeGreaterThan(0);
    const all = new Set(Object.values(placeImages).flat().map((i) => i.license).filter(Boolean));
    expect(new Set(summary.licenses.map((g) => g.license))).toEqual(all);
  });

  it("cuenta imágenes sin licencia en vez de ocultarlas", () => {
    const img = (license?: string): PlaceImage => ({ url: "u", alt: "a", license });
    const s = summarizePhotography({ A: [img("CC0"), img()], B: [img("CC0")] });
    expect(s.imageCount).toBe(3);
    expect(s.placeCount).toBe(2);
    expect(s.withoutLicenseCount).toBe(1);
    expect(s.licenses).toEqual([{ license: "CC0", licenseUrl: null, imageCount: 2 }]);
  });

  it("la versión de la aplicación viene de package.json, sin número duplicado en src", async () => {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
    const screen = code(await read("components/NosotrosScreen.tsx"));
    expect(screen).toContain("APP_VERSION");
    expect(screen).not.toContain(pkg.version);
    const sources = code(await read("components/SourcesAndLicences.tsx"));
    expect(sources).not.toContain(`"${pkg.version}"`);
  });

  it("la fecha que se muestra es «Consultada» de sources.json, nunca updatedAt", async () => {
    const sources = code(await read("components/SourcesAndLicences.tsx"));
    expect(sources).toContain("Consultada");
    expect(sources).not.toMatch(/updatedAt/);
  });

  it("el texto MLIT sigue siendo un único componente, íntegro", async () => {
    const mlit = await read("components/MlitAttribution.tsx");
    expect(mlit).toContain("N03, 2026");
    expect(mlit).toMatch(/no es un\s+producto oficial de MLIT/);
    expect(await read("components/SourcesAndLicences.tsx")).toContain("<MlitAttribution");
  });
});

describe("B26 — estructura de Nosotros (05 §11)", () => {
  it("cinco secciones en el orden del contrato, todas en el flujo (sin Sheet ni diálogo global)", async () => {
    const screen = await read("components/NosotrosScreen.tsx");
    const order = [
      'title="Viajeros"',
      'title="Copia del viaje"',
      'title="Cómo funciona Nihon"',
      'title="Fuentes y licencias"',
      'title="Acerca de"',
    ].map((needle) => screen.indexOf(needle));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(code(screen)).not.toMatch(/<Sheet|role="dialog"|aria-modal/);
  });

  it("la confirmación de importación precede a cualquier escritura y usa la frase del contrato", async () => {
    const backup = await read("components/TripBackup.tsx");
    expect(backup).toContain("Esto sustituirá todo lo que hay en este navegador.");
    const hook = code(await read("usePortableBackup.ts"));
    // prepareImport no escribe; sólo confirmImport llama a applyRestore.
    expect(hook.match(/applyRestore\(/g) ?? []).toHaveLength(1);
    const prepare = hook.slice(hook.indexOf("const prepareImport"), hook.indexOf("const confirmImport"));
    expect(prepare).not.toMatch(/applyRestore|setItem|removeItem/);
  });

  it("nada en Nosotros vive dentro de un modal: sin «Eres» en cabecera ni conmutador", async () => {
    const app = await read("App.tsx");
    const header = app.slice(app.indexOf("<header className="), app.indexOf("</header>"));
    // El token de cabecera sigue diciendo «Eres {nombre}» (identidad activa); lo que no vuelve es el
    // conmutador: ni TravellerBar, ni segmentado con aria-pressed, ni segunda persona seleccionable.
    expect(header).not.toMatch(/TravellerBar|traveller-bar|aria-pressed|setActiveTraveller/);
  });
});
