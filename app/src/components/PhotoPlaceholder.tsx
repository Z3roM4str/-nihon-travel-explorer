import type { Place } from "../types";
import { imageBriefText } from "../lib/place";
import { categoryPresentation } from "../lib/category-presentation";
import { Icon } from "../icons/Icon";
import { EvidenceMark } from "./EvidenceMark";

type Props = {
  place: Pick<Place, "name" | "category" | "imageBrief" | "differentiator">;
  /** `"missing"` (por defecto): el lugar nunca tuvo fotografía. `"error"`: la tenía, pero la
   * carga falló — `06 §6.4` pide un texto distinto («No se pudo cargar la imagen») en vez del
   * icono de imagen rota del navegador. Mismo componente en los dos casos (`04 §9`): un lugar
   * sin fotografía no puede parecer un error, y un error de carga no puede parecer un hueco. */
  variant?: "missing" | "error";
};

/**
 * Bloque 19 (B3) — `PhotoPlaceholder` (`04 §9`, `06 §5.4`/`§6.4`).
 *
 * Sustituye al recuadro con emoji/al icono de imagen rota del navegador. Debe leerse como una
 * decisión editorial deliberada, no como un hueco: fondo `--surface-sunken` con una trama
 * diagonal sutil, el icono de categoría, el nombre del lugar, y el `imageBrief` editorial que ya
 * existe en el dataset — nunca una fotografía de otro lugar ni un color plano genérico.
 */
export function PhotoPlaceholder({ place, variant = "missing" }: Props) {
  const { icon } = categoryPresentation(place.category);
  const brief = imageBriefText(place);
  const pendingLabel = variant === "error" ? "No se pudo cargar la imagen" : "Fotografía pendiente";

  return (
    <div className="photo-placeholder" role="img" aria-label={`${place.name}. ${pendingLabel}.`}>
      <span className="photo-placeholder__icon" aria-hidden="true">
        <Icon name={icon} size={32} />
      </span>
      <p className="photo-placeholder__name">{place.name}</p>
      {brief && (
        <p className="photo-placeholder__brief">
          <EvidenceMark level="nihon" label={false} /> {brief}
        </p>
      )}
      <p className="photo-placeholder__pending">{pendingLabel}</p>
    </div>
  );
}
