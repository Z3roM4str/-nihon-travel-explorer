import type { ReactNode } from "react";

import type { Reviewer } from "./review";
type Props = { destination: "explore" | "trip"; savedCount: number; reviewer?: Reviewer; onReviewer: (reviewer:Reviewer)=>void; children: ReactNode };

export function AppShell({ destination, savedCount, reviewer, onReviewer, children }: Props) {
  return <div className="astra-app">
    <a className="astra-skip" href="#astra-main">Saltar al contenido</a>
    <header className="astra-shell">
      <a className="astra-brand" href="#/explorar">Nihon<span>Japón, a su manera</span></a>
      <nav aria-label="Principal">
        <a href="#/explorar" aria-current={destination === "explore" ? "page" : undefined}>Explorar</a>
        <a href="#/viaje" aria-current={destination === "trip" ? "page" : undefined}>Nuestro viaje {savedCount > 0 && <span className="astra-count">{savedCount}</span>}</a>
      </nav>
      <label className="astra-reviewer">Gustos de <select aria-label="Persona activa" value={reviewer ?? ""} onChange={e=>onReviewer(e.target.value as Reviewer)}><option value="" disabled>Mis gustos</option><option value="fernando">Fernando</option><option value="ella">Ella</option></select></label>
    </header>
    <main id="astra-main" tabIndex={-1}>{children}</main>
  </div>;
}
