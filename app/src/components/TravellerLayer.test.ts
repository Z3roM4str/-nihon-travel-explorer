import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Block 5 — the wiring contract for the two-person layer.
 *
 * Same source-scanning technique the rest of this directory uses: the pure invariants live in
 * `lib/travellers.test.ts` and `lib/traveller-presentation.test.ts`, the real-viewport behaviour
 * lives in `scripts/block5-travellers-browser-audit.mjs`, and these assertions prove the
 * components wire the pure modules, keep the shared trip shared, and never grow into the UI the
 * brief for this layer explicitly forbids.
 */

function readSource(name: string): Promise<string> {
  return readFile(new URL(`./${name}`, import.meta.url), "utf8");
}

function readAppSource(name: string): Promise<string> {
  return readFile(new URL(`../${name}`, import.meta.url), "utf8");
}

/** Strips comments, so a vocabulary scan asserts on what a component RENDERS rather than on what
 * its documentation explains — the doc comments deliberately name the things this layer refuses
 * to become ("not a score", "never the best"). */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("the shared trip stays shared", () => {
  it("does not version the planning draft — V8 is still the canonical draft", async () => {
    const hook = await readAppSource("usePlanningDraft.ts");
    expect(hook).toContain('from "./lib/planning-draft-v8"');
    expect(hook).toContain("useState<ManualPlanningDraftV8>");
    // No per-person dimension was added to the shared plan.
    expect(hook).not.toMatch(/travellerId|perTraveller|personId/i);
  });

  it("keeps the travellers document out of the planning draft module entirely", async () => {
    const draft = await readAppSource("lib/planning-draft-v8.ts");
    expect(draft).not.toMatch(/travellers|traveller|persona/i);
  });

  it("feeds the planner one derived shortlist, exactly as before", async () => {
    const hook = withoutComments(await readAppSource("useTravellers.ts"));
    expect(hook).toContain("shortlistPlaceIds(document)");
    const app = await readAppSource("App.tsx");
    // The builder still receives the shared list, not one person's.
    expect(app).toMatch(/savedPlaces=\{savedPlaces\}/);
  });

  it("keeps the heart on the reader's own interest and the shared list on the trip's", async () => {
    const app = await readAppSource("App.tsx");
    expect(app).toContain("savedIds={activeInterestedIds}");
    expect(app).toContain("isSaved={isWantedByActive(selectedPlace.id)}");
    // The map and the saved list still show the shared shortlist.
    expect(app).toMatch(/savedIds=\{savedIds\}/);
  });

  it("has exactly one owner of the shortlist, and no second stored copy", async () => {
    const hook = await readAppSource("useTravellers.ts");
    expect(hook.match(/useState\s*[<(]/g) ?? []).toHaveLength(1);
    expect(hook).not.toContain("nihon.savedPlaceIds");
    // The superseded hook is gone rather than left as a second writer.
    await expect(readAppSource("useSavedPlaces.ts")).rejects.toThrow();
  });
});

describe("the layer stays subtle", () => {
  it("has exactly one permanent surface — the header bar", async () => {
    const app = await readAppSource("App.tsx");
    expect(app).toContain("<TravellerBar");
    expect(app.match(/<TravellerBar/g) ?? []).toHaveLength(1);
  });

  it("puts no person picker in front of the save action", async () => {
    const card = withoutComments(await readSource("PlaceCard.tsx"));
    // One control, one tap, exactly as before this block. The card never asks WHO is saving: no
    // <select>, no radio, no per-card traveller id. (`onSelect`/`selected` are the pre-existing
    // props for opening and highlighting a card, which is why this looks for elements, not words.)
    expect(card).toContain("onClick={() => onToggleSaved(place.id)}");
    expect(card).not.toMatch(/<select|type="radio"|travellerId|activeTraveller/);
    expect(card.match(/onToggleSaved\(/g) ?? []).toHaveLength(1);
  });

  it("renders the card marker only when one was resolved", async () => {
    const card = await readSource("PlaceCard.tsx");
    expect(card).toContain("{interestMarker && (");
    expect(card).toContain("interestMarker?: InterestMarker | null;");
  });

  it("never stamps both names on a card", async () => {
    const card = withoutComments(await readSource("PlaceCard.tsx"));
    expect(card).not.toMatch(/travellers\.map|stanceLines/);
  });

  it("keeps the explicit refusal off the card and in the detail", async () => {
    expect(withoutComments(await readSource("PlaceCard.tsx"))).not.toMatch(/no me interesa/i);
    expect(await readSource("PlaceDetail.tsx")).toMatch(/No me interesa/);
  });

  /**
   * Bloque 18 (`02 §D2`, gate 11): `TravellerManager` deja de ser el único modal de esta capa —
   * se convierte en contenido siempre presente de «Nosotros › Viajeros», sin `useState` booleano
   * que lo abra o lo cierre. El gesto que antes abría el modal ahora sólo desplaza el scroll
   * hasta esa sección, que ya está en pantalla.
   */
  it("renders embedded in Nosotros instead of as a modal, with nothing opening it automatically", async () => {
    const app = await readAppSource("App.tsx");
    expect(app).toContain("<TravellerManager");
    expect(app).toMatch(/<TravellerManager[\s\S]*?\bembedded\b/);
    expect(app).not.toContain("travellerManagerOpen");
    expect(app).not.toMatch(/useEffect\([^)]*setTravellerManagerOpen\(true\)/);
  });
});

describe("no score, no ranking, no dating app", () => {
  it("emits no percentage, score or compatibility figure anywhere in the layer", async () => {
    for (const name of ["TravellerBar.tsx", "TravellerManager.tsx", "PlaceCard.tsx", "PlaceDetail.tsx", "SelectionPanel.tsx"]) {
      const code = withoutComments(await readSource(name));
      expect(code, name).not.toMatch(/\bscore\b|\bcompatib|\bafinidad\b|\bmatch(es)?\s*%|\d\s*%/i);
    }
  });

  it("never sorts or filters the catalogue by what people said", async () => {
    const app = withoutComments(await readAppSource("App.tsx"));
    // Filtering stays the dataset's own business: no interest term reaches `matchesFilters`.
    expect(app).not.toMatch(/matchesFilters\([^)]*interest/i);
    const list = withoutComments(await readSource("PlaceList.tsx"));
    expect(list).not.toMatch(/\.sort\(/);
  });

  it("uses no gamified or judgemental vocabulary", async () => {
    for (const name of ["TravellerBar.tsx", "TravellerManager.tsx", "PlaceDetail.tsx"]) {
      const code = withoutComments(await readSource(name));
      expect(code, name).not.toMatch(
        /racha|nivel|puntos|insignia|logro|ganas|pierdes|mejor para|os conviene|recomendad/i
      );
    }
  });
});

describe("accessibility", () => {
  it("marks the active traveller with aria-pressed and a spelled-out name", async () => {
    const bar = await readSource("TravellerBar.tsx");
    expect(bar).toContain("aria-pressed={active}");
    expect(bar).toMatch(/Estás usando Nihon como \$\{traveller\.label\}/);
    expect(bar).toMatch(/Cambiar a \$\{traveller\.label\}/);
    expect(bar).toContain('role="group"');
    expect(bar).toContain('aria-label="Quién está usando Nihon"');
  });

  it("never relies on colour alone — every marker renders its label as text", async () => {
    const card = await readSource("PlaceCard.tsx");
    expect(card).toContain("{interestMarker.label}");
    expect(card).toContain("{interestMarker.description}");
    const panel = await readSource("SelectionPanel.tsx");
    expect(panel).toContain("{marker.label}");
    expect(panel).toContain("{marker.description}");
  });

  /**
   * Bloque 18, gate 11: `TravellerManager` ya no es siempre un diálogo — hoy se usa siempre
   * `embedded`, en cuyo caso el rol y la trampa de foco se retiran (no es una capa flotante).
   * El componente conserva la capacidad de comportarse como diálogo legítimo si algún día se
   * usa sin `embedded`, y eso es justo lo que este test comprueba: el `role`/`aria-modal`
   * condicional, no un modal permanente.
   */
  it("gives the manager a dialog role, a label and a focus trap when not embedded", async () => {
    const manager = await readSource("TravellerManager.tsx");
    expect(manager).toContain('role={embedded ? undefined : "dialog"}');
    expect(manager).toContain("aria-modal={embedded ? undefined : true}");
    expect(manager).toContain('aria-labelledby="traveller-manager-title"');
    expect(manager).toMatch(/if \(embedded\) return;/);
    expect(manager).toMatch(/event\.key !== "Tab"/);
    expect(manager).toMatch(/event\.key === "Escape"/);
  });

  it("names every destructive control with the person it affects", async () => {
    const manager = await readSource("TravellerManager.tsx");
    expect(manager).toMatch(/Reiniciar lo que ha guardado \$\{traveller\.label\}/);
    expect(manager).toMatch(/Quitar a \$\{traveller\.label\} del viaje/);
  });

  it("labels the list's remove control with whose interest it withdraws", async () => {
    const panel = await readSource("SelectionPanel.tsx");
    expect(panel).toMatch(/de Quiero ir de \$\{activeTravellerLabel\}/);
  });

  it("announces a destructive confirmation", async () => {
    const manager = await readSource("TravellerManager.tsx");
    expect(manager.match(/role="alert"/g) ?? []).toHaveLength(2);
  });

  it("keeps every new control at the 44px tap floor", async () => {
    const css = await readAppSource("App.css");
    for (const selector of [
      ".traveller-bar__option",
      ".traveller-bar__manage",
      ".traveller-manager__input",
      ".place-interest__decline",
    ]) {
      const block = css.slice(css.indexOf(`${selector} {`), css.indexOf(`${selector} {`) + 400);
      expect(block, selector).toContain("var(--tap-target)");
    }
  });

  it("honours reduced motion", async () => {
    const css = await readAppSource("App.css");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,300}traveller-bar__option/);
  });
});

describe("destruction is never a surprise", () => {
  it("states how many places a reset or removal would cost, before it is pressed", async () => {
    const manager = await readSource("TravellerManager.tsx");
    expect(manager).toContain("placesOnlyWantedBy(traveller.id)");
    expect(manager).toMatch(/sólo porque lo quiere esta persona/);
  });

  it("requires a second, explicit press", async () => {
    const manager = await readSource("TravellerManager.tsx");
    expect(manager).toContain("Sí, reiniciar");
    expect(manager).toContain("Sí, quitar");
    expect(manager).toMatch(/setConfirming\(\{ id: traveller\.id, action: "reset" \}\)/);
    expect(manager).toMatch(/setConfirming\(\{ id: traveller\.id, action: "remove" \}\)/);
  });

  it("says plainly that nothing transfers to the other person", async () => {
    const manager = await readSource("TravellerManager.tsx");
    expect(manager).toMatch(/Lo que dijo la otra persona no se toca/);
    expect(manager).toMatch(/Nada pasa a la otra persona/);
  });

  it("refuses to remove the last traveller from the UI as well as the model", async () => {
    const manager = await readSource("TravellerManager.tsx");
    expect(manager).toContain("disabled={travellers.length <= 1}");
  });

  it("says out loud that this is local only", async () => {
    const manager = await readSource("TravellerManager.tsx");
    expect(manager).toMatch(/No hay cuentas, ni servidor, ni sincronización/);
  });
});

describe("Block 4's assumption is untouched", () => {
  /**
   * Bloque 18 (`02 §D2`, gate 11): el mecanismo pasó de dos booleanos coordinados a mano a un
   * único `ViajeSection`, mutuamente excluyente por construcción — ver `ZonePlanSection.test.ts`
   * para la cobertura completa del nuevo mecanismo. Aquí sólo se confirma que la invariante en
   * sí (un solo escritor del borrador a la vez) sigue en pie.
   */
  it("still keeps the comparison and the planner mutually exclusive", async () => {
    const app = await readAppSource("App.tsx");
    expect(app).toMatch(/type ViajeSection = "planificar" \| "dormir";/);
    // Post-close correction: gated by `viajeVisited`, not `destination`, so leaving the Viaje
    // tab no longer unmounts whichever of the two is active (`02 §D3`) — see
    // `block18-shell.test.ts`'s "Viaje conserva su estado" describe block for full coverage.
    expect(app).toMatch(
      /\{viajeVisited && viajeSection === "planificar" && \(\s*<OrderedSequenceBuilder/
    );
    expect(app).toMatch(
      /\{viajeVisited && viajeSection === "dormir" && zonesHub && \(\s*<ZoneComparison/
    );
  });

  it("adds no new writer of the planning draft", async () => {
    for (const name of ["useTravellers.ts", "lib/travellers.ts", "lib/traveller-presentation.ts"]) {
      const source = await readAppSource(name);
      expect(source, name).not.toContain("manualPlanningDraft");
      expect(source, name).not.toMatch(/writeDraft|planning-draft/);
    }
  });

  it("leaves the zone choice a shared, single decision", async () => {
    // Comments stripped: the module's own prose explains at length that zones and accommodation
    // stay shared, which is the opposite of the defect this looks for.
    const travellers = withoutComments(await readAppSource("lib/travellers.ts"));
    expect(travellers).not.toMatch(/zone|accommodation/i);
  });
});
