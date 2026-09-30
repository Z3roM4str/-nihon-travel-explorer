import { describe, expect, it } from "vitest";
import {
  freshDraft,
  parseStoredDraft,
  withAccommodationLeg,
  withDayAccommodationChoice,
  withDayMoved,
  withInitialDays,
  withNewAccommodation,
  withNewEmptyDay,
  withPlaceMovedToPosition,
  withStartDate,
  withVisitStartTime,
  type ManualPlanningDraftV8,
} from "./lib/planning-draft-v8";
import { buildDayAssignment } from "./lib/day-assignment";
import { isPermutationOf, isSameOrder, moveItemDown, moveItemUp, planDayOrderMoves } from "./components/day-order";

/**
 * B29 (B9.3) — el modelo de «Usar este orden». La propuesta es una permutación de los ids del propio
 * día; el único efecto sobre el borrador es repetir `planDayOrderMoves` con la mutación B28 que ya
 * existía (`withPlaceMovedToPosition`, mismo día). Aquí se prueba que eso deja EXACTAMENTE el orden
 * pedido y nada más.
 */

function replay(draft: ManualPlanningDraftV8, dayId: string, target: readonly string[]): ManualPlanningDraftV8 {
  const current = draft.days!.find((day) => day.id === dayId)!.placeIds;
  let next = draft;
  for (const move of planDayOrderMoves(current, target)) {
    next = withPlaceMovedToPosition(next, dayId, dayId, move.from, move.to);
  }
  return next;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest])
  );
}

function seeded(): ManualPlanningDraftV8 {
  let n = 0;
  let draft = withInitialDays(
    freshDraft(["a", "b", "c", "d", "e", "f", "g"]),
    [["a", "b", "c", "d"], ["e", "f"], ["g"], []],
    () => `day-${++n}`
  );
  draft = withStartDate(draft, "2027-02-22");
  draft = withNewAccommodation(draft, "Hotel Uno", { lat: 35, lng: 139 }, () => "acc-1");
  draft = withDayAccommodationChoice(draft, "day-1", "end", { kind: "accommodation", accommodationId: "acc-1" });
  draft = withAccommodationLeg(draft, "place-to-accommodation", "acc-1", "b", 20);
  draft = withVisitStartTime(draft, "a", "09:30");
  return draft;
}

describe("B29 planDayOrderMoves — permutaciones", () => {
  it("cualquier permutación de 0…5 paradas se alcanza con los movimientos planeados", () => {
    for (let size = 0; size <= 5; size += 1) {
      const base = Array.from({ length: size }, (_, i) => `p${i}`);
      for (const target of permutations(base)) {
        const working = [...base];
        for (const move of planDayOrderMoves(base, target)) {
          working.splice(move.to, 0, working.splice(move.from, 1)[0]);
        }
        expect(working).toEqual(target);
      }
    }
  });

  it("el mismo orden no planea ningún movimiento (no-op) y no escribe", () => {
    expect(planDayOrderMoves(["a", "b", "c"], ["a", "b", "c"])).toEqual([]);
    expect(planDayOrderMoves([], [])).toEqual([]);
    expect(planDayOrderMoves(["a"], ["a"])).toEqual([]);
  });

  it("una propuesta que no es permutación (ajena, duplicada, incompleta) no planea nada", () => {
    expect(planDayOrderMoves(["a", "b", "c"], ["a", "b"])).toEqual([]);
    expect(planDayOrderMoves(["a", "b", "c"], ["a", "b", "x"])).toEqual([]);
    expect(planDayOrderMoves(["a", "b", "c"], ["a", "a", "b"])).toEqual([]);
    expect(isPermutationOf(["c", "a", "b"], ["a", "b", "c"])).toBe(true);
    expect(isPermutationOf(["a", "a"], ["a", "b"])).toBe(false);
    expect(isSameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(isSameOrder(["a", "b"], ["b", "a"])).toBe(false);
  });

  it("moveItemUp/Down intercambian vecinos y son no-op en los bordes sin mutar", () => {
    const base = ["a", "b", "c"];
    expect(moveItemUp(base, 1)).toEqual(["b", "a", "c"]);
    expect(moveItemDown(base, 1)).toEqual(["a", "c", "b"]);
    expect(moveItemUp(base, 0)).toEqual(base);
    expect(moveItemDown(base, 2)).toEqual(base);
    expect(base).toEqual(["a", "b", "c"]);
  });
});

describe("B29 «Usar este orden» sobre el borrador V8", () => {
  it("cambia sólo el orden del día objetivo: mismo id, demás días byte a byte, resto del borrador intacto", () => {
    const before = seeded();
    for (const target of permutations(["a", "b", "c", "d"])) {
      const after = replay(before, "day-1", target);
      expect(after.days![0].placeIds).toEqual(target);
      expect(after.days![0].id).toBe("day-1");
      expect(after.days![0].accommodationBoundary).toEqual(before.days![0].accommodationBoundary);
      expect(JSON.stringify(after.days!.slice(1))).toBe(JSON.stringify(before.days!.slice(1)));
      const { days: _a, ...restAfter } = after;
      const { days: _b, ...restBefore } = before;
      expect(JSON.stringify(restAfter)).toBe(JSON.stringify(restBefore));
      expect(buildDayAssignment(after.routeIds, after.days!.map((d) => d.placeIds)).valid).toBe(true);
    }
  });

  it("un día con 2 y con 1 parada: dos órdenes / ninguno", () => {
    const before = seeded();
    expect(replay(before, "day-2", ["f", "e"]).days![1].placeIds).toEqual(["f", "e"]);
    expect(replay(before, "day-3", ["g"])).toBe(before);
    expect(replay(before, "day-4", [])).toBe(before);
  });

  it("opera por id estable aunque B28 haya movido el día de posición ordinal", () => {
    const moved = withDayMoved(seeded(), "day-1", 1); // Día 1 pasa a ser el ordinal 2
    expect(moved.days!.map((d) => d.id)).toEqual(["day-2", "day-1", "day-3", "day-4"]);
    const after = replay(moved, "day-1", ["d", "c", "b", "a"]);
    expect(after.days!.map((d) => d.id)).toEqual(["day-2", "day-1", "day-3", "day-4"]);
    expect(after.days![1].placeIds).toEqual(["d", "c", "b", "a"]);
    expect(after.days![0]).toEqual(moved.days![0]);
  });

  it("varios días y un día vacío añadido después no se ven afectados", () => {
    const withEmpty = withNewEmptyDay(seeded(), () => "day-new");
    const after = replay(withEmpty, "day-2", ["f", "e"]);
    expect(after.days!.map((d) => d.placeIds)).toEqual([["a", "b", "c", "d"], ["f", "e"], ["g"], [], []]);
    expect(after.days!.at(-1)!.id).toBe("day-new");
  });

  it("persistencia: el borrador resultante serializa y se vuelve a leer igual (V8, misma forma)", () => {
    const after = replay(seeded(), "day-1", ["c", "a", "d", "b"]);
    expect(after.version).toBe(8);
    const parsed = parseStoredDraft(JSON.parse(JSON.stringify(after)));
    expect(parsed?.days![0].placeIds).toEqual(["c", "a", "d", "b"]);
    expect(Object.keys(parsed!).sort()).toEqual(Object.keys(seeded()).sort());
  });

  it("una propuesta obsoleta (ids que ya no son del día) no cambia el borrador", () => {
    const before = seeded();
    expect(replay(before, "day-1", ["a", "b", "e", "d"])).toBe(before);
  });
});
