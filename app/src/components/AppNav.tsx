import { Icon, type IconName } from "../icons/Icon";
import type { Destination } from "../lib/destination";

type NavItem = {
  id: Destination;
  label: string;
  icon: IconName;
  /** `04 §10`: "Activo: icono relleno + --ink-900; inactivo: --ink-500" — el color solo no
   * basta (Art. 11), así que el activo también cambia de glifo, no sólo de tinta. */
  iconActive: IconName;
};

const ITEMS: NavItem[] = [
  { id: "explorar", label: "Explorar", icon: "explorar", iconActive: "explorar-relleno" },
  { id: "quiero-ir", label: "Quiero ir", icon: "corazon", iconActive: "corazon-relleno" },
  { id: "viaje", label: "Viaje", icon: "calendario", iconActive: "calendario-relleno" },
  { id: "nosotros", label: "Nosotros", icon: "personas", iconActive: "personas-relleno" },
];

type Props = {
  active: Destination;
  onSelect: (destination: Destination) => void;
  /** Bloque 18, `02 §D3` / `04 §10`: sólo «Quiero ir» lleva contador, y sólo si es > 0 (Art. 6). */
  wantToGoCount: number;
};

/**
 * Bloque 18 — los cuatro destinos permanentes (`02 §D2`, DD-001), como barra inferior en
 * teléfono y raíl lateral desde `md` (`04 §10`). Ambos componentes se montan siempre; el CSS
 * decide cuál se ve en cada anchura, para que nunca aparezcan los dos a la vez ni ninguno.
 */
export function TabBar({ active, onSelect, wantToGoCount }: Props) {
  return (
    <nav className="tab-bar" aria-label="Navegación principal">
      {ITEMS.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            className={`tab-bar__item ${isActive ? "tab-bar__item--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span className="tab-bar__icon" aria-hidden="true">
              <Icon name={isActive ? item.iconActive : item.icon} size={24} />
              {item.id === "quiero-ir" && wantToGoCount > 0 && (
                <span className="tab-bar__badge">{wantToGoCount}</span>
              )}
            </span>
            <span className="tab-bar__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function NavRail({ active, onSelect, wantToGoCount }: Props) {
  return (
    <nav className="nav-rail" aria-label="Navegación principal">
      {ITEMS.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            className={`nav-rail__item ${isActive ? "nav-rail__item--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span className="nav-rail__icon" aria-hidden="true">
              <Icon name={isActive ? item.iconActive : item.icon} size={24} />
              {item.id === "quiero-ir" && wantToGoCount > 0 && (
                <span className="nav-rail__badge">{wantToGoCount}</span>
              )}
            </span>
            <span className="nav-rail__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
