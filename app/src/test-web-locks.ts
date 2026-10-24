// Sólo para pruebas (como `test-css.ts`).
/** Un Web Locks mínimo y fiel en lo que importa aquí: cola por nombre, `ifAvailable` y liberación al terminar la tarea. */
export function fakeLocks() {
  const held = new Set<string>();
  const queue = new Map<string, Array<() => void>>();
  const grant = async <T>(name: string, task: (lock: object) => Promise<T> | T): Promise<T> => {
    held.add(name);
    try { return await task({ name }); }
    finally {
      held.delete(name);
      queue.get(name)?.shift()?.();
    }
  };
  return {
    held,
    request<T>(name: string, options: { ifAvailable?: boolean }, task: (lock: object | null) => Promise<T> | T): Promise<T> {
      if (!held.has(name)) return grant(name, task);
      if (options.ifAvailable) return Promise.resolve(task(null));
      return new Promise<void>((resolve) => { queue.set(name, [...(queue.get(name) ?? []), resolve]); }).then(() => grant(name, task));
    },
  };
}
