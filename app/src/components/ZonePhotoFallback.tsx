import { Icon } from "../icons/Icon";

import "./ZonePhotoFallback.css";
/**
 * A zone is not a place, and the current licensed photo registry has no zone records.
 * Keep the media slot intentional until B6.7 supplies a photograph whose subject is this zone;
 * never borrow a nearby POI image or make the editorial text look like photographic evidence.
 */
export function ZonePhotoFallback({ zoneName }: { zoneName: string }) {
  return (
    <div
      className="zone-photo-fallback"
      role="img"
      aria-label={`Fotografía pendiente de ${zoneName}`}
    >
      <Icon name="cama" size={32} />
      <span className="zone-photo-fallback__name">{zoneName}</span>
      <span className="zone-photo-fallback__label">Fotografía pendiente</span>
    </div>
  );
}
