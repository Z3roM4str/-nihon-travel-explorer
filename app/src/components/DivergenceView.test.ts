import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { readProductCss } from "../test-css";
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
    // B25 (B7): el filtro es ahora el segmentado de Quiero ir — sigue siendo estado de vista.
    const panel = withoutComments(await readSource("SelectionPanel.tsx"));
    expect(panel).toContain('useState<QuieroIrLens>("both")');
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
    expect(hook).toContain("StoredDocumentAdapter<ManualPlanningDraftV8>");
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

/**
 * B25 — B7 «Quiero ir» (`05 §6`, `10 §B7`). La barra de filtros de Bloque 6 deja de ser la forma
 * de ver la divergencia: la pantalla se ORGANIZA por ella. Lo que se conserva, y estos tests
 * fijan, es que la organización se lee de los mismos módulos puros de Bloques 5 y 6.
 */
describe("the screen is organised by the Block 5/6 groups, not by a new calculation", () => {
  it("places each shortlisted place by its divergence group and its interest summary", async () => {
    const organiser = withoutComments(await readAppSource("lib/quiero-ir.ts"));
    expect(organiser).toContain('if (group === "agreed") agreed.push(place);');
    expect(organiser).toContain('else if (group === "differing") differing.push(place);');
    expect(organiser).toContain('else if (group === "unclaimed") unclaimed.push(place);');
    expect(organiser).toContain("const summary = interestSummary(place.id);");
    expect(organiser).not.toMatch(/\.sort\(|withStance|setItem/);
  });

  it("shows the agreement first, with no click, and the one-sided places after it", async () => {
    const panel = withoutComments(await readSource("SelectionPanel.tsx"));
    const agreed = panel.indexOf("Los dos queréis ir");
    const only = panel.indexOf("title={`Sólo ${section.traveller.label}`}");
    const declined = panel.indexOf('title="Descartados"');
    expect(agreed).toBeGreaterThan(0);
    expect(only).toBeGreaterThan(agreed);
    expect(declined).toBeGreaterThan(only);
    // The agreement heading is not a disclosure: nothing has to be pressed to see it.
    const agreedBlock = panel.slice(panel.lastIndexOf("<section", agreed), agreed);
    expect(agreedBlock).not.toContain("aria-expanded");
  });

  it("keeps «opiniones distintas» and «sin reclamar» apart from «sólo una persona»", async () => {
    const panel = withoutComments(await readSource("SelectionPanel.tsx"));
    expect(panel).toContain('title={filterLabel("differing")}');
    expect(panel).toContain('title={filterLabel("unclaimed")}');
    expect(panel).toContain("divergenceLine(entry.group, travellers, activeTravellerId)");
    expect(panel).toContain("plannedNote(entry)");
  });

  it("adds no second main surface — the view lives inside Quiero ir", async () => {
    const app = await readAppSource("App.tsx");
    expect(app).not.toMatch(/DivergencePanel|DisagreementScreen|setDivergenceOpen/);
    expect(app).not.toContain("ShortlistFilterBar");
    expect(app).not.toMatch(/analysisVisible|onAnalyze/);
  });

  it("never changes who is using the device from the segmented control", async () => {
    const panel = withoutComments(await readSource("SelectionPanel.tsx"));
    expect(panel).not.toMatch(/setActiveTraveller|onSelectTraveller/);
    expect(panel).toContain('role="radiogroup"');
    expect(panel).toContain("aria-checked={checked}");
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
    const css = await readProductCss();
    const chip = css.slice(css.indexOf(".shortlist-filters__chip {"));
    expect(chip.slice(0, 400)).toContain("min-height: var(--tap-target)");
  });

  it("distinguishes a pressed chip by more than hue", async () => {
    const css = await readProductCss();
    const active = css.slice(css.indexOf(".shortlist-filters__chip--active {"));
    const block = active.slice(0, active.indexOf("}"));
    expect(block).toContain("border-color:");
    expect(block).toContain("background:");
  });

  it("honours reduced motion", async () => {
    const css = await readProductCss();
    const queries = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)];
    expect(queries.some((query) => query[1].includes(".shortlist-filters__chip"))).toBe(true);
  });

  it("keeps the row from forcing a horizontal page scroll on a phone", async () => {
    const css = await readProductCss();
    const row = css.slice(css.indexOf(".shortlist-filters {"));
    expect(row.slice(0, 400)).toContain("overflow-x: auto");
  });

  it("states an empty agreement as a fact, not as an error", async () => {
    const panel = await readSource("SelectionPanel.tsx");
    expect(panel).toContain('emptyFilterSentence("agreed")');
    expect(panel).toContain("Cuando {yetToMark.label} marque sus sitios, aquí veréis en qué coincidís.");
  });
});
