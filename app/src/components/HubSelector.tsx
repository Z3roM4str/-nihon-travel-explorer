import { useRef } from "react";
import type { KeyboardEvent } from "react";

type Props = {
  hubs: string[];
  activeHub: string;
  onSelect: (hub: string) => void;
};

/**
 * Standard ARIA tabs pattern with roving tabindex: arrow keys move focus between hubs,
 * Enter/Space (native button activation) switches. Only the active tab is in the tab
 * order, so Tab itself skips straight past the whole group.
 */
export function HubSelector({ hubs, activeHub, onSelect }: Props) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusIndex(index: number) {
    const wrapped = (index + hubs.length) % hubs.length;
    tabRefs.current[wrapped]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusIndex(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusIndex(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusIndex(0);
        break;
      case "End":
        event.preventDefault();
        focusIndex(hubs.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <nav className="hub-selector" aria-label="Elegir ciudad o zona">
      <div className="hub-selector__track" role="tablist" aria-label="Hubs disponibles">
        {hubs.map((hub, index) => {
          const isActive = hub === activeHub;
          return (
            <button
              key={hub}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`hub-tab-${hub}`}
              aria-selected={isActive}
              aria-controls="app-hub-panel"
              tabIndex={isActive ? 0 : -1}
              className={`hub-selector__tab ${isActive ? "hub-selector__tab--active" : ""}`}
              onClick={() => onSelect(hub)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {hub}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
