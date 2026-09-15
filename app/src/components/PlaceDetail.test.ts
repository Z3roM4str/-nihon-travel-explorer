import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Phase 3D-C's structural integration coverage for `PlaceDetail.tsx`'s reservation display —
 * the same source-scanning technique `OrderedSequenceBuilder.test.ts` already established for
 * Phase 3D-B, for the same reason: this repository has no component DOM harness (no jsdom, no
 * Testing Library), and adding one is out of scope for this phase (no new dependency).
 *
 * The actual wording correctness ("Reserva recomendable"/"Reserva opcional" exist, generic "No
 * es necesaria" is reserved for the plain not-required category, role-specific nuance is
 * preserved verbatim) is proven once, thoroughly, in `lib/reservation.test.ts`'s
 * `describeReservationForUi` tests — that IS the exact function this component calls, so
 * duplicating those string assertions here would test the same logic twice under a different
 * name. What this file protects instead is the WIRING: that `PlaceDetail.tsx` actually calls the
 * shared domain function rather than reimplementing (or silently reverting to) its own
 * boolean-only interpretation of `place.reservation.required`.
 *
 * Manually verified end-to-end in a real browser (`npm run dev` + Playwright) for five
 * representative places — see `docs/ROADMAP.md`'s Phase 3D-C entry for the exact recorded
 * output.
 */

async function readSource(): Promise<string> {
  return readFile(new URL("./PlaceDetail.tsx", import.meta.url), "utf8");
}

describe("PlaceDetail.tsx — reservation domain wiring (source-scanning integration check)", () => {
  it("imports the reservation domain from lib/reservation", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bdescribeReservationForUi\b[^}]*\binterpretPlaceReservation\b[^}]*\}\s*from\s*["']\.\.\/lib\/reservation["']/
    );
  });

  it("computes the reservation display once from the place's raw reservation state", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /describeReservationForUi\(\s*interpretPlaceReservation\(place\)\s*,\s*place\.reservation\.leadTime\s*\)/
    );
  });

  it("renders the tag from the domain's own label/className, not a hardcoded 'Requiere reserva' literal", async () => {
    const source = await readSource();
    expect(source).toContain("reservation.tag.label");
    expect(source).toContain("reservation.tag.className");
    // The old lossy pattern this phase replaces — a literal boolean-gated tag — must be gone.
    expect(source).not.toMatch(/place\.reservation\.required\s*&&\s*<span/);
  });

  it("renders the practical-info 'Reserva' row from the domain's practicalRow, not a boolean ternary", async () => {
    const source = await readSource();
    expect(source).toMatch(/label="Reserva"\s+value=\{reservation\.practicalRow\}/);
    // The old lossy pattern this phase replaces: `place.reservation.required ? "Necesaria..." :
    // "No es necesaria"` collapsed every non-binary raw value into the same false branch.
    expect(source).not.toMatch(/place\.reservation\.required\s*\?/);
  });

  it("no longer reads place.reservation.required directly anywhere in this component", async () => {
    // The boolean is still a real field on Place (Phase 3D-C keeps it — see lib/reservation.ts's
    // module doc), but this component must resolve reservation semantics through the domain
    // function's output only, never by reading the boolean itself for a UI decision.
    const source = await readSource();
    expect(source).not.toContain("place.reservation.required");
  });
});

/**
 * Phase 3D-F's structural integration coverage for `PlaceDetail.tsx`'s Feb–Mar 2027 card — the
 * same source-scanning technique the reservation-domain block above already established, for the
 * same reason (no jsdom/Testing Library in this repository). The underlying domain logic
 * (category/tier parity with `scripts/temporal_data_lib.py`, priority order, tone/label mapping)
 * is proven once, thoroughly, in `lib/feb-mar-status.test.ts`; this file protects only the
 * WIRING — that this component actually calls that domain instead of the old, independently
 * regexing `alertSeverity()`/`severityLabel()` it used to import from `lib/place`.
 *
 * `alertSeverity`, `severityLabel`, and the `AlertSeverity` type were removed from `lib/place.ts`
 * entirely as part of this phase — a repo-wide grep confirmed `PlaceDetail.tsx` was their only
 * consumer, so there was no other call site to preserve and no reason to keep two competing
 * classifiers of `febMar2027.status` alive side by side.
 */
describe("PlaceDetail.tsx — Feb–Mar 2027 status domain wiring (source-scanning integration check)", () => {
  it("imports the Feb–Mar status domain from lib/feb-mar-status", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bdescribeFebMarStatusForUi\b[^}]*\binterpretPlaceFebMarStatus\b[^}]*\}\s*from\s*["']\.\.\/lib\/feb-mar-status["']/
    );
  });

  it("no longer imports alertSeverity, severityLabel, or AlertSeverity from lib/place", async () => {
    const source = await readSource();
    for (const forbidden of ["alertSeverity", "severityLabel", "AlertSeverity"]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });

  it("computes the Feb–Mar display once from the place's own status, via the domain module", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /describeFebMarStatusForUi\(\s*interpretPlaceFebMarStatus\(place\)\s*\)/
    );
  });

  it("renders the card's CSS modifier, icon, and label from the domain's own output, not a hardcoded ternary", async () => {
    const source = await readSource();
    expect(source).toContain("febMarStatus.cssModifier");
    expect(source).toContain("febMarStatus.icon");
    expect(source).toContain("febMarStatus.label");
    // The old inline ternary this phase replaces.
    expect(source).not.toMatch(/severity === ["']confirmed["']\s*\?/);
  });

  it("still renders the raw status, warning, and action verbatim — this phase corrects semantics, not the card's visible content", async () => {
    const source = await readSource();
    expect(source).toMatch(/\{place\.febMar2027\.status\}/);
    expect(source).toMatch(/\{place\.febMar2027\.warning\}/);
    expect(source).toMatch(/\{place\.febMar2027\.action\}/);
  });

  it("does not read schedule.hours, schedule.closures, bestTime, or reservation fields when computing the Feb-Mar display", async () => {
    // Scoped to the exact expression that builds febMarStatus, not the whole file — the file
    // legitimately reads schedule.hours/bestTime/reservation elsewhere, for entirely unrelated UI
    // rows, and a whole-file scan would false-fail on those.
    const source = await readSource();
    const match = /const febMarStatus = describeFebMarStatusForUi\([^;]*\);/.exec(source);
    expect(match).not.toBeNull();
    const expr = match?.[0] ?? "";
    for (const forbidden of ["schedule.hours", "schedule.closures", "bestTime", "reservation"]) {
      expect(expr, forbidden).not.toContain(forbidden);
    }
  });

  it("never contains open/closed/available/feasible vocabulary in the Feb-Mar card's own markup", async () => {
    const source = await readSource();
    const cardMatch = /<section className=\{`alert alert--\$\{febMarStatus\.cssModifier\}`\}>[\s\S]*?<\/section>/.exec(
      source
    );
    expect(cardMatch).not.toBeNull();
    const lower = (cardMatch?.[0] ?? "").toLowerCase();
    for (const forbidden of ["está abierto", "está cerrado", "disponible", "no disponible", "factible"]) {
      expect(lower, `should not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });
});
