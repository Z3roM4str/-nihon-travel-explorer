import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PLANNING_DRAFT_STORAGE_KEY,
  PLANNING_DRAFT_VERSION,
  freshDraft,
  withInitialDays,
  withNewEmptyDay,
  withPlaceMovedBetweenDays,
  withPlaceRelocatedWithinDay,
  withRoute,
  withoutEmptyDay,
  type ManualPlanningDraftV8,
} from "./lib/planning-draft-v8";
import { buildDayAssignment } from "./lib/day-assignment";
import { dayCityLabel, daySleepLine, dayHeadline, moveTargets, unassignedCountText } from "./lib/day-timeline-presentation";

/**
 * B27 (B9.1) — el bloque es presentación. Este fichero demuestra, con pruebas semánticas y no con
 * instantáneas, que NO cambia el modelo: esquema V8, clave de almacenamiento, identidad estable de
 * día, asignación por días, `routeIds`, alojamiento, traslados entre ciudades, reservas y la
 * comparación de órdenes; y que las dos mutaciones que «Mover a…» reutiliza se comportan como antes.
 */

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const BASE_SHA = "eab63a8af34c8e0474340eba4687766be979933b";

function changedSinceBase(): string[] | null {
  try {
    execFileSync("git", ["cat-file", "-e", `${BASE_SHA}^{commit}`], { cwd: REPO_ROOT });
    return execFileSync("git", ["diff", "--name-only", BASE_SHA, "--", "app/src", "data"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
  } catch {
    return null;
  }
}

function seeded(): ManualPlanningDraftV8 {
  let n = 0;
  const base = freshDraft(["a", "b", "c", "d", "e"]);
  const withDays = withInitialDays(base, [["a", "b", "c"], ["d"], ["e"]], () => `day-${++n}`);
  return { ...withDays, startDate: "2027-02-22" };
}

describe("B27 — el esquema y la clave de planificación no cambian", () => {
  it("sigue siendo V8 bajo la misma clave", () => {
    expect(PLANNING_DRAFT_VERSION).toBe(8);
    expect(PLANNING_DRAFT_STORAGE_KEY).toBe("nihon.manualPlanningDraft");
  });

  it("un borrador nuevo tiene exactamente los campos de V8", () => {
    expect(Object.keys(freshDraft(["a"])).sort()).toEqual(
      [
        "accommodationLegs",
        "accommodations",
        "days",
        "endDate",
        "interHubSegments",
        "routeIds",
        "startDate",
        "version",
        "visitStartTimes",
        "zoneAccommodationChoices",
      ].sort()
    );
  });

  it("B27 no toca los módulos de planificación, el hook, el dataset ni el catálogo de fotografías", () => {
    const files = changedSinceBase();
    if (files === null) return; // SHA base no disponible (clon superficial)
    const protectedPaths = [
      // B28 (B9.2) adds three V8 mutations (`withPlaceMovedToPosition`, `withPlaceAddedToDay`,
      // `withPlaceRemovedFromDay`) + their hook wrappers + the pure `stop-reorder` module; they are
      // covered by `b28-reorder-model.test.ts`. Nothing else in lib/ or the hook may change.
      /^app\/src\/lib\/(?!day-timeline-presentation|planning-draft-v8\.ts$|stop-reorder\.ts$)/,
      /^app\/src\/data\/(?!place-thumbnails\.ts$)/,
      /^data\//,
    ];
    const touched = files.filter(
      (file) => protectedPaths.some((pattern) => pattern.test(file)) && !file.endsWith(".test.ts")
    );
    expect(touched).toEqual([]);
  });

  it("el catálogo de imágenes no se toca: thumbImageUrl vive en su propio módulo", async () => {
    const catalogue = await readFile(new URL("./data/place-images.ts", import.meta.url), "utf8");
    expect(catalogue).not.toContain("thumbImageUrl");
    expect(catalogue).toContain("export const CARD_IMAGE_WIDTH = 800;");
    const thumbs = await readFile(new URL("./data/place-thumbnails.ts", import.meta.url), "utf8");
    expect(thumbs).toContain("export function thumbImageUrl(url: string): string | null {");
  });
});

describe("B27 — «Mover a…» reutiliza mutaciones que conservan la identidad estable", () => {
  it("relocatePlaceWithinDay: mismos ids de día, mismo routeIds, sólo cambia el orden del día", () => {
    const before = seeded();
    const after = withPlaceRelocatedWithinDay(before, "day-1", 0, 2);
    expect(after.days!.map((d) => d.id)).toEqual(["day-1", "day-2", "day-3"]);
    expect(after.days![0].placeIds).toEqual(["b", "c", "a"]);
    expect(after.routeIds).toEqual(before.routeIds);
    expect(after.startDate).toBe(before.startDate);
    expect(after.days![1]).toEqual(before.days![1]);
  });

  it("movePlaceBetweenDays + relocate = un destino explícito (día y posición), sin tocar otros días", () => {
    const before = seeded();
    const moved = withPlaceMovedBetweenDays(before, "day-1", "day-2", 1); // b → día 2 (al final)
    const placed = withPlaceRelocatedWithinDay(moved, "day-2", 1, 0); // b → posición 1
    expect(placed.days!.map((d) => d.id)).toEqual(["day-1", "day-2", "day-3"]);
    expect(placed.days![0].placeIds).toEqual(["a", "c"]);
    expect(placed.days![1].placeIds).toEqual(["b", "d"]);
    expect(placed.days![2]).toEqual(before.days![2]);
    expect([...placed.routeIds].sort()).toEqual([...before.routeIds].sort());
    expect(buildDayAssignment(placed.routeIds, placed.days!.map((d) => d.placeIds)).valid).toBe(true);
  });

  it("añadir un día vacío conserva todos los ids previos y crea uno nuevo y único", () => {
    const before = seeded();
    const after = withNewEmptyDay(before, () => "day-new");
    expect(after.days!.slice(0, 3)).toEqual(before.days);
    expect(after.days![3]).toMatchObject({ id: "day-new", placeIds: [] });
    expect(withoutEmptyDay(after, "day-new").days).toEqual(before.days);
  });

  it("cambiar la composición de la ruta invalida el reparto (V8) — B27 lo documenta, no lo cambia", () => {
    const before = seeded();
    expect(withRoute(before, [...before.routeIds, "z"]).days).toBeNull();
    expect(withRoute(before, before.routeIds.filter((id) => id !== "e")).days).toBeNull();
    expect(withRoute(before, before.routeIds).days).toEqual(before.days);
  });
});

describe("B27 — las reglas de presentación no inventan nada", () => {
  it("la ciudad del día es un hecho del catálogo; un día mixto lista sus hubs; uno vacío no tiene ciudad", () => {
    expect(dayCityLabel([])).toBeNull();
    expect(dayCityLabel(["Kioto"])).toBe("Kioto");
    expect(dayCityLabel(["Tokio", "Kioto"])).toBe("Tokio y Kioto");
    expect(dayCityLabel(["Tokio", "Kioto", "Osaka"])).toBe("Tokio, Kioto y Osaka");
    expect(dayHeadline(3, "mié 24 feb", "Kioto")).toBe("Día 3 · mié 24 feb · Kioto");
    expect(dayHeadline(1, null, null)).toBe("Día 1");
  });

  it("«Dormís en …» sólo nombra lo elegido; nunca se infiere de otro día", () => {
    const anchor = { id: "h", label: "Hotel A", location: { lat: 1, lng: 1 } };
    const chosen = { start: { kind: "unselected" as const }, end: { kind: "accommodation" as const, accommodationId: "h" } };
    const none = { start: { kind: "unselected" as const }, end: { kind: "unselected" as const } };
    expect(daySleepLine(chosen, null, [anchor])).toEqual({ kind: "chosen", zoneOrPlace: "Hotel A" });
    expect(daySleepLine(none, null, [anchor])).toEqual({ kind: "none" });
    expect(daySleepLine(null, null, [])).toEqual({ kind: "none" });
    expect(daySleepLine({ start: none.start, end: { kind: "no-accommodation" } }, null, [anchor])).toEqual({ kind: "none" });
  });

  it("el contador de sin asignar y los destinos de «Mover a…» son aritmética exacta", () => {
    expect(unassignedCountText(1)).toBe("1 sitio sin día");
    expect(unassignedCountText(7)).toBe("7 sitios sin día");
    expect(moveTargets([3, 1, 0], 0)).toEqual([
      { dayIndex: 0, positions: 3 },
      { dayIndex: 1, positions: 2 },
      { dayIndex: 2, positions: 1 },
    ]);
  });
});

describe("B27 — sin HTML5 drag ni semántica aria-grabbed (B9.2 arrastra con eventos de puntero)", () => {
  it("ninguna de las fuentes usa draggable, aria-grabbed ni handlers onDrag/onDrop", async () => {
    for (const file of [
      "components/DayTimeline.tsx",
      "components/TripStop.tsx",
      "components/UnassignedDrawer.tsx",
      "components/StopActionsSheet.tsx",
    ]) {
      const source = (await readFile(new URL(`./${file}`, import.meta.url), "utf8"))
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      // B28: el icono `arrastrar` del asa de reordenación ya es legítimo en TripStop/UnassignedDrawer.
      expect(source, file).not.toMatch(/draggable|aria-grabbed|onDrag|onDrop/);
    }
  });

  it("el trío ↑ ↓ × de fila no existe en TripStop", async () => {
    const source = await readFile(new URL("./components/TripStop.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/name="arriba"|name="abajo"|name="cerrar"/);
  });
});
