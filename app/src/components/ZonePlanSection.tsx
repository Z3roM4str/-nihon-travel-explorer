import { PROXIMITY_BANDS, type ProximityBand } from "../lib/accommodation-zone";
import { Icon } from "../icons/Icon";
import type {
  ZoneBoundarySideUse,
  ZoneDayLink,
  ZoneHubLink,
} from "../lib/zone-plan-link";
import type { ZoneAccommodationChoice } from "../lib/zone-accommodation-choice";

/**
 * Block 4 — what a chosen accommodation zone actually does to the plan, stated without inventing
 * anything.
 *
 * This section exists because a zone decision that stayed on the comparison screen would be
 * decoration. It answers the question the reader actually has once they have chosen — *"we decided
 * to sleep here; what does that mean for our days?"* — using only three kinds of statement, kept
 * apart exactly as Block 3 separated them:
 *
 * | shown | kind | where it comes from |
 * |---|---|---|
 * | which days are in this hub | **fact** | `Place.hub` in the catalogue |
 * | which boundary each day is planned from | **fact** | the reader's own choices in the draft |
 * | how far each day's places are from the zone's station | **derived** | straight-line geometry |
 *
 * There is deliberately no fourth row. No travel time is produced, estimated or implied — this
 * repository has no runtime routing and no recorded transfer edge starts at an accommodation, so a
 * minute figure here would be an invention. Straight-line distance is reported in the same coarse
 * bands `accommodation-zone.ts` already uses and is labelled *calculado* and *línea recta* wherever
 * it appears. The reader still types every manual duration in the per-day section below.
 *
 * Nothing here ranks, scores or recommends. A zone does not make a day better, and a day planned
 * from a different anchor is reported as a neutral fact rather than a warning — a reader who chose
 * a zone AND keeps a hand-made anchor for some days has done nothing wrong, and this section's job
 * is to make that legible, never to "fix" it by rebinding a boundary the reader chose.
 */
function formatZoneKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** One boundary side, in the reader's terms. Every branch is a statement about what THEY chose. */
function zoneBoundarySideText(side: ZoneBoundarySideUse, anchorLabelById: ReadonlyMap<string, string>): string {
  switch (side.kind) {
    case "empty-day":
      return "día vacío";
    case "unselected":
      return "sin seleccionar";
    case "no-accommodation":
      return "no aplica";
    case "zone-anchor":
      return "desde esta zona";
    case "other-anchor": {
      const label = anchorLabelById.get(side.accommodationId) ?? "otro alojamiento";
      return side.seededByZoneForHub
        ? `desde «${label}» (zona de ${side.seededByZoneForHub})`
        : `desde «${label}»`;
    }
  }
}

/** The band counts for one day, e.g. "2 a pie · 1 media distancia". Never a total, never minutes. */
function zoneBandSummary(byBand: Record<ProximityBand, number>): string {
  return (Object.keys(PROXIMITY_BANDS) as ProximityBand[])
    .filter((band) => byBand[band] > 0)
    .map((band) => `${byBand[band]} ${PROXIMITY_BANDS[band].label.toLowerCase()}`)
    .join(" · ");
}

function ZoneHubLinkCard({
  link,
  dayLinks,
  anchorLabelById,
  onClear,
}: {
  link: ZoneHubLink;
  dayLinks: readonly ZoneDayLink[];
  anchorLabelById: ReadonlyMap<string, string>;
  onClear: (hub: string) => void;
}) {
  const { choice } = link;
  const days = dayLinks.filter((day) => link.dayOrdinals.includes(day.dayOrdinal));

  return (
    <article className="zone-plan__card" aria-label={`Zona elegida para ${link.hub}`}>
      <header className="zone-plan__card-head">
        <div>
          <h4 className="zone-plan__card-title">
            {link.hub}: {choice.zone ? choice.zone.name : "zona ya no disponible"}
          </h4>
          {choice.zone ? (
            <p className="zone-plan__card-anchor">
              Referencia: {choice.zone.anchor.label}
              {choice.anchor && <> · alojamiento «{choice.anchor.label}»</>}
            </p>
          ) : (
            <p className="zone-plan__card-anchor">
              Esta zona ya no está en el catálogo. Vuestra decisión y su alojamiento siguen aquí
              intactos; podéis quitarla cuando queráis.
            </p>
          )}
        </div>
        <button
          type="button"
          className="button button--secondary zone-plan__clear"
          onClick={() => onClear(link.hub)}
          aria-label={`Quitar la zona elegida para ${link.hub}`}
        >
          Quitar
        </button>
      </header>

      <p className="zone-plan__caveat">
        <span aria-hidden="true">ⓘ</span> Esto <strong>no es un hotel reservado</strong> y no fija
        ningún horario. Nihon <strong>no ha calculado ni un minuto</strong> de trayecto: seguís
        eligiendo el alojamiento de cada día y escribiendo vosotros sus minutos, abajo.
      </p>

      {link.dayOrdinals.length === 0 ? (
        <p className="zone-plan__empty-days">
          Todavía no hay ningún día cuyos lugares estén todos en {link.hub}. La zona sigue elegida;
          simplemente aún no hay día al que referirla.
        </p>
      ) : (
        <>
          <p className="zone-plan__counts">
            <Icon name="calendario" size={16} /> Días en {link.hub}:{" "}
            <strong>{link.dayOrdinals.map((ordinal) => ordinal + 1).join(", ")}</strong> · límites
            planificados desde esta zona: <strong>{link.sidesPlannedFromZone}</strong>, desde otro
            alojamiento: <strong>{link.sidesPlannedFromAnotherAnchor}</strong>, sin seleccionar:{" "}
            <strong>{link.sidesUnselected}</strong>, no aplica:{" "}
            <strong>{link.sidesNoAccommodation}</strong>
          </p>

          <ul className="zone-plan__days">
            {days.map((day) => (
              <li key={day.dayOrdinal} className="zone-plan__day">
                <p className="zone-plan__day-head">
                  <strong>Día {day.dayOrdinal + 1}</strong>
                  <span className="zone-plan__day-sides">
                    Inicio: {zoneBoundarySideText(day.boundaryUse.start, anchorLabelById)} · Fin:{" "}
                    {zoneBoundarySideText(day.boundaryUse.end, anchorLabelById)}
                  </span>
                </p>
                {day.proximity && day.proximity.medianKm !== null && (
                  <p className="zone-plan__day-proximity">
                    <span className="zone-plan__tag zone-plan__tag--derived">calculado</span>{" "}
                    Mediana <strong>{formatZoneKm(day.proximity.medianKm)}</strong> en{" "}
                    <strong>línea recta</strong> desde {day.proximity.anchorLabel}
                    {zoneBandSummary(day.proximity.byBand) && (
                      <> · {zoneBandSummary(day.proximity.byBand)}</>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <p className="zone-plan__derived-note">
            La distancia es geometría en línea recta entre la estación de la zona y cada lugar.{" "}
            <strong>No es tiempo de trayecto</strong> y no dice que un día sea mejor que otro: en
            Tokio la red de tren, no la línea recta, decide cuánto se tarda.
          </p>
        </>
      )}
    </article>
  );
}

/**
 * The section itself, at one of two densities.
 *
 * `summary` is what the route view shows: one line per chosen zone, no per-day detail. It exists
 * because a reader who presses "Abrir el planificador" from the comparison lands on the ROUTE view,
 * and arriving to no acknowledgement at all of the decision they just made would make the link feel
 * like nothing happened. The per-day detail needs days to exist, so it belongs with them.
 *
 * `full` is the day-assignment view's section, beside the accommodation manager and the per-day
 * boundaries it actually describes.
 *
 * Both are rendered even with nothing chosen: the empty state is the honest answer to "I have not
 * chosen a zone yet", and hiding the section would make the feature invisible to anyone who has not
 * already found the comparison screen.
 */
export function ZonePlanSection({
  choices,
  dayLinks,
  hubLinks,
  anchorLabelById,
  onClear,
  variant = "full",
}: {
  choices: readonly ZoneAccommodationChoice[];
  dayLinks: readonly ZoneDayLink[];
  hubLinks: readonly ZoneHubLink[];
  anchorLabelById: ReadonlyMap<string, string>;
  onClear: (hub: string) => void;
  variant?: "full" | "summary";
}) {
  if (variant === "summary") {
    return (
      <section className="zone-plan zone-plan--summary" aria-label="Zonas de alojamiento elegidas">
        <h3>Zonas elegidas para dormir</h3>
        {choices.length === 0 ? (
          <p className="zone-plan__empty">
            No habéis elegido ninguna zona todavía. Se eligen comparándolas en{" "}
            <strong>«Dónde dormir»</strong>, en la barra de la ciudad.
          </p>
        ) : (
          <>
            <ul className="zone-plan__summary-list">
              {hubLinks.map((link) => (
                <li key={link.hub}>
                  <strong>{link.hub}</strong>:{" "}
                  {link.choice.zone ? link.choice.zone.name : "zona ya no disponible"}
                  {link.choice.anchor && <> · alojamiento «{link.choice.anchor.label}»</>}
                </li>
              ))}
            </ul>
            <p className="zone-plan__caveat">
              <span aria-hidden="true">ⓘ</span> No hay ningún hotel reservado y{" "}
              <strong>ningún tiempo calculado</strong>. El detalle por días está en{" "}
              <strong>«Distribuir por días»</strong>.
            </p>
          </>
        )}
      </section>
    );
  }

  const multiHubDays = dayLinks.filter((day) => day.hubs.length > 1);

  return (
    <section className="zone-plan" aria-label="Zonas de alojamiento elegidas">
      <h3>Zonas elegidas para dormir</h3>

      {choices.length === 0 ? (
        <p className="zone-plan__empty">
          No habéis elegido ninguna zona todavía. Se eligen comparándolas en{" "}
          <strong>«Dónde dormir»</strong>, en la barra de la ciudad. Elegir una no reserva nada: solo
          crea aquí un alojamiento de referencia con la estación de esa zona, para que no tengáis que
          copiar coordenadas a mano.
        </p>
      ) : (
        <>
          {hubLinks.map((link) => (
            <ZoneHubLinkCard
              key={link.hub}
              link={link}
              dayLinks={dayLinks}
              anchorLabelById={anchorLabelById}
              onClear={onClear}
            />
          ))}

          {multiHubDays.length > 0 && (
            <p className="zone-plan__multi-hub">
              <span aria-hidden="true">ⓘ</span> Día
              {multiHubDays.length === 1 ? " " : "s "}
              {multiHubDays.map((day) => day.dayOrdinal + 1).join(", ")} mezcla
              {multiHubDays.length === 1 ? "" : "n"} lugares de más de una ciudad, así que no hay una
              única zona a la que referir{multiHubDays.length === 1 ? "lo" : "los"}. Sus límites de
              alojamiento se siguen eligiendo día a día, abajo.
            </p>
          )}
        </>
      )}
    </section>
  );
}
