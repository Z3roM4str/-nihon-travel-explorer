import { describe, expect, it } from "vitest";
import {
  PLANNING_DRAFT_STORAGE_KEY,
  freshDraft,
  parseStoredDraft,
  withAccommodationLeg,
  withDayAccommodationChoice,
  withDayMoved,
  withInitialDays,
  withNewAccommodation,
  withNewEmptyDay,
  withPlaceAddedToDay,
  withPlaceMovedToPosition,
  withPlaceRemovedFromDay,
  withRoute,
  withStartDate,
  withVisitStartTime,
  writeDraft,
  type ManualPlanningDraftV8,
} from "./lib/planning-draft-v8";
import { buildDayAssignment } from "./lib/day-assignment";

/**
 * B28 (B9.2) — modelo de reordenación. Pruebas semánticas de las tres mutaciones nuevas sobre V8:
 * un único borrador final por gesto, identidad estable de día, sin duplicados ni pérdidas, y el
 * alojamiento / traslados / reservas (legs, horas) intactos. Es la línea Claude: no depende de
 * ninguna otra implementación.
 */

const SAVED = ["a", "b", "c", "d", "e", "f"];

function seeded(): ManualPlanningDraftV8 {
  let n = 0;
  const base = freshDraft(["a", "b", "c", "d", "e"]);
  let draft = withInitialDays(base, [["a", "b", "c"], ["d"], ["e"]], () => `day-${++n}`);
  draft = withStartDate(draft, "2027-02-22");
  draft = withNewAccommodation(draft, "Hotel Uno", { lat: 35, lng: 139 }, () => "acc-1");
  return draft;
}

function ids(draft: ManualPlanningDraftV8): string[][] {
  return draft.days!.map((day) => day.placeIds);
}

function valid(draft: ManualPlanningDraftV8): boolean {
  return buildDayAssignment(draft.routeIds, ids(draft)).valid;
}

describe("B28 withPlaceMovedToPosition", () => {
  it("mismo día: primero → último y último → primero", () => {
    const before = seeded();
    const toLast = withPlaceMovedToPosition(before, "day-1", "day-1", 0, 2);
    expect(ids(toLast)[0]).toEqual(["b", "c", "a"]);
    const toFirst = withPlaceMovedToPosition(toLast, "day-1", "day-1", 2, 0);
    expect(ids(toFirst)[0]).toEqual(["a", "b", "c"]);
    expect(valid(toLast) && valid(toFirst)).toBe(true);
  });

  it("entre días: posición exacta (inicio, medio, final) y un solo estado final", () => {
    const before = seeded();
    const start = withPlaceMovedToPosition(before, "day-1", "day-2", 1, 0);
    expect(ids(start)).toEqual([["a", "c"], ["b", "d"], ["e"]]);
    const end = withPlaceMovedToPosition(before, "day-1", "day-2", 1, 1);
    expect(ids(end)).toEqual([["a", "c"], ["d", "b"], ["e"]]);
    const toEmpty = withNewEmptyDay(before, () => "day-4");
    const into = withPlaceMovedToPosition(toEmpty, "day-3", "day-4", 0, 0);
    expect(ids(into)).toEqual([["a", "b", "c"], ["d"], [], ["e"]]);
    expect(valid(start) && valid(end) && valid(into)).toBe(true);
  });

  it("identidad estable: mismos ids de día y mismo orden de días; los demás días, byte a byte", () => {
    const before = seeded();
    const after = withPlaceMovedToPosition(before, "day-1", "day-2", 0, 1);
    expect(after.days!.map((d) => d.id)).toEqual(["day-1", "day-2", "day-3"]);
    expect(after.days![2]).toEqual(before.days![2]);
    expect(after.routeIds).toEqual(before.routeIds);
    expect(after.startDate).toBe(before.startDate);
    expect(after.accommodations).toEqual(before.accommodations);
  });

  it("no duplica ni pierde lugares tras una cadena de movimientos", () => {
    let draft = seeded();
    draft = withPlaceMovedToPosition(draft, "day-1", "day-3", 2, 0);
    draft = withPlaceMovedToPosition(draft, "day-3", "day-2", 0, 1);
    draft = withPlaceMovedToPosition(draft, "day-2", "day-1", 0, 0);
    draft = withPlaceMovedToPosition(draft, "day-1", "day-1", 0, 2);
    expect(ids(draft).flat().sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(valid(draft)).toBe(true);
  });

  it("el día que queda vacío conserva su id y resetea su alojamiento; el destino conserva el suyo", () => {
    let draft = seeded();
    draft = withDayAccommodationChoice(draft, "day-2", "start", { kind: "accommodation", accommodationId: "acc-1" });
    draft = withDayAccommodationChoice(draft, "day-3", "start", { kind: "accommodation", accommodationId: "acc-1" });
    const after = withPlaceMovedToPosition(draft, "day-2", "day-3", 0, 0); // día 2 se queda vacío
    expect(after.days![1]).toMatchObject({ id: "day-2", placeIds: [] });
    expect(after.days![1].accommodationBoundary.start.kind).toBe("unselected");
    expect(after.days![2].accommodationBoundary.start).toEqual({ kind: "accommodation", accommodationId: "acc-1" });
  });

  it("legs de alojamiento y horas de inicio sobreviven (identidad por lugar, no por día)", () => {
    let draft = seeded();
    draft = withAccommodationLeg(draft, "accommodation-to-place", "acc-1", "a", 25);
    draft = withVisitStartTime(draft, "b", "10:30");
    const after = withPlaceMovedToPosition(draft, "day-1", "day-2", 0, 0);
    expect(after.accommodationLegs).toEqual(draft.accommodationLegs);
    expect(after.visitStartTimes).toEqual({ b: "10:30" });
  });

  it("rechaza sin tocar nada: día desconocido, índices fuera de rango, sin reparto, no-op", () => {
    const before = seeded();
    expect(withPlaceMovedToPosition(before, "nope", "day-1", 0, 0)).toBe(before);
    expect(withPlaceMovedToPosition(before, "day-1", "nope", 0, 0)).toBe(before);
    expect(withPlaceMovedToPosition(before, "day-1", "day-2", 9, 0)).toBe(before);
    expect(withPlaceMovedToPosition(before, "day-1", "day-2", 0, 5)).toBe(before);
    expect(withPlaceMovedToPosition(before, "day-1", "day-2", 0, -1)).toBe(before);
    expect(withPlaceMovedToPosition(before, "day-1", "day-1", 1, 1)).toBe(before);
    const noSplit = freshDraft(SAVED);
    expect(withPlaceMovedToPosition(noSplit, "day-1", "day-2", 0, 0)).toBe(noSplit);
  });

  it("reordenar días (↑↓) sigue moviendo la entidad entera con sus paradas", () => {
    const before = withPlaceMovedToPosition(seeded(), "day-1", "day-2", 0, 1);
    const after = withDayMoved(before, "day-2", -1);
    expect(after.days!.map((d) => d.id)).toEqual(["day-2", "day-1", "day-3"]);
    expect(after.days![0]).toEqual(before.days![1]);
  });
});

describe("B28 withPlaceAddedToDay («Añadir al día…»)", () => {
  function withSavedF(): ManualPlanningDraftV8 {
    return seeded(); // «f» está guardado pero fuera del recorrido
  }

  it("mete el lugar en un día y posición sin rehacer el reparto ni tocar otros días", () => {
    const before = withSavedF();
    const after = withPlaceAddedToDay(before, "day-2", "f", 0, SAVED);
    expect(ids(after)).toEqual([["a", "b", "c"], ["f", "d"], ["e"]]);
    expect(after.days!.map((d) => d.id)).toEqual(["day-1", "day-2", "day-3"]);
    expect(after.days![0]).toEqual(before.days![0]);
    expect(after.days![2]).toEqual(before.days![2]);
    expect(after.routeIds).toEqual([...before.routeIds, "f"]);
    expect(valid(after)).toBe(true);
  });

  it("funciona sobre un día vacío y al final; conserva alojamiento y fecha", () => {
    let before = withNewEmptyDay(withSavedF(), () => "day-4");
    before = withDayAccommodationChoice(before, "day-1", "start", { kind: "accommodation", accommodationId: "acc-1" });
    const empty = withPlaceAddedToDay(before, "day-4", "f", 0, SAVED);
    expect(ids(empty)[3]).toEqual(["f"]);
    expect(empty.days![0].accommodationBoundary).toEqual(before.days![0].accommodationBoundary);
    const end = withPlaceAddedToDay(before, "day-1", "f", 3, SAVED);
    expect(ids(end)[0]).toEqual(["a", "b", "c", "f"]);
    expect(end.startDate).toBe("2027-02-22");
  });

  it("rechaza: ya está en la ruta, no está guardado, día/índice inválidos, sin reparto", () => {
    const before = withSavedF();
    expect(withPlaceAddedToDay(before, "day-1", "a", 0, SAVED)).toBe(before);
    expect(withPlaceAddedToDay(before, "day-1", "zzz", 0, SAVED)).toBe(before);
    expect(withPlaceAddedToDay(before, "nope", "f", 0, SAVED)).toBe(before);
    expect(withPlaceAddedToDay(before, "day-1", "f", 4, SAVED)).toBe(before);
    const noSplit = freshDraft(["a", "b"]);
    expect(withPlaceAddedToDay(noSplit, "day-1", "b", 0, SAVED)).toBe(noSplit);
  });

  it("contraste: la vía antigua (withRoute) sí invalida el reparto", () => {
    expect(withRoute(withSavedF(), [...withSavedF().routeIds, "f"]).days).toBeNull();
  });
});

describe("B28 withPlaceRemovedFromDay («Quitar del día» / soltar en Sin asignar)", () => {
  it("saca el lugar de su día y de la ruta sin rehacer el reparto", () => {
    const before = seeded();
    const after = withPlaceRemovedFromDay(before, "b");
    expect(ids(after)).toEqual([["a", "c"], ["d"], ["e"]]);
    expect(after.days!.map((d) => d.id)).toEqual(["day-1", "day-2", "day-3"]);
    expect(after.routeIds).not.toContain("b");
    expect(after.days![1]).toEqual(before.days![1]);
    expect(valid(after)).toBe(true);
  });

  it("poda lo del lugar (hora, legs) y resetea el alojamiento del día que queda vacío", () => {
    let draft = seeded();
    draft = withAccommodationLeg(draft, "accommodation-to-place", "acc-1", "d", 15);
    draft = withVisitStartTime(draft, "d", "09:00");
    draft = withDayAccommodationChoice(draft, "day-2", "start", { kind: "accommodation", accommodationId: "acc-1" });
    const after = withPlaceRemovedFromDay(draft, "d");
    expect(after.days![1]).toMatchObject({ id: "day-2", placeIds: [] });
    expect(after.days![1].accommodationBoundary.start.kind).toBe("unselected");
    expect(after.accommodationLegs).toEqual([]);
    expect(after.visitStartTimes).toEqual({});
    expect(after.accommodations).toEqual(draft.accommodations);
  });

  it("ruta inversa: quitar y volver a añadir deja el día como estaba (mismo orden)", () => {
    const before = seeded();
    const removed = withPlaceRemovedFromDay(before, "b");
    const back = withPlaceAddedToDay(removed, "day-1", "b", 1, SAVED);
    expect(ids(back)).toEqual(ids(before));
    expect(back.days!.map((d) => d.id)).toEqual(before.days!.map((d) => d.id));
  });

  it("rechaza lo que no está en ningún día", () => {
    const before = seeded();
    expect(withPlaceRemovedFromDay(before, "zzz")).toBe(before);
    const noSplit = freshDraft(SAVED);
    expect(withPlaceRemovedFromDay(noSplit, "a")).toBe(noSplit);
  });
});

describe("B28 persistencia", () => {
  it("un borrador reordenado sobrevive a serializar/parsear con el mismo orden e ids", () => {
    let draft = seeded();
    draft = withPlaceMovedToPosition(draft, "day-1", "day-3", 0, 0);
    draft = withPlaceAddedToDay(draft, "day-2", "f", 1, SAVED);
    const store = new Map<string, string>();
    writeDraft({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) }, draft);
    expect(store.has(PLANNING_DRAFT_STORAGE_KEY)).toBe(true);
    const parsed = parseStoredDraft(JSON.parse(store.get(PLANNING_DRAFT_STORAGE_KEY)!));
    expect(parsed).toEqual(draft);
    expect(parsed!.days!.map((d) => d.id)).toEqual(["day-1", "day-2", "day-3"]);
  });
});
