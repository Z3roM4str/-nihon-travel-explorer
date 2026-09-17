# TRACK: ASTRA — Nihon Design Authority v1

MODEL ROLE: ASTRA DIRECTOR

Status: **implementation specification ready; rendered visual certification pending**.
Base: `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81`. Date: 2026-09-17.
Applies only to `experiment/astra-redesign`, never the independent Claude experiment.

## DA-00 Authority and scope

This document owns Astra product presentation and interaction. `SOL_IMPLEMENTATION_PLAN.md` owns sequencing. `ASTRA_AUDIT_CHECKLIST.md` owns acceptance. `reference/` demonstrates a deliberately small subset, not a replacement app. Written rules win where the reference omits a surface. Log any contradiction; do not silently choose a new design.

Existing data, temporal, logistics, persistence and photography contracts remain authoritative for factual meaning. A new visual label cannot weaken them. Read current imports, not merely an older document's schema example. In particular, runtime planning is V7. No dataset edits, new hotels, factual area recommendations, backend or mass photography in this phase.

The user's new objective supersedes the historical *product goal* of stopping photography at v1, but does not establish that rejected assets are safe. The sixteen fail-closed places stay closed until new admissible evidence satisfies a documented re-entry review. Full coverage is a target, never an excuse to fabricate a photo or erase licensing constraints.

## DA-01 Product principles

1. Discover before schedule. No dates, hotel, profile or account required to browse.
2. Every card explains a possible experience and offers “Quiero ir”.
3. Saving IS expressing interest; do not introduce a second bookmark button.
4. Editorial recommendation, personal interest and trip inclusion are distinct axes.
5. Depth is available by disclosure, not removed. Action-relevant caveats remain visible.
6. “Not reviewed”, “no”, and “discarded for this trip” are different states.
7. The product never invents a partner's preference or a live availability result.
8. Preserve authored plans when exploring, switching profiles or changing filters.
9. Warm photographic travel journal: calm ivory, ink typography, restrained persimmon accent, generous image area. No map dashboard as the default, no ornamental Japanese stereotypes, no gamified swiping deck.

## DA-02 Information architecture and URLs

Primary navigation has **two destinations**, same labels and order on all devices:

| Destination | Contents | Entry |
|---|---|---|
| Explorar | Global discovery, hub exploration, list/map, region/prefecture browser, place detail | Default |
| Nuestro viaje | Interest comparison and shortlist; secondary Planificar and Dónde alojarnos | Always reachable; badge counts unique interested or legacy-pending places, not vote count |

Top-right person control reads `Fernando ▾`, `Ella ▾`, or initially `Mis gustos ▾`. It chooses the active local reviewer; it is not authentication. Changing it never silently changes the other person's choices. No avatar photograph is invented.

Use hash-based URLs for static-host compatibility unless an existing host provides verified rewrites. Contract examples: `#/explorar`, `#/explorar?hub=Tokio&mode=mapa`, `#/lugar/JP-002`, `#/viaje?view=ambos`, `#/viaje/planificar`, `#/viaje/alojamiento`. Encode query/category/filter selections with stable values and validate unknown values. No personal votes in URL. Detail entry stores the originating exploration state in navigation history; direct link close falls back to Explorar. Browser Back first closes the top overlay; returns from nearby details in order; never exits the app when a local overlay has a back state. Forward restores that state. Scroll restoration keyed by surface + filters + hub, not by page title.

Map/list are **modes of Explorar**, not extra bottom tabs. Regions are a secondary entry under the hub selector (“Explorar por región”); all nine regions and 47 prefectures retain coverage labels and local geometry/attribution. Do not hide uncovered regions or imply unresearched equals uninteresting. Canonical hub filters use hub membership; geographic navigation uses physical prefecture. JP-149 must not be moved to make these appear identical.

## DA-03 Responsive geometry

Breakpoints: mobile `<768px`; tablet `768–1199px`; desktop `>=1200px`. Test at 375×812, 390×844, 430×932, 768×1024, 1024×768 and 1440×900. Also reflow at 320 CSS px / 200% zoom. Values below are defaults at normal text scale; content may grow vertically.

| Surface | Mobile | Tablet | Desktop |
|---|---|---|---|
| Shell | 56px header; bottom two-tab bar 64px + safe area; 16px side margins | 64px header with two destinations; 24px margins; no bottom bar | 72px header, two destinations; centered max-width 1280px, 40px minimum margins |
| Discovery | One card column, 16px gaps; header then intro/search/filters/results | Two columns, 24px gaps | Three columns, 24px gaps; no fourth skinny column |
| Hub | Same discovery shell; hub subtitle + clear back to all Japan | Same; category controls wrap | Same; compact 2-line intro, not an enormous hero |
| Map | Replaces result grid; viewport height minus shell and 112px controls; preview max 35dvh | Full map with 320px preview panel; list toggle remains | 420px scrollable result column + flexible map; no simultaneous third detail column |
| Detail | Fullscreen modal route, 100dvh; gallery 4:3; sticky 72px action footer + safe area | Centered 680px max-width dialog, max-height calc(100dvh - 48px), internal scroll | Centered 1040px max-width dialog; 52% gallery / 48% content; max-height calc(100dvh - 64px) |
| Advanced filters | Full-height sheet, fixed header/footer; internal scroll | Centered 560px modal | Centered 640px modal; two-column category options, single-column groups |
| Nuestro viaje | Counts wrap in 2 columns; segmented filters scroll; single column cards | Two card columns; summary full width | Three card columns; summary and controls above |
| Lodging compare | Up to 3 areas; sticky criterion label + horizontal table scroll, explicit position | 2–3 columns; sticky heading | 3 columns max, readable criteria rail |
| Planner | Full route page with internal steps; controls wrap | Full route page | Full route page; reuse existing domain functionality |

Normal discovery uses page scrolling, not nested card scroll areas. Header can be sticky; intro and search scroll away. Only the compact result toolbar becomes sticky below header after reaching it. No stacked sticky blocks hiding half the mobile viewport. Bottom padding must include bottom navigation height + safe area. Mobile detail hides the bottom navigation and makes the background inert.

## DA-04 Visual tokens

Font: native sans stack `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; Japanese fallback `"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`. Use native fonts intentionally: fast, familiar, zero font network dependency. Weight 400 body; 600 labels/subtitles; 700 titles. No synthetic 900, uppercase paragraphs or ultralight captions. Headline tracking -0.025em, labels normal; line lengths body 45–70 characters.

| Token | Mobile size / line-height | Tablet/desktop |
|---|---|---|
| display | 32 / 36, 700 | 44 / 48, 700 |
| page-title | 28 / 34, 700 | 36 / 42, 700 |
| section-title | 22 / 28, 700 | 26 / 32, 700 |
| card-title | 20 / 25, 700 | 20 / 25 |
| body | 16 / 24, 400 | 16 / 24 |
| label | 14 / 20, 600 | same |
| caption | 13 / 18, 400 | same |
| nav-label | 13 / 18, 600 | 16 / 24 |

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Card padding 16 mobile / 20 other. Section spacing 32 mobile / 48 other. Card text gap 8; metadata gap 4; CTA margin-top 16. Grid gutters 16/24/24. Dialog padding 20/24/32. Never insert arbitrary spacers to match one screenshot.

| Token | Value | Usage |
|---|---|---|
| canvas | `#F7F5F0` | Page |
| surface | `#FFFFFF` | Cards/dialogs |
| subtle | `#EFEBE3` | Neutral placeholder/selected passive area |
| ink | `#202621` | Main text |
| muted | `#5F685F` | Secondary text on canvas/white |
| line | `#D9DDD5` | Decorative divider only |
| control-line | `#788277` | Required control boundaries |
| accent | `#A83727` | Interest action, white foreground |
| accent-hover | `#85291E` | Hover/pressed tone |
| accent-soft | `#FBECE6` | Selected interest background with accent text/border |
| together | `#245A47` | Agreement text/icon |
| together-soft | `#E6F1E9` | Agreement banner |
| attention | `#774A10` | Warning text/icon |
| attention-soft | `#FFF1D6` | Warning surface |
| focus | `#175EA8` | 3px outline, 3px offset with white separation |
| danger | `#A12634` | Destructive action/error text, with icon and words |

Contrast gate: text at least 4.5:1 (large text 3:1); interactive graphics/boundaries 3:1 against adjacent surface. Decorative `line` is not sufficient for unlabelled control boundaries. Disabled content is still readable, has a reason and never looks actionable. Links underlined within prose. White text never directly over a photo without an opaque or tested backing.

Radius: cards 20px; dialogs 24px; inputs/buttons 12px; chips 999px. Mobile fullscreen detail radius 0. Button min-height 48px; icon-only 48×48, glyph 20–24px; inline text-link target at least 44px where isolated. Card shadow `0 4px 20px rgba(32,38,33,.05)`; modal `0 24px 80px rgba(0,0,0,.18)`. Avoid glass, heavy shadows, gradients on text and decorative movement.

Icons: one consistent outline SVG family, 2px stroke on 24px grid; heart fills only when selected. Use heart, two hearts, check-circle, star, compass, map, sliders, clock, calendar, chevron, x, image, info. Decorative icons `aria-hidden`; always accompany unfamiliar symbols with labels. Do not encode grade as star count (looks like reviews), use platform emoji as controls, or mix icon families. Brand is the existing typographic “Nihon”, not a fabricated logo.

Motion: button pressed scale .98 for 90ms; state fill 140ms; sheet enter 220ms ease-out; exit 160ms; toast 180ms. No confetti, automatic card reordering, auto-pan on save or autoplay gallery. `prefers-reduced-motion: reduce`: remove transforms/sliding/smooth scroll, use immediate state changes. Never delay persistence for animation.

## DA-05 Discovery and hub screens

First view order: shell → small “JAPÓN, A SU MANERA” eyebrow → “¿Qué les gustaría descubrir?” → one sentence “Marca lo que te gusta. El viaje lo armamos después.” → search → quick filters → result heading/count + map switch → cards. Intro maximum 180px on desktop / 150px mobile, excluding search. No full-viewport splash.

Search is visible without another tap, placeholder “Busca un lugar o una experiencia”; retains existing name/Japanese/neighborhood/type/description matching and accent normalization. Default scope all seven hubs. No date required. Clear icon only when text exists. Empty query returns current filtered catalogue. Results update without moving keyboard focus, status announced after a 200ms debounce; data filtering itself can be synchronous.

Quick controls: `Todo Japón ▾`, `Experiencias ▾`, `Filtros (n)`; result toolbar has `Lista / Mapa` labelled segmented buttons. Do not add ten chips to the first screen. Hub menu lists all hubs with counts, then “Explorar por región”. Single hub selection changes heading to `Descubre Tokio` etc. Subheading gives place count, not fake promotional facts. Hub change retains global search and compatible filters; removes incompatible category options with a visible “Se ajustó el filtro de experiencias” announcement, never a silent empty page.

Default sorting is reproducible: grade S→A→B→C→D; within grade interleave hubs in the canonical store's stable order; within each hub preserve place ID order. Explicit hub view: grade then ID. Photographer coverage and likes never change recommendation or hide a place. User may choose “Nombre A–Z”, “Menor tiempo de visita” (quantified min then max; day-scale/unknown last with separate labels), or “Recomendación”. No random reorder between visits. Initial render 12 cards, explicit “Ver 12 más”; total count always reflects all matches, focus remains on the button and newly added heading is announced. Pagination state restored on Back. Map considers all matching IDs, not only rendered cards.

No fabricated editorial collections. A later researched collection must have explicit membership/provenance. “Experiencias” directly presents canonical category labels with an icon adapter, not inferred broad buckets that can drop rare categories.

## DA-06 Place card contract

Semantic `article` with an h2/h3 as appropriate. Image and title share a detail-link target; “Quiero ir” is a **sibling** button, never nested in that link. Entire card is not a giant button. Card's white surface remains unchanged when saved; the CTA and status carry the state.

Exact vertical order:
1. 4:3 photo frame, full card width, upper corners 20px; correct-place photo or neutral pending field.
2. Body padding. Recommendation badge, caption size, one line.
3. Place title, 20/25. Up to three visual lines normally; never force clipping at enlarged text size.
4. `Hub · neighborhood or municipality` + category on next line, muted 13/18. No ID/coordinates/raw grade.
5. `description`, 16/24, visual clamp to two lines at normal text size; full text always available in detail. Do not AI-rewrite source text at runtime.
6. Facts: duration range via existing formatter, or original day-scale text; reservation label from interpreter if applicable. Wrap; never reinterpret day-scale as minutes.
7. At most one collapsed seasonal signal, chosen by existing Feb–Mar display adapter: non-safe records show `Feb–mar: revisar condiciones`. Tap opens that expanded section in detail. No invented red “closed” indicator. Safe confidence never becomes “Disponible”.
8. Couple status line, if at least one vote exists or legacy record needs review. Text cannot be color-only.
9. Full-width 48px interest button. Below image, never obscuring photo; makes the action reachable without detail.

Card source credit: small `Créditos de la foto` link just under frame; opens a disclosure with all required metadata for that exact asset. The full attribution text may wrap. It must not be available only in place detail. No overlays of several technical badges on the photograph. Missing image uses same frame and gives no impression a different place is pictured.

Selected detail card (focus context, different from liked) gets 2px focus-color outline. Liked button gets filled heart and `Quiero ir ✓` with accent-soft background, accent border/text; initial button white heart outline on accent background, text `Quiero ir`. Hover darkens initial button; selected hover stays selected. Pending write has text `Guardando…`, reserved width and prevents duplicate same-action writes. Error restores previous durable state and offers retry. Local memory-only mode explicitly says so.

## DA-07 Recommendation is not personal interest

| Canonical grade | Display badge | Icon | Treatment |
|---|---|---|---|
| S | Imprescindible | star | ink on subtle, bold |
| A | Muy recomendable | check-circle | together on together-soft |
| B | Recomendable | check | ink on subtle |
| C | Opcional | compass | muted on subtle |
| D | Prescindible | minus-circle | muted on subtle |

Do not equate D automatically with “excesivamente turístico”. Tourism intensity remains a separate recorded fact; display `Turismo: Extremo` only if that value exists. Detail has “Cómo leer la recomendación”: these are editorial priorities, not ratings, availability or the couple's preferences. Unknown future grade displays “Sin clasificación”; never silently maps to B. Personal priority uses “Prioridad del viaje”, not a second grade badge.

## DA-08 Detail, gallery and depth

Top toolbar: back/close, context label; detail title is the primary heading. Mobile sequence: gallery → title/location → recommendation → description → “Por qué puede gustarte” differentiator → concise facts → important seasonal/reservation signal → partner status → disclosures. Interest footer always visible. Desktop left gallery is sticky within dialog; right column scrolls; footer sticks to right column bottom. All useful raw content remains reachable.

Disclosures, in order:
- “La experiencia”: experience text, bestTime, bestSeason; no empty duplicate of description.
- “Antes de ir”: hours and closures raw, reservation interpreter + leadTime, crowd/tourism, price with recorded currency and date. Existing MXN values may appear labelled as dataset conversion, not current exchange rate; never perform an invented live conversion.
- “Para febrero–marzo de 2027”: status, warning, action verbatim; non-safe summary visible above disclosure and expanded when entered via warning link. Never infer current opening from confirmed editorial status.
- “Cómo llegar y accesibilidad”: transport, accessibility, existing evidence labels. Unknown does not become accessible.
- “Cerca y alternativas”: real directed relations; existing distance/time/confidence presentation and footnote. Open target, preserve back trail, including cross-hub targets.
- “Fuentes y actualización”: official link, Google Maps link, updatedAt, region/prefecture/Japanese name where available; image attribution is independently reachable.

Disclosure headers are buttons or native summary with at least 48px targets; no nested accordions. Critical warning text is not buried behind an unlabeled “Ver más”. Official links open safely with descriptive labels. A link to Google Maps is not a claim that routing was calculated inside Nihon.

Gallery: 4:3, cover crop centered by default. Metadata may later specify validated focal point; do not alter metadata schema casually. Single image: no fake dots/arrows/swipe affordance. Two or more: explicit previous/next 48px targets, counter `2 de 4` and buttons with labels; loop permitted, no autoplay. Horizontal swipe threshold 40px AND horizontal delta > vertical delta; vertical gesture scrolls detail. Keyboard arrows only within gallery context. Fullscreen uses `object-fit: contain`, near-black backing, title/count/close and attribution disclosure; next/prev still keyboard and touch accessible. Escape closes fullscreen only, then detail on next Escape. Native dialog or equivalent focus trap/inert background, restore opener.

Initial visible photo eager; other card images lazy + async, fixed width/height ratio. Gallery loads active image and at most its neighbors; no request for all images in the catalogue. Skeleton occupies same frame, nonflashing neutral background; reduced motion static. Empty: `Fotografía pendiente`, category line, neutral image icon; never imageBrief text. Error: `No pudimos cargar esta foto` + retry within same frame. Do not convert a failed image into zero images or erase credits. Slow data load: six skeleton cards, 2-second text status; error “No pudimos cargar los lugares” + retry. Existing local data remains available if map tiles fail.

Attribution on every surface: credit, source/file-page link, exact license + URL, original source title, separate attributionTitle when recorded, processing statement. Cropping must be described if not already covered; display adapter can add `Recorte de visualización` without pretending source metadata changed. No download of raw Commons files at runtime.

Photography roadmap: first one useful compliant image per uncovered eligible place; then 3–5 **distinct useful views** for S/A where evidence permits (overall setting, inside/activity, scale/access/context). Five is a maximum target, not minimum acceptance. No duplicate crops, false seasonal representation or repeated views to fill slots. Do not promise 214/214 until every record passes. Historical fail-closed exclusion set in PRODUCT_AUDIT sources remains protected.

## DA-09 Personal and couple state machine

First session may browse immediately. On first interest action only, a small choice sheet asks “¿De quién son estos gustos?” with Fernando / Ella. Selecting one records the pending vote exactly once and sets active local reviewer. Cancel leaves it unrecorded. Subsequent one-tap saves do not repeat onboarding. Top control always displays active reviewer; switching takes a deliberate choice. Before shared backend exists, sheet says “Dos perfiles en este dispositivo”; never “Sincronizado”. No mandatory wedding/profile setup.

Any explicit vote or legacy import creates review-queue membership. Toggling a vote off does not erase queue membership; a user may remove an entirely unreviewed non-legacy candidate from that queue via “Quitar de pendientes”. This never removes an authored plan.

Each place has independent votes `fernando` and `ella`: `unreviewed | yes | no`. Trip disposition is a separate `candidate | shortlisted | discarded`; absent disposition means candidate. A `no` is chosen through secondary “Ahora no” in detail/review menu, never inferred by scrolling or leaving the card. Toggling selected “Quiero ir” off returns **that person's vote to unreviewed**, with “Interés retirado · Deshacer”; it is not an explicit rejection. “Restablecer mi respuesta” also gives unreviewed. Selecting yes from no replaces that person's vote. Never mutate the partner's vote.

| F | E | Display | Comparison bucket |
|---|---|---|---|
| unreviewed | unreviewed | No mostrado en card normal; “Por revisar” in review | Pendientes only if imported/explicitly queued; do not add entire catalogue |
| yes | unreviewed | Fernando quiere ir · Falta Ella | Fernando + Pendientes |
| unreviewed | yes | Ella quiere ir · Falta Fernando | Ella + Pendientes |
| yes | yes | **two hearts + Ambos quieren ir** | Ambos |
| yes | no | Fernando quiere ir · Ella: ahora no | Fernando; “Gustos diferentes” |
| no | yes | Ella quiere ir · Fernando: ahora no | Ella; “Gustos diferentes” |
| no | unreviewed | Fernando: ahora no · Falta Ella | Pendientes only when already in review queue |
| unreviewed | no | Ella: ahora no · Falta Fernando | Pendientes only when already in review queue |
| no | no | Ninguno quiere ir | Ninguno, under review filter |

Discarded trip disposition overlays the above and appears in Descartados, excluding normal review counts; votes are retained and shown inside detail. Restore returns candidate, not shortlisted. “Descartar del viaje” requires an explicit action and offers Undo; it does not delete canonical research. Positive vote on discarded place asks “¿Volver a considerar este lugar?”; cancel keeps state; confirm restores candidate and records own yes. Agreement is never auto-added to an itinerary. Prioritization is explicit: `Por decidir / Alta / Media / Baja`, independent of recommendation and votes; no automatically assigned days.

Data direction for Sol: a new versioned review store with stable person IDs, place IDs, votes, disposition, review-queue membership and optional trip priority. Persist user choices only; compute display/buckets/counts. Do not persist inferred “ambos”. Local-only namespace `nihon.astra.review.v1`. No backend provider selected in this phase.

Legacy migration bridge: leave `nihon.savedPlaceIds` and `nihon.manualPlanningDraft` unchanged on load. Existing saved IDs appear in Nuestro viaje → Pendientes as “Guardado anterior · Sin asignar”. Offer “Estos guardados son míos” after selecting reviewer, with count and explicit confirmation; never assign the whole list to both. Idempotent claim marker; cancellation is lossless. Imported IDs remain visible even without a vote. New yes votes do not write the legacy list until explicit plan inclusion.

Planner bridge: preserve the original saved list as legacy planner eligibility; maintain an additive eligibility set for new explicitly shortlisted IDs. Pass the union to the existing planner so changing reviewer or unliking cannot prune old routes. Removing an ID from an authored plan is a **separate operation** with affected day/route preview and explicit confirmation; reuse current reconcile rules only after that confirmation. Do not feed a currently filtered/liked subset to `usePlanningDraft`. If unable to preserve this invariant, stop SOL-4 and report P0 before migration.

## DA-10 Nuestro viaje

Header “Nuestro viaje”; subtitle “Primero elegimos lugares. Después armamos el recorrido.” First row count cards `Ambos` and `Por comparar`; counts derived, no fake progress percentage. Segmented filters in order `Todos`, `Ambos`, `Fernando`, `Ella`, `Pendientes`, `Descartados`; “Más” contains `Ninguno` and `Gustos diferentes` for narrow widths. Counts can overlap by definition (Fernando includes both); do not display them as a partition or add them together. `Todos` means review set (any yes, legacy/queue, shortlisted) excluding discarded; not all 214 catalogue places. `Ninguno` remains discoverable even after last yes becomes no.

Default view Todos with groups: Ambos, Por comparar, Otros intereses; each ID appears once in this grouped view. Default order within group recommendation then ID. Filters flatten groups and preserve same tie-break. Optional sort `Prioridad del viaje`, `Recomendación`, `Nombre`, `Hub`; unknown priority last. Same canonical card, both-person status always visible here. Secondary menu `Ahora no` (own vote), `Prioridad del viaje`, `Añadir a preselección`, `Descartar del viaje`. No swipe-only decisions. `Revisar pendientes` walks a stable filtered queue with next/previous and progress `3 de 12`; user must tap choices, no automatic yes.

Bulk mode only via `Seleccionar`: checkboxes + count + `Preseleccionar` or `Descartar`; explicit confirmation listing count and expandable names, Undo transaction; never casts votes on behalf of either person. Bulk mode does not mutate an existing plan. Exit selection clears ephemeral checkboxes.

Secondary navigation below heading: `Intereses` (default), `Planificar`, `Dónde alojarnos`. Planificar shows preselection and `Construir recorrido` explicit CTA. Reopening an old plan says `Continuar recorrido`; existing saved eligibility is retained. All current planner functions remain available under clear sections: Recorrido, Días, Traslados, Reservas y horarios, Alojamiento, Resumen del viaje. Initially the old module may be embedded unchanged behind this entry until its separate fidelity block; never remove a function simply to finish a block.

Selection analysis moves under “Ver distribución y tiempos”: group by hub/prefecture/cluster, quantified visit ranges, day-scale commitments and “No incluye traslados”. Do not add unordered travel times or generate days from hours.

Empty states:
- Todos empty: “Su viaje empieza con un lugar” + “Explorar Japón”.
- Ambos empty with existing interests: “Todavía no hay coincidencias. Revisen lo que le gusta al otro.” + “Ver pendientes”. Never say nobody agrees if partner is unreviewed.
- Filter empty: selected filter chips + “Quitar filtros”, retaining saved data.
- Descartados empty: “No han descartado lugares.” No guilt language.
- Ninguno: retain records and allow reconsideration; don't delete them.

## DA-11 Map and filters

Map loads only when requested (and optionally prefetches after idle on nonconstrained desktop); planning module is also a separate lazy boundary. Default discovery performs no tile requests. Use existing Leaflet and geometry; no new paid provider. Marker clustering may use a small tested adapter but no arbitrary performance-heavy rewrite. Cluster count is number of matching places, never vote sum. Activate cluster zooms to its bounds; overlapping pins at max zoom open an accessible list of those places.

Marker 36px visible / 48px hit area: neutral pin with category icon; small filled heart on own yes; two-heart badge for both; dark 3px outer ring when selected. Never encode all grades and people into multicolored dots. Recommendation and full couple status are in selected preview/list. Discarded hidden unless filter includes it. Selection is independent of filters; if opening a nearby place outside filters, keep it visible and say `Fuera de tus filtros` with clear dismiss. No background jump when liking.

Mobile preview: image 80×80, title, recommendation and duration, status, “Ver lugar” and own interest control; max 35dvh with expand-to-detail, map still usable. Desktop list is 420px wide; selecting preview opens the two-column detail dialog over map, not another fixed rail. Fit hub on explicit hub change; panning does not continuously reset. Button `Buscar en esta zona` explicitly intersects current filtered IDs with viewport; “Quitar límite del mapa” clears only viewport condition. Results count states when geographically bounded. No GPS prompt or presumed hotel origin.

Filter semantics: OR within one multiselect group; AND between groups. Search always intersects. Hub single-select in quick controls; category quick selector opens full category group. Advanced groups: Recommendation (all five), Duration (existing overlap taxonomy; quantified vs day-scale separated), Reservation (all existing semantic values), Feb–Mar confidence (adapter tone with explanation, not months inferred from prose), Own interest (all/yes/unreviewed/no), Couple bucket, Hidden gems, Tourism intensity. Preserve existing exact reservation options; do not map them to true/false. Actual seasonal text remains visible in detail; a future month filter needs a sourced structured field, not regex over bestSeason.

Advanced sheet holds draft filters; result-count preview updates without applying; footer `Ver N lugares` commits atomically. Close/Back cancels draft; `Limpiar` resets draft only until applied. Zero results is allowed and the footer reads `Ver 0 lugares`; don't disable escape from a chosen combination. Applied chips can be individually removed from results toolbar. Filter count = active groups excluding search and default hub; document this exact definition in test. Quick category/hub changes commit immediately, preserve other compatible filters. Maintain keyboard focus in initiating control.

Tile error: “El mapa no está disponible. Tus lugares siguen aquí.” + list switch/retry. No blank blocking overlay over the only way to navigate. Include OSM/MLIT attribution in visible map region, not beneath fixed navigation.

## DA-12 Lodging: zones before properties

Entry Nuestro viaje → Dónde alojarnos. First screen “¿Qué zona nos conviene?”; Tokio / Osaka / Kioto tabs, followed by interests context (number of shortlisted/liked places in selected hub). No hotel prepopulated; no map origin if no anchor. Without area research: “Aún no hay zonas investigadas para comparar” + “Ver nuestros lugares en el mapa”. This is an honest functional empty state, not fictional neighbourhood cards.

Once sourced data exists, area cards show name, location, summary, transport access, relative price tier with basis/date, fit to current selected places with evidence coverage, pros/cons; `Comparar` checkbox up to 3. Fourth selection announces maximum and preserves previous choices. Area shortlist is separate from actual accommodation.

Comparison rows: transport/stations, access to our places, luggage barriers/elevators, atmosphere, nearby food, noise, relative cost, cleanliness/safety evidence limits, advantages, disadvantages, source/date and confidence. Unknown displays “Por investigar”, not score zero. Safety/cleanliness are not guaranteed by a neighborhood label. No overall weighted winner until all required facts and a published comparison method exist; missing travel routes remain missing, never haversine travel-time.

Accommodation preferences are optional chips: business hotel, hotel, hostel, private room, capsule, aparthotel; no filtering away unknown property types. After selecting a zone, properties require a later live research task with dates/occupancy/total taxes, cancellation, walking station distance and luggage access. No booking integration promised. Only an explicit user “Usar este alojamiento” with a real property/location creates an existing planner anchor; area centroid can never be used as a hotel. Legacy user anchors stay accessible from Planificar.

## DA-13 Accessibility, errors and performance acceptance

Native buttons/links/fields; logical headings; skip-to-main; navigation aria-current; heart aria-pressed and accessible name “Quiero ir a [place] como [person]”. Status updates polite, no duplicated announcements by several surfaces. Own vote toggle stays focused even if the current filter removes the card; move to next result or results heading and announce removal when necessary.

Dialog focus moves to title/close; traps only when modal; backdrop inert; Escape closes top layer; close restores opener or result heading if removed. Desktop map/list remain navigable without a mouse. No hidden control reachable by Tab. 48px action targets with 8px separation; 44px minimum minor isolated controls. Swipe has button alternative. No color-only recommendations/agreement/errors. Error message adjacent to action and connected with aria-describedby where applicable.

Text zoom 200%, 320px reflow, long Spanish names and Japanese fonts cannot hide CTA or horizontally scroll whole page. Horizontal scroll allowed only for explicit segment strips and comparison tables with cues. Keyboard opening on mobile must not place input under sticky footer. Safe area tested top/bottom.

Performance gates to measure, not claimed here: no map/planner code on initial exploration critical path; visible card heart feedback <=100ms under ordinary device conditions; no layout shift from photo dimensions; network trace confirms only visible/nearby photos load, no runtime acquisition host, no transit provider activation. Report actual build deltas vs baseline, use same compression method. Do not impose a fabricated score if no real device test exists; browser CPU throttling is supporting evidence, not an iPhone measurement.

Persistence errors: retain last durable data, local pending indicator, retry and export option when implemented; never destructive automatic reset. Shared mode (future): writes scoped to own authenticated participant, idempotent operation IDs and server revision, no silent last-write-wins for same vote conflict; show “Cambió en otro dispositivo” with current/server and attempted own choice. Disposition/priority conflicts also require explicit resolution. No shared success banner while offline or pending. See SOL-8 for engineering gate.

## DA-14 Anti-patterns and release boundary

Forbidden: copying Claude visuals; replacing real data with a demo list; moving research into hand-written presentation JSON; hiding D or unphotographed places; interpreting unknown as no; heart + separate bookmark; dates/hotel forced on entry; automatic itinerary; fake partner agreement; unsaving that silently prunes an authored plan; acquisition of hundreds of assets during design; changed validator assertions to make a branch pass; map-only controls; generic “Japan photo” for missing place; uncredited image; feature stub labelled as a working shared feature.

Director phase acceptance: all required contracts, preservation map and macroblock gates present; source baseline verified; reference is isolated and explicitly limited; branch committed/pushed with no main changes. **Rendered certification remains an explicit first Sol task if blocked here.** Implementation release requires no P0/P1 findings and every applicable audit item PASS; a PARTIAL is never silently accepted as PASS.
