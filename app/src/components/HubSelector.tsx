import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

type Props = {
  hubs: string[];
  activeHub: string;
  onSelect: (hub: string) => void;
};

/**
 * Standard ARIA tabs pattern with roving tabindex and manual activation: arrow keys move
 * focus between hubs without switching; Enter/Space/click (native button activation)
 * switches via onSelect. `focusedHub` — not `activeHub` — decides which tab is in the tab
 * order, so focus can browse ahead of the selection the way native tabs do.
 */
export function HubSelector({ hubs, activeHub, onSelect }: Props) {
  const [focusedHub, setFocusedHub] = useState(activeHub);
  // Tracks the activeHub seen on the last render so a hub switch from outside this
  // component (saved place on another hub, cross-hub nearby jump, Back) can be detected
  // and reflected in focusedHub during render — without an effect, and without stealing
  // focus from wherever the user actually is.
  const [syncedHub, setSyncedHub] = useState(activeHub);
  if (activeHub !== syncedHub) {
    setSyncedHub(activeHub);
    setFocusedHub(activeHub);
  }
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusIndex(index: number) {
    const wrapped = (index + hubs.length) % hubs.length;
    setFocusedHub(hubs[wrapped]);
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
        {hubs.map((hub, index) => (
          <button
            key={hub}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`hub-tab-${hub}`}
            aria-selected={hub === activeHub}
            aria-controls="app-hub-panel"
            tabIndex={hub === focusedHub ? 0 : -1}
            className={`hub-selector__tab ${hub === activeHub ? "hub-selector__tab--active" : ""}`}
            onClick={() => onSelect(hub)}
            onFocus={() => setFocusedHub(hub)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {hub}
          </button>
        ))}
      </div>
    </nav>
  );
}
