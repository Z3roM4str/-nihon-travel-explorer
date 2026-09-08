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

  it("renders ReservationDeadlineNotice per day bucket, passing this day's own places and dayAssignment/startDate", async () => {
    const source = await readSource();
    expect(source).toContain("function ReservationDeadlineNotice(");
    expect(source).toMatch(
      /<ReservationDeadlineNotice\s+places=\{places\}\s+dayAssignment=\{dayAssignment\}\s+startDate=\{startDate\}\s*\/>/
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
