/**
 * Margen tras recibir un lock que hubo que ESPERAR. Medido sin código de Nihon (`scripts/webstorage-lock-staleness-probe.mjs`,
 * WebKit 26.5 de Playwright en Linux, 500 traspasos por carga): al conceder el lock, `localStorage` seguía devolviendo el
 * valor anterior a la escritura del titular previo —aun después de ceder una tarea— en el 3,4 % de los traspasos sin carga
 * y en el 44 % con cuatro hilos ocupados; la invalidación llegó siempre en ≤ 6 ms. Sin este margen, la pestaña que esperaba
 * clasifica el documento viejo como válido y escribe encima de lo que acaba de publicar la otra (también de un documento
 * protegido). 32 ms (dos fotogramas) quintuplican el máximo medido y sólo se pagan tras una espera real; la ruta sin
 * contención no cambia. No es una garantía de la plataforma: es el margen medido, y el linaje `_w` del diario sigue
 * detectando y reaplicando una escritura sobrescrita (ver `useStoredDocument.persistence.test.ts`).
 */
export const SETTLE_AFTER_CONTENTION_MS = 32;

const UNAVAILABLE = Symbol("lock-unavailable");
const tick = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Mismo nombre para el diario, los reintentos y las sustituciones explícitas. */
export function runExclusive<T>(name: string, task: () => T | Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== "function") {
    try { return Promise.resolve(task()); } catch (error) { return Promise.reject(error); }
  }
  // Un lock rechazado no autoriza a saltárselo; una tarea que lanza no se ejecuta dos veces.
  const lockName = `nihon:${name}`;
  // Primero sin esperar: si nadie lo tiene, no hay escritor anterior cuya invalidación pueda llegar tarde.
  return locks.request(lockName, { mode: "exclusive", ifAvailable: true }, async (lock) => {
    if (lock === null) return UNAVAILABLE;
    // WebKit puede conceder el lock antes de procesar la invalidación de localStorage enviada
    // por la pestaña anterior. Cedemos una tarea SIN soltar el lock; todos los lectores/escritores clasifican después.
    await tick(0);
    return task();
  }).then((outcome) => outcome !== UNAVAILABLE
    ? outcome as T
    : locks.request(lockName, { mode: "exclusive" }, async () => {
      // Hubo un titular: su escritura puede aún no ser visible aquí (ver SETTLE_AFTER_CONTENTION_MS).
      await tick(SETTLE_AFTER_CONTENTION_MS);
      return task();
    }));
}

export function runExclusiveDocuments<T>(keys: readonly string[], task: () => T | Promise<T>): Promise<T> {
  const ordered = [...new Set(keys)].sort();
  const acquire = (index: number): Promise<T> => index === ordered.length
    ? Promise.resolve().then(task)
    : runExclusive(ordered[index], () => acquire(index + 1));
  return acquire(0);
}
