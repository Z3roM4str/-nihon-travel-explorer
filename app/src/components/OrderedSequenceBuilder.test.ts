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
async function readReservationsSource() { return readFile(new URL("./TripReservations.tsx", import.meta.url), "utf8"); }
async function readReservationProjection() { return readFile(new URL("../lib/trip-reservation-presentation.ts", import.meta.url), "utf8"); }
describe("B31 — relocated reservation preparation wiring", () => {
  it("uses existing aggregation", async () => { expect(await readReservationProjection()).toContain("buildReservationPreparationSummary(places)"); });
  it("receives canonical route", async () => { expect(await readSource()).toContain("buildTripReservationRows(routePlaces, dayAssignment, startDate)"); });
  it("renders dedicated Reservations", async () => { expect(await readSource()).toContain("<TripReservations"); expect(await readReservationsSource()).toContain("Reservas por preparar"); });
  it("adds no competing modal", async () => { expect(await readReservationsSource()).not.toMatch(/role=["']dialog["']|aria-modal/); expect((await readSource()).match(/role="dialog"/g)).toHaveLength(1); });
  it("preserves preparation classifications", async () => { expect(await readReservationsSource()).toContain("coarse-magnitude"); expect(await readReservationsSource()).toContain("Mecanismo específico"); });
  it("preserves raw registered evidence", async () => { const s=await readReservationsSource(); expect(s).toContain("«{row.prep.leadTime.raw}»"); expect(s).toContain('level="registrado"'); expect(s).not.toContain("Dato:"); });
  it("does not calculate dates in view", async () => { for(const text of ["Date.now", "addCivilDays", "derivePlaceReservationDateWindow("]) expect(await readReservationsSource()).not.toContain(text); });
  it("does not invent recommendations", async () => { for(const text of ["reserva antes del", "te quedan", "ya deberías reservar", "estás a tiempo", "urgente"]) expect((await readReservationsSource()).toLowerCase()).not.toContain(text); });
  it("retains singular anticipation label", async () => { expect(await readReservationsSource()).toContain("Anticipación registrada"); expect(await readReservationsSource()).not.toContain("anticipación registradas"); });
});

/**
 * Phase 3D-E's "Horarios registrados" section (`HoursPlanningSection`) lived only in the unreachable route
 * view and was retired with it (D5-M1, release hardening), together with `lib/hours-planning.ts` (its only
 * consumer). What remains of 3D-E is `lib/recorded-hours.ts`, proven in its own tests, and the per-day hours
 * surfaces tested below. This test pins the retirement so the dead section is not resurrected silently.
 */
describe("OrderedSequenceBuilder.tsx — retired route-view hours section (D5-M1)", () => {
  it("no longer carries HoursPlanningSection or its route-wide summary", async () => {
    const source = await readSource();
    expect(source).not.toContain("HoursPlanningSection");
    expect(source).not.toContain("buildRecordedHoursSummary");
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
  const end = fullSource.indexOf("\n/**", start);
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
    const source = await readReservationsSource();
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
      /<ReservationDeadlineNotice\s+places=\{\[row\.place\]\}\s+dayAssignment=\{dayAssignment\}\s+startDate=\{startDate\}\s+referenceDate=\{reservationReferenceDate\}\s*\/>/
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

  it("retains Feb–Mar status", async () => { expect(await readReservationsSource()).toContain("place.febMar2027.status"); });
  it("retains warning alongside window", async () => { expect(await readReservationsSource()).toContain("place.febMar2027.warning"); expect(extractReservationDeadlineNoticeSource(await readSource())).toContain("window.farAdvanceDate"); });
  it("uses existing status label", async () => { expect(await readReservationsSource()).toContain("{febMar.label}"); });
  it("preserves recorded action", async () => { expect(await readReservationsSource()).toContain("place.febMar2027.action"); expect(await readReservationsSource()).toContain("«{raw}»"); });
  it("classifies once per place", async () => { expect((await readReservationsSource()).match(/describeFebMarStatusForUi\(interpretPlaceFebMarStatus\(place\)\)/g)).toHaveLength(1); });
  it("does not duplicate confidence classifier", async () => { expect(extractReservationDeadlineNoticeSource(await readSource())).not.toContain("febMarTone"); });
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
    expect(source).toMatch(/<HoursClosureCompositionNotice[\s\S]*?dayNumber=\{row\.dayNumber\}[\s\S]*?\/>/);
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
    // Phase 3D-Q moved the canonical runtime draft to V4, Phase 3D-S to V5, Phase 3D-Y to V7 and
    // Block 4 to V8 (same storage key throughout); the pure mutation this phase's contract depends
    // on is unchanged, only the module that re-exports it.
    expect(hook).toMatch(/import\s*\{[\s\S]*?\bwithVisitStartTime\b[\s\S]*?\}\s*from\s*["']\.\/lib\/planning-draft-v8["']/);
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
    expect(hook).toMatch(/useState<ManualPlanningDraftV8>/);
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

  // `ORS` is anchored to word boundaries. Unanchored and case-insensitive it also matched the
  // "ors" inside ordinary English words such as `anchors`, which made the gate fire on prose that
  // said nothing about a routing provider. The claim it exists to catch — naming openrouteservice
  // as the source of a duration — is still caught; only the false positive is gone.
  it("uses no forbidden claim about routes, providers, traffic, timetables or hotel quality", async () => {
    const section = extractAccommodationSectionSource(await readSource());
    expect(section).not.toMatch(
      /ruta óptima|mejor ruta|mejor hotel|hotel más conveniente|tiempo real|tráfico|ruta actual|horario de tren|Google|\bORS\b|transporte confirmado|disponibilidad confirmada|recomend|sugier/i
    );
  });

  it("still catches a real openrouteservice claim", () => {
    expect("duración según ORS").toMatch(/\bORS\b/i);
    expect("anchors").not.toMatch(/\bORS\b/i);
  });
});

describe("usePlanningDraft.ts — Phase 3D-Q accommodation wiring", () => {
  it("exposes the persisted accommodation state and setters that delegate to the pure module", async () => {
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    expect(hook).toMatch(
      /import\s*\{[\s\S]*?\bwithDayAccommodationChoice\b[\s\S]*?\}\s*from\s*["']\.\/lib\/planning-draft-v8["']/
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

  it("keeps V8 as the single canonical runtime draft under the existing storage key", async () => {
    const hook = await readFile(new URL("../usePlanningDraft.ts", import.meta.url), "utf8");
    const code = withoutComments(hook);
    // Still exactly one piece of state: the whole V8 draft. No parallel legacy state, no second key,
    // no separate day-id store, and — Block 4 — no side-car store for the chosen zone either.
    expect(code.match(/useState\s*[<(]/g) ?? []).toHaveLength(1);
    expect(code).not.toContain("ManualPlanningDraftV3");
    expect(code).not.toContain("ManualPlanningDraftV4");
    expect(code).not.toMatch(/from ["']\.\/lib\/planning-draft["']/);
    expect(code).not.toMatch(/from ["']\.\/lib\/planning-draft-v4["']/);
    expect(code).not.toMatch(/from ["']\.\/lib\/planning-draft-v7["']/);
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
      /<OfficialReservationDateNotice\s+places=\{\[row\.place\]\}\s+dayAssignment=\{dayAssignment\}\s+startDate=\{startDate\}\s+dayNumber=\{row\.dayNumber\}\s+referenceDate=\{reservationReferenceDate\}\s*\/>/
    );
  });

  it("receives no hours, closure, end-date, visit-time or Phase 3D reservation input", async () => {
    const source = await readSource();
    const notice = withoutComments(extractOfficialReservationDateNoticeSource(source));
    for (const forbidden of [
      // Phase 3F-H shares only the explicit civil-date VALUE; it never captures a second clock and
      // never reaches into the Phase 3D-O evaluator or the editorial reservation domain.
      "captureDeviceLocalCivilDate",
      "evaluateReservationWindowReference",
      "describeReservationWindowReferenceForUi",
      "formatDeviceReferenceDateForUi",
      "derivePlaceReservationDateWindow",
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
    const framing = await readReservationsSource();
    expect(framing).toContain("ni indica el");
    expect(framing).toContain("estado actual de la venta.");
    expect(framing).toContain("la anticipación editorial no confirma disponibilidad");
    expect(framing).toContain("Nihon no combina ambas fuentes.");
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
