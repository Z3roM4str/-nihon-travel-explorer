/**
 * P-06·A — la línea de alojamiento de la tarjeta de día (tres estados, copy cerrado).
 *
 * Una lectura pura del borrador: nunca escribe nada y nunca inventa un alojamiento. La
 * configuración real (anclas, tramos, minutos) pertenece a Viaje › Dónde dormir.
 *
 *  - alojamiento concreto elegido para esa noche → «Dormís en {alojamiento}»
 *  - sólo existe la zona (la ancla sembrada por la zona, o la zona elegida para la ciudad de la
 *    última parada) → «Zona para dormir: {zona}» — nunca «Dormís en la zona X»
 *  - nada → «Elegir zona para dormir»
 */
export type DaySleepLine =
  | { kind: "accommodation"; label: string; text: string }
  | { kind: "zone"; label: string; text: string }
  | { kind: "none"; label: null; text: string };

export type DaySleepLineInput = {
  /** La elección de la noche (el lado `end` del día): sólo cuenta si es un alojamiento. */
  endAccommodationId: string | null;
  /** Ciudad de la última parada: es donde se duerme tras el día. `null` si el día está vacío. */
  lastPlaceHub: string | null;
  accommodations: readonly { id: string; label: string }[];
  zoneChoices: readonly { hub: string; accommodationId: string }[];
};

export function describeDaySleepLine(input: DaySleepLineInput): DaySleepLine {
  const labelOf = (id: string) => input.accommodations.find((anchor) => anchor.id === id)?.label ?? null;
  const isZoneAnchor = (id: string) => input.zoneChoices.some((choice) => choice.accommodationId === id);

  if (input.endAccommodationId) {
    const label = labelOf(input.endAccommodationId);
    if (label) {
      return isZoneAnchor(input.endAccommodationId)
        ? { kind: "zone", label, text: `Zona para dormir: ${label}` }
        : { kind: "accommodation", label, text: `Dormís en ${label}` };
    }
  }
  const choice = input.lastPlaceHub
    ? input.zoneChoices.find((entry) => entry.hub === input.lastPlaceHub)
    : undefined;
  const zoneLabel = choice ? labelOf(choice.accommodationId) : null;
  if (zoneLabel) return { kind: "zone", label: zoneLabel, text: `Zona para dormir: ${zoneLabel}` };
  return { kind: "none", label: null, text: "Elegir zona para dormir" };
}
