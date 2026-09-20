import type { IconName } from "../icons/Icon";
import { Icon } from "../icons/Icon";

type Props = {
  icon: IconName;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
};

/**
 * Bloque 19 (B3) — `EmptyState` (`04 §15`).
 *
 * Una invitación, nunca una disculpa: icono de línea, título en voz, una frase en registro, y
 * una única acción cuando la hay. Sustituye a los estados vacíos ad hoc de `PlaceList`/la
 * búsqueda de ciudad, que hasta ahora escribían su propio marcado sin pasar por un componente
 * compartido.
 */
export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state__icon" aria-hidden="true">
        <Icon name={icon} size={32} />
      </span>
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__description">{description}</p>
      {action && (
        <button type="button" className="button button--secondary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
