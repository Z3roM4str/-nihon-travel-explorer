/**
 * Bloque 19 (B3) — `EvidenceMark` (`04 §2`, `03 §1.4`).
 *
 * Implementa la gramática de evidencia sin color: cuatro glifos, forma y peso, nunca matiz —
 * así la honestidad de Nihon se lee igual en escala de grises. `PhotoPlaceholder` (`04 §9`) es
 * el primer componente que lo necesita, de ahí que nazca en este bloque en vez de en uno
 * posterior; no migra nada de `PlaceDetail` (eso sigue siendo B4).
 */

export type EvidenceLevel = "verificado" | "registrado" | "estimado" | "nihon";

type LevelInfo = { glyph: string; label: string };

const LEVELS: Record<EvidenceLevel, LevelInfo> = {
  verificado: { glyph: "◼", label: "Verificado" },
  registrado: { glyph: "◧", label: "Registrado" },
  estimado: { glyph: "◇", label: "Estimado" },
  nihon: { glyph: "✎", label: "Nihon dice" },
};

type Props = {
  level: EvidenceLevel;
  /** p. ej. «consultado en 2026-09» — se añade tras la etiqueta, nunca sustituye al glifo. */
  detail?: string;
  /** Por defecto visible (`true`): el texto se pinta junto al glifo. En `false`, el mismo texto
   * pasa a `aria-label`/`title` y sólo se ve el glifo — nunca desaparece de la información
   * accesible, sólo del trazo visual. */
  label?: boolean;
};

export function EvidenceMark({ level, detail, label = true }: Props) {
  const info = LEVELS[level];
  const text = detail ? `${info.label} · ${detail}` : info.label;

  if (!label) {
    return (
      <span className="evidence-mark evidence-mark--glyph-only" aria-label={text} title={text}>
        <span aria-hidden="true">{info.glyph}</span>
      </span>
    );
  }

  return (
    <span className="evidence-mark">
      <span aria-hidden="true">{info.glyph}</span> {text}
    </span>
  );
}
