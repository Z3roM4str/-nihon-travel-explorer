import type { Place } from "../types";

/** Lowercases and strips diacritics so "ryogoku" matches "Ryōgoku" and "jardin" matches "jardín". */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Fields a free-text query is matched against. Only data already present in the dataset. */
function searchCorpus(place: Place): string {
  return [
    place.name,
    place.japaneseName,
    place.mapTitle,
    place.category,
    place.type,
    place.neighborhood,
    place.municipality,
    place.cluster,
    place.description,
    place.differentiator,
    place.hiddenGemStatus,
  ]
    .filter(Boolean)
    .join(" ");
}

const corpusCache = new WeakMap<Place, string>();

export function matchesQuery(place: Place, query: string): boolean {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  let corpus = corpusCache.get(place);
  if (corpus === undefined) {
    corpus = normalizeText(searchCorpus(place));
    corpusCache.set(place, corpus);
  }

  // Japanese names have no word boundaries, so a plain substring match on every term is right.
  return terms.every((term) => corpus!.includes(term));
}

/** True for the statuses the dataset uses to flag genuinely uncommon places. */
export function isHiddenGem(place: Place): boolean {
  const status = normalizeText(place.hiddenGemStatus ?? "");
  return status.includes("hidden") || status.includes("alternativa menos saturada");
}

/**
 * Etiqueta visible en español para cada valor de `hiddenGemStatus`. El dato del workbook se queda
 * igual (algunos valores vienen en inglés: «Hidden Gem real», «Semi-hidden»); sólo cambia lo que
 * se lee en pantalla. El orden es de menos a más conocido y es el que usa el filtro «Joyas».
 */
const HIDDEN_GEM_LABELS: ReadonlyArray<readonly [status: string, label: string]> = [
  ["Hidden Gem real", "Joya escondida"],
  ["Semi-hidden", "Poco conocido"],
  ["Alternativa menos saturada", "Menos saturado"],
  ["Lugar conocido pero excelente", "Conocido y excelente"],
  ["Popular / turístico", "Popular"],
  ["No aplica", "Sin clasificar"],
];

export function hiddenGemLabel(status: string | undefined | null): string {
  const raw = (status ?? "").trim();
  const found = HIDDEN_GEM_LABELS.find(([value]) => value === raw);
  return found ? found[1] : raw;
}

/** Orden editorial (de menos a más conocido) para listar valores de `hiddenGemStatus`. */
export function hiddenGemOrder(status: string): number {
  const index = HIDDEN_GEM_LABELS.findIndex(([value]) => value === status.trim());
  return index === -1 ? HIDDEN_GEM_LABELS.length : index;
}

/**
 * La etiqueta de «joya» que la tarjeta pone sobre la foto, junto a «★ Imprescindible»: sólo
 * para los lugares que `isHiddenGem` ya reconoce (joya real, poco conocido, alternativa menos
 * saturada). `null` para los demás — un lugar popular no lleva etiqueta.
 */
export function hiddenGemTag(place: Place): string | null {
  return isHiddenGem(place) ? hiddenGemLabel(place.hiddenGemStatus) : null;
}

/**
 * El nombre en español que el workbook guarda en `mapTitle`, sólo cuando aporta algo distinto
 * del nombre oficial (p. ej. «Gran Buda de Kamakura (Kōtoku-in)» frente a «Kōtoku-in»).
 */
export function spanishAlias(place: Pick<Place, "name" | "mapTitle">): string | null {
  const alias = (place.mapTitle ?? "").trim();
  if (!alias) return null;
  // Un título de mapa que sólo acorta el nombre oficial no es un alias que valga la pena repetir.
  return normalizeText(place.name).includes(normalizeText(alias)) ? null : alias;
}

export function formatPrice(place: Place): string {
  const { min, max, currency } = place.price;
  if (min === 0 && max === 0) return "Gratis";
  if (min === max) return `${min.toLocaleString("es-MX")} ${currency}`;
  return `${min.toLocaleString("es-MX")}–${max.toLocaleString("es-MX")} ${currency}`;
}

/**
 * Briefs are composed as "Imagen ideal: <diferenciador>. <condiciones de la foto>". The card
 * already shows the differentiator under "Por qué vale la pena", so both the prefix and the
 * repeated sentence are dropped and only the photographic guidance is kept. Nothing is added:
 * if the brief carries no extra guidance, the full text is shown instead.
 */
export function imageBriefText(place: Pick<Place, "imageBrief" | "differentiator">): string {
  const brief = (place.imageBrief ?? "").trim().replace(/^imagen ideal:\s*/i, "");
  if (!brief) return "";

  const differentiator = (place.differentiator ?? "").trim().replace(/\.+$/, "");
  let text = brief;
  if (differentiator && normalizeText(brief).startsWith(normalizeText(differentiator))) {
    const remainder = brief.slice(differentiator.length).replace(/^[.\s]+/, "");
    if (remainder) text = remainder;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Category strings are stored with a leading emoji ("🏙️ Ciudad y barrios"). */
export function splitCategory(category: string): { icon: string; label: string } {
  const match = /^(\P{L}+)\s*(.*)$/u.exec(category.trim());
  if (match && match[2]) return { icon: match[1].trim(), label: match[2].trim() };
  return { icon: "", label: category.trim() };
}
