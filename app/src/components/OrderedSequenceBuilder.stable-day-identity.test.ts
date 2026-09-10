import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  dayMatrixFromPlanningDays,
  withDayAccommodationChoice,
  withInitialDays,
  withNewEmptyDay,
  withPlaceMovedBetweenDays,
  withPlaceMovedWithinDay,
  withStartDate,
  withAccommodation,
  withAccommodationLeg,
  withoutEmptyDay,
  type ManualPlanningDraftV5,
} from "../lib/planning-draft-v5";
import {
  buildDayLogisticsWithAccommodation,
  type AccommodationBoundaryLegResult,
} from "../lib/accommodation-commute";
import { buildDayAssignment } from "../lib/day-assignment";
import { addCivilDays } from "../lib/civil-date";

/**
 * Phase 3D-S — Stable Day Identity Runtime: the UI-flow integration checks.
 *
 * This file follows the same two-part convention the existing
 * `OrderedSequenceBuilder.test.ts` already uses for Phase 3C-C/3D-L/3D-Q: the pure state
 * transitions are exercised as the real end-to-end flow a user performs (every step is exactly the
 * call the corresponding control's `onClick`/`onChange` makes, in order), and the wiring itself is
 * asserted against the component source, so the flow tests cannot pass against a control that is
 * secretly still rebuilding a whole `string[][]` matrix.
 *
 * Rendering is asserted through the same derivation the component renders from
 * (`buildDayLogisticsWithAccommodation` for the accommodation section, `dayIndex + 1` for the
 * visible `Día N` label), rather than through a DOM harness this project does not have.
 */

const SOURCE_PATH = new URL("./OrderedSequenceBuilder.tsx", import.meta.url);
const HOOK_PATH = new URL("../usePlanningDraft.ts", import.meta.url);

async function readSource(): Promise<string> {
  return readFile(SOURCE_PATH, "utf8");
}

const hotelA = { id: "hotel-a", label: "Hotel A", location: { lat: 35.6812, lng: 139.7671 } };
const hotelB = { id: "hotel-b", label: "Hotel B", location: { lat: 34.6937, lng: 135.5023 } };

function sequentialIds(prefix = "day"): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `${prefix}-${next}`;
  };
}

/** The state the user arrives at after: opening "Distribuir por días" on a three-place route,
 * splitting it into two days, registering both hotels, choosing Hotel A for Día 1's two sides, and
 * typing the two exact durations for Día 1's current endpoints. */
function seededDraft(): ManualPlanningDraftV5 {
  const ids = sequentialIds();
  let draft: ManualPlanningDraftV5 = {
    version: 5,
    routeIds: ["p1", "p2", "p3"],
    days: null,
    startDate: "2026-03-01",
    visitStartTimes: {},
    accommodations: [],
    accommodationLegs: [],
  };
  draft = withInitialDays(draft, [["p1", "p2", "p3"]], ids);
  draft = withNewEmptyDay(draft, ids);
  // Move p3 into the second day, so the split is [p1, p2] / [p3].
  draft = withPlaceMovedBetweenDays(draft, draft.days![0].id, draft.days![1].id, 2);
  draft = withAccommodation(draft, hotelA);
  draft = withAccommodation(draft, hotelB);
  draft = withDayAccommodationChoice(draft, draft.days![0].id, "start", {
    kind: "accommodation",
    accommodationId: "hotel-a",
  });
  draft = withDayAccommodationChoice(draft, draft.days![0].id, "end", {
    kind: "accommodation",
    accommodationId: "hotel-a",
  });
  draft = withAccommodationLeg(draft, "accommodation-to-place", "hotel-a", "p1", 20);
  draft = withAccommodationLeg(draft, "place-to-accommodation", "hotel-a", "p2", 30);
  return draft;
}

/** Exactly what the day card renders its accommodation section from. */
function dayLogistics(draft: ManualPlanningDraftV5, dayIndex: number) {
  const matrix = dayMatrixFromPlanningDays(draft.days)!;
  const assignment = buildDayAssignment(draft.routeIds, matrix);
  return buildDayLogisticsWithAccommodation(
    matrix[dayIndex],
    assignment.days[dayIndex].sequence.summary,
    draft.days![dayIndex].accommodationBoundary,
    draft.accommodationLegs
  );
}

/** The visible label is the array position, not the id — exactly `Día {dayIndex + 1}`. */
function visibleDayLabels(draft: ManualPlanningDraftV5): string[] {
  return (draft.days ?? []).map((_, dayIndex) => `Día ${dayIndex + 1}`);
}

function isMissing(result: AccommodationBoundaryLegResult, placeId: string): boolean {
  return result.kind === "manual-leg-missing" && result.placeId === placeId;
}

// ---------------------------------------------------------------------------------------
// User flows
// ---------------------------------------------------------------------------------------

describe("day view flow — reorder places inside one day", () => {
  it("keeps the day's accommodation selection when the user reorders inside it", () => {
    const before = seededDraft();
    const dayId = before.days![0].id;
    // The user presses "move down" on the first place of Día 1.
    const after = withPlaceMovedWithinDay(before, dayId, 0, 1);

    expect(after.days![0].id).toBe(dayId);
    expect(after.days![0].placeIds).toEqual(["p2", "p1"]);
    expect(after.days![0].accommodationBoundary).toEqual(before.days![0].accommodationBoundary);
    expect(after.days![0].accommodationBoundary.start).toEqual({
      kind: "accommodation",
      accommodationId: "hotel-a",
    });
  });

  it("shows the new endpoints as unrecorded rather than reusing the old durations", () => {
    const after = withPlaceMovedWithinDay(seededDraft(), seededDraft().days![0].id, 0, 1);
    const logistics = dayLogistics(after, 0);
    // Start endpoint became p2 and end endpoint became p1; neither has an exact leg on record.
    expect(isMissing(logistics.outbound, "p2")).toBe(true);
    expect(isMissing(logistics.returnLeg, "p1")).toBe(true);
    // Missing is never zero, and never a reused old value.
    expect(logistics.registeredTransferMinutes).toBeNull();
    expect(logistics.completeDoorToDoor).toBe(false);
    // Both original legs are still persisted, simply unused.
    expect(after.accommodationLegs).toHaveLength(2);
  });

  it("shows a recorded duration when the endpoint's exact leg does exist", () => {
    const logistics = dayLogistics(seededDraft(), 0);
    expect(logistics.outbound).toMatchObject({ kind: "manual-leg", minutes: 20, placeId: "p1" });
    expect(logistics.returnLeg).toMatchObject({ kind: "manual-leg", minutes: 30, placeId: "p2" });
  });

  it("keeps the visible ordinal labels unchanged", () => {
    const before = seededDraft();
    expect(visibleDayLabels(withPlaceMovedWithinDay(before, before.days![0].id, 0, 1))).toEqual([
      "Día 1",
      "Día 2",
    ]);
  });
});

describe("day view flow — move a place across days", () => {
  it("keeps both days' selections when both stay non-empty", () => {
    const before = seededDraft();
    const withChoiceOnTwo = withDayAccommodationChoice(before, before.days![1].id, "start", {
      kind: "accommodation",
      accommodationId: "hotel-b",
    });
    const [idOne, idTwo] = withChoiceOnTwo.days!.map((d) => d.id);
    // The user presses "al día siguiente" on Día 1's second place.
    const after = withPlaceMovedBetweenDays(withChoiceOnTwo, idOne, idTwo, 1);

    expect(after.days!.map((d) => d.id)).toEqual([idOne, idTwo]);
    expect(after.days![0].placeIds).toEqual(["p1"]);
    expect(after.days![1].placeIds).toEqual(["p3", "p2"]);
    expect(after.days![0].accommodationBoundary.start).toEqual({
      kind: "accommodation",
      accommodationId: "hotel-a",
    });
    expect(after.days![1].accommodationBoundary.start).toEqual({
      kind: "accommodation",
      accommodationId: "hotel-b",
    });
  });

  it("renders the moved-to day's changed endpoint as unrecorded, never rebound", () => {
    const before = seededDraft();
    const withChoiceOnTwo = withDayAccommodationChoice(before, before.days![1].id, "end", {
      kind: "accommodation",
      accommodationId: "hotel-b",
    });
    const [idOne, idTwo] = withChoiceOnTwo.days!.map((d) => d.id);
    const after = withPlaceMovedBetweenDays(withChoiceOnTwo, idOne, idTwo, 1);
    // Día 2 now ends at p2. A p2 leg exists — but for Hotel A, not the chosen Hotel B.
    expect(isMissing(dayLogistics(after, 1).returnLeg, "p2")).toBe(true);
  });

  it("keeps Día 1's remaining endpoints recorded where the exact leg still matches", () => {
    const before = seededDraft();
    const after = withPlaceMovedBetweenDays(before, before.days![0].id, before.days![1].id, 1);
    // Día 1 is now [p1]: start endpoint p1 still has its exact Hotel A leg.
    expect(dayLogistics(after, 0).outbound).toMatchObject({ kind: "manual-leg", minutes: 20, placeId: "p1" });
    // Its end endpoint is now also p1, which has no place-to-accommodation leg on record.
    expect(isMissing(dayLogistics(after, 0).returnLeg, "p1")).toBe(true);
  });
});

describe("day view flow — a day becomes empty", () => {
  it("resets the emptied day's accommodation selection to unselected but keeps the day", () => {
    const before = seededDraft();
    const [idOne, idTwo] = before.days!.map((d) => d.id);
    const emptied = withPlaceMovedBetweenDays(
      withPlaceMovedBetweenDays(before, idOne, idTwo, 0),
      idOne,
      idTwo,
      0
    );
    expect(emptied.days![0].id).toBe(idOne);
    expect(emptied.days![0].placeIds).toEqual([]);
    expect(emptied.days![0].accommodationBoundary).toEqual({
      start: { kind: "unselected" },
      end: { kind: "unselected" },
    });
    // Both days still exist, so the visible labels are unchanged.
    expect(visibleDayLabels(emptied)).toEqual(["Día 1", "Día 2"]);
  });

  it("does not resurrect the old selection when the user moves a place back in", () => {
    const before = seededDraft();
    const [idOne, idTwo] = before.days!.map((d) => d.id);
    const emptied = withPlaceMovedBetweenDays(
      withPlaceMovedBetweenDays(before, idOne, idTwo, 0),
      idOne,
      idTwo,
      0
    );
    const repopulated = withPlaceMovedBetweenDays(emptied, idTwo, idOne, 0);
    expect(repopulated.days![0].id).toBe(idOne);
    expect(repopulated.days![0].placeIds).toHaveLength(1);
    expect(repopulated.days![0].accommodationBoundary).toEqual({
      start: { kind: "unselected" },
      end: { kind: "unselected" },
    });
  });

  it("renders nothing accommodation-related for the empty bucket itself", () => {
    const before = seededDraft();
    const [idOne, idTwo] = before.days!.map((d) => d.id);
    const emptied = withPlaceMovedBetweenDays(
      withPlaceMovedBetweenDays(before, idOne, idTwo, 0),
      idOne,
      idTwo,
      0
    );
    const logistics = dayLogistics(emptied, 0);
    expect(logistics.outbound).toEqual({ kind: "not-applicable", side: "start", reason: "empty-day" });
    expect(logistics.returnLeg).toEqual({ kind: "not-applicable", side: "end", reason: "empty-day" });
    expect(logistics.registeredTransferMinutes).toBeNull();
  });
});

describe("day view flow — add and delete an empty day", () => {
  it("adds a day that starts unselected without disturbing any existing day", () => {
    const before = seededDraft();
    const after = withNewEmptyDay(before, () => "brand-new");
    expect(after.days!.slice(0, 2)).toEqual(before.days);
    expect(after.days![2]).toEqual({
      id: "brand-new",
      placeIds: [],
      accommodationBoundary: { start: { kind: "unselected" }, end: { kind: "unselected" } },
    });
    expect(visibleDayLabels(after)).toEqual(["Día 1", "Día 2", "Día 3"]);
    // Only the new day is unselected — Día 1 keeps its choices.
    expect(after.days![0].accommodationBoundary.start).toEqual({
      kind: "accommodation",
      accommodationId: "hotel-a",
    });
  });

  it("deletes only that empty day, keeping anchors, legs, times and every other day", () => {
    const before = withNewEmptyDay(seededDraft(), () => "brand-new");
    const after = withoutEmptyDay(before, "brand-new");
    expect(after.days!.map((d) => d.id)).toEqual(before.days!.slice(0, 2).map((d) => d.id));
    expect(after.accommodations).toEqual(before.accommodations);
    expect(after.accommodationLegs).toEqual(before.accommodationLegs);
    expect(after.startDate).toBe(before.startDate);
    expect(after.visitStartTimes).toEqual(before.visitStartTimes);
    expect(visibleDayLabels(after)).toEqual(["Día 1", "Día 2"]);
  });

  it("leaves the derived ordinal dates to array position, never to a day id", () => {
    const before = seededDraft();
    const after = withNewEmptyDay(before, () => "brand-new");
    expect(after.days!.map((_, index) => addCivilDays(after.startDate!, index))).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
    // Changing the start date moves every date and no id.
    const rescheduled = withStartDate(after, "2026-04-10");
    expect(rescheduled.days!.map((d) => d.id)).toEqual(after.days!.map((d) => d.id));
    expect(addCivilDays(rescheduled.startDate!, 2)).toBe("2026-04-12");
  });
});

// ---------------------------------------------------------------------------------------
// Component wiring
// ---------------------------------------------------------------------------------------

describe("OrderedSequenceBuilder.tsx — Phase 3D-S identity-aware wiring", () => {
  it("consumes the identity view and the ordinal projection as two separate values", async () => {
    const source = await readSource();
    expect(source).toMatch(/const dayIds = useMemo\(\(\) => days \?\? \[\], \[days\]\);/);
    expect(source).toMatch(/const dayEntities = useMemo\(\(\) => planningDays \?\? \[\], \[planningDays\]\);/);
  });

  it("addresses every day mutation by the day's stable id, not by its ordinal index", async () => {
    const source = await readSource();
    expect(source).toMatch(/movePlaceWithinDay\(dayEntity\.id, placeIndex, -1\)/);
    expect(source).toMatch(/movePlaceWithinDay\(dayEntity\.id, placeIndex, 1\)/);
    expect(source).toMatch(/movePlaceBetweenDays\(dayEntity\.id, target\.id, placeIndex\)/);
    expect(source).toMatch(/removeEmptyDay\(dayEntity\.id\)/);
    expect(source).toMatch(/setDayAccommodationChoice\(dayEntity\.id, side, choice\)/);
    expect(source).toMatch(/onClick=\{\(\) => addEmptyDay\(\)\}/);
  });

  it("no longer rebuilds a whole day matrix in the component", async () => {
    const source = await readSource();
    for (const gone of [
      "function addEmptyDay(days",
      "function removeEmptyDay(days",
      "function moveWithinDay(",
      "function moveToAdjacentDay(",
      "setDayIds(",
    ]) {
      expect(source).not.toContain(gone);
    }
  });

  it("passes only the ordinal projection to every temporal and logistics consumer", async () => {
    const source = await readSource();
    // Each of these still receives places / the ordinal matrix / the ordinal day number.
    expect(source).toMatch(/dayPlaceIds=\{dayIds\[dayIndex\] \?\? \[\]\}/);
    expect(source).toMatch(/dayNumber=\{dayIndex \+ 1\}/);
    expect(source).toMatch(/const dayDate = startDate \? addCivilDays\(startDate, dayIndex\) : null;/);
    // And no day id is ever handed to one.
    expect(source).not.toMatch(/dayId=\{/);
    expect(source).not.toMatch(/dayId:\s*day/);
    expect(source).not.toMatch(/buildDayAssignment\([^)]*dayEntities/);
  });

  it("keeps the day id invisible to the user — the heading stays the ordinal label", async () => {
    const source = await readSource();
    expect(source).toMatch(/<h3 id=\{`day-heading-\$\{dayIndex\}`\}>Día \{dayIndex \+ 1\}<\/h3>/);
    expect(source).toMatch(/aria-label=\{`Eliminar Día \$\{dayIndex \+ 1\}`\}/);
    expect(source).toMatch(/labelSuffix=\{` en Día \$\{dayIndex \+ 1\}`\}/);
    // The id is used as a React key and as a mutation address only — never rendered as text.
    expect(source).not.toMatch(/\{dayEntity\.id\}</);
    expect(source).not.toMatch(/>\{dayEntity\?\.id/);
  });

  it("preserves the approved Phase 3D-Q copy", async () => {
    const source = await readSource();
    for (const copy of [
      "Salida desde alojamiento",
      "Regreso al alojamiento",
      "sin registrar",
      "Sin seleccionar",
      "No aplica",
      "Total de traslados registrado:",
      "Sin lugares en este día.",
      "Añadir día",
    ]) {
      expect(source).toContain(copy);
    }
  });

  it("introduces no new planning mode or visual surface", async () => {
    const source = await readSource();
    const views = source.match(/useState<"builder" \| "compare" \| "days">/g) ?? [];
    expect(views).toHaveLength(1);
  });
});

describe("usePlanningDraft.ts — Phase 3D-S mutation surface", () => {
  it("exposes exactly the identity-aware mutations the UI needs, and no bulk day setter", async () => {
    const hook = await readFile(HOOK_PATH, "utf8");
    for (const exposed of [
      "initializeDays,",
      "movePlaceWithinDay,",
      "movePlaceBetweenDays,",
      "addEmptyDay,",
      "removeEmptyDay,",
      "planningDays: draft.days,",
    ]) {
      expect(hook).toContain(exposed);
    }
    expect(hook).not.toMatch(/\bsetDays\b/);
    expect(hook).not.toMatch(/\bwithDays\b/);
  });

  it("projects the ordinal matrix through the pure projection, not by hand", async () => {
    const hook = await readFile(HOOK_PATH, "utf8");
    expect(hook).toMatch(/const days = useMemo\(\(\) => dayMatrixFromPlanningDays\(draft\.days\), \[draft\.days\]\);/);
  });

  it("injects an opaque day-id factory that reads nothing from the day's content", async () => {
    const hook = await readFile(HOOK_PATH, "utf8");
    expect(hook).toMatch(/function randomDayId\(\): string \{/);
    expect(hook).toMatch(/crypto\.randomUUID\(\)/);
    expect(hook).toMatch(/withNewEmptyDay\(current, randomDayId\)/);
    expect(hook).toMatch(/withInitialDays\(current, days, randomDayId\)/);
    const body = hook.slice(hook.indexOf("function randomDayId"), hook.indexOf("type SetStateAction"));
    // "Date.now" is pinned here too (corrective pass, Finding 1): a day id must never encode
    // creation time, on the `randomUUID` path OR on any fallback.
    for (const forbidden of ["Date.now", "placeId", "dayIndex", "startDate", "accommodation", "lat", "lng"]) {
      expect(body).not.toContain(forbidden);
    }
  });

  /**
   * Corrective pass (post-3D-S hostile review, Finding 1): the initial implementation's
   * `crypto.randomUUID()` branch was fine, but its fallback silently encoded `Date.now()` — a
   * creation-time signal the identity contract (`docs/STABLE_DAY_IDENTITY_DESIGN.md` §3.2)
   * explicitly forbids. Checking only for the presence of `crypto.randomUUID()` in the function
   * (as the test above does) is not sufficient, because that assertion holds regardless of what
   * the OTHER branch does. This test isolates the code that runs when `randomUUID` is NOT taken —
   * everything after that branch's closing brace — and pins it independently.
   */
  it("keeps every non-randomUUID fallback free of Date.now and every other non-opaque signal", async () => {
    const hook = await readFile(HOOK_PATH, "utf8");
    const functionBody = hook.slice(hook.indexOf("function randomDayId"), hook.indexOf("type SetStateAction"));
    const randomUUIDBranchEnd = functionBody.indexOf("}", functionBody.indexOf("crypto.randomUUID()"));
    const fallback = functionBody.slice(randomUUIDBranchEnd + 1);

    // A real fallback must exist, and it must not itself be another call to `crypto.randomUUID()`
    // — otherwise the checks below would trivially pass without ever exercising a real alternative
    // path.
    expect(fallback.trim().length).toBeGreaterThan(0);
    expect(fallback).not.toContain("crypto.randomUUID()");

    for (const forbidden of [
      "Date.now",
      "startDate",
      "dayIndex",
      "placeId",
      "accommodation",
      "lat",
      "lng",
      "coordinates",
    ]) {
      expect(fallback).not.toContain(forbidden);
    }
  });
});
