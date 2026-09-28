import { Icon } from "../icons/Icon";
import type { Traveller } from "../lib/travellers";

type Size = "xs" | "sm" | "md";

type Props = {
  /** `null` renders the "los dos" token — `04 §1`: nunca se apilan dos tokens. */
  traveller: Traveller | null;
  /**
   * `a` / `b` por orden de creación (04 §1), no por identidad del `id` opaco — resuelto por quien
   * llama, que es quien conoce la posición del viajero en la lista.
   */
  variant?: "a" | "b";
  /** Whether this token stands for both travellers at once. */
  both?: boolean;
  size?: Size;
  className?: string;
  /**
   * Bloque 19 (B3): sustituye el `aria-label`/`title` por defecto («Eres {nombre}»), pensado para
   * el único uso que existía hasta ahora — la identidad de la persona activa en la cabecera. En
   * `PlaceCard` (`04 §5.5`) el mismo componente marca a LA OTRA persona, donde «Eres» sería la
   * frase equivocada; el llamador pasa el texto correcto en su lugar.
   */
  label?: string;
};

/**
 * Bloque 18 — `PersonToken` (`04 §1`).
 *
 * Sustituye al conmutador «Eres» en la cabecera (DD-007, `02 §D4`): la identidad se fija una
 * vez y se representa aquí. Nunca sólo color — el círculo siempre lleva la inicial del nombre,
 * o el glifo de dos personas cuando representa a ambas.
 */
export function PersonToken({
  traveller,
  variant = "a",
  both = false,
  size = "sm",
  className = "",
  label: labelOverride,
}: Props) {
  if (both) {
    return (
      <span
        className={`person-token person-token--both person-token--${size} ${className}`.trim()}
        aria-label="Los dos queréis ir"
        title="Los dos queréis ir"
      >
        <Icon name="personas" size={size === "md" ? 24 : 16} />
      </span>
    );
  }

  const label = traveller?.label?.trim();
  const initial = label ? label[0].toUpperCase() : variant === "b" ? "B" : "A";
  const colorClass = variant === "b" ? "person-token--b" : "person-token--a";
  const accessibleText = labelOverride ?? (label ? `Eres ${label}` : "Persona activa");

  return (
    <span
      className={`person-token ${colorClass} person-token--${size} ${className}`.trim()}
      aria-label={accessibleText}
      title={accessibleText}
    >
      {initial}
    </span>
  );
}
