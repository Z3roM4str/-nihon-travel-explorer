import { useEffect, useState, type RefObject } from "react";

/** Una pantalla y media por delante: la foto llega antes que el dedo, y nada más lejos se descarga. */
const NEAR_MARGIN = "150%";

function closestScroller(node: Element): Element | null {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(parent);
    if (/auto|scroll/.test(`${overflowX} ${overflowY}`)) return parent;
  }
  return null;
}

/**
 * `true` cuando `ref` está a menos de `NEAR_MARGIN` de la zona visible de su scroller; ya no vuelve
 * a `false`. Con `enabled=false` es `true` desde el principio.
 *
 * `loading="lazy"` no alcanza en la lista de una ciudad: el navegador decide su propio margen, y una
 * foto que la portada ya descargó se pinta al instante por lejos que esté. El `root` es el scroller
 * real, no el viewport, porque `rootMargin` no se aplica a un scroller anidado. Sin
 * IntersectionObserver (SSR, pruebas) no se difiere nada.
 */
export function useNearScrollport(ref: RefObject<Element | null>, enabled: boolean): boolean {
  const [near, setNear] = useState(!enabled || typeof IntersectionObserver === "undefined");
  // Una tarjeta que pasa a ser la prioritaria no espera al observador.
  if (!enabled && !near) setNear(true);

  useEffect(() => {
    const node = ref.current;
    if (near || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { root: closestScroller(node), rootMargin: NEAR_MARGIN }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near, ref]);

  return near;
}
