/** Mismo nombre para el diario, los reintentos y las sustituciones explícitas. */
export function runExclusive<T>(name: string, task: () => T | Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== "function") {
    try { return Promise.resolve(task()); } catch (error) { return Promise.reject(error); }
  }
  // Un lock rechazado no autoriza a saltárselo; una tarea que lanza no se ejecuta dos veces.
  return locks.request(`nihon:${name}`, { mode: "exclusive" }, async () => {
    // WebKit puede conceder el lock antes de procesar la invalidación de localStorage enviada
    // por la pestaña anterior. Las relecturas síncronas ven entonces la misma caché antigua.
    // Cedemos una tarea SIN soltar el lock; todos los lectores/escritores clasifican después.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return task();
  });
}

export function runExclusiveDocuments<T>(keys: readonly string[], task: () => T | Promise<T>): Promise<T> {
  const ordered = [...new Set(keys)].sort();
  const acquire = (index: number): Promise<T> => index === ordered.length
    ? Promise.resolve().then(task)
    : runExclusive(ordered[index], () => acquire(index + 1));
  return acquire(0);
}
