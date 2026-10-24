MISIÓN B24 — Auditoría con input real y corrección de superficies construidas · Nihon
Eres el agente de ingeniería de UX/UI de Nihon. La autoridad de diseño es docs/design/ (00–10), normativa y congelada. No reinterpretas. Si falta una decisión: te detienes en ese punto, registras DESIGN DECISION REQUIRED (DDR-B24-n) con opciones y evidencia, y sigues con otro hallazgo.
== 0. REGLAS ABSOLUTAS ==

* Cero PR, cero merge.
* Push solo a claude/block-24-ux-real-input-audit.
* Nada de Astra: ni astra/*, ni experiment/astra-*, ni codex/*astra*, ni codex/implementar-sol-3-*. No se usa ni como referencia.
* Commits pequeños: uno por hallazgo o gate, en español.
* Push en cada checkpoint.
* No se rediseñan Quiero ir, Viaje ni Nosotros (son B7/B8/B9). Ahí solo se corrigen P0.
* No se elimina ninguna capacidad.
* VEDADO: app/src/components/OrderedSequenceBuilder.tsx.
* block20-place-detail.test.ts falla por diseño si cambia; su trabajo es de B9.
* Cualquier hallazgo ahí va a DEFERRED-ROADMAP(B9).

== 1. PREFLIGHT ==
BASE CANÓNICA B24:
origin/codex/block-22-b6-7-grade-a-depth-photography
SHA obligatorio:
4afbf50e9d1e3137f9148c6c471c1c40aac6a56f
Esta rama es descendiente directa de B21:
0390708df514215778a835b4e2328a85854c759d
y los commits entre B21 y esta base afectan exclusivamente fotografía, datos y scripts.
B23:
52a7073799bdeeb180949ef379275201a94879fe
y B6.5 timing fix:
af21671a99b63b451df11ac15c11775d94dc324e
son líneas paralelas protegidas y NO deben incorporarse, cherry-pickearse ni usarse como base.
La rama claude/block-24-ux-real-input-audit YA FUE CREADA en esta sesión desde:
4afbf50e9d1e3137f9148c6c471c1c40aac6a56f
Por tanto:

1. git fetch --all
2. Comprueba:

   * origin/main == 8eb725eeb836ca121180f8dd8b0dc49c65efae25
   * origin/codex/block-21-b5-explore-home-map == 0390708df514215778a835b4e2328a85854c759d
   * HEAD == 4afbf50e9d1e3137f9148c6c471c1c40aac6a56f
   * rama actual == claude/block-24-ux-real-input-audit
3. NO vuelvas a crear la rama.
4. Si HEAD o la base no coinciden, detente antes de modificar código.
5. Guarda ESTE PROMPT ÍNTEGRO como docs/BLOCK_24_MISSION.md en el primer commit.
6. Lee completos:

   * docs/design/00
   * docs/design/02
   * docs/design/03
   * docs/design/04
   * docs/design/05
   * docs/design/06 §5–6
   * docs/design/08
   * docs/design/09
   * docs/design/10
   * docs/CURRENT_WORK_HANDOFF.md

Línea base: regístrala en docs/BLOCK_24_HANDOFF.md:

* build PASS;
* lint: 0 errores, 1 warning heredado PlaceMap.tsx:14;
* vitest 3328/3329.

El fallo es un timeout conocido de block20-place-detail.test.ts (no modifica OrderedSequenceBuilder.tsx): git diff sobre un árbol grande tarda más de 5 s bajo carga.
Puedes dar a ESE test un timeout propio de 30 s, justificado, sin cambiar su expectativa.
Nada más en ese archivo.
== 2. ZONAS PROTEGIDAS ==
B6.7:

* photography-metadata.json (app/src/data y data/visual)
* place-images.ts
* app/public/images/**
* scripts de adquisición y derivados
* cómo se importan esos datos

B23 (52a7073):

* PlaceCard.tsx
* PlaceGallery.tsx
* sus tests
* retry
* photoAttempt
* keys/remount
* reglas .place-card__photo-retry*
* reglas .place-card__save* de styles/discovery.css

Nota: B23 también añade reglas .gallery__retry en App.css. No modifiques esas reglas. El resto de App.css puede tocarse cuando B24 lo requiera.
B6.5-fix (af21671):

* block22-b6-5-*.mjs
* sus helpers
* sus tests

Si un arreglo exige tocar una zona protegida:
DEFERRED — ACTIVE BRANCH CONFLICT
Incluye el diff propuesto en el informe, sin aplicarlo.
Ya se sabe que caen aquí:

* el corazón de PlaceCard de 40×40 (menor que --tap-min);
* el chip Hidden gem de PlaceCard.tsx:84;
* dividir el import de photography-metadata para aligerar el bundle.

== 3. HALLAZGOS CONFIRMADOS POR DIRECCIÓN ==
Reprodúcelos primero, cúbrelos con el gate en rojo y después corrige.
P0-1 — Portada Explorar sin desplazamiento
La portada de Explorar no se desplaza, ni con rueda ni con toque, a 390 ni a 1440.
Causa observada:
.app__body { overflow:hidden }
explorer-home tiene aproximadamente 3007 px dentro de 732 px y ningún ancestro con scroll.
Quedan fuera de alcance:

* Okinawa
* Más destinos
* colecciones
* Ver Japón en el mapa

Criterios:

* desplazable en todos los viewports;
* el buscador sigue fijo arriba (05 §2 pt.2);
* no se rompe la regla de montaje de Leaflet (App.css aproximadamente línea 840);
* no se rompe la restauración de scroll de B18/B21.

P0-2 — Iconos .icon-button--small invisibles
El ::before (absolute, fondo surface) se pinta encima del SVG.
Afecta:

* Quiero ir
* Viaje
* cabeceras de día

Arréglalo en App.css con isolation + z-index, sin cambiar la geometría de 44 px.
P0-3 — Contador de tarjetas de ciudad ilegible
Texto blanco sobre píldora clara.
Aplica D-M1.
P0-4 — Mapa de ciudad
No cumple 03 §9:

* más de 12 marcadores visibles sin agrupación;
* marcadores con área táctil insuficiente.

Implementa la agrupación exactamente como la describe 03 §9.
Área de impacto:

* mínimo 44 px;
* sin solapes ambiguos;
* cumplir Art. 11.

Los tamaños visibles se quedan como están porque ya cumplen 03 §9.
El encuadre inicial, hoy ajustado a lugares periféricos como Okutama, Takao e Izu, es DDR-B24.
NO decidas tú.
Propón opciones y aporta capturas.
P0-5 — Búsqueda global
Las filas miden 32 px más que la pantalla y su tercer control queda fuera del viewport.
Aplica D-M6.
P1:
FilterSheet:

* sobra el desplegable ▾ Filtros porque no está en 04 §13;
* el contenido asoma bajo el pie fijo;
* etiquetas en MAYÚSCULAS (03 §2.3);
* glifos ▾ ▸.

Onboarding:

* eyebrow PASO 1 DE 3 (03 §2.3);
* dice zona donde debe decir ciudad.

Toast Guardado en Quiero ir:

* aplica D-M4.

Mismo cluster visible (lib/transfer.ts):

* aplica D-M4.

Foco a <body> al cerrar la ficha con Escape:

* debe volver al control que abrió la ficha.

Hero de la ficha a 820 px:

* aplica D-M3.

Más destinos:

* texto cortado: 1 lugar por ahor.

Contenedores anidados de la portada:

* verifica contra 05 §2.
* Si la especificación no prescribe el panel interior, retíralo.
* Si lo prescribe, repórtalo y no lo toques.

P2 — solo en catálogo salvo que sea trivial y esté dentro del alcance:

* carruseles sin salto de teclado: aproximadamente 64 paradas cada uno;
* colecciones que empiezan todas por Tokio;
* foto de Tokio repetida como primer Imprescindible;
* bundle principal de aproximadamente 1,63 MB: mídelo y aplázalo;
* estado vacío de Viaje con instrucción falsa: DEFERRED-ROADMAP(B9).

== 4. DECISIONES DE DIRECCIÓN ==
Regístralas en docs/design/09 como DD nuevas.
D-M1 — Contador de ciudad
Sin píldora.
57 lugares va en --type-num directamente sobre el scrim.
El scrim debe cumplir su contrato:

* opacidad efectiva >= 0,60 en toda la banda de texto.

D-M3 — Foto de la ficha
Por debajo de md:

* proporción 4:5;
* altura máxima 60svh;
* object-fit: cover.

Desde md:

* sigue 04 §6;
* 4:3 en panel.

D-M4 — Léxico

* Mismo cluster → Misma zona solo en presentación; dataset intacto.
* Toast al marcar:
"{lugar} está en Quiero ir"
* Toast al desmarcar:
"{lugar} ya no está en Quiero ir"

D-M5 — Iconos
Los glifos de texto que hacen de icono (▾, ▸, ↓) en cromo y hojas se sustituyen por el set de:
app/src/icons
Fuera de las zonas vedadas.
D-M6 — Resultados de búsqueda

* filas nunca más anchas que la hoja;
* metadato:
"{categoría} · {barrio}, {ciudad}"
* un solo · (03 §2.3);
* contador vivo en la cabecera:
"14 lugares"

== 5. METODOLOGÍA DE INPUT REAL — OBLIGATORIA ==
Viewports:

* 320×568
* 375×667
* 390×844
* 430×932
* 820×1180
* 1024×768
* 1280×800
* 1440×900

Scroll:
Usa page.mouse.wheel sobre la superficie.
IMPORTANTE:
En Chromium headless, CDP synthesizeScrollGesture NO desplaza contenedores reales.
No lo uses como evidencia.
PROHIBIDO:

* asignar scrollTop;
* usar el autoscroll de locator.click() como prueba de que algo es alcanzable.

Además:
Auditoría estática por superficie:

* el ancestro más cercano con overflow-y: auto o scroll debe existir;
* debe contener todo el contenido.

Clics:

* usa page.mouse en coordenadas;
* antes comprueba con elementFromPoint que el impacto cae en el control;
* comprueba que el control está dentro del viewport.

Iconos:

* muestreo de píxeles del bbox del SVG;
* confirmar contraste con el fondo.

Teclado:

* Tab / Shift+Tab por pantalla;
* foco visible;
* trap en hojas;
* retorno de foco al cerrar;
* Escape;
* aria-current en pestañas.

Revisa también:

* prefers-reduced-motion.

Gate permanente:
app/scripts/b24-real-input-audit.mjs
Debe:

1. escribirse primero;
2. reproducir P0-1..5;
3. quedar en rojo antes de los fixes;
4. quedar en verde después.

Capturas:

* /tmp
* NO se commitean en el repo.

Deja escrito explícitamente que:

* la verificación final del scroll táctil real;
* y el teclado de iOS

requieren un iPhone real y quedan pendientes de validación humana.
== 6. FASES Y CHECKPOINTS ==
F1 — Preflight

* verificar rama/base;
* guardar BLOCK_24_MISSION.md;
* crear/actualizar BLOCK_24_HANDOFF.md;
* gate B24 en rojo.

→ CHECKPOINT A
→ commit
→ push
F2 — Auditoría
Crear:
docs/BLOCK_24_UX_AUDIT.md
Una entrada por hallazgo con:

* id
* superficie
* viewport
* severidad
* evidencia
* documento y sección
* estado, uno de:

   * FIX-NOW
   * DDR
   * DEFERRED-ROADMAP(Bn)
   * DEFERRED-ACTIVE-BRANCH

→ CHECKPOINT B
→ commit
→ push
F3 — P0
Corregir todos los P0 que sean FIX-NOW.
Los DDR se documentan y no se deciden.
Los conflictos con ramas activas se aplazan.
→ CHECKPOINT C
→ commits pequeños
→ push
F4 — P1
Corregir P1 FIX-NOW.
No rediseñar B7/B8/B9.
→ CHECKPOINT D
→ commits pequeños
→ push
F5 — Regresión
Ejecuta y documenta:

* build
* lint
* vitest
* gates B17
* B18
* B19
* B20
* B21
* DDR-03
* Block 1 UX
* Block 2 Photography
* Phase 5A
* B21 global search
* B24 real input audit

Toda expectativa de test que cambie debe citar:

* documento;
* sección normativa.

→ CHECKPOINT E
→ commit si procede
→ push
F6 — Handoff
docs/BLOCK_24_HANDOFF.md debe ser reanudable e incluir:

* SHA de cada checkpoint;
* commits;
* archivos tocados;
* pruebas;
* gates;
* DDR pendientes;
* DEFERRED;
* validaciones humanas pendientes;
* siguiente acción exacta.

Añade una sección nueva ARRIBA de:
docs/CURRENT_WORK_HANDOFF.md
No borres ni reescribas el historial anterior.
== 7. INFORME FINAL EN EL CHAT ==
Entrega:

* SHA base;
* SHA final;
* lista de commits;
* tabla de hallazgos por estado;
* DDR con opciones y capturas;
* DEFERRED con motivo;
* números exactos de tests;
* gates ejecutados y resultado;
* lista explícita de lo que no se pudo verificar.

No abras PR.
No hagas merge.
No empieces B25.
No cambies de rama.
No incorpores B23 ni B6.5.
No te detengas entre checkpoints salvo:

* condición de parada explícita;
* conflicto de base;
* DESIGN DECISION REQUIRED que impida únicamente ese hallazgo.

Si aparece un DDR, documenta el DDR y continúa con el resto del bloque.
Empieza ahora desde el estado actual de claude/block-24-ux-real-input-audit.
