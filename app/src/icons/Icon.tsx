import type { SVGProps } from "react";

/**
 * Set de iconos de línea de Nihon (Bloque 17 — B1, 03 §8). Trazo 1.5px, caja
 * 24×24, terminaciones redondeadas, heredan `currentColor`. Sustituye a los
 * emoji usados como iconografía de interfaz (Art. 00, patrón prohibido
 * "Emoji como icono de interfaz").
 *
 * Inventario mínimo de `03 §8` más los añadidos que exige sustituir el
 * inventario real de emoji del cromo (ubicación, avión, joya, precio,
 * ajustes, siguiente, comparar, monorriel, imagen — ninguno tiene overlap de
 * significado con los 25 mínimos).
 *
 * Bloque 18, corrección post-cierre (`04 §10`: "Activo: icono relleno +
 * --ink-900; inactivo: --ink-500"): `explorar-relleno`, `calendario-relleno`
 * y `personas-relleno` se añaden con la misma técnica que ya usaba
 * `corazon-relleno` desde el Bloque 17 — la misma geometría de línea, con
 * `fill="currentColor"` en sus formas cerradas. Ningún icono nuevo, ningún
 * segundo sistema: es el mismo set, con el estado que `04 §10` exige para los
 * cuatro destinos de `TabBar`/`NavRail`.
 */
export type IconName =
  | "explorar"
  | "explorar-relleno"
  | "corazon"
  | "corazon-relleno"
  | "calendario"
  | "calendario-relleno"
  | "personas"
  | "personas-relleno"
  | "buscar"
  | "filtro"
  | "mapa"
  | "lista"
  | "atras"
  | "cerrar"
  | "mas"
  | "info"
  | "reloj"
  | "ticket"
  | "cama"
  | "tren"
  | "a-pie"
  | "aviso"
  | "enlace-externo"
  | "descargar"
  | "arriba"
  | "abajo"
  | "arrastrar"
  | "expandir"
  | "ubicacion"
  | "avion"
  | "joya"
  | "precio"
  | "ajustes"
  | "siguiente"
  | "comparar"
  | "monorriel"
  | "imagen"
  | "confirmado"
  | "punto"
  /**
   * Bloque 19 (B3, `03 §8`) — mapa `categoría → icono`. Un icono por cada una de las 26
   * etiquetas de presentación (`lib/category-presentation.ts`), nunca el emoji del dataset.
   */
  | "categoria-templos"
  | "categoria-nocturno"
  | "categoria-miradores"
  | "categoria-playa"
  | "categoria-cielo-nocturno"
  | "categoria-jardines"
  | "categoria-naturaleza"
  | "categoria-gastronomia"
  | "categoria-eventos"
  | "categoria-entretenimiento"
  | "categoria-arte"
  | "categoria-cultura-tradicional"
  | "categoria-videojuegos"
  | "categoria-ciudad"
  | "categoria-arquitectura"
  | "categoria-museos"
  | "categoria-historia"
  | "categoria-fauna"
  | "categoria-anime"
  | "categoria-fotografia"
  | "categoria-experiencias-especiales"
  | "categoria-compras"
  | "categoria-tecnologia"
  | "categoria-senderismo"
  | "categoria-onsen"
  | "categoria-extrano";

/**
 * `03 §8` fija 16/20/24 para el cromo/interfaz general. Bloque 19 (B3) añade 32 — el tamaño que
 * `04 §9` (`PhotoPlaceholder`) y `04 §15` (`EmptyState`) fijan explícitamente para su icono de
 * línea; no es un tamaño inventado, es el que esos dos componentes ya especifican por su cuenta.
 */
export type IconSize = 16 | 20 | 24 | 32;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: IconSize;
}

const SHARED_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function paths(name: IconName) {
  switch (name) {
    case "explorar":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M14.8 9.2 13 13l-3.8 1.8L11 11l3.8-1.8Z" />
        </>
      );
    case "explorar-relleno":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M14.8 9.2 13 13l-3.8 1.8L11 11l3.8-1.8Z" fill="currentColor" />
        </>
      );
    case "corazon":
      return (
        <path d="M12 20.2S4 15.4 4 9.9C4 7.2 6.1 5 8.7 5c1.5 0 2.8.7 3.3 1.9C12.5 5.7 13.8 5 15.3 5 17.9 5 20 7.2 20 9.9c0 5.5-8 10.3-8 10.3Z" />
      );
    case "corazon-relleno":
      return (
        <path
          d="M12 20.2S4 15.4 4 9.9C4 7.2 6.1 5 8.7 5c1.5 0 2.8.7 3.3 1.9C12.5 5.7 13.8 5 15.3 5 17.9 5 20 7.2 20 9.9c0 5.5-8 10.3-8 10.3Z"
          fill="currentColor"
        />
      );
    case "calendario":
      return (
        <>
          <rect x="3.75" y="5.25" width="16.5" height="15" rx="2" />
          <line x1="3.75" y1="9.75" x2="20.25" y2="9.75" />
          <line x1="8" y1="3.25" x2="8" y2="7.25" />
          <line x1="16" y1="3.25" x2="16" y2="7.25" />
        </>
      );
    case "calendario-relleno":
      return (
        <>
          <rect x="3.75" y="5.25" width="16.5" height="15" rx="2" fill="currentColor" />
          <line x1="8" y1="3.25" x2="8" y2="7.25" />
          <line x1="16" y1="3.25" x2="16" y2="7.25" />
        </>
      );
    case "personas":
      return (
        <>
          <circle cx="8.5" cy="8.5" r="2.75" />
          <circle cx="16" cy="9.5" r="2.25" />
          <path d="M3.5 19.5c0-3 2.3-5 5-5s5 2 5 5" />
          <path d="M14 19.5c0-2.3 1.6-4 3.7-4 2 0 3.8 1.5 3.8 4" />
        </>
      );
    case "personas-relleno":
      return (
        <>
          <circle cx="8.5" cy="8.5" r="2.75" fill="currentColor" />
          <circle cx="16" cy="9.5" r="2.25" fill="currentColor" />
          <path d="M3.5 19.5c0-3 2.3-5 5-5s5 2 5 5" fill="currentColor" />
          <path d="M14 19.5c0-2.3 1.6-4 3.7-4 2 0 3.8 1.5 3.8 4" fill="currentColor" />
        </>
      );
    case "buscar":
      return (
        <>
          <circle cx="10.75" cy="10.75" r="6.25" />
          <line x1="15.4" y1="15.4" x2="20.5" y2="20.5" />
        </>
      );
    case "filtro":
      return (
        <>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="8.5" cy="6" r="1.75" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1.75" fill="currentColor" stroke="none" />
          <circle cx="10.5" cy="18" r="1.75" fill="currentColor" stroke="none" />
        </>
      );
    case "mapa":
      return (
        <>
          <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
          <line x1="9" y1="4" x2="9" y2="18" />
          <line x1="15" y1="6" x2="15" y2="20" />
        </>
      );
    case "lista":
      return (
        <>
          <line x1="9" y1="6" x2="20" y2="6" />
          <line x1="9" y1="12" x2="20" y2="12" />
          <line x1="9" y1="18" x2="20" y2="18" />
          <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case "atras":
      return (
        <>
          <polyline points="14.5,5.5 8,12 14.5,18.5" />
        </>
      );
    case "siguiente":
      return (
        <>
          <polyline points="9.5,5.5 16,12 9.5,18.5" />
        </>
      );
    case "cerrar":
      return (
        <>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </>
      );
    case "mas":
      return (
        <>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </>
      );
    case "info":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <line x1="12" y1="11" x2="12" y2="16.5" />
          <circle cx="12" cy="7.75" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
    case "reloj":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <polyline points="12,7.5 12,12 15.5,14" />
        </>
      );
    case "ticket":
      return (
        <>
          <path d="M4 9.5c0-1.4 1.1-2.5 2.5-2.5h11c1.4 0 2.5 1.1 2.5 2.5v1.3a1.9 1.9 0 0 0 0 3.4v1.3c0 1.4-1.1 2.5-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5v-1.3a1.9 1.9 0 0 0 0-3.4Z" />
          <line x1="14.5" y1="7.5" x2="14.5" y2="16.5" strokeDasharray="1.6 2" />
        </>
      );
    case "cama":
      return (
        <>
          <path d="M3.5 18.5V9.75c0-.97.78-1.75 1.75-1.75h13.5c.97 0 1.75.78 1.75 1.75V18.5" />
          <path d="M3.5 15.5h17" />
          <path d="M6.5 15.5V13c0-.83.67-1.5 1.5-1.5h2.5c.83 0 1.5.67 1.5 1.5v2.5" />
          <line x1="3.5" y1="18.5" x2="3.5" y2="20.25" />
          <line x1="20.5" y1="18.5" x2="20.5" y2="20.25" />
        </>
      );
    case "tren":
      return (
        <>
          <rect x="5.5" y="4.5" width="13" height="12" rx="3.5" />
          <line x1="5.5" y1="10.5" x2="18.5" y2="10.5" />
          <circle cx="9" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
          <line x1="8" y1="19.5" x2="6.3" y2="21.5" />
          <line x1="16" y1="19.5" x2="17.7" y2="21.5" />
        </>
      );
    case "monorriel":
      return (
        <>
          <path d="M4 15.5h16" />
          <rect x="5.5" y="7" width="13" height="7" rx="2.5" />
          <line x1="9" y1="10.5" x2="9" y2="10.5" />
          <line x1="15" y1="10.5" x2="15" y2="10.5" />
          <line x1="7.5" y1="18.5" x2="6" y2="20.5" />
          <line x1="16.5" y1="18.5" x2="18" y2="20.5" />
        </>
      );
    case "a-pie":
      return (
        <>
          <circle cx="13.5" cy="4.75" r="1.6" fill="currentColor" stroke="none" />
          <path d="M10.5 21 12 15l-2.5-2 .5-4 3.5-1.5 2.5 2.5 3 1" />
          <path d="M9.5 12.5 7 14l-1 4.5" />
        </>
      );
    case "avion":
      return (
        <path d="M11 4.5v6.2L3.8 14v1.8L11 14v3.6l-2 1.6v1.4l3-1 3 1v-1.4l-2-1.6V14l7.2 1.8V14L13 10.7V4.5c0-.7-.45-1.25-1-1.25s-1 .55-1 1.25Z" />
      );
    case "aviso":
      return (
        <>
          <path d="M12 4.25 21 19.5H3Z" />
          <line x1="12" y1="10.5" x2="12" y2="14.5" />
          <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
    case "enlace-externo":
      return (
        <>
          <path d="M10 6H5.5A1.5 1.5 0 0 0 4 7.5v11A1.5 1.5 0 0 0 5.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />
          <path d="M14 4h6v6" />
          <line x1="20" y1="4" x2="11" y2="13" />
        </>
      );
    case "descargar":
      return (
        <>
          <line x1="12" y1="4" x2="12" y2="14.5" />
          <polyline points="7.5,11 12,15.5 16.5,11" />
          <path d="M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2" />
        </>
      );
    case "arriba":
      return (
        <>
          <line x1="12" y1="18.5" x2="12" y2="6" />
          <polyline points="6.5,11.5 12,6 17.5,11.5" />
        </>
      );
    case "abajo":
      return (
        <>
          <line x1="12" y1="5.5" x2="12" y2="18" />
          <polyline points="6.5,12.5 12,18 17.5,12.5" />
        </>
      );
    case "arrastrar":
      return (
        <>
          <circle cx="9" cy="6.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="6.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="9" cy="17.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="17.5" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case "expandir":
      return (
        <>
          <polyline points="8.5,10 12,6.5 15.5,10" />
          <polyline points="8.5,14 12,17.5 15.5,14" />
        </>
      );
    case "ubicacion":
      return (
        <>
          <path d="M12 21S5.5 14.7 5.5 9.9A6.5 6.5 0 0 1 18.5 9.9C18.5 14.7 12 21 12 21Z" />
          <circle cx="12" cy="9.8" r="2.2" />
        </>
      );
    case "joya":
      return (
        <path d="m4.5 9 3-4.5h9l3 4.5-7.5 10.5Z M4.5 9h15 M9.4 4.5 8 9l4 10.5 4-10.5-1.4-4.5" />
      );
    case "precio":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9 8.5h4.2a2.3 2.3 0 0 1 0 4.6H9m0 0h4.2a2.3 2.3 0 0 1 0 4.6H9" />
          <line x1="9" y1="8.5" x2="9" y2="17.7" />
        </>
      );
    case "ajustes":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.4l1.6 1.6M17.5 16l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.6l1.6-1.6M17.5 8l1.6-1.6" />
        </>
      );
    case "comparar":
      return (
        <>
          <path d="M6 7h11.5" />
          <polyline points="14.5,3.5 17.5,7 14.5,10.5" />
          <path d="M18 17H6.5" />
          <polyline points="9.5,13.5 6.5,17 9.5,20.5" />
        </>
      );
    case "imagen":
      return (
        <>
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m4.5 17 4.8-4.8 3 3 2.7-2.7 4.5 4.5" />
        </>
      );
    case "confirmado":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <polyline points="8,12.3 10.7,15 16,9" />
        </>
      );
    case "punto":
      return <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />;

    // ---------- Bloque 19 (B3) — categoría → icono (03 §8) ----------
    case "categoria-templos":
      return (
        <>
          <path d="M3 6.4c3-1.6 15-1.6 18 0" />
          <line x1="4" y1="9.5" x2="20" y2="9.5" />
          <line x1="7" y1="9.5" x2="7" y2="20" />
          <line x1="17" y1="9.5" x2="17" y2="20" />
        </>
      );
    case "categoria-nocturno":
      return (
        <>
          <path d="M15.8 4.5a7.8 7.8 0 1 0 3.8 12A6.3 6.3 0 0 1 15.8 4.5Z" />
          <path d="M19.2 4.3 19.8 5.7 21.2 6.3 19.8 6.9 19.2 8.3 18.6 6.9 17.2 6.3 18.6 5.7Z" fill="currentColor" stroke="none" />
        </>
      );
    case "categoria-miradores":
      return (
        <>
          <circle cx="17.5" cy="6.5" r="1.6" />
          <path d="M3.5 18.5 8.5 10l3 4 2.3-2.8 6.2 7.3Z" />
        </>
      );
    case "categoria-playa":
      return (
        <>
          <circle cx="17.5" cy="6.5" r="2.1" />
          <path d="M3 13.5c1.6 1.6 3.4 1.6 5 0s3.4-1.6 5 0 3.4 1.6 5 0" />
          <path d="M3 18c1.6 1.6 3.4 1.6 5 0s3.4-1.6 5 0 3.4 1.6 5 0" />
        </>
      );
    case "categoria-cielo-nocturno":
      return (
        <>
          <path d="M6 7.5 14 5.5 18 12 9 15Z" />
          <circle cx="6" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="14" cy="5.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="9" cy="15" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
    case "categoria-jardines":
      return (
        <>
          <line x1="12" y1="21" x2="12" y2="14.5" />
          <path d="M12 14.5c-3.3 0-5.8-2.3-5.8-5.3C6.2 5.9 8.7 3.8 12 3.8s5.8 2.1 5.8 5.4c0 3-2.5 5.3-5.8 5.3Z" />
        </>
      );
    case "categoria-naturaleza":
      return (
        <>
          <path d="M6 18c-1-6.2 3-11.5 12-12.5C18.5 14 13 18 6 18Z" />
          <path d="M6 18c2-3.2 5-6.2 10-9" />
        </>
      );
    case "categoria-gastronomia":
      return (
        <>
          <path d="M4 14.5c0 4 3.6 6 8 6s8-2 8-6" />
          <line x1="4" y1="14.5" x2="20" y2="14.5" />
          <line x1="9" y1="10" x2="15.5" y2="3.5" />
          <line x1="11" y1="10" x2="17.5" y2="3.5" />
        </>
      );
    case "categoria-eventos":
      return (
        <>
          <line x1="6" y1="3.5" x2="6" y2="20.5" />
          <path d="M6 5c3-1.6 6 1.6 9 0v7c-3 1.6-6-1.6-9 0Z" />
        </>
      );
    case "categoria-entretenimiento":
      return (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <line x1="12" y1="4.5" x2="12" y2="19.5" />
          <line x1="4.5" y1="12" x2="19.5" y2="12" />
          <circle cx="12" cy="4.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="19.5" cy="12" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case "categoria-arte":
      return (
        <>
          <path d="M12 4.5c-4.7 0-8.5 3.4-8.5 7.5 0 3.3 2.7 5 5.3 5 .9 0 1.5-.6 1.5-1.4 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.7-1.4 1.5-1.4h2.2c2.6 0 4.8-2 4.8-4.7 0-1.7-1.5-3-6-3" />
          <circle cx="8" cy="10.2" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="10.5" cy="7.6" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="14" cy="8.2" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
    case "categoria-cultura-tradicional":
      return (
        <>
          <line x1="12" y1="20" x2="12" y2="11" />
          <path d="M6 11a6 6 0 0 1 12 0" />
          <line x1="8" y1="11" x2="12" y2="4" />
          <line x1="16" y1="11" x2="12" y2="4" />
        </>
      );
    case "categoria-videojuegos":
      return (
        <>
          <rect x="3" y="8.5" width="18" height="9" rx="4" />
          <line x1="7.5" y1="11" x2="7.5" y2="14" />
          <line x1="6" y1="12.5" x2="9" y2="12.5" />
          <circle cx="16" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="18" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
    case "categoria-ciudad":
      return (
        <>
          <rect x="3.5" y="10" width="5" height="10.5" />
          <rect x="10" y="5.5" width="5" height="15" />
          <rect x="16.5" y="12.5" width="4" height="8" />
        </>
      );
    case "categoria-arquitectura":
      return (
        <>
          <line x1="4" y1="20.5" x2="20" y2="20.5" />
          <line x1="4" y1="5" x2="20" y2="5" />
          <line x1="6" y1="7.5" x2="6" y2="20.5" />
          <line x1="12" y1="7.5" x2="12" y2="20.5" />
          <line x1="18" y1="7.5" x2="18" y2="20.5" />
        </>
      );
    case "categoria-museos":
      return (
        <>
          <path d="M3.5 9 12 4l8.5 5" />
          <rect x="4.5" y="9" width="15" height="10.5" />
          <line x1="4.5" y1="19.5" x2="19.5" y2="19.5" />
          <line x1="8" y1="9" x2="8" y2="19.5" />
          <line x1="16" y1="9" x2="16" y2="19.5" />
        </>
      );
    case "categoria-historia":
      return (
        <>
          <path d="M4 20h16" />
          <path d="M6 20v-4h12v4" />
          <path d="M3.5 16h17" />
          <path d="M6.5 12.5h11" />
          <path d="M5 16 12 9l7 7" />
          <line x1="12" y1="9" x2="12" y2="5" />
        </>
      );
    case "categoria-fauna":
      return (
        <>
          <circle cx="12" cy="15" r="3.2" />
          <circle cx="7" cy="9" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="6.5" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="17" cy="9" r="1.4" fill="currentColor" stroke="none" />
        </>
      );
    case "categoria-anime":
      return (
        <>
          <path d="M4 5.5h16v10H10l-3.5 3.5V15.5H4Z" />
          <path d="M9 10 9.9 8 11 10l-1.1.7Z" fill="currentColor" stroke="none" />
          <path d="M14 10l.9-2 1.1 2-1 .7Z" fill="currentColor" stroke="none" />
        </>
      );
    case "categoria-fotografia":
      return (
        <>
          <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
          <path d="M8.5 7.5 10 5h4l1.5 2.5" />
          <circle cx="12" cy="13.5" r="3.3" />
        </>
      );
    case "categoria-experiencias-especiales":
      return (
        <>
          <line x1="12" y1="3.5" x2="12" y2="8.5" />
          <line x1="12" y1="15.5" x2="12" y2="20.5" />
          <line x1="3.5" y1="12" x2="8.5" y2="12" />
          <line x1="15.5" y1="12" x2="20.5" y2="12" />
          <line x1="6" y1="6" x2="9.5" y2="9.5" />
          <line x1="14.5" y1="14.5" x2="18" y2="18" />
          <line x1="18" y1="6" x2="14.5" y2="9.5" />
          <line x1="9.5" y1="14.5" x2="6" y2="18" />
        </>
      );
    case "categoria-compras":
      return (
        <>
          <path d="M6 8.5h12l-1 11.5H7Z" />
          <path d="M9 8.5V6.8a3 3 0 0 1 6 0v1.7" />
        </>
      );
    case "categoria-tecnologia":
      return (
        <>
          <rect x="7" y="7" width="10" height="10" rx="1.5" />
          <line x1="9.5" y1="3.5" x2="9.5" y2="7" />
          <line x1="14.5" y1="3.5" x2="14.5" y2="7" />
          <line x1="9.5" y1="17" x2="9.5" y2="20.5" />
          <line x1="14.5" y1="17" x2="14.5" y2="20.5" />
          <line x1="3.5" y1="9.5" x2="7" y2="9.5" />
          <line x1="3.5" y1="14.5" x2="7" y2="14.5" />
          <line x1="17" y1="9.5" x2="20.5" y2="9.5" />
          <line x1="17" y1="14.5" x2="20.5" y2="14.5" />
        </>
      );
    case "categoria-senderismo":
      return (
        <>
          <path d="M5 20.5h13c1 0 1.5-.7 1.2-1.5-.4-1-1.5-1.3-2.7-1.8-1.4-.6-2-1.4-2-3V8.5L9 6v7.5c0 1.3-.5 2-1.6 2.6-1.4.8-2.4 2-2.4 4.4Z" />
          <line x1="5" y1="17.5" x2="9" y2="17.5" />
        </>
      );
    case "categoria-onsen":
      return (
        <>
          <path d="M12 5c2.2 3.3 4.3 6.4 4.3 9.1a4.3 4.3 0 1 1-8.6 0C7.7 11.4 9.8 8.3 12 5Z" />
          <path d="M8.5 3c.3.6.3 1.1 0 1.6M15.5 3c-.3.6-.3 1.1 0 1.6" />
        </>
      );
    case "categoria-extrano":
      return (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
          <path d="M9.5 9.3a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 2" />
          <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
  }
}

/** Icono de línea. `size` controla el lado del `viewBox`; el trazo es siempre 1.5px. */
export function Icon({ name, size = 24, ...rest }: IconProps) {
  return (
    <svg {...SHARED_PROPS} width={size} height={size} aria-hidden="true" focusable="false" {...rest}>
      {paths(name)}
    </svg>
  );
}
