/**
 * Bloque 18 — los cuatro destinos permanentes de `02 §D2` (DD-001).
 *
 * Un destino, no un historial: cambiar entre ellos nunca descarta el estado interno de los
 * demás (`02 §D3`). El orden de esta unión es el orden visible en `TabBar`/`NavRail` y no se
 * reordena en ningún sitio.
 */
export type Destination = "explorar" | "quiero-ir" | "viaje" | "nosotros";

export const DESTINATIONS: readonly Destination[] = ["explorar", "quiero-ir", "viaje", "nosotros"];

export function destinationLabel(destination: Destination): string {
  switch (destination) {
    case "explorar":
      return "Explorar";
    case "quiero-ir":
      return "Quiero ir";
    case "viaje":
      return "Viaje";
    case "nosotros":
      return "Nosotros";
  }
}
