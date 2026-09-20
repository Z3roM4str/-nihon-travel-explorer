/**
 * Bloque 18 — el texto de atribución MLIT, exportado una vez para que la ⓘ del mapa
 * (`NationalExplorer`) y «Nosotros › Fuentes y licencias» (`App.tsx`) muestren exactamente el
 * mismo texto íntegro (Art. 4), sin dos copias que puedan divergir.
 *
 * El propio párrafo no cambia respecto a `v1.1.0`: sólo deja de ocupar espacio permanente bajo
 * el mapa (defecto D5/D11, `05 §3`) y pasa a vivir detrás de un `ⓘ` y en Nosotros.
 */
export function MlitAttribution({ className = "national__attribution" }: { className?: string }) {
  return (
    <p className={className}>
      Geometría derivada del{" "}
      <a
        href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span lang="ja">国土数値情報 行政区域データ</span> (N03, 2026)
        <span className="visually-hidden"> — se abre en una pestaña nueva</span>
      </a>{" "}
      del <span lang="ja">国土交通省</span> / MLIT. Versión simplificada creada por Nihon; no es un
      producto oficial de MLIT.
    </p>
  );
}
