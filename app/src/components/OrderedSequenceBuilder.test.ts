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
