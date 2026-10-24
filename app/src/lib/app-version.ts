/**
 * B26 (`05 §11` «Acerca de») — la versión de la aplicación.
 *
 * La única fuente de verdad es `app/package.json`; `vite.config.ts` la inyecta como
 * `__APP_VERSION__` en la compilación (y en Vitest). Este módulo no escribe ningún número: si la
 * constante no existe (herramienta que no pasa por Vite) dice que no la conoce en vez de inventar.
 */
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string | null =
  typeof __APP_VERSION__ === "string" && __APP_VERSION__.length > 0 ? __APP_VERSION__ : null;
