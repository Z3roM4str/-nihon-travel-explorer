#!/usr/bin/env bash
# P-06 v2 — certificación reproducible por navegador.
#   scripts/p06-v2-certify.sh chromium            # usa NIHON_CHROMIUM_PATH (o el Chromium de Playwright)
#   scripts/p06-v2-certify.sh webkit              # exige un WebKit de Playwright instalado (`npx playwright install webkit`, fuera de este repo/entorno)
# Falla al instante, sin declarar nada, si el navegador pedido no arranca. Ejecutar desde `app/` tras `npm ci && npm run build`.
set -u
browser="${1:-chromium}"
cd "$(dirname "$0")/.."
export NIHON_BROWSER="$browser"
if [ "$browser" = "webkit" ]; then
  node -e 'import("playwright").then(async({webkit})=>{const b=await webkit.launch();console.log("WebKit",b.version());await b.close()})' \
    || { echo "BLOQUEADO: WebKit no arranca; no se certifica nada."; exit 2; }
fi
fail=0
# Gates con soporte NIHON_BROWSER (arrancan su propio `vite preview`).
for g in p06-v2-list-invariant-check p06-v2-history-check p06-v2-journeys-check \
         b30-where-to-sleep-check b31-reservas-resumen-check b10-microcopy-check b10-motion-check \
         d0b-design-system-hygiene-check d5-normative-vocabulary-check p04-national-map-reachability-check; do
  echo "== $g ($browser)"
  node "scripts/$g.mjs" || { echo "FAIL $g"; fail=1; }
done
# Gates escritos sólo para Chromium (B27–B29, Phase 3F…): no se ejecutan en WebKit; se listan para que no se den por cubiertos.
if [ "$browser" = "chromium" ]; then
  for g in b27-viaje-dias-check b29-day-order-tools-check phase5a-rc-browser-audit; do
    echo "== $g (chromium)"; node "scripts/$g.mjs" || { echo "FAIL $g"; fail=1; }
  done
else
  echo "NOTA: b27/b28/b29/phase5a/phase3f/block4/block6 son Chromium-only: sin evidencia en WebKit."
fi
exit $fail
