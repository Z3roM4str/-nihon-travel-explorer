import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";
import { getAllPlaces } from "../data/store";
import { buildDayAssignment } from "../lib/day-assignment";
import { buildTripReservationRows } from "../lib/trip-reservation-presentation";
import { buildWholeTripComposition } from "../lib/whole-trip-composition";
import { reservationMechanismEvidenceRecords } from "../lib/reservation-mechanism-evidence";
import { TripReservations } from "./TripReservations";
import { TripTimeline } from "./TripTimeline";
import { WholeTripCompositionSection } from "./OrderedSequenceBuilder";

const all = getAllPlaces();
const byId = new Map(all.map((place) => [place.id, place]));
const ghibli = byId.get("JP-044")!;
const disney = byId.get("JP-203")!;
const kyoto = all.find((place) => place.hub === "Kioto")!;
const boundary = { start: { kind: "unselected" as const }, end: { kind: "unselected" as const } };
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("B31 reservation presentation, separate from unchanged domain calculations", () => {
  it("removes renderable Dato literals throughout production source, ignoring tests and comments", () => {
    const root = new URL("../", import.meta.url);
    const violations: string[] = [];
    for (const path of readdirSync(root, { recursive: true }) as string[]) {
      if (!/\.tsx?$/.test(path) || /\.test\./.test(path)) continue;
      const source = ts.createSourceFile(path, readFileSync(new URL(path.replaceAll("\\", "/"), root), "utf8"), ts.ScriptTarget.Latest, true, path.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (node: ts.Node) => {
        if ((ts.isJsxText(node) || ts.isStringLiteralLike(node)) && node.text.includes("Dato:")) violations.push(path);
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(violations).toEqual([]);
  });
  it("orders official derived dates ahead of route position and preserves input identity/order", () => {
    const places = [ghibli, disney];
    const ids = places.map((place) => place.id);
    const assignment = buildDayAssignment(ids, [ids]);
    const snapshot = JSON.stringify({ places, assignment });
    const rows = buildTripReservationRows(places, assignment, "2027-02-22");
    expect(rows.map((row) => row.place.id)).toEqual([disney.id, ghibli.id]);
    expect(rows.map((row) => row.urgencyDate)).toEqual(["2026-12-22", "2027-01-10"]);
    expect(rows.every((row) => row.urgencyLabel === "Apertura de venta")).toBe(true);
    expect(JSON.stringify({ places, assignment })).toBe(snapshot);
  });
  it("preserves literal lead time, official mechanism evidence, source URL and date result", () => {
    const assignment = buildDayAssignment([ghibli.id], [[ghibli.id]]);
    const row = buildTripReservationRows([ghibli], assignment, "2027-02-22")[0];
    expect(row.prep?.leadTime.raw).toBe(ghibli.reservation.leadTime);
    expect(row.records[0]).toEqual(reservationMechanismEvidenceRecords.find((record) => record.placeId === ghibli.id));
    expect(row.official[0]).toMatchObject({ kind: "release-date", releaseDate: "2027-01-10", releaseTimeLocal: "10:00", sourceTimeZone: "Asia/Tokyo" });
    const rendered = html(createElement(TripReservations, { rows: [row], renderDetails: () => null, calendar: null }));
    expect(rendered).toContain("Registrado");
    expect(rendered).toContain("Estimado");
    expect(rendered).toContain(`«${ghibli.reservation.leadTime}»`);
    expect(rendered).toContain(row.records[0].provenance.evidence);
    expect(rendered).toContain(row.records[0].provenance.sourceUrl);
    expect(rendered).not.toContain("Dato:");
  });
  it("retains mechanisms without inventing a date when the plan is not dated", () => {
    const rows = buildTripReservationRows([ghibli], buildDayAssignment([ghibli.id], [[ghibli.id]]), null);
    expect(rows[0].urgencyDate).toBeNull();
    expect(rows[0].records.length).toBeGreaterThan(0);
    expect(html(createElement(TripReservations, { rows, renderDetails: () => null, calendar: null }))).toContain("Sin fecha límite derivable");
  });
  it("sorts ties independently of route order", () => {
    const ids = [ghibli.id, disney.id];
    const assignment = buildDayAssignment(ids, [ids]);
    expect(buildTripReservationRows([ghibli, disney], assignment, null).map((row) => row.place.id))
      .toEqual(buildTripReservationRows([disney, ghibli], assignment, null).map((row) => row.place.id));
  });
  it("uses the actual official application close date, never its opening as a deadline", () => {
    const guided = byId.get("JP-077")!;
    const row = buildTripReservationRows([guided], buildDayAssignment([guided.id], [[guided.id]]), "2027-02-22")[0];
    const fact = row.official.find((item) => item.kind === "application-window")!;
    expect(fact.kind).toBe("application-window");
    if (fact.kind !== "application-window") throw new Error("Missing official fixture");
    expect(row.urgencyDate).toBe(fact.closeDate);
    expect(row.urgencyDate).not.toBe(fact.openDate);
    expect(row.urgencyLabel).toBe("Cierre de solicitudes");
  });
  it("keeps editorial anticipation a reference distinct from an official deadline", () => {
    const editorial = { ...ghibli, id: "b31-editorial-only", reservation: { required: true, raw: "Sí", leadTime: "2–4 semanas" } };
    const row = buildTripReservationRows([editorial], buildDayAssignment([editorial.id], [[editorial.id]]), "2027-02-22")[0];
    expect(row.window).toMatchObject({ kind: "derived-window", farAdvanceDate: "2027-01-25", nearAdvanceDate: "2027-02-08" });
    expect(row.urgencyDate).toBe("2027-02-08");
    expect(row.urgencyLabel).toBe("Referencia de anticipación");
    expect(row.records).toHaveLength(0);
  });
  it("shows an honest empty list", () => {
    const rendered = html(createElement(TripReservations, { rows: [], renderDetails: () => null, calendar: null }));
    expect(rendered).toContain("No hay reservas por preparar");
    expect(rendered).not.toContain("data-urgency-date");
  });
  it("keeps February/March source text verbatim", () => {
    const rows = buildTripReservationRows([ghibli], buildDayAssignment([ghibli.id], [[ghibli.id]]), null);
    const rendered = html(createElement(TripReservations, { rows, renderDetails: () => null, calendar: null }));
    for (const text of Object.values(ghibli.febMar2027).filter(Boolean)) expect(rendered).toContain(text.replaceAll("&", "&amp;"));
  });
});

describe("B31 summary and timeline from the actual composition/day buckets", () => {
  const ids = [ghibli.id, kyoto.id];
  const days = [{ id: "real-tokyo", placeIds: [ghibli.id], accommodationBoundary: boundary }, { id: "real-empty", placeIds: [], accommodationBoundary: boundary }, { id: "real-kyoto", placeIds: [kyoto.id], accommodationBoundary: boundary }];
  const composition = buildWholeTripComposition({ routeIds: ids, days, accommodationLegs: [], interHubSegments: [], bounds: { startDate: "2027-02-22", endDate: "2027-03-05" } }, { resolvePlace: (id) => byId.get(id) ?? null });
  it("renders exactly four cards and the real composition counts, without fake lodging minutes", () => {
    const rendered = html(createElement(WholeTripCompositionSection, { composition }));
    expect(rendered.match(/class="whole-trip-composition__group"/g)).toHaveLength(4);
    for (const title of ["Visitas", "Traslados registrados", "Alojamiento", "Rango del viaje"]) expect(rendered).toContain(`<h4>${title}</h4>`);
    expect(rendered).toContain("Días creados: 3");
    expect(rendered).toContain("Minutos manuales registrados: ninguno");
    expect(rendered).toContain("Ver Dónde dormir");
    expect(rendered).toContain("Ver fechas en Días");
  });
  it("keeps four honest unavailable cards and performs no partial arithmetic", () => {
    const rendered = html(createElement(WholeTripCompositionSection, { composition: { kind: "unavailable", reason: "no-day-assignment" } }));
    expect(rendered.match(/class="whole-trip-composition__group"/g)).toHaveLength(4);
    expect(rendered).toContain("Sin datos para describir el plan completo");
    expect(rendered).not.toContain("0 min");
  });
  it("renders exactly the stable real days, dates, cities, places and empty day", () => {
    const rendered = html(createElement(TripTimeline, { days, placeById: byId, startDate: "2027-02-22" }));
    expect(rendered.match(/data-day-id=/g)).toHaveLength(3);
    for (const day of days) expect(rendered).toContain(day.id);
    expect(rendered).toContain("Tokio"); expect(rendered).toContain("Kioto");
    expect(rendered).toContain("Sin ciudad asignada"); expect(rendered).toContain("Día vacío");
    expect(rendered).toContain('dateTime="2027-02-24"'.replace("dateTime", "dateTime"));
    expect(rendered).toContain("Línea de tiempo del viaje por días");
  });
  it("does not infer a calendar, city, hotel or day from an empty state", () => {
    const rendered = html(createElement(TripTimeline, { days: [], placeById: byId, startDate: null }));
    expect(rendered).toContain("Sin días creados");
    expect(rendered).not.toMatch(/<time|data-day-id|Tokio|Kioto|hotel/i);
  });
  it("retains all cities when the actual day contains more than one hub", () => {
    const rendered = html(createElement(TripTimeline, { days: [{ id: "mixed-real", placeIds: ids }], placeById: byId, startDate: null }));
    expect(rendered).toContain("Tokio / Kioto"); expect(rendered).not.toContain("<time");
  });
});
