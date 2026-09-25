import type { ReactNode } from "react";

type Props = { destination: "explore" | "trip"; savedCount: number; children: ReactNode };

export function AppShell({ destination, savedCount, children }: Props) {
  return <div className="astra-app">
    <a className="astra-skip" href="#astra-main">Saltar al contenido</a>
    <header className="astra-shell">
      <a className="astra-brand" href="#/explorar">Nihon<span>Japón, a su manera</span></a>
      <nav aria-label="Principal">
        <a href="#/explorar" aria-current={destination === "explore" ? "page" : undefined}>Explorar</a>
        <a href="#/viaje" aria-current={destination === "trip" ? "page" : undefined}>Nuestro viaje {savedCount > 0 && <span className="astra-count">{savedCount}</span>}</a>
      </nav>
      <span className="astra-profile">Viaje de Fernando y Lorena</span>
    </header>
    <main id="astra-main" tabIndex={-1}>{children}</main>
  </div>;
}
