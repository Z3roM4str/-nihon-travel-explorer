import photographyMetadata from "../data/photography-metadata.json";

type Record = {
  placeId: string;
  source: string;
  sourceUrl: string;
  credit: string;
  license: string;
  licenseUrl: string;
  originalTitle: string;
  attributionTitle?: string;
};

const images = (photographyMetadata as { images: Record[] }).images;
const groups = [...new Map(images.map((image) => [`${image.source}\0${image.license}\0${image.licenseUrl}`, image])).values()]
  .map((sample) => ({ ...sample, images: images.filter((image) => image.source === sample.source && image.license === sample.license && image.licenseUrl === sample.licenseUrl) }))
  .sort((a, b) => a.license.localeCompare(b.license));

/** Vista escalable del mismo registro canónico que alimenta PlaceGallery/CreditsSheet. */
export function PhotographyLicenses() {
  return (
    <div className="photo-licenses">
      <p className="nosotros-section__text">
        {images.length} fotografías con autoría, obra, fuente y licencia conservadas individualmente.
        Las imágenes se redimensionan y convierten a WebP; la autoría y la licencia no cambian.
      </p>
      <ul className="photo-licenses__groups">
        {groups.map((group) => (
          <li key={`${group.source}-${group.license}`}>
            <details>
              <summary><strong>{group.license}</strong> · {group.images.length} fotografías · {group.source}</summary>
              <ul className="photo-licenses__items">
                {group.images.map((image) => (
                  <li key={`${image.placeId}-${image.sourceUrl}`}>
                    <span>{image.attributionTitle || image.originalTitle}</span>
                    {image.credit && <span> — {image.credit}</span>}{" "}
                    <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">Fuente<span className="visually-hidden"> — se abre en una pestaña nueva</span></a>
                    {image.licenseUrl && <> · <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">Licencia<span className="visually-hidden"> — se abre en una pestaña nueva</span></a></>}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
