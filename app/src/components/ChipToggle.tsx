import type { ReactNode } from "react";
import type { IconName } from "../icons/Icon";
import { Icon } from "../icons/Icon";

type Props = {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: IconName;
};

/**
 * Bloque 19 (B3) — `ChipToggle` (`04 §3`).
 *
 * La variante interactiva de `Chip`: usada exclusivamente en `FilterSheet`, sustituye a la
 * casilla de verificación oculta tras una etiqueta. Altura visual 40px (`04 §3`); el área
 * táctil real sigue midiendo ≥44×44 (Art. 11) mediante la misma técnica `.tap-target-min` que ya
 * usa el resto del producto para un control aislado — un `::after` invisible, no una caja más
 * grande pintada.
 */
export function ChipToggle({ pressed, onClick, children, icon }: Props) {
  return (
    <button
      type="button"
      className={`chip-toggle tap-target-min ${pressed ? "chip-toggle--pressed" : ""}`.trim()}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {icon && (
        <span className="chip-toggle__icon" aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
      )}
      <span className="chip-toggle__label">{children}</span>
    </button>
  );
}
