import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Block 6 — the wiring contract for the derived "dónde no coincidimos" view.
 *
 * Same source-scanning technique the rest of this directory uses: the pure rules live in
 * `lib/interest-divergence.test.ts`, the words in `lib/divergence-presentation.test.ts`, the
 * real-viewport behaviour in `scripts/block6-divergence-browser-audit.mjs`, and these assertions
 * prove the components wire the pure modules, that the block stores nothing, and that it cannot
 * reach the shared plan.
 */

async function readSource(name: string): Promise<string> {
  return (await readFile(new URL(`./${name}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
}

async function readAppSource(name: string): Promise<string> {
  return (await readFile(new URL(`../${name}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
}

/** Strips comments, so a vocabulary scan asserts on what a module RENDERS rather than on what its
 * documentation explains — these doc comments deliberately name what the block refuses to be. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const BLOCK_6_SOURCES = [
  "lib/interest-divergence.ts",
  "lib/divergence-presentation.ts",
  "usePlannedPlaceIds.ts",
];

describe("the block adds no persistence", () => {
  it("declares no storage key of its own", async () => {
    for (const name of [...BLOCK_6_SOURCES, "components/ShortlistFilterBar.tsx"]) {
      const code = withoutComments(await readAppSource(name));
      expect(code, name).not.toMatch(/nihon\.[a-z]/i);
    }
  });

  it("never writes to storage from any Block 6 module", async () => {
    for (const name of BLOCK_6_SOURCES) {
      const code = withoutComments(await readAppSource(name));
      expect(code, name).not.toMatch(
        /localStorage\.setItem|removeItem|writeDraft|writeTravellersDocument/
      );
    }
  });

  it("hands the draft reader a setter that reaches nothing", async () => {
    const hook = withoutComments(await readAppSource("usePlannedPlaceIds.ts"));
    expect(hook).toContain("setItem: () => {}");
    expect(hook).not.toContain("localStorage.setItem");
  });

  it("keeps the filter in view state, not in storage", async () => {
    const panel = withoutComments(await readSource("SelectionPanel.tsx"));
    expect(panel).toContain('useState<ShortlistFilterKind>("all")');
    expect(panel).not.toMatch(/localStorage|sessionStorage/);
  });

  it("introduces no new document, version or migration", async () => {
    for (const name of BLOCK_6_SOURCES) {
      const code = withoutComments(await readAppSource(name));
      // Declaring one, not naming one: `interest-divergence.ts` reads
      // `TravellersDocumentV1` and must be free to say so in its imports.
      expect(code, name).not.toMatch(/type\s+\w*Document\w*\s*=|version:\s*\d|migrate\w*\(|parseStored/);
    }
  });
});

describe("the shared plan stays untouched", () => {
  it("leaves the planning draft at V8, with no traveller dimension", async () => {
    const hook = await readAppSource("usePlanningDraft.ts");
    expect(hook).toContain("useState<ManualPlanningDraftV8>");
    expect(hook).not.toMatch(/travellerId|perTraveller|personId|divergen/i);
    const draft = await readAppSource("lib/planning-draft-v8.ts");
    expect(draft).not.toMatch(/travellers|traveller|persona|divergence/i);
  });

  it("reads the planner and never writes it", async () => {
    const hook = withoutComments(await readAppSource("usePlannedPlaceIds.ts"));
    expect(hook).toContain("loadReconciledDraft");
    expect(hook).toContain("dayAssignedPlaceIds");
    expect(hook).not.toMatch(/writeDraft|setItem\(PLANNING|with[A-Z]/);
  });

  it("uses day assignment, not route membership, as the meaning of 'planned'", async () => {
    const draft = await readAppSource("lib/planning-draft-v8.ts");
    expect(draft).toMatch(/export function dayAssignedPlaceIds/);
    // `routeIds` is seeded from the saved list, so it is not a decision anybody made.
    const body = draft.slice(draft.indexOf("export function dayAssignedPlaceIds"));
    expect(body).not.toContain("routeIds");
  });

  it("changes no planning operation — the view calls none of them", async () => {
    for (const name of [...BLOCK_6_SOURCES, "components/ShortlistFilterBar.tsx", "components/SelectionPanel.tsx"]) {
      const code = withoutComments(await readAppSource(name));
      expect(code, name).not.toMatch(
        /withDays|withPlaceMoved|withDayMoved|withNewEmptyDay|withoutEmptyDay|withZoneAccommodation|withRoute|withStartDate|withVisitStart/
      );
    }
  });

  it("does not touch the travellers document either — it only reads it", async () => {
    const view = withoutComments(await readAppSource("lib/interest-divergence.ts"));
    expect(view).not.toMatch(/withStance|withToggledInterest|withTraveller|withoutTraveller/);
  });
});

describe("the derived view is wired, once", () => {
  it("derives the entries in App from the hook that owns the document", async () => {
    const app = await readAppSource("App.tsx");
    expect(app).toContain("divergenceFor,");
    expect(app).toContain("const plannedPlaceIds = usePlannedPlaceIds(savedIds, plannerRevision)");
    expect(app).toContain("divergenceFor(plannedPlaceIds)");
    expect(app).toContain("divergence={divergence}");
  });

  /**
   * Bloque 18 (`02 §D2`): «cerrar el planificador» ya no es un evento de modal — es dejar la
   * sección «Planificar» de Viaje por «Dónde dormir» (o por otro destino). `setViajeSectionTracked`
   * es el único punto por el que pasa ese cambio, y sigue siendo el sitio donde se refresca la
   * foto de sólo lectura del Bloque 6.
   */
  it("refreshes the planner snapshot when the reader leaves the planner section", async () => {
    const app = await readAppSource("App.tsx");
    expect(app).toContain("const setViajeSectionTracked = useCallback((section: ViajeSection) => {");
    expect(app).toMatch(/setPlannerRevision\(\(revision\) => revision \+ 1\)/);
  });

  it("keeps the travellers document inside its hook rather than leaking it", async () => {
    const app = await readAppSource("App.tsx");
    expect(app).not.toMatch(/divergenceEntries\(/);
    const hook = withoutComments(await readAppSource("useTravellers.ts"));
    expect(hook).toContain("divergenceEntries(document, plannedPlaceIds)");
  });
});

describe("the default view is unchanged", () => {
  it("renders Block 5's list, markers and all, when no filter is active", async () => {
    const panel = await readSource("SelectionPanel.tsx");
    expect(panel).toContain('filter === "all"\n      ? savedPlaces');
    // The derived line is filtered-only.
    expect(panel).toContain("const entry = filtering ? groupOf.get(place.id) ?? null : null;");
  });

  it("shows one indicator per row, never a marker and a line together", async () => {
    const panel = await readSource("SelectionPanel.tsx");
    expect(panel).toContain(
      "const marker = filtering || !interestMarkerFor ? null : interestMarkerFor(place.id);"
    );
  });

  it("says nothing extra above the list until a filter is pressed", async () => {
    const panel = await readSource("SelectionPanel.tsx");
    expect(panel).toContain("{filtering && (");
    expect(panel).toContain("filterStatusSentence(filter, visiblePlaces.length)");
  });

  it("hides the whole row when it could not partition anything", async () => {
    const bar = await readSource("ShortlistFilterBar.tsx");
    expect(bar).toContain("if (!shouldOfferFilters(counts, active)) return null;");
    const panel = await readSource("SelectionPanel.tsx");
    expect(panel).toContain("{entries.length > 0 && (");
  });

  it("adds no second main surface — the view lives inside the saved list", async () => {
    const app = await readAppSource("App.tsx");
    expect(app).not.toMatch(/DivergencePanel|DisagreementScreen|setDivergenceOpen/);
    // ShortlistFilterBar is rendered by the panel, not by App.
    expect(app).not.toContain("ShortlistFilterBar");
    const panel = await readSource("SelectionPanel.tsx");
    expect(panel).toContain("<ShortlistFilterBar");
  });
});

describe("no score, no ranking, no arbitration", () => {
  it("emits no percentage, score or compatibility figure", async () => {
    for (const name of [
      "lib/interest-divergence.ts",
      "lib/divergence-presentation.ts",
      "components/ShortlistFilterBar.tsx",
      "components/SelectionPanel.tsx",
    ]) {
      const code = withoutComments(await readAppSource(name));
      expect(code, name).not.toMatch(/\bscore\b|\bcompatib|\bafinidad\b|\bmatch(es)?\s*%|\d\s*%/i);
    }
  });

  it("never sorts, ranks or weights the list", async () => {
    for (const name of [
      "lib/interest-divergence.ts",
      "lib/divergence-presentation.ts",
      "components/ShortlistFilterBar.tsx",
    ]) {
      const code = withoutComments(await readAppSource(name));
      expect(code, name).not.toMatch(/\.sort\(|rank|weight|priorit|\bpeso\b/i);
    }
  });

  it("suggests no resolution and picks no winner", async () => {
    for (const name of [
      "lib/divergence-presentation.ts",
      "components/ShortlistFilterBar.tsx",
      "components/SelectionPanel.tsx",
    ]) {
      const code = withoutComments(await readAppSource(name));
      expect(code, name).not.toMatch(
        /conflicto|deberíais|os conviene|mejor opción|votar|votaci|ceder|gana\b|resolver/i
      );
    }
  });

  it("adds no vote, no decision and no new planning action", async () => {
    const panel = withoutComments(await readSource("SelectionPanel.tsx"));
    expect(panel).not.toMatch(/onVote|onResolve|onDecide|onSchedule|onReplace/);
  });
});

describe("accessibility", () => {
  it("marks the selected filter with aria-pressed and a name that says what it selects", async () => {
    const bar = await readSource("ShortlistFilterBar.tsx");
    expect(bar).toContain("aria-pressed={selected}");
    expect(bar).toContain("aria-label={filterAccessibleName(filter, counts[filter])}");
    expect(bar).toContain('role="group"');
    expect(bar).toContain("aria-label={divergenceHeading(counts)}");
  });

  it("never relies on colour alone — the label is text and the count is decorative", async () => {
    const bar = await readSource("ShortlistFilterBar.tsx");
    expect(bar).toContain("{filterLabel(filter)}");
    expect(bar).toContain('<span className="shortlist-filters__count" aria-hidden="true">');
  });

  it("keeps every new control at the 44px tap floor", async () => {
    const css = await readAppSource("App.css");
    const chip = css.slice(css.indexOf(".shortlist-filters__chip {"));
    expect(chip.slice(0, 400)).toContain("min-height: var(--tap-target)");
  });

  it("distinguishes a pressed chip by more than hue", async () => {
    const css = await readAppSource("App.css");
    const active = css.slice(css.indexOf(".shortlist-filters__chip--active {"));
    const block = active.slice(0, active.indexOf("}"));
    expect(block).toContain("border-color:");
    expect(block).toContain("background:");
  });

  it("honours reduced motion", async () => {
    const css = await readAppSource("App.css");
    const query = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(query).toContain(".shortlist-filters__chip");
  });

  it("keeps the row from forcing a horizontal page scroll on a phone", async () => {
    const css = await readAppSource("App.css");
    const row = css.slice(css.indexOf(".shortlist-filters {"));
    expect(row.slice(0, 400)).toContain("overflow-x: auto");
  });

  it("announces the filter status and the empty state politely", async () => {
    const panel = await readSource("SelectionPanel.tsx");
    expect(panel).toContain('className="selection-panel__filter-status" role="status"');
    expect(panel).toContain("emptyFilterSentence(filter)");
  });
});
