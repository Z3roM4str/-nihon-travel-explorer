import type { PlaceImage } from "../types";
import { describePhotographyProcessing, hasAttribution } from "../lib/photography-attribution";
import { Sheet } from "./Sheet";

/**
 * Bloque 20 (B4) — `CreditsSheet` (`04 §7`).
 *
 * La casa definitiva de la atribución fotográfica. Hasta este bloque, los seis campos se
 * renderizaban como un párrafo dentro del flujo de lectura, justo entre la fotografía y el
 * nombre del lugar: es el defecto D2, y `08` lo prohíbe sin matices («mostrar créditos
 * fotográficos dentro del flujo de lectura»).
 *
 * **Nada se pierde, sólo cambia de sitio** (`04 §7`: «toda la información de atribución actual
 * se conserva íntegra»). Los seis campos —fuente y su enlace, autoría, licencia y su enlace,
 * título del archivo original, título de atribución y nota de reprocesado— siguen aquí, ahora
 * etiquetados uno a uno en vez de encadenados con `·`, y por cada imagen de la galería en vez
 * de sólo por la que estuviera visible. La hoja muestra más información que el párrafo que
 * sustituye, no menos.
 *
 * Las dos etiquetas que ya eran visibles («Archivo de Commons», «Título de atribución») se
 * conservan con su redacción exacta de v1.1.0.
 */

type Props = {
  placeName: string;
  images: readonly PlaceImage[];
  onClose: () => void;
  /** `04 §7`: «Al pie: enlace a "Fuentes y licencias" en Nosotros». Sin manejador no se
   * renderiza el pie — nunca un enlace que no lleva a ninguna parte (`08` prohibición 8). */
  onOpenSources?: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="credits-sheet__field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Enlace externo cuando la fuente registró una URI; texto plano cuando no. Nunca un enlace
 * inventado hacia un destino que el dataset no afirma. */
function MaybeLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function CreditsSheet({ placeName, images, onClose, onOpenSources }: Props) {
  const credited = images.filter(hasAttribution);

  return (
    <Sheet title={`Fotografía de ${placeName}`} onClose={onClose} labelledBy="credits-sheet-title">
      <ul className="credits-sheet__list">
        {credited.map((image, index) => {
          const processing = describePhotographyProcessing(image.processing);
          return (
            <li key={image.url} className="credits-sheet__item">
              {credited.length > 1 && (
                <p className="credits-sheet__image-label">
                  Imagen {index + 1} de {credited.length}
                </p>
              )}
              <dl className="credits-sheet__fields">
                {image.source && (
                  <Field label="Fuente">
                    <MaybeLink href={image.sourceUrl}>{image.source}</MaybeLink>
                  </Field>
                )}
                {image.credit && <Field label="Autoría">{image.credit}</Field>}
                {image.license && (
                  <Field label="Licencia">
                    <MaybeLink href={image.licenseUrl}>{image.license}</MaybeLink>
                  </Field>
                )}
                {image.sourceFileTitle && (
                  <Field label="Archivo de Commons">{image.sourceFileTitle}</Field>
                )}
                {image.attributionTitle && (
                  <Field label="Título de atribución">{image.attributionTitle}</Field>
                )}
                {processing && <Field label="Reprocesado">{processing}</Field>}
              </dl>
            </li>
          );
        })}
      </ul>

      {onOpenSources && (
        <p className="credits-sheet__foot">
          <button type="button" className="link-button" onClick={onOpenSources}>
            Fuentes y licencias
          </button>
        </p>
      )}
    </Sheet>
  );
}
