import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { INTEREST_LEVELS } from "./lib/interest-level";

/**
 * Block 1 regression guard.
 *
 * Two jobs. First, prove the UX rework did not quietly drop anything the application already
 * showed — this repository's standing rule is that saturated information gets relocated behind
 * progressive disclosure, never deleted. Second, hold the accessibility promises the rework
 * makes: tap targets, non-colour signals, and a live region for the one repeated action.
 */

const src = (path: string) => readFile(new URL(`./${path}`, import.meta.url), "utf8");

describe("nothing the detail panel used to show was removed", () => {
  it("still renders every practical-information row", async () => {
    const source = await src("components/PlaceDetail.tsx");
    for (const row of ["Horario", "Cierres", "Reserva", "Cómo llegar", "Accesibilidad", "Aglomeración"]) {
      expect(source, row).toContain(`label="${row}"`);
    }
  });

  it("still renders the February–March 2027 seasonal block with its action", async () => {
    const source = await src("components/PlaceDetail.tsx");
    expect(source).toContain("Febrero–marzo 2027");
    expect(source).toContain("place.febMar2027.warning");
    expect(source).toContain("place.febMar2027.action");
  });

  it("still renders the quick facts, nearby list and official links", async () => {
    const source = await src("components/PlaceDetail.tsx");
    expect(source).toContain("Tiempo de visita");
    expect(source).toContain("Mejor época");
    expect(source).toContain("Cerca de aquí");
    expect(source).toContain("place.officialUrl");
    expect(source).toContain("place.googleMapsUrl");
  });

  it("still shows the dataset's own grade letter next to the plain-language level", async () => {
    const source = await src("components/PlaceDetail.tsx");
    expect(source).toContain("Grado {place.grade}");
  });

  it("keeps photography attribution rendered with the image, not behind a disclosure", async () => {
    const source = await src("components/PlaceGallery.tsx");
    expect(source).toContain("gallery__credit");
    // A licence obligation must not become something the reader has to go looking for.
    expect(source).not.toMatch(/<details[\s\S]*gallery__credit/);
  });
});

describe("nothing the filter panel used to offer was removed", () => {
  it("still offers all six filter groups", async () => {
    const source = await src("components/FilterPanel.tsx");
    for (const label of [
      "Categoría",
      "Nivel de interés",
      "Duración",
      "Hidden gem",
      "Nivel turístico",
      "Reserva",
    ]) {
      expect(source, label).toContain(`label="${label}"`);
    }
  });

  it("still filters on the dataset's grade field, whatever the group is called", async () => {
    const source = await src("components/FilterPanel.tsx");
    expect(source).toContain("filters.grades");
    expect(source).toContain("toggleValue(filters.grades, grade)");
  });

  it("keeps free-text search reachable from the panel", async () => {
    const source = await src("components/FilterPanel.tsx");
    expect(source).toContain('type="search"');
    expect(source).toContain("filters.query");
  });
});

describe("saved places keep their existing storage contract", () => {
  /**
   * Block 5 replaced `useSavedPlaces` with `useTravellers`: the shortlist is no longer a stored
   * array of its own but is DERIVED from the travellers document, so that the two-person layer
   * cannot produce a second list to drift from the first. The contract this phase actually cares
   * about is unchanged and now stronger — the shortlist has exactly ONE owner, and the old key is
   * still honoured so nobody's existing list is lost.
   */
  it("gives the shortlist a single owner, and still honours the original key", async () => {
    const source = await src("lib/travellers.ts");
    expect(source).toContain('export const LEGACY_SAVED_PLACES_KEY = "nihon.savedPlaceIds"');
    expect(source).toContain('export const TRAVELLERS_STORAGE_KEY = "nihon.travellers.v1"');

    const hook = await src("useTravellers.ts");
    expect(hook).toContain("shortlistPlaceIds(document)");
    // No second stored copy of the list: `savedIds` is computed, never written on its own.
    expect(hook).not.toContain("nihon.savedPlaceIds");
  });

  it("keeps the travellers hook the only writer — feedback never persists anything", async () => {
    const source = await src("useSaveFeedback.ts");
    expect(source).not.toContain("localStorage");
  });

  it("routes every surface's save through one announcing wrapper", async () => {
    const source = await src("App.tsx");
    expect(source).toContain("toggleSavedWithFeedback");
    expect(source).toContain("onToggleSaved={toggleSavedWithFeedback}");
  });
});

describe("accessibility promises", () => {
  it("keeps a 44px tap-target token and uses it for the card's save control", async () => {
    const css = await src("App.css");
    expect(css).toContain("--tap-target: 44px");
    const saveRule = css.slice(css.indexOf(".place-card__save {"));
    expect(saveRule.slice(0, 400)).toContain("var(--tap-target)");
  });

  it("gives every interest level a CSS rule that is not colour-only in the markup", async () => {
    const source = await src("components/PlaceCard.tsx");
    // The label text ships with the badge; the colour class is additional, never the carrier.
    const badge = source.slice(source.indexOf("interest-badge"));
    expect(badge).toContain("interest-badge__label");
  });

  it("has a badge colour for every level in the ladder", async () => {
    const css = await src("App.css");
    for (const level of INTEREST_LEVELS) {
      expect(css, level.grade).toContain(`.badge--grade-${level.grade}`);
    }
  });

  it("announces saving through a polite live region that is always mounted", async () => {
    const source = await src("components/SaveToast.tsx");
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    // The region element is outside the conditional; only its contents are conditional.
    expect(source.indexOf("save-toast-region")).toBeLessThan(source.indexOf("{feedback &&"));
  });

  it("keeps the reduced-motion escape hatch covering the new animations", async () => {
    const css = await src("App.css");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.001ms !important");
  });

  it("marks the phone view switch with its pressed state", async () => {
    const source = await src("App.tsx");
    expect(source).toContain('aria-pressed={mobilePane === "list"}');
    expect(source).toContain('aria-pressed={mobilePane === "map"}');
  });
});

describe("empty states are deliberate", () => {
  it("distinguishes a failed search from an over-filtered list", async () => {
    const source = await src("components/PlaceList.tsx");
    expect(source).toContain("Nada coincide con");
    expect(source).toContain("Ningún lugar coincide con los filtros");
  });

  it("always offers the way out of an empty result", async () => {
    const source = await src("components/PlaceList.tsx");
    expect(source).toContain("Limpiar búsqueda y filtros");
  });

  it("explains both ways to save when nothing is saved yet", async () => {
    const source = await src("components/SelectionPanel.tsx");
    expect(source).toContain("Todavía no hay nada guardado");
    expect(source).toContain("Quiero ir");
  });

  it("says how many places are still there when the map has nothing to show", async () => {
    const source = await src("App.tsx");
    expect(source).toContain("map-empty__hint");
    expect(source).toContain("{hubPlaces.length} lugares de esta zona");
  });
});

describe("no backend and no invented data were introduced", () => {
  it("adds no network call from the new UI modules", async () => {
    for (const file of [
      "components/PlaceCard.tsx",
      "components/Onboarding.tsx",
      "components/SaveToast.tsx",
      "components/InterestLegend.tsx",
      "lib/interest-level.ts",
      "lib/onboarding.ts",
      "useSaveFeedback.ts",
    ]) {
      const source = await src(file);
      for (const forbidden of ["fetch(", "XMLHttpRequest", "supabase", "https://"]) {
        expect(source, `${file}: ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("introduces no hotel or accommodation origin", async () => {
    for (const file of ["components/PlaceCard.tsx", "App.tsx", "lib/interest-level.ts"]) {
      const source = (await src(file)).toLowerCase();
      for (const forbidden of ["hotel", "alojamiento", "check-in"]) {
        expect(source, `${file}: ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
