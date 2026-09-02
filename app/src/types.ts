/**
 * A licensed photograph of a place. `url` may be a local asset under `public/` or a remote URL
 * that is cleared for use; `credit`, `source` and `license` carry the attribution the source
 * requires and are rendered with the image when present.
 */
export type PlaceImage = {
  url: string;
  alt: string;
  credit?: string;
  source?: string;
  sourceUrl?: string;
  license?: string;
};

export type Place = {
  id: string;
  hub: string;
  region: string;
  prefecture: string;
  municipality: string;
  neighborhood: string;
  cluster: string;
  name: string;
  japaneseName?: string;
  mapTitle: string;
  category: string;
  type: string;
  grade: string;
  description: string;
  differentiator: string;
  experience: string;
  duration: {
    raw: string;
    minMinutes?: number;
    maxMinutes?: number;
    planningBlock?: string;
    variability?: string;
  };
  bestTime: string;
  bestSeason: string;
  crowdLevel: string;
  tourismLevel: string;
  price: {
    currency: string;
    min: number;
    max: number;
    mxnMin?: number;
    mxnMax?: number;
  };
  reservation: {
    required: boolean;
    leadTime: string;
    raw: string;
  };
  schedule: {
    hours: string;
    closures: string;
  };
  transport: string;
  accessibility: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  officialUrl: string;
  googleMapsUrl: string;
  imageBrief: string;
  imageStatus: string;
  /** Present only once the export pipeline carries licensed assets; see `data/place-images.ts`. */
  images?: PlaceImage[];
  nearbyIds: string[];
  hiddenGemStatus?: string;
  alternativeTo?: string | null;
  updatedAt: string;
  febMar2027: {
    status: string;
    warning: string;
    action: string;
  };
};

export type NearbyRelation = {
  "Desde ID": string;
  "Hacia ID": string;
  "Desde": string;
  "Hacia": string;
  "Distancia km": number;
  "Min aprox.": number;
  "Modo": string;
  "Relación": string;
  "Nota": string;
};

export type Filters = {
  query: string;
  categories: string[];
  grades: string[];
  hiddenGemStatuses: string[];
  tourismLevels: string[];
  reservation: "all" | "required" | "not-required";
};
