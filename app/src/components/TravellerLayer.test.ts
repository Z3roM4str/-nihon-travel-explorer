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
  it("has no permanent header surface — the «Eres» switcher is gone (DD-007, B26)", async () => {
    const app = await readAppSource("App.tsx");
    expect(app).not.toContain("TravellerBar");
    const screen = await readSource("NosotrosScreen.tsx");
    expect(screen.match(/<TravellerManager/g) ?? []).toHaveLength(1);
  });

  it("puts no person picker in front of the save action", async () => {
    const card = withoutComments(await readSource("PlaceCard.tsx"));
    // One control, one tap, exactly as before this block. The card never asks WHO is saving: no
    // <select>, no radio, no per-card traveller id. (`onSelect`/`selected` are the pre-existing
    // props for opening and highlighting a card, which is why this looks for elements, not words.)
    expect(card).toContain("onClick={() => onToggleSaved(place.id)}");
    expect(card).not.toMatch(/<select|type="radio"|travellerId|activeTraveller/);
    // Bloque 19 (B3, `04 §5.10`): `PlaceCard` ahora sirve dos variantes (`normal`/`compact`) del
    // mismo componente, en vez de vivir duplicado — cada una tiene su propio botón de guardar,
    // de ahí las dos llamadas en vez de una.
    expect(card.match(/onToggleSaved\(/g) ?? []).toHaveLength(2);
  });

  it("renders the card marker only when one was resolved", async () => {
    // Bloque 19 (B3, `04 §5.5`): el marcador de chip de texto (`interestMarker`) que este test
    // comprobaba se sustituye, sólo en `PlaceCard`, por `otherPersonMarker` — un `PersonToken`
    // junto al corazón en vez de un chip dentro del cuerpo. `SelectionPanel.tsx` sigue usando
    // `interestMarker` sin cambios (ver el resto de este fichero). La garantía que este test
    // protege — nada se pinta cuando no hay nada que decir — se traslada intacta al nuevo prop.
    const card = await readSource("PlaceCard.tsx");
    expect(card).toContain("{otherPersonMarker &&");
    expect(card).toContain("otherPersonMarker?: OtherPersonMarker | null;");
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
    expect(app).toContain("<NosotrosScreen");
    expect(await readSource("NosotrosScreen.tsx")).toContain("<TravellerManager");
    expect(app).not.toContain("travellerManagerOpen");
    expect(app).not.toMatch(/useEffect\([^)]*setTravellerManagerOpen\(true\)/);
  });
});

describe("no score, no ranking, no dating app", () => {
  it("emits no percentage, score or compatibility figure anywhere in the layer", async () => {
    for (const name of ["TravellerManager.tsx", "PlaceCard.tsx", "PlaceDetail.tsx", "SelectionPanel.tsx"]) {
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
    for (const name of ["TravellerManager.tsx", "PlaceDetail.tsx"]) {
      const code = withoutComments(await readSource(name));
      expect(code, name).not.toMatch(
        /racha|nivel|puntos|insignia|logro|ganas|pierdes|mejor para|os conviene|recomendad/i
      );
    }
  });
});

describe("accessibility", () => {
  it("marks the active traveller in text, with an icon and a spelled-out switch button (B26)", async () => {
    const manager = await readSource("TravellerManager.tsx");
    expect(manager).toContain("Este dispositivo lo usa {traveller.label}");
    expect(manager).toContain("Usar este dispositivo como {traveller.label}");
    expect(manager).toContain("traveller-card--active");
    expect(manager).toContain('role="status"');
  });

  it("never relies on colour alone — every marker renders its label as text", async () => {
    // Bloque 19 (B3): en `PlaceCard`, el marcador de la otra persona es un `PersonToken`, no un
    // chip de texto — su no-color-only lo lleva el propio `PersonToken` (la inicial dentro del
    // círculo, más un `aria-label`/`title` explícito), nunca sólo `--person-a`/`--person-b`.
    // `PlaceCard` pasa un texto propio («{nombre} quiere ir», voz coherente con
    // `interestMarker`'s "{who} quiere ir") en vez del "Eres {nombre}" por defecto, que sólo
    // tiene sentido para la identidad de la persona activa en la cabecera.
    const token = await readSource("PersonToken.tsx");
    expect(token).toContain("aria-label={accessibleText}");
    expect(token).toContain("title={accessibleText}");
    expect(token).toContain("{initial}");
    const card = await readSource("PlaceCard.tsx");
    expect(card).toContain("label={`${otherPersonMarker.traveller.label} quiere ir`}");
    // B25 (B7): Quiero ir ya no usa el chip de texto por fila — cada sección dice de quién es con
    // su titular «Sólo {nombre}» y un `PersonToken` con la inicial y un nombre accesible propio.
    const panel = await readSource("SelectionPanel.tsx");
    expect(panel).toContain("title={`Sólo ${section.traveller.label}`}");
    expect(panel).toContain("label={`${section.traveller.label} quiere ir`}");
  });

  /**
   * B26: `TravellerManager` es contenido de Nosotros › Viajeros, nunca una capa flotante: sin
   * `role="dialog"`, sin `aria-modal`, sin trampa de foco y sin cierre.
   */
  it("is section content, not a dialog", async () => {
    const manager = withoutComments(await readSource("TravellerManager.tsx"));
    expect(manager).not.toMatch(/role=\{?["']?dialog|aria-modal|onClose|embedded/);
  });

  it("names every destructive control with the person it affects", async () => {
    const manager = await readSource("TravellerManager.tsx");
    expect(manager).toMatch(/Reiniciar lo que ha guardado \$\{traveller\.label\}/);
    expect(manager).toMatch(/Quitar a \$\{traveller\.label\} del viaje/);
  });

  it("removes from Quiero ir only the active traveller's own interest (B25)", async () => {
    // B25 (B7): quitar es el corazón de la persona activa (`PlaceCard compact`, «Quitar {lugar}
    // de Quiero ir»), que en Quiero ir pasa por `removeSaved` — sólo la postura de quien usa el
    // dispositivo — y confirma con «Deshacer».
    const app = withoutComments(await readAppSource("App.tsx"));
    expect(app).toMatch(/if \(isWantedByActive\(id\)\) removeSavedWithUndo\(id\)/);
    expect(app).toMatch(/const snapshot = snapshotActiveInterest\(id\);\s*removeSaved\(id\);/);
    const hook = withoutComments(await readAppSource("useTravellers.ts"));
    expect(hook).toContain("withStance(current, id, current.activeTravellerId, null)");
  });

  it("announces a destructive confirmation", async () => {
    const manager = await readSource("TravellerManager.tsx");
    expect(manager.match(/role="alert"/g) ?? []).toHaveLength(2);
  });

  it("keeps every new control at the 44px tap floor", async () => {
    const css = await readAppSource("App.css");
    for (const selector of [
      ".traveller-manager__input",
      ".traveller-card__use",
      ".place-interest__decline",
    ]) {
      const block = css.slice(css.indexOf(`${selector} {`), css.indexOf(`${selector} {`) + 400);
      expect(block, selector).toMatch(/var\(--tap-(target|min)\)/);
    }
  });

  it("has no transitions of its own to disable under reduced motion", async () => {
    const css = await readAppSource("App.css");
    const cards = css.slice(css.indexOf(".traveller-card {"), css.indexOf(".traveller-manager__confirm {"));
    expect(cards).not.toMatch(/transition|animation/);
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
    expect(app).toMatch(/type ViajeSection = "dias" \| "dormir" \| "reservas" \| "resumen";/);
    // Post-close correction: gated by `viajeVisited`, not `destination`, so leaving the Viaje
    // tab no longer unmounts whichever of the two is active (`02 §D3`) — see
    // `block18-shell.test.ts`'s "Viaje conserva su estado" describe block for full coverage.
    expect(app).toMatch(
      /\{viajeVisited && \(\s*<div hidden=\{viajeSection === "dormir"\}>\s*<OrderedSequenceBuilder/
    );
    expect(app).toMatch(
      /\{zonesVisited && zonesHub && \(\s*<div hidden=\{viajeSection !== "dormir"\}>\s*<ZoneComparison/
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
