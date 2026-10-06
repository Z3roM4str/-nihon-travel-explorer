import { Component, type ReactNode } from "react";
import { Icon } from "../icons/Icon";
import { LazyLoadError } from "../lib/lazy-surface";

import "./LazySurfaceBoundary.css";

/**
 * Auditoría final (H03) — recuperación ante el fallo de descarga de una superficie diferida.
 *
 * «Viaje» y «Dónde dormir» se cargan con `React.lazy`. Cuando la descarga del módulo fallaba (red
 * inestable, un deploy que retira el chunk), la promesa rechazada llegaba a `Suspense`, que no
 * captura errores: el árbol de React se desmontaba entero y la persona veía una pantalla en blanco
 * con la navegación inutilizable, aunque sus datos estuvieran a salvo.
 *
 * Esta frontera captura el error de ESA superficie, dejando vivo el resto de la aplicación, y
 * ofrece una única recuperación honesta: recargar la página.
 *
 * **Por qué recargar y no «Reintentar».** `React.lazy` memoriza la promesa rechazada, y el
 * navegador memoriza también la importación dinámica fallida de la misma URL: volver a pedirla sin
 * recargar reutiliza el rechazo, así que un botón «Reintentar» prometería algo que no ocurre. Una
 * recarga reinicia ambos cachés. Es segura: todo lo que la persona ha hecho se escribe de forma
 * síncrona en `localStorage` (véase `useStoredDocument`) y se vuelve a leer al arrancar.
 */

type Props = { surface: string; children: ReactNode };
type State = { error: Error | null };

export class LazySurfaceBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const download = error instanceof LazyLoadError;
    return (
      <div className="lazy-failure" role="alert" data-lazy-failure={this.props.surface}>
        <span className="lazy-failure__icon" aria-hidden="true">
          <Icon name="aviso" size={20} />
        </span>
        <div className="lazy-failure__body">
          <p className="lazy-failure__title">
            {download
              ? `No se ha podido cargar ${this.props.surface}.`
              : `${this.props.surface} ha dejado de funcionar.`}
          </p>
          <p className="lazy-failure__text">
            {download
              ? "Suele deberse a una conexión inestable. "
              : "Ha ocurrido un error inesperado. "}
            Tus lugares, fechas e itinerario están a salvo en este dispositivo y no se han tocado.
            Recarga la página cuando tengas conexión; el resto de la aplicación sigue disponible.
          </p>
          <button
            type="button"
            className="button button--secondary lazy-failure__reload tap-target-min"
            onClick={() => window.location.reload()}
          >
            Recargar la página
          </button>
        </div>
      </div>
    );
  }
}
