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

  it("the route-summary phrase for externalDependencyCount is neutral, never naming 'un tercero' — a weather/tide-dependent place is not a third party", async () => {
    // Corrective regression: externalDependencyCount intentionally combines BOTH OPAQUE
    // categories (weather-or-tide-dependent AND third-party-operator-dependent). A summary
    // phrase reading "N depende de un tercero" is semantically false for a route containing only
    // a weather/tide-dependent place — there is no third party involved at all. The combined
    // count's own phrase must stay neutral over both categories; only the per-item label (checked
    // above, "operador externo; revisar") may name a specific dependency kind.
    const sectionSource = extractHoursPlanningSectionSource(await readSource());
    expect(sectionSource).toContain("con dependencia externa");
    expect(sectionSource).not.toContain("un tercero");
    expect(sectionSource).not.toMatch(/externalDependencyCount\}[^`]*tercero/);
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

/**
 * Phase 3D-H's structural integration coverage for the per-day "ventana de anticipación
 * registrada" signal — the same source-scanning technique the three blocks above already
 * established, for the same reason (no jsdom/Testing Library in this repository). The underlying
 * domain logic (Class A/B/C/D/E classification, reservation-level eligibility, the visit-date
 * contract, cross-axis orthogonality) is proven once, thoroughly, in
 * `lib/reservation-deadline.test.ts`; this file protects only the WIRING — that this component
 * actually calls that domain per day bucket, gates on the stricter visit-date contract, and
 * composes the existing Feb–Mar presentation without a second classifier.
 *
 * Scoped to `ReservationDeadlineNotice`'s own function body (from its declaration up to the
 * following `const RESERVATION_PREP_LABEL` table, its immediate file neighbor) rather than the
 * whole file, so forbidden-phrase checks cannot false-fail on this same file's unrelated prose
 * (e.g. the module doc's own discussion of `febMar2027`/`Date.now`).
 */
function extractReservationDeadlineNoticeSource(fullSource: string): string {
  const start = fullSource.indexOf("function ReservationDeadlineNotice");
  if (start === -1) {
    throw new Error("ReservationDeadlineNotice function not found in OrderedSequenceBuilder.tsx");
  }
  const end = fullSource.indexOf("\nconst RESERVATION_PREP_LABEL", start);
  if (end === -1) {
    throw new Error("Could not find the end boundary of ReservationDeadlineNotice");
  }
  return fullSource.slice(start, end);
}

describe("OrderedSequenceBuilder.tsx — explicit lead-time window wiring (source-scanning integration check)", () => {
  it("imports derivePlaceReservationDateWindow and deriveVisitDateForPlace from the reservation-deadline module", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bderivePlaceReservationDateWindow\b[^}]*\}\s*from\s*["']\.\.\/lib\/reservation-deadline["']/
    );
    expect(source).toMatch(
      /import\s*\{[^}]*\bderiveVisitDateForPlace\b[^}]*\}\s*from\s*["']\.\.\/lib\/reservation-deadline["']/
    );
  });

  it("imports describeFebMarStatusForUi/interpretPlaceFebMarStatus from the existing feb-mar-status module, never a second classifier", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bdescribeFebMarStatusForUi\b[^}]*\}\s*from\s*["']\.\.\/lib\/feb-mar-status["']/
    );
    expect(source).toMatch(
      /import\s*\{[^}]*\binterpretPlaceFebMarStatus\b[^}]*\}\s*from\s*["']\.\.\/lib\/feb-mar-status["']/
    );
  });

  it("computes the visit date via deriveVisitDateForPlace(dayAssignment, startDate, place.id) — the stricter per-place contract, not the existing dayDate", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    expect(noticeSource).toMatch(/deriveVisitDateForPlace\(\s*dayAssignment\s*,\s*startDate\s*,\s*place\.id\s*\)/);
  });

  it("renders ReservationDeadlineNotice per day bucket, passing this day's own places, dayAssignment/startDate and referenceDate", async () => {
    const source = await readSource();
    expect(source).toContain("function ReservationDeadlineNotice(");
    expect(source).toMatch(
      /<ReservationDeadlineNotice\s+places=\{places\}\s+dayAssignment=\{dayAssignment\}\s+startDate=\{startDate\}\s+referenceDate=\{reservationReferenceDate\}\s*\/>/
    );
  });

  it("renders next to WeekdayClosureNotice inside the existing day card, not a second dialog/modal", async () => {
    const source = await readSource();
    const weekdayIndex = source.indexOf("<WeekdayClosureNotice");
    const deadlineIndex = source.indexOf("<ReservationDeadlineNotice");
    expect(weekdayIndex).toBeGreaterThan(-1);
    expect(deadlineIndex).toBeGreaterThan(weekdayIndex);
    const noticeSource = extractReservationDeadlineNoticeSource(source);
    expect(noticeSource).not.toMatch(/role=["']dialog["']/);
    expect(noticeSource).not.toMatch(/aria-modal/);
    const dialogRootCount = (source.match(/role="dialog"/g) ?? []).length;
    expect(dialogRootCount).toBe(1);
  });

  it("renders nothing (an empty items list) unless a place resolves to a derived-window, gating on window.kind", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    expect(noticeSource).toMatch(/window\.kind\s*!==\s*["']derived-window["']/);
    expect(noticeSource).toMatch(/items\.length === 0/);
  });

  it("always renders the raw evidence text alongside the derived window", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    expect(noticeSource).toMatch(/window\.signal\.raw/);
  });

  it("uses the conservative 'ventana de anticipación registrada' phrase, never a deadline/availability claim", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    expect(noticeSource).toMatch(/ventana de anticipación registrada/i);
  });

  it("never uses forbidden deadline/availability/guarantee phrasing", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    const lower = noticeSource.toLowerCase();
    for (const forbidden of [
      "fecha límite",
      "reserva antes de",
      "último día para reservar",
      "disponible desde",
      "se abre la reserva",
      "fecha de apertura",
      "garantizado",
      "garantizada",
    ]) {
      expect(lower, `should not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("never contains current-date/urgency vocabulary or Date.now", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    const lower = noticeSource.toLowerCase();
    for (const forbidden of ["date.now()", "días restantes", "quedan", "urgente", "reserva ahora", "vencid"]) {
      expect(lower, `should not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("composes the pending Feb–Mar reconfirmation callout BEFORE the derived range in markup order, never replacing it", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    const pendingIndex = noticeSource.indexOf('febMarTone === "pending"');
    const windowIndex = noticeSource.indexOf("reservation-deadline__window");
    expect(pendingIndex).toBeGreaterThan(-1);
    expect(windowIndex).toBeGreaterThan(-1);
    expect(pendingIndex).toBeLessThan(windowIndex);
    expect(noticeSource).toMatch(/pendiente de\s*\n?\s*confirmar/i);
  });

  it("composes an attention Feb–Mar caveat callout BEFORE the derived range in markup order, never replacing it (corrective audit finding MAJOR-1)", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    const attentionIndex = noticeSource.indexOf('febMarTone === "attention"');
    const windowIndex = noticeSource.indexOf("reservation-deadline__window");
    expect(attentionIndex).toBeGreaterThan(-1);
    expect(windowIndex).toBeGreaterThan(-1);
    expect(attentionIndex).toBeLessThan(windowIndex);
    // The attention callout is also strictly before the pending callout's own markup position is
    // irrelevant (only one of the two ever renders for a given place) — what matters is that BOTH
    // non-confirmed branches individually precede the range, proven separately in each test.
  });

  it("the attention callout reuses describeFebMarStatusForUi's own label rather than inventing category-specific copy", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    expect(noticeSource).toMatch(/\{febMarLabel\}/);
  });

  it("the attention callout never implies closed/unavailable/dangerous/impossible/confirmed/deadline", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    const attentionBlockMatch = noticeSource.match(/febMarTone === "attention"[\s\S]*?<\/p>/);
    expect(attentionBlockMatch).not.toBeNull();
    const lower = (attentionBlockMatch?.[0] ?? "").toLowerCase();
    for (const forbidden of [
      "cerrado",
      "no disponible",
      "peligro",
      "imposible",
      "confirmado",
      "fecha límite",
    ]) {
      expect(lower, `attention callout should not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("derives the Feb–Mar tone/label once per place via describeFebMarStatusForUi, reusing the existing display path — never a second classifier", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    // Exactly one call site deriving the display adapter, destructured into tone+label, then
    // branched on — not re-interpreted per branch, not a category-specific check anywhere.
    const callSites = noticeSource.match(/describeFebMarStatusForUi\(\s*interpretPlaceFebMarStatus\(\s*place\s*\)\s*\)/g) ?? [];
    expect(callSites.length).toBe(1);
    expect(noticeSource).not.toMatch(/\.category\s*===/);
    expect(noticeSource).toMatch(/febMarTone === "pending"/);
    expect(noticeSource).toMatch(/febMarTone === "attention"/);
  });

  it("a confirmed tone renders neither status callout — no extra caveat when the calendar is confirmed", async () => {
    const noticeSource = extractReservationDeadlineNoticeSource(await readSource());
    // "confirmed" never appears as a rendering condition — absence of both other branches IS the
    // confirmed behaviour (render the range with no callout at all).
    expect(noticeSource).not.toMatch(/febMarTone === "confirmed"/);
  });
});

function extractHoursClosureCompositionNoticeSource(fullSource: string): string {
  const start = fullSource.indexOf("function HoursClosureCompositionNotice");
  if (start === -1) {
    throw new Error("HoursClosureCompositionNotice function not found in OrderedSequenceBuilder.tsx");
  }
  const nextFunctionStart = fullSource.indexOf("\nfunction ", start + 1);
  if (nextFunctionStart === -1) {
    throw new Error("Could not find the end boundary of HoursClosureCompositionNotice");
  }
  return fullSource.slice(start, nextFunctionStart);
}

describe("OrderedSequenceBuilder.tsx — hours/closure composition wiring", () => {
  it("imports and calls the pure per-day composition boundary", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bbuildPresentableDayHoursClosureCompositions\b[^}]*\}\s*from\s*["']\.\.\/lib\/hours-closure-composition["']/
    );
    const notice = extractHoursClosureCompositionNoticeSource(source);
    expect(notice).toMatch(
      /buildPresentableDayHoursClosureCompositions\(\s*places\s*,\s*dayAssignment\s*,\s*startDate\s*\)/
    );
  });

  it("delegates class/not-composed omission to the behaviorally tested pure boundary", async () => {
    const notice = extractHoursClosureCompositionNoticeSource(await readSource());
    expect(notice).not.toContain('"keep-separate"');
    expect(notice).not.toContain('"not-composable"');
    expect(notice).not.toContain("buildDayHoursClosureCompositions");
  });

  it("keeps both raw facts visible and gives each PARTIAL fact its own caveat treatment", async () => {
    const notice = extractHoursClosureCompositionNoticeSource(await readSource());
    expect(notice).toMatch(/signal\.hours\.raw/);
    expect(notice).toMatch(/signal\.closure\.raw/);
    expect(notice).toMatch(/signal\.hours\.tier\s*===\s*["']partial["']/);
    expect(notice).toMatch(/signal\.closure\.tier\s*===\s*["']partial["']/);
    expect(notice).toContain("Con salvedad; conviene revisar");
  });

  it("is an additional day-card signal alongside both existing temporal notices", async () => {
    const source = await readSource();
    const weekdayIndex = source.indexOf("<WeekdayClosureNotice");
    const compositionIndex = source.indexOf("<HoursClosureCompositionNotice");
    const deadlineIndex = source.indexOf("<ReservationDeadlineNotice");
    expect(weekdayIndex).toBeGreaterThan(-1);
    expect(compositionIndex).toBeGreaterThan(weekdayIndex);
    expect(deadlineIndex).toBeGreaterThan(compositionIndex);
  });

  it("gives repeated day-card regions distinct accessible names", async () => {
    const source = await readSource();
    const notice = extractHoursClosureCompositionNoticeSource(source);
    expect(notice).toMatch(/aria-label=\{`Horario e información de cierres registrados · Día \$\{dayNumber\}`\}/);
    expect(source).toMatch(/<HoursClosureCompositionNotice[\s\S]*?dayNumber=\{dayIndex \+ 1\}[\s\S]*?\/>/);
  });

  it("introduces no second dialog and no prohibited decision language", async () => {
    const source = await readSource();
    const notice = extractHoursClosureCompositionNoticeSource(source);
    expect(notice).not.toMatch(/role=["']dialog["']/);
    expect(notice).not.toMatch(/aria-modal/);
    expect((source.match(/role="dialog"/g) ?? []).length).toBe(1);
    const lower = notice.toLowerCase();
    for (const forbidden of [
      "está abierto",
      "está cerrado",
      "puedes ir",
      "funciona",
      "compatible",
      "disponible",
      "garantizado",
      "horario confirmado para tu visita",
      "live verified",
    ]) {
      expect(lower, `should not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });
});

/**
 * Phase 3D-L — manual visit start time vs. the recorded interval.
 *
 * The behaviour itself (which places are eligible, what each outcome is, the date gate, the
 * boundaries) is proven purely in `../lib/recorded-interval-fit.test.ts` against the real dataset;
 * those are behavioural tests, not scans. What remains genuinely unobservable without a component
 * harness — which this repository deliberately does not have — is the WIRING: that the section is
 * rendered from that pure builder, in the required position between the two existing temporal
 * notices, with a per-place accessible label, no default value, and the persisted setter attached.
 * Those, and only those, are checked by scanning here.
 */

/**
 * Slices one top-level function, stopping at whichever comes first: the next top-level `function`
 * declaration, or the next top-level doc comment. Stopping at the doc comment matters — the comment
 * introducing the NEXT function sits before its `function` keyword, so a boundary of `\nfunction `
 * alone would pull that neighbour's prose into this slice and make vocabulary assertions report on
 * text this phase did not write.
 */
function extractTopLevel(fullSource: string, declaration: string): string {
  const start = fullSource.indexOf(declaration);
  if (start === -1) throw new Error(`${declaration} not found in OrderedSequenceBuilder.tsx`);
  const candidates = [fullSource.indexOf("\nfunction ", start + 1), fullSource.indexOf("\n/**", start + 1)].filter(
    (index) => index !== -1
  );
  return candidates.length === 0 ? fullSource.slice(start) : fullSource.slice(start, Math.min(...candidates));
}

/** Strips comments, so a vocabulary scan asserts on what the component RENDERS rather than on what
 * its documentation explains. The doc comments deliberately name the fields this surface must not
 * read (`bestTime`, closures, transfers) in order to record that exclusion; scanning them raw would
 * make the explanation itself look like a violation. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function extractRecordedIntervalFitSource(fullSource: string): string {
  return extractTopLevel(fullSource, "function RecordedIntervalFitSection");
}

function extractFitTextSource(fullSource: string): string {
  return extractTopLevel(fullSource, "function recordedIntervalFitText");
}

describe("OrderedSequenceBuilder.tsx — Phase 3D-L manual visit start time wiring", () => {
  it("builds the section from the pure recorded-interval-fit domain builder", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bbuildDayRecordedIntervalFits\b[^}]*\}\s*from\s*["']\.\.\/lib\/recorded-interval-fit["']/
    );
    expect(source).toMatch(
      /buildDayRecordedIntervalFits\(\s*places\s*,\s*dayAssignment\s*,\s*startDate\s*,\s*visitStartTimes\s*\)/
    );
  });

  it("renders the section between the Phase 3D-J and Phase 3D-H notices, reordering neither", async () => {
    const source = await readSource();
    const composition = source.indexOf("<HoursClosureCompositionNotice");
    const fit = source.indexOf("<RecordedIntervalFitSection");
    const deadline = source.indexOf("<ReservationDeadlineNotice");
    const weekday = source.indexOf("<WeekdayClosureNotice");
    expect(weekday).toBeGreaterThan(-1);
    expect(composition).toBeGreaterThan(-1);
    expect(fit).toBeGreaterThan(-1);
    expect(deadline).toBeGreaterThan(-1);
    expect(weekday).toBeLessThan(composition);
    expect(composition).toBeLessThan(fit);
    expect(fit).toBeLessThan(deadline);
  });

  it("keeps the existing temporal notices rendered and unchanged in kind", async () => {
    const source = await readSource();
    expect(source).toContain("function WeekdayClosureNotice(");
    expect(source).toContain("function HoursClosureCompositionNotice(");
    expect(source).toContain("function ReservationDeadlineNotice(");
    expect(source).toMatch(/buildPresentableDayHoursClosureCompositions\(/);
  });

  it("uses a native time input with no default value", async () => {
    const section = extractRecordedIntervalFitSource(await readSource());
    expect(section).toMatch(/type="time"/);
    // The value comes from the persisted map only, falling back to the empty string — never to a
    // clock, an opening bound, or a literal like 09:00.
    expect(section).toMatch(/value=\{visitStartTime \?\? ""\}/);
    expect(section).not.toMatch(/defaultValue/);
    expect(section).not.toMatch(/placeholder/);
    expect(section).not.toMatch(/autoFocus/);
    expect(section).not.toMatch(/\b09:00\b/);
  });

  it("gives each control an accessible label naming both the place and the day", async () => {
    const section = extractRecordedIntervalFitSource(await readSource());
    expect(section).toMatch(/<label[^>]*htmlFor=\{inputId\}/);
    expect(section).toMatch(/Hora de inicio para \$\{placeName\} en Día \$\{dayNumber\}/);
    // The id is per day AND per place, so two controls can never collide across day cards.
    expect(section).toMatch(/visit-start-time-\$\{dayNumber\}-\$\{placeId\}/);
    expect(section).toMatch(/aria-label=\{`[^`]*Día \$\{dayNumber\}`\}/);
  });

  it("delegates every change to the persisted setter, keeping no local copy of the times", async () => {
    const source = await readSource();
    expect(source).toMatch(/setVisitStartTime,/);
    expect(source).toMatch(/onVisitStartTimeChange=\{setVisitStartTime\}/);
    const section = extractRecordedIntervalFitSource(source);
    expect(section).toMatch(/onVisitStartTimeChange\(placeId, event\.target\.value \|\| null\)/);
    // No component-local mirror of the persisted map.
    expect(source).not.toMatch(/useState<[^>]*visitStartTimes/i);
    expect(section).not.toMatch(/useState/);
  });

  it("renders nothing at all when the pure builder yields no eligible place", async () => {
    const section = extractRecordedIntervalFitSource(await readSource());
    expect(section).toMatch(/if \(items\.length === 0\) return null;/);
  });

  it("keeps the original recorded hours text beside every result", async () => {
    const section = extractRecordedIntervalFitSource(await readSource());
    expect(section).toMatch(/hours\.raw/);
    // The parsed token is never rendered in place of the raw record.
    expect(section).not.toMatch(/intervalRaw/);
  });

  it("uses exactly the design gate's permitted wording for each outcome", async () => {
    const text = extractFitTextSource(await readSource());
    expect(text).toContain("La duración registrada cabe dentro del intervalo horario registrado.");
    expect(text).toContain("Solo la duración mínima registrada cabe dentro del intervalo registrado.");
    expect(text).toContain("La duración registrada excede este intervalo horario registrado.");
    expect(text).toContain("La hora que has indicado queda fuera del intervalo horario registrado.");
    expect(text).toContain("No hay información horaria estructurada suficiente para evaluar este intervalo.");
    expect(text).toContain("No hay una duración numérica registrada para evaluar.");
    expect(text).toContain("Introduce una hora de inicio para comparar con el intervalo registrado.");
  });

  it("uses no forbidden decision language anywhere in the new surface", async () => {
    const source = await readSource();
    const surface = withoutComments(
      extractFitTextSource(source) + extractRecordedIntervalFitSource(source)
    ).toLowerCase();
    for (const forbidden of [
      "está abierto",
      "cerrado",
      "puedes ir",
      "este horario funciona",
      "este día funciona",
      "disponible",
      "visita válida",
      "horario garantizado",
      "horario confirmado",
      "compatible",
      "te recomendamos",
      "mejor hora",
      "hora óptima",
    ]) {
      expect(surface, `should not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("introduces no dialog, modal, or scheduling control", async () => {
    const section = withoutComments(extractRecordedIntervalFitSource(await readSource()));
    expect(section).not.toMatch(/role=["']dialog["']/);
    expect(section).not.toMatch(/aria-modal/);
    expect(section).not.toMatch(/draggable/);
    expect(section).not.toMatch(/onDrag/);
    for (const forbidden of ["optimiz", "sugerir", "sugerencia", "recomend", "auto"]) {
      expect(section.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("reads no bestTime, closure, transfer, or clock source in the new surface", async () => {
    const source = await readSource();
    const surface = withoutComments(extractFitTextSource(source) + extractRecordedIntervalFitSource(source));
    for (const forbidden of [
      "bestTime",
      "closures",
      "ClosureFact",
      "CompositionClass",
      "assessWeekdayClosure",
      "TransferEdge",
      "getBestTransfer",
      "new Date",
      "Date.now",
      "Asia/Tokyo",
      "timeZone",
    ]) {
      expect(surface).not.toContain(forbidden);
    }
  });

  it("uses a neutral treatment, with no success/failure styling for the outcomes", async () => {
    const section = withoutComments(extractRecordedIntervalFitSource(await readSource()));
    // No per-outcome class name, so no outcome can be styled as approval or rejection.
    expect(section).not.toMatch(/recorded-interval-fit__item--/);
    expect(section).not.toMatch(/\bsuccess\b|\berror\b|\bvalid\b|\binvalid\b|\bok\b/i);
    // It must not borrow Phase 3D-J's composed-notice styling either.
    expect(section).not.toContain("hours-closure-composition");
  });
});

describe("usePlanningDraft.ts — Phase 3D-L persisted-time wiring", () => {
  it("exposes the persisted map and a setter that delegates to the pure mutation", async () => {
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    // Phase 3D-Q moved the canonical runtime draft to V4 and Phase 3D-S to V5 (same storage key
    // throughout); the pure mutation this phase's contract depends on is unchanged, only the
    // module that re-exports it.
    expect(hook).toMatch(/import\s*\{[\s\S]*?\bwithVisitStartTime\b[\s\S]*?\}\s*from\s*["']\.\/lib\/planning-draft-v7["']/);
    expect(hook).toMatch(/setDraft\(\(current\) => withVisitStartTime\(current, placeId, time\)\);/);
    expect(hook).toMatch(/visitStartTimes: draft\.visitStartTimes,/);
    expect(hook).toMatch(/setVisitStartTime,/);
  });

  it("keeps the draft as the single canonical source — no second copy of the times", async () => {
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    // Exactly one piece of state: the whole draft. Counts CALL SITES (`useState<` / `useState(`),
    // not the bare word, which also appears in the import list and in prose.
    const useStateCalls = withoutComments(hook).match(/useState\s*[<(]/g) ?? [];
    expect(useStateCalls).toHaveLength(1);
    expect(hook).toMatch(/useState<ManualPlanningDraftV7>/);
    // Every mutation goes through the pure module and is written back by the existing effect.
    expect(hook).toMatch(/writeDraft\(browserStorage, draft\);/);
  });
});

/**
 * Phase 3D-Q — Manual Accommodation Commute Legs. Same source-scanning technique as the sections
 * above (this repository still has no component-level DOM harness and this phase adds no
 * dependency): the pure invariants live in `lib/accommodation-commute.test.ts` and
 * `lib/planning-draft-v4.test.ts`, and these assertions prove the component actually wires them,
 * renders only the approved copy, and never reaches for a routing/geometry/booking shortcut.
 *
 * The whole Phase 3D-Q block — the anchor manager, the two boundary helpers, the copy function and
 * the two rendered sections — sits between `AccommodationManagerSection` and the next feature's
 * `INTER_HUB_MODE_LABELS` declaration, so
 * one extractor scopes every wording assertion to exactly this phase's surface rather than to the
 * ~1800-line file (which legitimately contains unrelated words elsewhere).
 */
function extractAccommodationSectionSource(fullSource: string): string {
  const start = fullSource.indexOf("function AccommodationManagerSection");
  if (start === -1) throw new Error("AccommodationManagerSection not found in OrderedSequenceBuilder.tsx");
  const end = fullSource.indexOf("\nconst INTER_HUB_MODE_LABELS", start + 1);
  if (end === -1) throw new Error("Could not find the end boundary of the Phase 3D-Q block");
  return fullSource.slice(start, end);
}

describe("OrderedSequenceBuilder.tsx — Phase 3D-Q manual accommodation commute (source-scanning integration check)", () => {
  it("composes the day view model through the accommodation domain module", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[\s\S]*?\bbuildDayLogisticsWithAccommodation\b[\s\S]*?\}\s*from\s*["']\.\.\/lib\/accommodation-commute["']/
    );
    expect(source).toMatch(
      /buildDayLogisticsWithAccommodation\(\s*dayPlaceIds\s*,\s*intraDay\s*,\s*boundary\s*,\s*accommodationLegs\s*\)/
    );
  });

  it("reads the day's boundary from that day's own persisted entity, not from a positional vector", async () => {
    const source = await readSource();
    // Phase 3D-S: the separate same-length boundary vector is gone. The boundary is structurally
    // part of the day entity at this ordinal position, so no splice can shift another day's choice
    // into it and no length can drift.
    expect(source).toMatch(/const dayEntity = dayEntities\[dayIndex\] \?\? null;/);
    expect(source).toMatch(/const dayBoundary = dayEntity\?\.accommodationBoundary \?\? null;/);
    expect(source).not.toContain("dayAccommodationBoundaries");
  });

  it("renders the per-day controls only for a day that actually has places", async () => {
    const source = await readSource();
    // Mounted inside the non-empty branch, and gated again on the day's own bucket and boundary.
    expect(source).toMatch(/\{bucket && dayEntity && dayBoundary && \(\s*<AccommodationCommuteSection/);
    // And the section itself refuses to render for an empty bucket even if it were mounted.
    const section = extractAccommodationSectionSource(source);
    expect(section).toContain("if (dayPlaceIds.length === 0) return null;");
  });

  it("labels every recorded duration as a manual datum and every absent one as unrecorded", async () => {
    const section = extractAccommodationSectionSource(await readSource());
    expect(section).toContain("Salida desde alojamiento: ${formatMinutes(result.minutes)} · dato manual");
    expect(section).toContain("Regreso al alojamiento: ${formatMinutes(result.minutes)} · dato manual");
    expect(section).toContain("Traslado desde alojamiento sin registrar");
    expect(section).toContain("Regreso al alojamiento sin registrar");
  });

  it("keeps unselected and explicit no-accommodation as visibly different states", async () => {
    const section = extractAccommodationSectionSource(await readSource());
    expect(section).toContain("Salida desde alojamiento: no aplica en este día");
    expect(section).toContain("Regreso al alojamiento: no aplica en este día");
    expect(section).toContain("Salida desde alojamiento: sin seleccionar");
    expect(section).toContain("Regreso al alojamiento: sin seleccionar");
    // The select offers all three families explicitly — there is no implicit default anchor.
    expect(section).toContain('<option value="unselected">Sin seleccionar</option>');
    expect(section).toContain('<option value="no-accommodation">No aplica</option>');
  });

  it("claims a complete registered total only under completeDoorToDoor, and labels it as registered components", async () => {
    const section = extractAccommodationSectionSource(await readSource());
    expect(section).toContain("Total de traslados registrado:");
    expect(section).toContain("incompleto");
    expect(section).toMatch(
      /logistics\.completeDoorToDoor\s*\?\s*"completo según los componentes registrados"\s*:\s*"incompleto"/
    );
    // A day with no known minutes at all shows no number — never a 0.
    expect(section).toContain('"Total de traslados registrado: sin datos · incompleto"');
  });

  it("shows the exact directed endpoint pair the domain evaluated", async () => {
    const section = extractAccommodationSectionSource(await readSource());
    expect(section).toContain('side === "start" ? `${anchorLabel ?? ""} → ${placeName}` : `${placeName} → ${anchorLabel ?? ""}`');
    expect(section).toMatch(/result\.kind === "manual-leg" \|\| result\.kind === "manual-leg-missing"/);
  });

  it("writes minutes only through the exact directed setter and never coerces a value", async () => {
    const section = extractAccommodationSectionSource(await readSource());
    expect(section).toContain("if (!isValidManualAccommodationMinutes(value)) return;");
    // A blank field CLEARS that one key; it never stores zero.
    expect(section).toContain("onLegChange(endpoint.accommodationId, endpoint.placeId, null);");
    const code = withoutComments(section);
    expect(code).not.toMatch(/Math\.round|Math\.floor|Math\.ceil|parseInt|parseFloat/);
    expect(code).not.toMatch(/\?\?\s*0\b/);
    // The two directions are written separately; neither side reuses the other's key.
    expect(code).toContain('onLegChange("accommodation-to-place", accommodationId, placeId, minutes)');
    expect(code).toContain('onLegChange("place-to-accommodation", accommodationId, placeId, minutes)');
  });

  it("never routes, geocodes, reverses a leg, or names a provider", async () => {
    const section = extractAccommodationSectionSource(await readSource());
    const code = withoutComments(section);
    expect(code).not.toContain("getBestTransfer");
    expect(code).not.toMatch(/haversine|Math\.(sqrt|atan2|cos|sin)/i);
    expect(code).not.toMatch(/\bfetch\b|geocod|openrouteservice|googleapis|booking\.com|expedia/i);
    // The anchor's coordinates are only ever displayed, never read into arithmetic.
    expect(code).toContain("{anchor.location.lat}, {anchor.location.lng}");
  });

  it("uses no forbidden claim about routes, providers, traffic, timetables or hotel quality", async () => {
    const section = extractAccommodationSectionSource(await readSource());
    expect(section).not.toMatch(
      /ruta óptima|mejor ruta|mejor hotel|hotel más conveniente|tiempo real|tráfico|ruta actual|horario de tren|Google|ORS|transporte confirmado|disponibilidad confirmada|recomend|sugier/i
    );
  });
});

describe("usePlanningDraft.ts — Phase 3D-Q accommodation wiring", () => {
  it("exposes the persisted accommodation state and setters that delegate to the pure module", async () => {
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    expect(hook).toMatch(
      /import\s*\{[\s\S]*?\bwithDayAccommodationChoice\b[\s\S]*?\}\s*from\s*["']\.\/lib\/planning-draft-v7["']/
    );
    expect(hook).toMatch(/accommodations: draft\.accommodations,/);
    // Phase 3D-S: the boundary vector is gone from the hook's surface — each day's choice now
    // travels inside its own entity, exposed as `planningDays`.
    expect(hook).toMatch(/planningDays: draft\.days,/);
    expect(hook).not.toContain("dayAccommodationBoundaries");
    expect(hook).toMatch(/accommodationLegs: draft\.accommodationLegs,/);
    expect(hook).toMatch(/withNewAccommodation\(current, label, location, randomAccommodationId\)/);
    expect(hook).toMatch(/withoutAccommodation\(current, accommodationId\)/);
    // Addressed by the day's stable id rather than by its ordinal position.
    expect(hook).toMatch(/withDayAccommodationChoice\(current, dayId, side, choice\)/);
    expect(hook).toMatch(/withAccommodationLeg\(current, direction, accommodationId, placeId, minutes\)/);
  });

  it("keeps V7 as the single canonical runtime draft under the existing storage key", async () => {
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    const code = withoutComments(hook);
    // Still exactly one piece of state: the whole V7 draft. No parallel legacy state, no second key,
    // and no separate day-id store.
    expect(code.match(/useState\s*[<(]/g) ?? []).toHaveLength(1);
    expect(code).not.toContain("ManualPlanningDraftV3");
    expect(code).not.toContain("ManualPlanningDraftV4");
    expect(code).not.toMatch(/from ["']\.\/lib\/planning-draft["']/);
    expect(code).not.toMatch(/from ["']\.\/lib\/planning-draft-v4["']/);
    expect(code).not.toMatch(/localStorage\.(getItem|setItem)\((?!key)/);
    // Nothing derived and nothing looked up happens in the hook itself.
    expect(code).not.toMatch(/\bfetch\b|geocod|getBestTransfer|haversine/i);
  });
});

function extractOfficialReservationDateNoticeSource(fullSource: string): string {
  return extractTopLevel(fullSource, "function OfficialReservationDateNotice");
}

describe("OrderedSequenceBuilder.tsx — Phase 3F-F official reservation date presentation wiring", () => {
  it("imports the Phase 3F evidence, derivation and presentation owners", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\breservationMechanismEvidenceRecords\b[^}]*\}\s*from\s*["']\.\.\/lib\/reservation-mechanism-evidence["']/
    );
    expect(source).toMatch(
      /import\s*\{[^}]*\bderiveReservationMechanismDatesForPlannedPlace\b[^}]*\}\s*from\s*["']\.\.\/lib\/reservation-mechanism-date-derivation["']/
    );
    expect(source).toMatch(
      /import\s*\{[^}]*\bbuildOfficialReservationDatePresentation\b[^}]*\}\s*from\s*["']\.\.\/lib\/reservation-mechanism-presentation["']/
    );
  });

  it("derives per planned place and pairs every result back to its exact record id", async () => {
    const notice = extractOfficialReservationDateNoticeSource(await readSource());
    expect(notice).toMatch(
      /deriveReservationMechanismDatesForPlannedPlace\(\s*reservationMechanismEvidenceRecords\s*,\s*dayAssignment\s*,\s*startDate\s*,\s*place\.id\s*\)/
    );
    expect(notice).toMatch(
      /reservationMechanismEvidenceRecords\.find\(\s*\(candidate\)\s*=>\s*candidate\.id\s*===\s*derivation\.recordId/
    );
    expect(notice).toMatch(/buildOfficialReservationDatePresentation\(record, derivation\)/);
    expect(notice).not.toMatch(/\.sort\s*\(/);
  });

  it("renders as a separate sibling immediately after the existing Phase 3D-H notice", async () => {
    const source = await readSource();
    const deadline = source.indexOf("<ReservationDeadlineNotice");
    const official = source.indexOf("<OfficialReservationDateNotice");
    expect(deadline).toBeGreaterThan(-1);
    expect(official).toBeGreaterThan(deadline);
    expect(source.slice(deadline, official)).toContain("referenceDate={reservationReferenceDate}");
    expect(source).toMatch(
      /<OfficialReservationDateNotice\s+places=\{places\}\s+dayAssignment=\{dayAssignment\}\s+startDate=\{startDate\}\s+dayNumber=\{dayIndex \+ 1\}\s*\/>/
    );
  });

  it("receives no current/reference-date, hours, closure, end-date or visit-time input", async () => {
    const source = await readSource();
    const notice = withoutComments(extractOfficialReservationDateNoticeSource(source));
    for (const forbidden of [
      "reservationReferenceDate",
      "referenceDate",
      "captureDeviceLocalCivilDate",
      "evaluateReservationWindowReference",
      "visitStartTimes",
      "endDate",
      "febMar2027",
      "schedule.hours",
      "schedule.closures",
      "reservation.required",
      "reservation.leadTime",
    ]) {
      expect(notice, forbidden).not.toContain(forbidden);
    }
  });

  it("renders scope, provenance and a provenance-only official-source link", async () => {
    const notice = extractOfficialReservationDateNoticeSource(await readSource());
    expect(notice).toMatch(/presentation\.scopeLabel/);
    expect(notice).toMatch(/presentation\.provenanceText/);
    expect(notice).toMatch(/href=\{presentation\.sourceUrl\}/);
    expect(notice).toContain("Ver fuente oficial");
    expect(notice).toMatch(/target="_blank"/);
    expect(notice).toMatch(/rel="noreferrer"/);
  });

  it("keeps multiple details and allocation disclosure read-only", async () => {
    const notice = extractOfficialReservationDateNoticeSource(await readSource());
    expect(notice).toMatch(/presentation\.detailLines\.map/);
    expect(notice).toMatch(/presentation\.allocationText/);
    expect(notice).not.toMatch(/<button/);
    expect(notice).not.toMatch(/onClick=/);
    expect(notice).not.toMatch(/onChange=/);
  });

  it("has a day-specific accessible section name and neutral source-separation disclosure", async () => {
    const notice = extractOfficialReservationDateNoticeSource(await readSource());
    expect(notice).toContain("Fechas de reserva según fuente oficial · Día");
    expect(notice).toContain("Fechas de reserva según fuente oficial");
    expect(notice).toContain("No se comparan con la fecha actual ni indican el estado actual de la venta.");
    expect(notice).toContain(
      "Esta información oficial se muestra por separado de la anticipación editorial registrada;"
    );
    expect(notice).toContain("Nihon no combina ambas fuentes.");
  });

  it("renders nothing when no presentable Phase 3F result exists", async () => {
    const notice = extractOfficialReservationDateNoticeSource(await readSource());
    expect(notice).toMatch(/if \(items\.length === 0\) return null;/);
  });

  it("does not introduce action/currentness vocabulary in the rendered Phase 3F surface", async () => {
    const notice = withoutComments(extractOfficialReservationDateNoticeSource(await readSource())).toLowerCase();
    for (const forbidden of [
      "ya puedes comprar",
      "reserva ahora",
      "compra ahora",
      "última oportunidad",
      "se te pasó",
      "fecha límite",
      "reservas abiertas",
      "reservas cerradas",
      "venta abierta",
      "venta cerrada",
      "disponible",
      "no disponible",
      "quedan boletos",
      "te quedan",
      "urgente",
      "garantizada",
    ]) {
      expect(notice, forbidden).not.toContain(forbidden);
    }
  });

  it("adds no second dialog or persistence surface", async () => {
    const source = await readSource();
    const notice = extractOfficialReservationDateNoticeSource(source);
    expect(notice).not.toMatch(/role=["']dialog["']/);
    expect(notice).not.toMatch(/aria-modal/);
    expect(notice).not.toContain("localStorage");
    expect((source.match(/role="dialog"/g) ?? []).length).toBe(1);
  });
});
