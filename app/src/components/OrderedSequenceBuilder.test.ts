import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Phase 3D-B's corrective review asked for automated coverage proving `OrderedSequenceBuilder.tsx`
 * still wires and renders the weekday-closure signal — the pure-domain tests in
 * `day-weekday-signal.test.ts`/`temporal-availability.test.ts` prove the underlying logic is
 * correct, but none of them touch this component's own source.
 *
 * This repository has no component-level test harness (no jsdom, no Testing Library — see the
 * precedent noted in `docs/ROADMAP.md`'s Phase 3B2I entry), and adding one is out of scope for
 * this corrective pass (no new dependency). So this is a structural, source-scanning regression
 * test — the same technique `app/server/transit.test.ts` already uses to prove its module
 * references no persistence API — not a substitute for a future proper component test harness.
 * It was additionally backed by manual browser verification via Playwright during development
 * (see `docs/ROADMAP.md`'s Phase 3D-B entry): a Monday start date surfaced the warning naming
 * both matched test places; a Tuesday date showed only the neutral no-match line; clearing the
 * date removed the section entirely.
 */

const SOURCE_PATH = new URL("./OrderedSequenceBuilder.tsx", import.meta.url);

async function readSource(): Promise<string> {
  return readFile(SOURCE_PATH, "utf8");
}

/**
 * Isolates just the `WeekdayClosureNotice` function's body — from its declaration up to (but not
 * including) the next top-level `function` declaration — so wording/forbidden-phrase assertions
 * are scoped to the actual user-facing section this phase added, not the whole ~800-line file
 * (which legitimately contains unrelated words like "Cerrar" on close buttons).
 */
function extractWeekdayClosureNoticeSource(fullSource: string): string {
  const start = fullSource.indexOf("function WeekdayClosureNotice");
  if (start === -1) {
    throw new Error("WeekdayClosureNotice function not found in OrderedSequenceBuilder.tsx");
  }
  const nextFunctionStart = fullSource.indexOf("\nfunction ", start + 1);
  if (nextFunctionStart === -1) {
    throw new Error("Could not find the end boundary of WeekdayClosureNotice (no following function)");
  }
  return fullSource.slice(start, nextFunctionStart);
}

describe("OrderedSequenceBuilder.tsx — weekday-closure signal wiring (source-scanning integration check)", () => {
  it("imports buildDayWeekdaySignal from the day-weekday-signal module", async () => {
    const source = await readSource();
    expect(source).toMatch(/import\s*\{[^}]*\bbuildDayWeekdaySignal\b[^}]*\}\s*from\s*["']\.\.\/lib\/day-weekday-signal["']/);
  });

  it("computes the signal from the day's places and its derived dayDate", async () => {
    const source = await readSource();
    // The exact call site: buildDayWeekdaySignal(places, dayDate) — proves it is computed per
    // day bucket from that day's own places and its own derived date, not some global state.
    expect(source).toMatch(/buildDayWeekdaySignal\(\s*places\s*,\s*dayDate\s*\)/);
  });

  it("renders WeekdayClosureNotice with the computed signal", async () => {
    const source = await readSource();
    expect(source).toContain("function WeekdayClosureNotice(");
    // JSX usage, passing the same variable the call site above assigns.
    expect(source).toMatch(/<WeekdayClosureNotice\s+signal=\{weekdaySignal\}\s*\/>/);
  });

  it("renders inside the existing day-card view, not a second dialog/modal", async () => {
    const source = await readSource();
    const noticeSource = extractWeekdayClosureNoticeSource(source);
    // The notice itself introduces no dialog semantics.
    expect(noticeSource).not.toMatch(/role=["']dialog["']/);
    expect(noticeSource).not.toMatch(/aria-modal/);
    // The whole file still has exactly one dialog root — Phase 3D-B did not add a second one.
    const dialogRootCount = (source.match(/role="dialog"/g) ?? []).length;
    expect(dialogRootCount).toBe(1);
  });

  describe("WeekdayClosureNotice wording (scoped to its own function body)", () => {
    it("uses conservative match wording — 'posible … coincidencia … cierre semanal'", async () => {
      const noticeSource = extractWeekdayClosureNoticeSource(await readSource());
      expect(noticeSource).toMatch(/posible/i);
      expect(noticeSource).toMatch(/coincidencia/i);
      expect(noticeSource).toMatch(/cierre semanal/i);
    });

    it("uses the neutral zero-match wording — 'Sin coincidencias de cierre semanal detectadas'", async () => {
      const noticeSource = extractWeekdayClosureNoticeSource(await readSource());
      expect(noticeSource).toContain("Sin coincidencias de cierre semanal detectadas");
    });

    it("discloses the not-evaluable limitation (references notEvaluableCount and 'evaluarse')", async () => {
      const noticeSource = extractWeekdayClosureNoticeSource(await readSource());
      expect(noticeSource).toContain("notEvaluableCount");
      expect(noticeSource).toMatch(/evaluarse/i);
    });

    it("carries the standing disclaimer naming every excluded verification axis", async () => {
      const noticeSource = extractWeekdayClosureNoticeSource(await readSource());
      for (const term of ["horarios", "festivos", "cierres temporales", "clima", "reservas", "estado real"]) {
        expect(noticeSource.toLowerCase(), `disclaimer should mention "${term}"`).toContain(term);
      }
    });

    it("never claims a place is closed or a day is valid/compatible/best", async () => {
      const noticeSource = extractWeekdayClosureNoticeSource(await readSource());
      const lower = noticeSource.toLowerCase();
      for (const forbidden of ["está cerrado", "día válido", "día compatible", "mejor día"]) {
        expect(lower, `should not contain "${forbidden}"`).not.toContain(forbidden);
      }
    });
  });

  it("does not read place.schedule.hours, place.bestTime, or place.febMar2027 in the notice itself", async () => {
    // Scoped to WeekdayClosureNotice's own body only — the surrounding file's module doc
    // comments legitimately *mention* these field names in prose (to state they are NOT read
    // anywhere in this component, a guarantee predating this phase), so a whole-file scan would
    // false-fail on that prose rather than on any real code reference.
    const noticeSource = extractWeekdayClosureNoticeSource(await readSource());
    for (const forbidden of ["schedule.hours", "bestTime", "febMar2027"]) {
      expect(noticeSource, forbidden).not.toContain(forbidden);
    }
  });
});

/**
 * Phase 3D-D's structural integration coverage for the "Reservas por preparar" section — the
 * same source-scanning technique the weekday-closure block above already established, for the
 * same reason (no jsdom/Testing Library in this repository). The underlying domain logic
 * (classification parity, whole-string opacity protection, aggregation order/omission rules) is
 * proven once, thoroughly, in `lib/reservation-lead-time.test.ts` and
 * `lib/reservation-planning.test.ts`; this file protects only the WIRING — that this component
 * actually calls that domain and renders its output, route-wide, without any date/deadline
 * arithmetic creeping in at the integration layer.
 *
 * Scans are scoped to `ReservationPreparationSection`'s own function body (via
 * `extractReservationPreparationSectionSource`) rather than the whole ~950-line file, so the
 * forbidden-phrase checks below cannot false-fail on unrelated prose elsewhere in the file (e.g.
 * this same file's calendar-anchoring disclaimers, which legitimately discuss `startDate`).
 */
function extractReservationPreparationSectionSource(fullSource: string): string {
  const start = fullSource.indexOf("function ReservationPreparationSection");
  if (start === -1) {
    throw new Error("ReservationPreparationSection function not found in OrderedSequenceBuilder.tsx");
  }
  const nextFunctionStart = fullSource.indexOf("\nfunction ", start + 1);
  if (nextFunctionStart === -1) {
    throw new Error("Could not find the end boundary of ReservationPreparationSection (no following function)");
  }
  return fullSource.slice(start, nextFunctionStart);
}

describe("OrderedSequenceBuilder.tsx — reservation lead-time signal wiring (source-scanning integration check)", () => {
  it("imports buildReservationPreparationSummary from the reservation-planning module", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bbuildReservationPreparationSummary\b[^}]*\}\s*from\s*["']\.\.\/lib\/reservation-planning["']/
    );
  });

  it("computes the summary from the current canonical route (routePlaces), not a day bucket", async () => {
    const source = await readSource();
    expect(source).toMatch(/buildReservationPreparationSummary\(\s*routePlaces\s*\)/);
  });

  it("renders ReservationPreparationSection in the builder view with the computed summary", async () => {
    const source = await readSource();
    expect(source).toContain("function ReservationPreparationSection(");
    expect(source).toMatch(/<ReservationPreparationSection\s+summary=\{reservationPreparation\}\s*\/>/);
  });

  it("renders inside the existing single dialog, not a second dialog/modal", async () => {
    const source = await readSource();
    const sectionSource = extractReservationPreparationSectionSource(source);
    expect(sectionSource).not.toMatch(/role=["']dialog["']/);
    expect(sectionSource).not.toMatch(/aria-modal/);
    const dialogRootCount = (source.match(/role="dialog"/g) ?? []).length;
    expect(dialogRootCount).toBe(1);
  });

  it("renders both a coarse-magnitude signal and a specific-mechanism review signal", async () => {
    const sectionSource = extractReservationPreparationSectionSource(await readSource());
    expect(sectionSource).toContain("coarse-magnitude");
    expect(sectionSource).toMatch(/Anticipación registrada/);
    expect(sectionSource).toMatch(/Mecanismo específico/);
  });

  it("always renders the raw evidence text alongside the derived signal", async () => {
    const sectionSource = extractReservationPreparationSectionSource(await readSource());
    expect(sectionSource).toMatch(/item\.leadTime\.raw/);
  });

  it("does not read startDate, a derived day date, or Date.now anywhere in the section", async () => {
    const sectionSource = extractReservationPreparationSectionSource(await readSource());
    for (const forbidden of ["startDate", "dayDate", "Date.now", "addCivilDays"]) {
      expect(sectionSource, forbidden).not.toContain(forbidden);
    }
  });

  it("never states a booking deadline, a days-remaining count, or an urgency judgment", async () => {
    const sectionSource = extractReservationPreparationSectionSource(await readSource());
    const lower = sectionSource.toLowerCase();
    for (const forbidden of ["reserva antes del", "te quedan", "ya deberías reservar", "estás a tiempo", "urgente"]) {
      expect(lower, `should not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("never pluralizes 'registrada' — 'anticipación' is the noun being agreed with and stays singular regardless of count", async () => {
    // Corrective regression: a prior version conditionally appended "s" onto "registrada" when
    // the count was greater than 1, producing the grammatically wrong "N con anticipación
    // registradas". "anticipación" itself never pluralizes here, so "registrada" must not either.
    const sectionSource = extractReservationPreparationSectionSource(await readSource());
    expect(sectionSource).not.toContain("registradas");
    expect(sectionSource).toContain("con anticipación registrada");
  });
});

/**
 * Phase 3D-E's structural integration coverage for the "Horarios registrados" section — the same
 * source-scanning technique the two blocks above already established, for the same reason (no
 * jsdom/Testing Library in this repository). The underlying domain logic (category/tier parity
 * with `scripts/temporal_data_lib.py`, priority order, safe-interval-extraction isolation,
 * aggregation order/inclusion rules) is proven once, thoroughly, in `lib/recorded-hours.test.ts`
 * and `lib/hours-planning.test.ts`; this file protects only the WIRING.
 *
 * Scans are scoped to `HoursPlanningSection`'s own function body via
 * `extractHoursPlanningSectionSource`, for the same reason the other two extractors exist: so the
 * forbidden-phrase checks below cannot false-fail on unrelated prose elsewhere in this file.
 */
function extractHoursPlanningSectionSource(fullSource: string): string {
  const start = fullSource.indexOf("function HoursPlanningSection");
  if (start === -1) {
    throw new Error("HoursPlanningSection function not found in OrderedSequenceBuilder.tsx");
  }
  const nextFunctionStart = fullSource.indexOf("\nfunction ", start + 1);
  if (nextFunctionStart === -1) {
    throw new Error("Could not find the end boundary of HoursPlanningSection (no following function)");
  }
  return fullSource.slice(start, nextFunctionStart);
}

describe("OrderedSequenceBuilder.tsx — recorded-hours signal wiring (source-scanning integration check)", () => {
  it("imports buildRecordedHoursSummary from the hours-planning module", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bbuildRecordedHoursSummary\b[^}]*\}\s*from\s*["']\.\.\/lib\/hours-planning["']/
    );
  });

  it("computes the summary from the current canonical route (routePlaces), not a day bucket", async () => {
    const source = await readSource();
    expect(source).toMatch(/buildRecordedHoursSummary\(\s*routePlaces\s*\)/);
  });

  it("renders HoursPlanningSection in the builder view with the computed summary", async () => {
    const source = await readSource();
    expect(source).toContain("function HoursPlanningSection(");
    expect(source).toMatch(/<HoursPlanningSection\s+summary=\{recordedHours\}\s*\/>/);
  });

  it("renders inside the existing single dialog, not a second dialog/modal", async () => {
    const source = await readSource();
    const sectionSource = extractHoursPlanningSectionSource(source);
    expect(sectionSource).not.toMatch(/role=["']dialog["']/);
    expect(sectionSource).not.toMatch(/aria-modal/);
    const dialogRootCount = (source.match(/role="dialog"/g) ?? []).length;
    expect(dialogRootCount).toBe(1);
  });

  it("renders every route place — no tier is omitted, unlike the reservation section", async () => {
    const sectionSource = extractHoursPlanningSectionSource(await readSource());
    // Renders unconditionally over summary.items with no per-item filter/omission logic.
    expect(sectionSource).toMatch(/summary\.items\.map/);
    expect(sectionSource).not.toMatch(/\.filter\(/);
  });

  it("renders the SAFE recorded-interval wording with the actual interval token", async () => {
    // hoursSignalText (which builds this phrase) is a small helper defined just above
    // HoursPlanningSection, not inside its own body, so this checks the whole file rather than
    // the narrowly-scoped section extract used for forbidden-phrase checks below.
    const source = await readSource();
    expect(source).toMatch(/recorded-interval/);
    expect(source).toMatch(/Horario registrado: \$\{fact\.intervalRaw\}/);
  });

  it("renders the SAFE 24h wording distinctly from the interval wording", async () => {
    const source = await readSource();
    expect(source).toContain("Acceso registrado: 24 h");
  });

  it("renders PARTIAL/OPAQUE/UNKNOWN wording distinctly, every phrase ending in a review call", async () => {
    const source = await readSource();
    for (const phrase of [
      "con condiciones; revisar",
      "operador externo; revisar",
      "estacional; revisar",
      "relativo a la luz solar; revisar",
      "diurno registrado; revisar",
      "alternativas registradas; revisar",
      "Horario variable; revisar dato original",
      "Horario no estructurado; revisar",
    ]) {
      expect(source, phrase).toContain(phrase);
    }
  });

  it("always renders the raw evidence text alongside the derived signal", async () => {
    const sectionSource = extractHoursPlanningSectionSource(await readSource());
    expect(sectionSource).toMatch(/item\.hours\.raw/);
  });

  it("does not read startDate, a derived day date, or Date.now anywhere in the section", async () => {
    const sectionSource = extractHoursPlanningSectionSource(await readSource());
    for (const forbidden of ["startDate", "dayDate", "Date.now", "addCivilDays"]) {
      expect(sectionSource, forbidden).not.toContain(forbidden);
    }
  });

  it("does not read schedule.closures, bestTime, or febMar2027 in the section itself", async () => {
    const sectionSource = extractHoursPlanningSectionSource(await readSource());
    for (const forbidden of ["schedule.closures", "bestTime", "febMar2027"]) {
      expect(sectionSource, forbidden).not.toContain(forbidden);
    }
  });

  it("never contains open/closed/feasibility vocabulary", async () => {
    const sectionSource = extractHoursPlanningSectionSource(await readSource());
    const lower = sectionSource.toLowerCase();
    for (const forbidden of [
      "está abierto",
      "está cerrado",
      "disponible",
      "no disponible",
      "factible",
      "compatible",
      "incompatible",
      "encaja",
      "día válido",
    ]) {
      expect(lower, `should not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });
});
