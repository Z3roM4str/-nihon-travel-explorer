/**
 * Auditoría final (H03) — el rechazo de la descarga de una superficie diferida, reconocible por
 * `components/LazySurfaceBoundary` (véase allí el porqué de la frontera y de recargar en vez de
 * «reintentar»).
 */

/** Marca el error como «no se pudo DESCARGAR el módulo», para decirlo con precisión. */
export class LazyLoadError extends Error {
  readonly surface: string;
  constructor(surface: string, cause: unknown) {
    super(`No se pudo descargar la superficie «${surface}»`);
    this.name = "LazyLoadError";
    this.surface = surface;
    this.cause = cause;
  }
}

/** Envuelve el `import()` de una superficie para que su rechazo sea reconocible por la frontera. */
export function guardedImport<T>(surface: string, load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().catch((error: unknown) => {
      throw new LazyLoadError(surface, error);
    });
}

/**
 * Recarga la página tras REFRESCAR los módulos precargados.
 *
 * Medido en WebKit (CI, servidor local que falla de verdad): tras un fallo de descarga, recargar, recargar otra vez,
 * navegar a otra URL o esperar NO recupera la sección en la misma sesión (el motor conserva la entrada fallida del módulo),
 * pero `fetch(url, { cache: "reload" })` del módulo y DESPUÉS recargar sí. Vite añade un `<link rel="modulepreload">` por cada
 * módulo antes de importarlo, así que esos enlaces nombran lo que hay que refrescar. Es inocuo en los demás motores y tiene
 * un tope de tiempo: la recarga ocurre siempre, aunque la red siga caída.
 */
export async function reloadRefreshingModules(timeoutMs = 3000): Promise<void> {
  try {
    const urls = [...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')]
      .map((link) => link.href)
      .filter((href) => href.startsWith(window.location.origin));
    const refresh = Promise.allSettled(urls.map((url) => fetch(url, { cache: "reload" })));
    await Promise.race([refresh, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
  } catch {
    /* sin refresco no hay daño: se recarga igualmente */
  }
  window.location.reload();
}
