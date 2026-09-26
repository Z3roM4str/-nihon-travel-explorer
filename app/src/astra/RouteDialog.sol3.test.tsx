// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RouteDialog } from "./RouteDialog";

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  return <><header className="astra-shell">shell</header><main id="astra-content"><button onClick={event => { (window as unknown as { opener: HTMLElement }).opener = event.currentTarget; setOpen(true); }}>Abrir ficha</button></main>{open && <RouteDialog label="Ficha" onClose={() => setOpen(false)} returnFocus={() => (window as unknown as { opener: HTMLElement }).opener}><button>Cerrar</button><a href="#fin">Último control</a></RouteDialog>}</>;
}

describe("RouteDialog SOL-3 modal contract", () => {
  it("moves focus, isolates the exterior, traps Tab, closes with Escape and restores exact focus", async () => {
    const view = render(<Harness />);
    const opener = view.getByRole("button", { name: "Abrir ficha" }); fireEvent.click(opener);
    expect(document.querySelector(".astra-shell")?.hasAttribute("inert")).toBe(true);
    expect(document.querySelector("#astra-content")?.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(view.getByRole("button", { name: "Cerrar" }));
    const last = view.getByRole("link", { name: "Último control" }); last.focus(); fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(view.getByRole("button", { name: "Cerrar" }));
    fireEvent.keyDown(document, { key: "Escape" }); await Promise.resolve();
    expect(view.queryByRole("dialog", { name: "Ficha" })).toBeNull();
    expect(document.querySelector("#astra-content")?.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});
