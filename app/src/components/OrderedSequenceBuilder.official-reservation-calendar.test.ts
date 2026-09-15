import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const SOURCE_PATH = new URL("./OrderedSequenceBuilder.tsx", import.meta.url);

async function readSource(): Promise<string> {
  return readFile(SOURCE_PATH, "utf8");
}

function extractSection(fullSource: string): string {
  const start = fullSource.indexOf("function OfficialReservationCalendarSection");
  if (start === -1) throw new Error("OfficialReservationCalendarSection not found");
  const end = fullSource.indexOf("\n/**", start + 1);
  if (end === -1) throw new Error("section end boundary not found");
  return fullSource.slice(start, end);
}

function extractOfficialDayNotice(fullSource: string): string {
  const start = fullSource.indexOf("function OfficialReservationDateNotice");
  if (start === -1) throw new Error("OfficialReservationDateNotice not found");
  const end = fullSource.indexOf("\n/**", start + 1);
  if (end === -1) throw new Error("day notice end boundary not found");
  return fullSource.slice(start, end);
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** The section's own disclaimer is mandated by the design gate to NEGATE priority/urgency, so it is
 * excluded from the claim-vocabulary scan and asserted separately (see its own test below). */
function sectionWithoutDisclaimer(section: string): string {
  const start = section.indexOf('className="official-reservation-calendar__disclaimer"');
  if (start === -1) throw new Error("disclaimer not found");
  const end = section.indexOf("</p>", start);
  if (end === -1) throw new Error("disclaimer end not found");
  return section.slice(0, start) + section.slice(end);
}

describe("OrderedSequenceBuilder.tsx — Phase 3F-J route-wide calendar wiring", () => {
  it("imports the pure aggregator and its focused presentation helper", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[\s\S]*?\bbuildRouteWideOfficialReservationCalendar\b[\s\S]*?\}\s*from\s*["']\.\.\/lib\/reservation-mechanism-calendar["']/
    );
    expect(source).toMatch(
      /import\s*\{\s*OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE\s*\}\s*from\s*["']\.\.\/lib\/reservation-mechanism-calendar-presentation["']/
    );
  });

  it("derives the calendar once from the plan plus the single captured reference date", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /const routeWideReservationCalendar = useMemo\([\s\S]*?buildRouteWideOfficialReservationCalendar\(\s*reservationMechanismEvidenceRecords,/
    );
    expect(source).toMatch(/dayAssignment,\s*startDate,\s*reservationReferenceDate\s*\)/);
    // Still exactly one device-clock capture in the whole component.
    expect((source.match(/captureDeviceLocalCivilDate\(/g) ?? []).length).toBe(1);
  });

  it("renders exactly one route-wide instance, in the days view, between the accommodation manager and the day list", async () => {
    const source = await readSource();
    const usages = source.match(/<OfficialReservationCalendarSection/g) ?? [];
    expect(usages).toHaveLength(1);
    const accommodation = source.indexOf("<AccommodationManagerSection");
    const calendar = source.indexOf("<OfficialReservationCalendarSection");
    const dayList = source.indexOf('<div className="day-list">');
    expect(accommodation).toBeGreaterThan(-1);
    expect(calendar).toBeGreaterThan(accommodation);
    expect(dayList).toBeGreaterThan(calendar);
    // It is not rendered inside a day card: the day list opens after it.
    expect(source.slice(calendar, dayList)).not.toContain("dayPlaceLists.map");
  });

  it("uses the approved heading and no rejected alternative", async () => {
    const section = extractSection(await readSource());
    expect(section).toContain("Fechas oficiales de reserva del recorrido");
    expect(section).not.toContain("Calendario oficial de reservas");
  });

  it("renders nothing when the aggregator produced no dated item", async () => {
    const section = extractSection(await readSource());
    expect(section).toMatch(/if \(calendar\.chronological\.length === 0\) return null;/);
    // No empty state, no absence message.
    for (const forbidden of ["no hay", "sin fechas", "todavía no", "aún no", "vacío"]) {
      expect(section.toLowerCase(), forbidden).not.toContain(forbidden);
    }
  });

  it("renders the chronological list in aggregator order without re-sorting", async () => {
    const section = extractSection(await readSource());
    expect(section).toContain("calendar.chronological.map((item)");
    expect(section).not.toMatch(/\.sort\s*\(/);
    expect(section).not.toMatch(/\.reverse\s*\(/);
    expect(section).not.toMatch(/\.filter\s*\(/);
  });

  it("shows anchor date, place, day, visit date, scope, fact, provenance and source link per row", async () => {
    const section = extractSection(await readSource());
    expect(section).toContain("formatCivilDateDisplay(item.anchorDate)");
    expect(section).toContain("{item.placeName}");
    expect(section).toContain("Día {item.dayNumber}");
    expect(section).toContain("formatCivilDateDisplay(item.visitDate)");
    expect(section).toContain("item.presentation.scopeLabel");
    expect(section).toContain("item.presentation.heading");
    expect(section).toContain("item.presentation.allocationText");
    expect(section).toContain("item.presentation.purchaseResidenceContextText");
    expect(section).toContain("item.presentation.provenanceText");
    expect(section).toContain("href={item.presentation.sourceUrl}");
    expect(section).toContain("Ver fuente oficial");
  });

  it("renders an application window as one span row with its anchor disclosed", async () => {
    const section = extractSection(await readSource());
    expect(section).toContain('item.fact.kind === "application-date-span"');
    expect(section).toContain("{item.fact.spanText}");
    expect(section).toContain("OFFICIAL_RESERVATION_CALENDAR_SPAN_ANCHOR_NOTE");
    // No second row is synthesised for the close edge.
    expect(section).not.toContain("item.fact.closeDate");
  });

  it("discloses the one reference date at section level only when a relation exists", async () => {
    const section = extractSection(await readSource());
    expect(section).toContain("calendar.referenceDate");
    expect(section).toContain("item.relation !== null");
    expect(section).toContain("referenceDateText");
    expect(section).toContain("Esta misma fecha de referencia se usa en todas las relaciones de esta");
    // Never a bare currentness label.
    for (const forbidden of [">hoy<", ">ahora<", ">actualmente<"]) {
      expect(section, forbidden).not.toContain(forbidden);
    }
    // No collapsible affordance around it.
    expect(section).not.toContain("<details");
    expect(section).not.toContain("<summary");
  });

  it("renders residence context after allocation and before the temporal relation/provenance", async () => {
    const section = extractSection(await readSource());
    const allocation = section.indexOf("item.presentation.allocationText");
    const residenceContext = section.indexOf("item.presentation.purchaseResidenceContextText");
    const relation = section.indexOf("item.relation.relationText");
    const provenance = section.indexOf("item.presentation.provenanceText");
    const source = section.indexOf("href={item.presentation.sourceUrl}");
    expect(allocation).toBeGreaterThan(-1);
    expect(residenceContext).toBeGreaterThan(allocation);
    expect(relation).toBeGreaterThan(residenceContext);
    expect(provenance).toBeGreaterThan(relation);
    expect(source).toBeGreaterThan(provenance);
    expect(section).toContain("official-reservation-calendar__purchase-residence-context");
  });

  it("renders a relation only when the aggregator composed one, with no placeholder", async () => {
    const section = extractSection(await readSource());
    expect(section).toMatch(/\{item\.relation && \(/);
    expect(section).toContain("item.relation.relationText");
    expect(section).not.toContain("—</p>");
    expect(section).not.toContain("Sin relación");
    expect(section).not.toContain("desconocid");
  });

  it("is read-only: no control, no task affordance, no completion state", async () => {
    const section = extractSection(await readSource());
    expect(section).not.toMatch(/<button/);
    expect(section).not.toMatch(/<input/);
    expect(section).not.toMatch(/onClick=/);
    expect(section).not.toMatch(/onChange=/);
    expect(section).not.toMatch(/type="checkbox"/);
    expect(section).not.toMatch(/role=["']dialog["']/);
    expect(section).not.toMatch(/aria-modal/);
    const source = await readSource();
    expect((source.match(/role="dialog"/g) ?? []).length).toBe(1);
  });

  it("keeps one neutral class family and no state-encoding styling", async () => {
    const section = extractSection(await readSource());
    const classNames = [...section.matchAll(/className="([^"]+)"/g)].map((match) => match[1]);
    for (const name of classNames) {
      expect(name.startsWith("official-reservation-calendar")).toBe(true);
    }
    for (const forbidden of ["--urgent", "--warning", "--danger", "--success", "--late", "--soon", "--past"]) {
      expect(section, forbidden).not.toContain(forbidden);
    }
    // Styling never depends on the relation or the date.
    expect(section).not.toMatch(/className=\{[^}]*item\.relation/);
    expect(section).not.toMatch(/className=\{[^}]*anchorDate/);
  });

  it("carries the mandated disclaimer, including the order-is-not-priority negation", async () => {
    const section = extractSection(await readSource());
    expect(section).toContain("provienen del registro oficial de cada lugar");
    expect(section).toContain("calculadas sobre la fecha de");
    expect(section).toContain("visita planificada");
    expect(section).toContain("El orden cronológico solo ordena fechas de calendario: no indica prioridad");
    expect(section).toContain("ni en");
    expect(section).toContain("conviene reservar");
    expect(section).toContain("No indica disponibilidad ni el estado actual de la venta");
    expect(section).toContain("compara únicamente fechas de calendario");
    expect(section).toContain("no considera la hora");
    expect(section).toContain("registrada ni la zona horaria de la fuente");
    expect(section).toContain("Nihon no combina ambas fuentes");
  });

  it("uses no priority, urgency, availability or booking-state vocabulary outside the disclaimer", async () => {
    const section = sectionWithoutDisclaimer(withoutComments(extractSection(await readSource()))).toLowerCase();
    for (const forbidden of [
      "próxima reserva",
      "siguiente",
      "primero",
      "prioridad",
      "prioritario",
      "importante",
      "urgente",
      "pendiente",
      "por hacer",
      "completado",
      "te falta",
      "quedan",
      "faltan",
      "días restantes",
      "horas restantes",
      "fecha límite",
      "deadline",
      "última oportunidad",
      "abierta",
      "cerrada",
      "disponible",
      "agotado",
      "boletos",
      "reserva ahora",
      "no olvides",
      "recuerda",
      "alerta",
      "ya puedes",
      "todavía puedes",
      "estás a tiempo",
      "se te pasó",
    ]) {
      expect(section, forbidden).not.toContain(forbidden);
    }
  });

  it("reads no Phase 3D reservation value and no forbidden plan input", async () => {
    const section = withoutComments(extractSection(await readSource()));
    for (const forbidden of [
      "reservationPreparation",
      "ReservationPreparationSection",
      "leadTime",
      "reservation.required",
      "evaluateReservationWindowReference",
      "derivePlaceReservationDateWindow",
      "febMar2027",
      "visitStartTimes",
      "endDate",
      "accommodations",
      "schedule.hours",
      "schedule.closures",
    ]) {
      expect(section, forbidden).not.toContain(forbidden);
    }
  });

  it("keeps the Phase 3D route-wide surface in the builder view and the calendar in the days view", async () => {
    const source = await readSource();
    // `{view === "days" && (` also guards a small back-link earlier in the dialog, so the view
    // BLOCKS are located by their last occurrence, which is the branch that renders the view body.
    const builderView = source.lastIndexOf('{view === "builder" && (');
    const daysView = source.lastIndexOf('{view === "days" && (');
    const prep = source.indexOf("<ReservationPreparationSection");
    const calendar = source.indexOf("<OfficialReservationCalendarSection");
    expect(builderView).toBeGreaterThan(-1);
    expect(daysView).toBeGreaterThan(builderView);
    // Phase 3D's route-wide list renders inside the builder body, before the days body begins.
    expect(prep).toBeGreaterThan(builderView);
    expect(prep).toBeLessThan(daysView);
    // Phase 3F-J's calendar renders inside the days body only.
    expect(calendar).toBeGreaterThan(daysView);
    // The two surfaces never share a container: neither appears inside the other's subtree.
    const daysBody = source.slice(daysView);
    expect(daysBody).not.toContain("<ReservationPreparationSection");
    const builderBody = source.slice(builderView, daysView);
    expect(builderBody).not.toContain("<OfficialReservationCalendarSection");
  });

  it("keeps the per-day Phase 3F-F/3F-H notice separate while carrying its own residence context", async () => {
    const notice = extractOfficialDayNotice(await readSource());
    expect(notice).toContain("buildOfficialReservationDatePresentation(record, derivation)");
    expect(notice).toContain("evaluateOfficialReservationReferenceDate(derivation, referenceDate)");
    expect(notice).toContain("official-reservation-date__reference-relation");
    expect(notice).toContain("official-reservation-date__reference-date");
    expect(notice).toContain("official-reservation-date__purchase-residence-context");
    expect(notice).not.toContain("OfficialReservationCalendarSection");
    expect(notice).not.toContain("routeWideReservationCalendar");
    expect(notice).not.toContain("anchorDate");
  });

  it("recomputes from plan state and persists nothing", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /\[dayPlaceLists, dayEntities, dayAssignment, startDate, reservationReferenceDate\]/
    );
    const section = extractSection(source);
    expect(section).not.toContain("localStorage");
    expect(section).not.toContain("sessionStorage");
    expect(section).not.toContain("useState");
    expect(section).not.toContain("useEffect");
    expect(source).not.toContain("ManualPlanningDraftV8");
    expect(source).not.toContain("routeWideReservationCalendar:");
  });

  it("adds no timer, listener, worker or background refresh", async () => {
    const source = withoutComments(await readSource());
    for (const forbidden of [
      "setInterval(",
      "setTimeout(",
      "requestAnimationFrame(",
      "visibilitychange",
      "serviceWorker",
      'addEventListener("focus"',
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});
