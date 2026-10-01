import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TripSummaryCards } from "./components/TripSummaryCards";
import { TripTimelineBand } from "./components/TripTimelineBand";
import { SUMMARY_CARD_TARGETS, timelineDayText, type TripTimelineDay } from "./components/viajeResumenModel";
import type { Place } from "./types";
import { buildWholeTripComposition } from "./lib/whole-trip-composition";

/**
 * B31 (B9.5) — «Reservas y Resumen» (`docs/design/05 §9–10`, `10 §B9.5`, DDR-B31-01…07). Contrato de
 * presentación: escaneo de fuente + render estático de los componentes puros. El comportamiento real
 * (orden en pantalla, foco, historial, storage) lo mide `scripts/b31-reservas-resumen-check.mjs`.
 */

const read = (rel: string) => readFile(new URL(rel, import.meta.url), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const SRC_DIR = fileURLToPath(new URL(".", import.meta.url));
async function sourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await sourceFiles(full)));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function between(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  if (start === -1) throw new Error(`missing ${from}`);
  const end = source.indexOf(to, start + from.length);
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

const FORBIDDEN_LEXICON = /urgent|prioridad|prioritari|primero|importante|recomendad|mejor\b/i;

describe("B31 — «Dato:» retirado (DDR-05, 03 §10)", () => {
  it("la cadena «Dato:» no aparece en ningún código de app/src", async () => {
    const offenders: string[] = [];
    for (const file of await sourceFiles(SRC_DIR)) {
      if ((await readFile(file, "utf8")).includes("Dato:")) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("las cuatro sustituciones: texto íntegro entre comillas + marcador registrado", async () => {
    const code = strip(await read("./components/OrderedSequenceBuilder.tsx"));
    for (const raw of ["hours.raw", "window.signal.raw", "item.leadTime.raw", "item.hours.raw"]) {
      expect(code, raw).toContain(`«{${raw}}» <EvidenceMark level="registrado" />`);
    }
    for (const cls of [
      "recorded-interval-fit__raw",
      "reservation-deadline__raw",
      "reservation-prep__raw",
      "hours-planning__raw",
    ]) {
      expect(code, cls).toContain(`className="${cls}"`);
    }
  });
});

describe("B31 — Reservas: dos listas separadas (DDR-B31-01/02/03)", () => {
  it("cada lista es su propio componente con su propio h3, y llevan su marcador de evidencia", async () => {
    const code = await read("./components/OrderedSequenceBuilder.tsx");
    const official = between(code, "function OfficialReservationCalendarSection", "\n}\n");
    const prep = between(code, "function ReservationPreparationSection", "\n}\n");
    const hours = between(code, "function HoursPlanningSection", "\n}\n");
    expect(official).toContain(">Fechas oficiales</h3>");
    expect(prep).toContain(">Reservas por preparar</h3>");
    expect(hours).toContain(">Horarios registrados</h3>");
    // Oficial ◼ Verificado; editorial ◧ Registrado — nunca mezclados en una misma lista.
    expect(official).toContain('level="verificado"');
    expect(official).not.toContain('level="registrado"');
    expect(prep).toContain('level="registrado"');
    expect(prep).not.toContain('level="verificado"');
    expect(hours).toContain('level="registrado"');
    expect(hours).not.toContain('level="verificado"');
  });

  it("el orden es el de lib: la vista no reordena ninguna de las listas", async () => {
    const code = strip(await read("./components/OrderedSequenceBuilder.tsx"));
    for (const name of [
      "OfficialReservationCalendarSection",
      "ReservationPreparationSection",
      "HoursPlanningSection",
    ]) {
      const body = between(code, `function ${name}`, "\n}\n");
      expect(body, name).not.toMatch(/\.sort\(|\.toSorted\(|\.reverse\(|\.toReversed\(/);
    }
    expect(between(code, "function OfficialReservationCalendarSection", "\n}\n")).toContain(
      "calendar.chronological.map("
    );
    expect(between(code, "function ReservationPreparationSection", "\n}\n")).toContain("summary.items.map(");
  });

  it("la superficie las pinta en orden oficial → preparación → horarios, y sin segundo calendario", async () => {
    const code = await read("./components/OrderedSequenceBuilder.tsx");
    const surface = between(code, '{section === "reservas" && (', '{section === "resumen" && (');
    const a = surface.indexOf("<OfficialReservationCalendarSection");
    const b = surface.indexOf("<ReservationPreparationSection");
    const c = surface.indexOf("<HoursPlanningSection");
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(code.match(/<OfficialReservationCalendarSection/g)).toHaveLength(1);
  });

  it("el enlace oficial nombra el lugar, con rel=noreferrer y el target existente", async () => {
    const code = await read("./components/OrderedSequenceBuilder.tsx");
    const official = between(code, "function OfficialReservationCalendarSection", "\n}\n");
    expect(official).toContain("aria-label={`Ver fuente oficial de ${item.placeName}`}");
    expect(official).toContain('target="_blank"');
    expect(official).toContain('rel="noreferrer"');
  });

  it("los nombres de lugar de Reservas no son enlaces a ficha (DDR-B31-07)", async () => {
    const code = await read("./components/OrderedSequenceBuilder.tsx");
    const surfaces = [
      between(code, "function OfficialReservationCalendarSection", "\n}\n"),
      between(code, "function ReservationPreparationSection", "\n}\n"),
      between(code, "function HoursPlanningSection", "\n}\n"),
    ].join("\n");
    expect(surfaces).not.toMatch(/onSelectPlace|<button/);
  });

  it("ningún léxico de urgencia/prioridad en las superficies nuevas de Reservas (DDR-B31-01)", async () => {
    const code = strip(await read("./components/OrderedSequenceBuilder.tsx"));
    // La negación «no indica prioridad, urgencia…» es un descargo que ya existía y que DDR-B31-04
    // conserva en el detail del marcador; es la única frase exenta, por su constante.
    const reservas = [
      between(code, "const RESERVAS_NOTE", ";\n"),
      between(code, "const RESERVATION_PREP_MARK_DETAIL", ";\n"),
      between(code, "const HOURS_PLANNING_MARK_DETAIL", ";\n"),
      between(code, "function OfficialReservationCalendarSection", "\n}\n"),
      between(code, "function ReservationPreparationSection", "\n}\n").replace(/RESERVATION_PREP_LABEL\[[^\]]+\]/g, ""),
      between(code, "function HoursPlanningSection", "\n}\n"),
    ].join("\n");
    expect(reservas).not.toMatch(FORBIDDEN_LEXICON);
  });
});

describe("B31 — una sola nota de encuadre por superficie (Art. 3, DDR-B31-04)", () => {
  it("Reservas y Resumen pintan exactamente una nota, y los tres descargos en prosa desaparecen", async () => {
    const code = await read("./components/OrderedSequenceBuilder.tsx");
    const reservas = between(code, '{section === "reservas" && (', '{section === "resumen" && (');
    const resumen = between(code, '{section === "resumen" && (', '{section === "dias" && (');
    expect(reservas.match(/viaje-surface__note/g)).toHaveLength(1);
    expect(resumen.match(/viaje-surface__note/g)).toHaveLength(1);
    for (const gone of [
      "official-reservation-calendar__disclaimer",
      "reservation-prep__disclaimer",
      "hours-planning__disclaimer",
      "whole-trip-composition__intro",
    ]) {
      expect(code, gone).not.toContain(gone);
    }
  });

  it("el detalle que vivía en cada descargo viaja en el detail de su marcador", async () => {
    const code = await read("./components/OrderedSequenceBuilder.tsx");
    expect(code).toContain("detail={OFFICIAL_CALENDAR_MARK_DETAIL}");
    expect(code).toContain("detail={RESERVATION_PREP_MARK_DETAIL}");
    expect(code).toContain("detail={HOURS_PLANNING_MARK_DETAIL}");
    expect(code).toMatch(/const RESERVAS_NOTE =\s*"La información oficial se muestra por separado/);
  });

  it("los descargos de las tarjetas de día en Días no se tocan", async () => {
    const code = await read("./components/OrderedSequenceBuilder.tsx");
    for (const kept of [
      "recorded-interval-fit__disclaimer",
      "reservation-deadline__disclaimer",
      "official-reservation-date__disclaimer",
    ]) {
      expect(code, kept).toContain(kept);
    }
  });
});

// Dos lugares mínimos en un día: lo justo para una composición «available» sin tocar el dataset.
const fixturePlace = (id: string, hub: string) =>
  ({ id, hub, name: id, duration: { raw: "60 min", minMinutes: 60, maxMinutes: 60 } }) as unknown as Place;
const fixturePlaces = new Map([fixturePlace("a", "Tokio"), fixturePlace("b", "Tokio")].map((p) => [p.id, p]));
const emptyComposition = buildWholeTripComposition(
  {
    routeIds: ["a", "b"],
    days: [{ placeIds: ["a", "b"], accommodationBoundary: { start: { kind: "unselected" }, end: { kind: "unselected" } } }],
    interHubSegments: [],
    accommodationLegs: [],
    bounds: { startDate: null, endDate: null },
  },
  { resolvePlace: (id) => fixturePlaces.get(id) ?? null, lookupTransfer: () => null }
);

describe("B31 — Resumen: cuatro tarjetas y destinos (DDR-B31-07)", () => {
  it("el mapeo de destinos es Visitas→Días · Traslados→Días · Alojamiento→Dónde dormir · Rango→Días", () => {
    expect(SUMMARY_CARD_TARGETS.visitas.target).toBe("dias");
    expect(SUMMARY_CARD_TARGETS.traslados.target).toBe("dias");
    expect(SUMMARY_CARD_TARGETS.alojamiento.target).toBe("dormir");
    expect(SUMMARY_CARD_TARGETS.rango.target).toBe("dias");
  });

  it("renderiza cuatro tarjetas h3, cada una con su marcador ◇ y un <button> de navegación", () => {
    expect(emptyComposition.kind).toBe("available");
    const html = renderToStaticMarkup(createElement(TripSummaryCards, { composition: emptyComposition, onNavigate: () => {} }));
    expect(html.match(/<h3>/g)).toHaveLength(4);
    for (const title of ["Visitas", "Traslados registrados", "Alojamiento", "Rango del viaje"]) {
      expect(html).toContain(`<h3>${title}</h3>`);
    }
    expect(html.match(/◇/g)).toHaveLength(4);
    expect(html.match(/<button type="button"/g)).toHaveLength(4);
    for (const { label, target } of Object.values(SUMMARY_CARD_TARGETS)) {
      expect(html).toContain(`>${label}</button>`);
      expect(html).toContain(`data-summary-target="${target}"`);
    }
    // Navegación, no acción: sin flecha final (03 §10).
    expect(html).not.toMatch(/→\s*<\/button>/);
    expect(html).not.toMatch(/tramo/i);
    expect(html).not.toContain("Dato:");
  });

  it("estado «unavailable»: una sola tarjeta con el texto existente, sin banda ni enlaces", () => {
    const html = renderToStaticMarkup(
      createElement(TripSummaryCards, {
        composition: { kind: "unavailable", reason: "no-day-assignment" },
        onNavigate: () => {},
      })
    );
    expect(html).toContain("Crea un reparto por días para describir el plan completo sin borrar sus límites.");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<h3");
  });

  it("el control sólo navega: sin storage ni estado en los componentes nuevos", async () => {
    for (const file of ["TripSummaryCards.tsx", "TripTimelineBand.tsx", "viajeResumenModel.ts", "viajeSurfaceFocus.ts"]) {
      const code = strip(await read(`./components/${file}`));
      expect(code, file).not.toMatch(/localStorage|sessionStorage|setItem|useState|useEffect|history\.(push|replace)State/);
    }
    const app = await read("./App.tsx");
    expect(app).toContain("onNavigateSection={setViajeSectionTracked}");
  });

  it("el foco va al h2 de la superficie de destino", async () => {
    const code = await read("./components/viajeSurfaceFocus.ts");
    expect(code).toContain('\'[data-viaje-surface="dias"] h2\'');
    expect(code).toContain('"#zone-panel-title"');
    expect(code).toContain('setAttribute("tabindex", "-1")');
  });

  it("léxico de Resumen: «traslado», sin «tramo(s)» ni «posiciones de movimiento modeladas»; sin ranking", async () => {
    for (const file of ["TripSummaryCards.tsx", "TripTimelineBand.tsx", "viajeResumenModel.ts"]) {
      const code = strip(await read(`./components/${file}`));
      expect(code, file).not.toMatch(/tramo|posiciones de movimiento|modelad/i);
      expect(code, file).not.toMatch(FORBIDDEN_LEXICON);
    }
    // Art. 7: «cobertura» (vocabulario de repositorio) fuera de las tarjetas nuevas.
    expect(strip(await read("./components/TripSummaryCards.tsx"))).not.toMatch(/cobertura/i);
  });
});

describe("B31 — banda de línea de tiempo comprimida (DDR-B31-05)", () => {
  const days: TripTimelineDay[] = [
    { ordinal: 1, cityLabel: "Tokio", isEmpty: false },
    { ordinal: 2, cityLabel: "Tokio y Kioto", isEmpty: false },
    { ordinal: 3, cityLabel: null, isEmpty: true },
  ];
  const html = renderToStaticMarkup(createElement(TripTimelineBand, { days }));

  it("un segmento por día, de ancho igual y neutro: sin estilo inline ni color por ciudad", () => {
    expect(html.match(/trip-timeline__segment/g)).toHaveLength(3);
    expect(html).not.toMatch(/style=|color|background/i);
  });

  it("cada día se dice también por texto: alternativa «Día N · ciudad», multiciudad y día vacío", () => {
    expect(html).toContain("<li>Día 1 · Tokio</li>");
    expect(html).toContain("<li>Día 2 · Tokio y Kioto</li>");
    expect(html).toContain("<li>Día 3 · sin lugares</li>");
    expect(timelineDayText({ ordinal: 4, cityLabel: null, isEmpty: false })).toBe("Día 4");
    expect(html).toContain('class="visually-hidden"');
  });

  it("la banda es una imagen con nombre, no interactiva y sin tabstops; marcador ◇ de derivada", () => {
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Línea de tiempo del viaje: 3 días"');
    expect(html).not.toMatch(/<button|<a |tabindex|onclick/i);
    expect(html).toContain("◇");
    expect(renderToStaticMarkup(createElement(TripTimelineBand, { days: [] }))).toBe("");
  });

  it("el CSS de la banda usa sólo tokens existentes y ningún token de color por ciudad ni animación", async () => {
    const css = await readFile(new URL("./App.css", import.meta.url), "utf8");
    const block = css.slice(css.indexOf("B31 (B9.5) — Viaje › Reservas y Resumen"));
    expect(block).not.toMatch(/--city|--hub|--color-city/);
    expect(block).not.toMatch(/animation|transition|@keyframes/);
    expect(block).toContain("grid-auto-columns: minmax(0, 1fr)");
    // Tarjetas: columnas por ancho de contenedor (DD-016), mínimo 264 px, sin @media nuevo.
    expect(block).toContain("minmax(min(264px, 100%), 1fr)");
    expect(block).not.toMatch(/@media/);
  });
});
