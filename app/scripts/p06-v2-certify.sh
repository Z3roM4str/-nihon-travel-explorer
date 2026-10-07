#!/usr/bin/env bash
# P-06 v2 — certificación reproducible por navegador.
#   scripts/p06-v2-certify.sh chromium   # usa NIHON_CHROMIUM_PATH (o el Chromium de Playwright)
#   scripts/p06-v2-certify.sh webkit     # exige el WebKit de Playwright (`npx playwright install --with-deps webkit`, sólo donde esté permitido)
# Variables: P06_LOG_DIR (por defecto `p06-certify-logs/<navegador>`): un log por gate + `summary.txt` + capturas en `shots/`.
# No declara nada si el navegador no arranca (código 2). Ejecutar desde `app/` tras `npm ci && npm run build`.
set -u
browser="${1:-chromium}"
cd "$(dirname "$0")/.."
export NIHON_BROWSER="$browser"
logs="${P06_LOG_DIR:-p06-certify-logs/$browser}"
mkdir -p "$logs/shots"
export NIHON_EVIDENCE_OUT="$logs"
: > "$logs/summary.txt"
echo "sha=$(git rev-parse HEAD 2>/dev/null || echo unknown) browser=$browser node=$(node -v)" | tee -a "$logs/summary.txt"
if [ "$browser" = "webkit" ]; then
  node -e 'import("playwright").then(async({webkit})=>{const b=await webkit.launch();console.log("WebKit",b.version());await b.close()})' 2>&1 | tee -a "$logs/summary.txt" \
    && [ "${PIPESTATUS[0]}" = "0" ] || { echo "BLOQUEADO: WebKit no arranca; no se certifica nada." | tee -a "$logs/summary.txt"; exit 2; }
fi
fail=0
run() { # run <gate>
  local g="$1"
  echo "== $g ($browser)"
  node "scripts/$g.mjs" > "$logs/$g.log" 2>&1
  local rc=$?
  if [ "$rc" = "0" ]; then tail -n 3 "$logs/$g.log"; else tail -n 40 "$logs/$g.log"; fi
  echo "$g rc=$rc :: $(grep -v '^\s*$' "$logs/$g.log" | tail -n 1 | cut -c1-200)" >> "$logs/summary.txt"
  [ "$rc" = "0" ] || { echo "FAIL $g"; fail=1; }
}
# Gates P-06 v2 y los de Viaje que admiten NIHON_BROWSER.
for g in p06-v2-list-invariant-check p06-v2-history-check p06-v2-journeys-check p06-v2-clip-check \
         b27-viaje-dias-check b29-day-order-tools-check \
         b30-where-to-sleep-check b31-reservas-resumen-check b10-microcopy-check b10-motion-check \
         d0b-design-system-hygiene-check d5-normative-vocabulary-check p04-national-map-reachability-check \
         final-audit-data-recovery-check final-audit-a11y-check \
         final-audit-stale-tabs-check final-audit-export-protection-check \
         final-audit-persistence-regressions-check; do
  run "$g"
done
# B29 ejecuta B28 dentro (arrastre con ratón, auto-scroll, movimiento reducido, 8 viewports).
if [ "$browser" = "chromium" ]; then
  run phase5a-rc-browser-audit
else
  echo "NOTA: phase5a/phase3f/block4/block6 son Chromium-only: sin evidencia en WebKit." | tee -a "$logs/summary.txt"
fi
# Capturas (390×844 y 1440×900) del código exacto probado.
NIHON_P06_SHOTS="$logs/shots" NIHON_P06_LABEL="$browser" node scripts/p06-days-capture.mjs > "$logs/capture.log" 2>&1 \
  && echo "capture rc=0" >> "$logs/summary.txt" || { echo "capture FAIL" | tee -a "$logs/summary.txt"; fail=1; }
echo "RESULT fail=$fail" | tee -a "$logs/summary.txt"
exit $fail
