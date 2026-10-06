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
