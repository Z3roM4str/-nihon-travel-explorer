import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Phase 3D-W — §15 tests 65–69, plus the forbidden-copy scan.
 *
 * This repository has no component-level test harness (no jsdom, no Testing Library — see the
 * precedent recorded in `docs/ROADMAP.md`'s Phase 3B2I entry and reused by
 * `OrderedSequenceBuilder.test.ts`), and adding one is out of scope for this phase (no new
 * dependency). So the WIRING and the COPY are asserted here by scanning this component's own
 * source, while everything that can be tested behaviourally — the assessment itself, the
 * calendar-day counting, the bucket/mismatch facts, the persistence round-trip and the
 * independence of every real temporal evaluator — is tested against real behaviour in
 * `lib/trip-bounds.test.ts`, `lib/planning-draft-v6.test.ts` and `lib/trip-bounds-consumers.test.ts`.
 * The rendered result was additionally verified in a real browser via Playwright (see
 * `docs/ROADMAP.md`'s Phase 3D-W entry).
 */

const SOURCE_PATH = new URL("./OrderedSequenceBuilder.tsx", import.meta.url);

async function readSource(): Promise<string> {
  return readFile(SOURCE_PATH, "utf8");
}

/** Isolates one top-level `function X(` body, up to the next top-level declaration, so wording
 * assertions are scoped to the section this phase added rather than the whole file. */
function extractFunctionSource(fullSource: string, name: string): string {
  const start = fullSource.indexOf(`function ${name}`);
  if (start === -1) throw new Error(`${name} not found in OrderedSequenceBuilder.tsx`);
  const boundary = /\n(?:export )?(?:function|const|type|class) /g;
  boundary.lastIndex = start + 1;
  const next = boundary.exec(fullSource);
  if (!next) throw new Error(`Could not find the end boundary of ${name}`);
  return fullSource.slice(start, next.index);
}

/** Strips comments, so copy assertions read the rendered strings rather than the prose that
 * documents which strings are forbidden. */
function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("trip-bounds wiring (source-scanning integration check)", () => {
  it("imports the pure assessment and summary from the trip-bounds module", async () => {
    const source = await readSource();
    expect(source).toMatch(/import \{[\s\S]*assessTripBounds[\s\S]*\} from "\.\.\/lib\/trip-bounds"/);
    expect(source).toMatch(/import \{[\s\S]*buildTripBoundsSummary[\s\S]*\} from "\.\.\/lib\/trip-bounds"/);
  });

  it("reads endDate and setEndDate from the single canonical planning-draft hook", async () => {
    const source = await readSource();
    // Destructured from `usePlanningDraft(savedIds)` alongside startDate — no second useState.
    expect(source).toMatch(/^\s{4}endDate,$/m);
    expect(source).toMatch(/^\s{4}setEndDate,$/m);
    expect(source).not.toMatch(/useState[^\n]*endDate/i);
  });

  it("computes the assessment from the bounds and the day's ORDINAL — never a day id", async () => {
    const source = await readSource();
    expect(source).toContain("assessTripBounds({ startDate, endDate }, dayIndex)");
    expect(source).not.toMatch(/assessTripBounds\([^)]*dayEntity/);
    expect(source).not.toMatch(/assessTripBounds\([^)]*\.id/);
  });

  it("derives the summary from the bounds and the bucket count, with days: null giving null", async () => {
    const source = await readSource();
    expect(source).toContain("buildTripBoundsSummary({ startDate, endDate }, days === null ? null : days.length)");
  });

  it("renders the end-date control inside the existing .calendar-anchor block — no new surface", async () => {
    const source = await readSource();
    expect(source).toContain('<label htmlFor="sequence-end-date" className="calendar-anchor__label">');
    expect(source).toContain("Fecha de fin (último día del viaje)");
    expect(source).toContain('id="sequence-end-date"');
    expect(source).toContain('type="date"');
    expect(source).toContain('value={endDate ?? ""}');
    expect(source).toContain("setEndDate(event.target.value || null)");
    // The existing Día 1 control is untouched and still present.
    expect(source).toContain("Fecha de inicio (Día 1)");
    expect(source).toContain('value={startDate ?? ""}');
  });

  it("offers a clear button only when an end date exists, using the canonical setter", async () => {
    const source = await readSource();
    const block = source.slice(source.indexOf('id="sequence-end-date"'));
    expect(block).toMatch(/\{endDate && \(/);
    expect(block).toContain("onClick={() => setEndDate(null)}");
    expect(block).toContain("Quitar fecha");
  });

  it("adds no modal, wizard, dialog, route or new page for the bounds UI", async () => {
    const source = await readSource();
    // Exactly one dialog exists in this component, as before this phase.
    expect(source.match(/role="dialog"/g) ?? []).toHaveLength(1);
    for (const forbidden of ["Wizard", "Modal", "useNavigate", "<Route", "createPortal"]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });

  it("renders the per-day warning inside the existing day card, alongside its heading and date", async () => {
    const source = await readSource();
    expect(source).toContain("<TripBoundsDayWarning assessment={boundsAssessment} />");
    const cardHeader = source.slice(source.indexOf("<h3 id={`day-heading-${dayIndex}`}>"));
    // The warning sits next to — not instead of — the heading, the date and the controls.
    expect(cardHeader.indexOf("<TripBoundsDayWarning")).toBeLessThan(400);
    expect(source).toContain("{dayDate && <p className=\"day-card__date\">{formatCivilDateDisplay(dayDate)}</p>}");
  });

  it("never hides, disables, reorders or deletes a day because of its assessment", async () => {
    const source = await readSource();
    const code = stripComments(source);
    // No conditional rendering, disabling, filtering or removal keyed off the assessment.
    expect(code).not.toMatch(/after-trip-end[^\n]*\?\s*null/);
    expect(code).not.toMatch(/disabled=\{[^}]*boundsAssessment/);
    expect(code).not.toMatch(/filter\([^)]*boundsAssessment/);
    expect(code).not.toMatch(/boundsAssessment[^\n]*removeEmptyDay/);
    expect(code).not.toMatch(/boundsAssessment[^\n]*moveDay/);
    // The card's own controls are rendered unconditionally with respect to bounds.
    expect(code).toContain("dayPlaceLists.map((places, dayIndex) => {");
  });
});

describe("TripBoundsDayWarning wording (scoped to its own function body)", () => {
  async function warningSource(): Promise<string> {
    return stripComments(extractFunctionSource(await readSource(), "TripBoundsDayWarning"));
  }

  it("uses the approved wording", async () => {
    expect(await warningSource()).toContain("Este día es posterior a la fecha de fin de tu viaje.");
  });

  it("renders nothing at all for any kind other than after-trip-end", async () => {
    const body = await warningSource();
    expect(body).toContain('if (assessment.kind !== "after-trip-end") return null;');
  });

  it("is a status signal, kept separate from the invalid-partition alert", async () => {
    const body = await warningSource();
    expect(body).toContain('role="status"');
    expect(body).not.toContain('role="alert"');
    // The pre-existing invalid-partition banner still exists and is still the only role="alert"
    // in the days view, unmerged with this one.
    const source = await readSource();
    expect(source).toContain('className="analysis-disclaimer sequence-day-invalid" role="alert"');
  });
});

describe("TripBoundsNotice — three distinct facts, no recommendation", () => {
  async function noticeSource(): Promise<string> {
    return stripComments(extractFunctionSource(await readSource(), "TripBoundsNotice"));
  }

  it("renders the chosen range with its inclusive calendar-day count", async () => {
    const body = await noticeSource();
    expect(body).toContain("Rango elegido:");
    expect(body).toContain("días de calendario");
    expect(body).toContain("formatCivilDateDisplay(startDate)");
    expect(body).toContain("formatCivilDateDisplay(endDate)");
    expect(body).toContain("tripCalendarDays");
  });

  it("renders the bucket count as a SEPARATE fact from the range", async () => {
    const body = await noticeSource();
    expect(body).toContain("Días creados:");
    expect(body).toContain("trip-bounds-notice__buckets");
    expect(body).toContain("trip-bounds-notice__range");
  });

  it("renders the mismatch as a THIRD, separately classed fact", async () => {
    const body = await noticeSource();
    expect(body).toContain("trip-bounds-notice__mismatch");
    expect(body).toContain("posteriores a la fecha de fin");
    expect(body).toContain("daysAfterTripEnd");
    // Only shown when there actually is a mismatch.
    expect(body).toContain("daysAfterTripEnd > 0");
  });

  it("renders the three facts as three distinct elements", async () => {
    const body = await noticeSource();
    for (const className of [
      "trip-bounds-notice__range",
      "trip-bounds-notice__buckets",
      "trip-bounds-notice__mismatch",
    ]) {
      expect(body.match(new RegExp(className, "g")) ?? [], className).toHaveLength(1);
    }
  });

  it("covers the only-start, only-end and inverted states with neutral copy", async () => {
    const body = await noticeSource();
    expect(body).toContain("Has fijado la fecha de inicio.");
    expect(body).toContain("Has fijado la fecha de fin.");
    expect(body).toContain("La fecha de fin es anterior a la de inicio.");
    expect(body).toContain("Nihon no");
    expect(body).toContain("revisa las fechas");
  });

  it("states that nothing is modified when the range is inverted", async () => {
    const body = await noticeSource();
    expect(body).toMatch(/no\s+modifica ninguna de las dos ni tus días/);
  });

  it("contains NO duration recommendation, night count, or add/remove-a-day suggestion", async () => {
    const body = await noticeSource();
    const forbidden = [
      "te sobran",
      "te faltan",
      "debería durar",
      "deberías viajar",
      "añade un día",
      "añadir un día",
      "elimina un día",
      "elimina este día",
      "eliminar un día",
      "quita un día",
      "recomendamos",
      "recomendado",
      "te sugerimos",
      "noche",
      "vuelo",
      "aeropuerto",
      "check-in",
      "check-out",
      "salida",
      "llegada",
      "equipaje",
      "ideal",
      "óptimo",
      "demasiado",
      "suficiente",
    ];
    const lowered = body.toLowerCase();
    for (const phrase of forbidden) {
      expect(lowered, phrase).not.toContain(phrase);
    }
  });

  it("gives the fewer and equal cases identical treatment — no branch privileges either", async () => {
    const body = await noticeSource();
    // There is no comparison branch on "fewer vs equal" at all: the only count branch is the
    // mismatch one, which fires solely when buckets exceed the calendar days.
    expect(body).not.toMatch(/dayCount\s*===\s*tripCalendarDays/);
    expect(body).not.toMatch(/dayCount\s*<\s*tripCalendarDays/);
  });

  it("never reads a clock, an instant or a timezone", async () => {
    const body = await noticeSource();
    for (const forbidden of ["Date.now", "new Date(", "toISOString", "getHours", "timeZone", "Asia/Tokyo"]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });
});

describe("no persisted derived bounds state", () => {
  it("the component never writes a count, an assessment or a per-day date back into the draft", async () => {
    const source = stripComments(await readSource());
    for (const forbidden of [
      "setTripCalendarDays",
      "tripLengthDays",
      "setDayDate",
      "localStorage",
      "boundsAssessment)",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
    // The only bounds mutation the component can perform is the one canonical setter.
    expect(source.match(/setEndDate\(/g) ?? []).toHaveLength(2); // the input's onChange + the clear button
  });
});
