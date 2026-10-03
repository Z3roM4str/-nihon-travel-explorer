import { useEffect, useRef, useState } from "react";

/**
 * B10 (#177, `design/09` «autorización del lote de activación diferida de imágenes») — la
 * descarga de la fotografía de una tarjeta NO prioritaria no empieza hasta que su caja está a
 * como mucho dos viewports de distancia. El margen es el máximo autorizado, no un objetivo: el
 * `loading="lazy"` nativo se conserva en la imagen y sigue aplicando su propia distancia, de modo
 * que la petición sólo nace cuando se cumplen las dos condiciones.
 *
 * `rootMargin` en porcentaje es relativo a la caja de la raíz: 200 % = dos alturas por arriba y
 * abajo y dos anchuras a los lados. Es un máximo de dos viewports porque ninguna raíz que se use
 * aquí es mayor que el viewport.
 */
export const IMAGE_ACTIVATION_ROOT_MARGIN = "200% 200% 200% 200%";

type Listener = (inRange: boolean) => void;
type Watched = { listeners: Set<Listener>; inRange: boolean | null };
type Group = { observer: IntersectionObserver; watched: Map<Element, Watched> };

/**
 * Un observador por raíz, compartido por todas las tarjetas que la usan, con cuenta de
 * referencias: se crea con la primera suscripción y se desconecta con la última. La portada tiene
 * unas 150 tarjetas; un observador por tarjeta y tramo serían cientos de instancias.
 */
const groups = new Map<Element | null, Group>();

function subscribe(target: Element, root: Element | null, listener: Listener): () => void {
  let group = groups.get(root);
  if (!group) {
    const watched = new Map<Element, Watched>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const item = watched.get(entry.target);
          if (!item) continue;
          item.inRange = entry.isIntersecting;
          for (const each of [...item.listeners]) each(entry.isIntersecting);
        }
      },
      { root, rootMargin: IMAGE_ACTIVATION_ROOT_MARGIN }
    );
    group = { observer, watched };
    groups.set(root, group);
  }
  const current = group;
  let item = current.watched.get(target);
  if (!item) {
    item = { listeners: new Set(), inRange: null };
    current.watched.set(target, item);
    current.observer.observe(target);
  }
  const mine = item;
  mine.listeners.add(listener);
  // Un contenedor ya observado no vuelve a notificar su estado a quien llega después.
  if (mine.inRange !== null) listener(mine.inRange);
  return () => {
    mine.listeners.delete(listener);
    if (mine.listeners.size > 0) return;
    current.observer.unobserve(target);
    current.watched.delete(target);
    if (current.watched.size === 0) {
      current.observer.disconnect();
      if (groups.get(root) === current) groups.delete(root);
    }
  };
}

/**
 * Un `IntersectionObserver` con raíz implícita (el viewport) recorta la caja observada por cada
 * contenedor con scroll propio que la rodea, y `rootMargin` sólo amplía la raíz: dentro del panel
 * de la lista o de un carrusel la anticipación sería cero y cada foto aparecería recién al entrar
 * en pantalla. Para que los dos viewports se cumplan de verdad, la caja se observa por tramos:
 * la tarjeta respecto de su contenedor con scroll más cercano, ese contenedor respecto del
 * siguiente, y el último respecto del viewport. Cada tramo lleva el mismo margen y la imagen se
 * activa cuando todos los tramos están a la distancia autorizada — así un carrusel fuera de
 * pantalla no activa sus tarjetas, aunque estén a su lado.
 *
 * Sólo cuentan los contenedores que el usuario puede desplazar (`auto`/`scroll`); `hidden` y
 * `clip` siguen recortando dentro del cálculo del navegador. `body`/`html` no son raíces: su
 * scroll es el del viewport.
 */
function scrollContainersOf(node: Element): Element[] {
  const containers: Element[] = [];
  for (let el = node.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(el);
    if (/(auto|scroll)/.test(overflowX) || /(auto|scroll)/.test(overflowY)) containers.push(el);
  }
  return containers;
}

/**
 * Devuelve la referencia que hay que poner en la caja de la fotografía y si su `src` ya puede
 * asignarse. Una tarjeta prioritaria (`priority`) se activa de inmediato, sin observador: la
 * política de prioridad vigente no cambia. La activación es de una sola vez; todas las
 * suscripciones se cancelan al activarse y también al desmontarse la tarjeta (superficie
 * abandonada), por lo que ninguna superficie que ya no existe puede iniciar respuestas nuevas y
 * un observador sin suscriptores se desconecta.
 *
 * Sin `IntersectionObserver` (entornos que no lo ofrecen) la imagen se activa de inmediato: la
 * degradación es el comportamiento anterior (carga nativa diferida), nunca una foto que no llega.
 */
export function useDeferredImageActivation<T extends Element>(priority: boolean) {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  // Sin observador disponible no hay nada que esperar: se deriva en el render, sin efecto.
  const active = priority || near || typeof IntersectionObserver === "undefined";

  useEffect(() => {
    if (active) return;
    const node = ref.current;
    if (!node) return;
    const containers = scrollContainersOf(node);
    const targets: Element[] = [node, ...containers];
    const roots: (Element | null)[] = [...containers, null];
    const within = targets.map(() => false);
    const cancel: (() => void)[] = [];
    let reached = false;
    const release = () => {
      for (const stop of cancel.splice(0)) stop();
    };
    targets.forEach((target, index) => {
      cancel.push(
        subscribe(target, roots[index], (inRange) => {
          within[index] = inRange;
          if (within.every(Boolean)) {
            reached = true;
            release();
            setNear(true);
          }
        })
      );
    });
    // Un contenedor ya observado notifica al suscribirse: si eso completó el criterio antes de
    // registrar todas las cancelaciones, se liberan aquí.
    if (reached) release();
    return release;
  }, [active]);

  return { ref, active };
}
