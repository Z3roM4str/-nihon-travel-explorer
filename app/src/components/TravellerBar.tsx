import type { Traveller } from "../lib/travellers";
import { Icon } from "../icons/Icon";

/**
 * Block 5 — the whole of the two-person layer's permanent UI.
 *
 * It is one small row in the header, and it exists so that everything else can stay exactly as it
 * was. Because the reader says once who is holding the device, the heart on every card keeps being
 * a single tap with no person picker in front of it, and no card has to carry a Persona 1 /
 * Persona 2 pair.
 *
 * Two names side by side rather than a dropdown: with two people a segmented control is one tap
 * instead of two, it shows the current state without being opened, and it needs no portal, no
 * overlay and no animation. `aria-pressed` carries the state, and the visible label carries the
 * name — colour is never the only difference between the selected and unselected halves.
 *
 * The gear opens the manager, which is the only modal this layer has and is opened deliberately,
 * rarely, and never by the app itself.
 */
export function TravellerBar({
  travellers,
  activeTravellerId,
  onSelect,
  onManage,
}: {
  travellers: readonly Traveller[];
  activeTravellerId: string | null;
  onSelect: (travellerId: string) => void;
  onManage: () => void;
}) {
  if (travellers.length === 0) return null;

  return (
    <div className="traveller-bar" role="group" aria-label="Quién está usando Nihon">
      <span className="traveller-bar__legend" aria-hidden="true">
        Eres
      </span>
      <div className="traveller-bar__options">
        {travellers.map((traveller) => {
          const active = traveller.id === activeTravellerId;
          return (
            <button
              key={traveller.id}
              type="button"
              className={`traveller-bar__option ${active ? "traveller-bar__option--active" : ""}`}
              aria-pressed={active}
              onClick={() => onSelect(traveller.id)}
              // The visible label is the name alone; the accessible name says what pressing it
              // means, which the name on its own does not.
              aria-label={
                active
                  ? `Estás usando Nihon como ${traveller.label}`
                  : `Cambiar a ${traveller.label}`
              }
            >
              <span className="traveller-bar__name">{traveller.label}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="traveller-bar__manage"
        onClick={onManage}
        aria-haspopup="dialog"
        aria-label="Editar las personas del viaje"
        title="Editar las personas del viaje"
      >
        <Icon name="ajustes" size={20} />
      </button>
    </div>
  );
}
