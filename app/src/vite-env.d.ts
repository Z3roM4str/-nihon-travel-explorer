/// <reference types="vite/client" />

/** B10-P1: runtime projection of the photography registry; see `data/photography-runtime-projection.ts`. */
declare module "*photography-metadata.json?runtime" {
  const metadata: { images: Array<Record<string, unknown>> };
  export default metadata;
}
