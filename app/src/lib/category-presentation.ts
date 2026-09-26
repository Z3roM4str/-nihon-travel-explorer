import type { IconName } from "../icons/Icon";
import { splitCategory } from "./place";

/**
 * Bloque 19 (B3) — mapa de presentación `categoría → icono` (`03 §8`, OD-02).
 *
 * El dataset guarda la categoría con un emoji incrustado en la propia cadena
 * (`"🍜 Gastronomía"`) y trae **29** cadenas distintas porque tres conceptos se registraron dos
 * veces con emoji distinto (`🍜`/`🍶 Gastronomía`, `🌸`/`🌿 Naturaleza`, `🍵`/`🎭 Cultura
 * tradicional`). `03 §8` autoriza colapsar esos tres duplicados **sólo en presentación**
 * (OD-02: "B3 puede avanzar con el mapa de presentación") — el workbook y `data/places.json`
 * no se tocan; `place.category` sigue siendo la cadena original de 29 valores en todo momento.
 *
 * Esta tabla vive aparte de `splitCategory` (que sólo separa el emoji del texto) porque colapsar
 * duplicados es una decisión de presentación distinta de quitar el emoji, y las dos cosas se
 * prueban por separado.
 */

/** Las 26 etiquetas de presentación, en el mismo orden en que aparecen citadas en `03 §8`/`04
 * §9`/`04 §12`. Cualquier raíz del dataset que colapse a la misma etiqueta comparte icono. */
const CATEGORY_ICON: Record<string, IconName> = {
  "Templos y santuarios": "categoria-templos",
  Nocturno: "categoria-nocturno",
  Miradores: "categoria-miradores",
  "Playa/mar/islas": "categoria-playa",
  "Cielo nocturno": "categoria-cielo-nocturno",
  "Jardines y paisajes": "categoria-jardines",
  Naturaleza: "categoria-naturaleza",
  Gastronomía: "categoria-gastronomia",
  Eventos: "categoria-eventos",
  Entretenimiento: "categoria-entretenimiento",
  Arte: "categoria-arte",
  "Cultura tradicional": "categoria-cultura-tradicional",
  Videojuegos: "categoria-videojuegos",
  "Ciudad y barrios": "categoria-ciudad",
  Arquitectura: "categoria-arquitectura",
  Museos: "categoria-museos",
  "Historia y patrimonio": "categoria-historia",
  "Fauna y experiencias estacionales": "categoria-fauna",
  "Anime/manga": "categoria-anime",
  Fotografía: "categoria-fotografia",
  "Experiencias especiales": "categoria-experiencias-especiales",
  Compras: "categoria-compras",
  Tecnología: "categoria-tecnologia",
  "Senderismo/aventura": "categoria-senderismo",
  "Onsen/bienestar": "categoria-onsen",
  "Extraño/peculiar/único": "categoria-extrano",
};

/** Las 26 etiquetas de presentación, para pruebas y para poblar un filtro por etiqueta colapsada
 * en vez de por las 29 cadenas fuente. */
export const CATEGORY_PRESENTATION_LABELS: readonly string[] = Object.keys(CATEGORY_ICON);

export type CategoryPresentation = {
  /** Etiqueta ya colapsada (26 valores), sin el emoji del dataset. */
  label: string;
  icon: IconName;
};

/**
 * Etiqueta + icono para una categoría fuente (la cadena cruda de `place.category`, emoji
 * incluido). Nunca modifica ni recuerda el dato fuente — es una función pura de presentación,
 * llamada de nuevo en cada render.
 */
export function categoryPresentation(rawCategory: string): CategoryPresentation {
  const { label } = splitCategory(rawCategory);
  const icon = CATEGORY_ICON[label];
  // Nunca debería faltar — las 26 claves cubren las 29 cadenas fuente conocidas — pero un
  // valor no mapeado usa el icono genérico de categoría en vez de romper el render.
  return { label, icon: icon ?? "categoria-extrano" };
}
