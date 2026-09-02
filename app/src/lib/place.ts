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

export type AlertSeverity = "confirmed" | "risk" | "pending";

/**
 * Maps the editorial February–March 2027 status onto a visual severity. The status text itself
 * is always displayed verbatim; this only decides how loudly the card presents it.
 */
export function alertSeverity(status: string): AlertSeverity {
  const normalized = normalizeText(status);
  if (/riesgo|cerrad|cierre|cupo|loteria|venta futura/.test(normalized)) return "risk";
  if (/confirmad/.test(normalized) && !/pendiente/.test(normalized)) return "confirmed";
  return "pending";
}

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  confirmed: "Confirmado",
  risk: "Requiere atención",
  pending: "Por confirmar",
};

export function severityLabel(severity: AlertSeverity): string {
  return SEVERITY_LABEL[severity];
}

/** True for the statuses the dataset uses to flag genuinely uncommon places. */
export function isHiddenGem(place: Place): boolean {
  const status = normalizeText(place.hiddenGemStatus ?? "");
  return status.includes("hidden") || status.includes("alternativa menos saturada");
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
export function imageBriefText(place: Place): string {
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
