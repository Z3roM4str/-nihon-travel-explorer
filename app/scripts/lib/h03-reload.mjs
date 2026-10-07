/**
 * H03 — pulsar «Recargar la página» y clasificar un timeout con pruebas objetivas, no por suposición.
 *
 * Un timeout esperando a que desaparezca el documento anterior NO demuestra por sí solo que el producto no recargara. Medido en
 * WebKit 26.5 (Playwright/WPE, libsoup; docs/final-audit-evidence/round5-h03): en todos los atascos `beforeunload` se dispara
 * (`location.reload()` se ejecutó) y el driver ve la petición de documento, pero esa petición NUNCA llega al servidor local y la
 * navegación queda pendiente sin terminar ni fallar. Se reproduce con una recarga simple y SIN código de Nihon.
 *
 * Reglas (el límite de espera es explícito y no se amplía):
 *   - la recarga ocurre dentro del límite                                       → listo;
 *   - límite superado, petición de documento emitida y NO recibida por el servidor
 *     (o el proceso de red del motor se reemplazó)                              → `report(detalle)` (cobertura parcial) y
 *                                                                                 se pulsa otra vez, como haría una persona;
 *   - cada reintento exige su propia prueba del motor y hay como máximo `maxPresses` (3) pulsaciones; la última es ESTRICTA;
 *   - límite superado sin esa prueba (la petición llegó al servidor, o no se emitió) → se propaga el error (fallo estricto).
 */
export async function pressOfferedReload({ page, alert, proxy = null, networkReplaced = () => false, report, timeoutMs = 8000, maxPresses = 3 }) {
  const navigations = [];
  const onRequest = (request) => { if (request.isNavigationRequest()) navigations.push(Date.now()); };
  page.on("request", onRequest);
  const waitReplaced = () => page.waitForFunction(() => window.__beforeReload === undefined, undefined, { timeout: timeoutMs });
  const button = () => alert.first().getByRole("button", { name: /Recargar/ });
  // La 1.ª pulsación es un clic real. Las siguientes usan el evento `click` del propio botón: con la navegación perdida aún
  // pendiente, `click()` de Playwright espera a que esa navegación termine (8 s en CI: «waiting for navigation to finish») y
  // nunca llega a pulsar, mientras que una persona sí puede pulsar de nuevo. El manejador del producto es el mismo.
  const press = (n) => (n === 1 ? button().click({ noWaitAfter: true }) : button().dispatchEvent("click"));
  try {
    let documentsBefore = proxy ? proxy.state.documents : 0;
    const faults = [];
    for (let attempt = 1; attempt <= maxPresses; attempt++) {
      navigations.length = 0;
      documentsBefore = proxy ? proxy.state.documents : 0;
      await press(attempt);
      try {
        await waitReplaced();
        return { attempts: attempt, engineFault: faults.length ? faults.join(" | ") : null };
      } catch (error) {
        const reachedServer = proxy ? proxy.state.documents - documentsBefore : null;
        const lostRequest = Boolean(proxy) && navigations.length > 0 && reachedServer === 0;
        const replaced = networkReplaced();
        const detail = `pulsación ${attempt}: petición de documento emitida=${navigations.length > 0}; llegó al servidor=${reachedServer ?? "n/d"}; proceso de red reemplazado=${replaced}`;
        // Sin prueba del motor, o sin pulsaciones que ofrecer: fallo estricto. Cada reintento exige su propia prueba.
        if ((!lostRequest && !replaced) || attempt === maxPresses) throw error;
        faults.push(detail);
        report?.(detail);
      }
    }
  } finally {
    page.off("request", onRequest);
  }
}
