import { useMemo } from "react";
import { MlitAttribution } from "./MlitAttribution";
import { getAllPlaces } from "../data/store";
import { placeImages } from "../data/place-images";
import { getNationalSummary } from "../data/geography";
import { summarizePhotography } from "../lib/sources-summary";
import { APP_VERSION } from "../lib/app-version";
import sourcesData from "../../../data/sources.json";

import "./SourcesAndLicences.css";
/**
 * B26 (`05 §11` «Fuentes y licencias») — la casa definitiva de la atribución del producto.
 *
 * Nada de esto se inventa: los conteos salen del catálogo, las licencias y sus enlaces de lo que
 * cada imagen registra, y las fuentes de datos con su fecha de consulta de `data/sources.json`
 * (`Consultada` es la fecha en que se consultó la fuente; **no** es el `updatedAt` de ningún
 * lugar y no se presenta como tal). El texto MLIT es el mismo componente que usa la ⓘ del
 * mapa: una sola copia, íntegra.
 */

type SourceRecord = {
  "Fuente ID": string;
  Nombre: string;
  Tipo: string;
  Cobertura: string;
  URL: string;
  Consultada: string;
};

const SOURCES = sourcesData as SourceRecord[];

export function SourcesAndLicences() {
  const summary = useMemo(() => getNationalSummary(), []);
  const placeCount = useMemo(() => getAllPlaces().length, []);
  const photos = useMemo(() => summarizePhotography(placeImages), []);

  return (
    <div className="sources">
      <h3 className="sources__heading">Datos</h3>
      <p className="nosotros-section__text">
        {placeCount} lugares · {summary.coveredPrefectureCount} de {summary.prefectureCount}{" "}
        prefecturas con lugares verificados. Los datos viajan dentro de la aplicación
        {APP_VERSION ? ` (versión ${APP_VERSION})` : ""}: no se descargan ni se actualizan por
        separado.
      </p>

      <h3 className="sources__heading">Mapa</h3>
      <MlitAttribution className="nosotros-section__text" />

      <h3 className="sources__heading">Fotografía</h3>
      <p className="nosotros-section__text">
        {photos.imageCount} fotografías de {photos.placeCount} lugares
        {photos.sources.length > 0 ? `, procedentes de ${photos.sources.join(" y ")}` : ""}. Cada
        una conserva su autoría, su archivo original y su licencia en los créditos de la ficha del
        lugar.
      </p>
      <ul className="sources__licenses">
        {photos.licenses.map((group) => (
          <li key={group.license} className="sources__license">
            {group.licenseUrl ? (
              <a href={group.licenseUrl} target="_blank" rel="noopener noreferrer">
                {group.license}
                <span className="visually-hidden"> — se abre en una pestaña nueva</span>
              </a>
            ) : (
              <span>{group.license}</span>
            )}
            <span className="sources__license-count">
              {group.imageCount} {group.imageCount === 1 ? "fotografía" : "fotografías"}
            </span>
          </li>
        ))}
      </ul>
      {photos.withoutLicenseCount > 0 && (
        <p className="nosotros-section__text">
          {photos.withoutLicenseCount} fotografías no registran licencia en el catálogo.
        </p>
      )}

      <h3 className="sources__heading">Fuentes de los datos</h3>
      <ul className="sources__list">
        {SOURCES.map((source) => (
          <li key={source["Fuente ID"]} className="sources__item">
            <a href={source.URL} target="_blank" rel="noopener noreferrer">
              {source.Nombre}
              <span className="visually-hidden"> — se abre en una pestaña nueva</span>
            </a>
            <span className="sources__meta">
              {source.Tipo} · {source.Cobertura} · Consultada el {source.Consultada}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
