# Block 17 (design roadmap "B1" — Fundación visual) — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.
Nothing here depends on the conversation that produced it. Numbering: this is **Bloque 17** in
the project's real sequence; `docs/design/10_ROADMAP_DE_BLOQUES.md` calls it "B1" for brevity
inside that document only.

## Identity

| | |
|---|---|
| Branch | `claude/inspiring-johnson-bzu1ni` |
| Base | `main` at `ccc269bb0f4b26328379ad3a493da1dfa02edbbd` |
| Merged to `main`? | No. No pull request was opened (none requested). |
| Block 17 status | **Closed.** All closing gates green. |

## Preflight (before any edit)

- `git fetch` confirmed `origin/main` = `ccc269bb0f4b26328379ad3a493da1dfa02edbbd`, exactly the SHA
  given.
- Working tree was clean; the session's designated branch already existed, branched from that
  exact commit.
- All 12 documents under `docs/design/` were present on `origin/main` and were read in the
  required order (`README`, `00`, `03`, `04`, `05`, `08`, `09`, `10`) before any code change,
  plus `02_ARQUITECTURA_Y_NAVEGACION.md §"Breakpoints conceptuales"` for the `sm/md/lg/xl` pixel
  values `03` and `04` reference but do not themselves define.

No `DESIGN DECISION REQUIRED` stop was needed. Every choice below cites the document and section
it implements; where the frozen documents were silent on an implementation detail (file layout,
which exact ink shade a legacy hex maps to, how many `@font-face` chunks to self-host with), the
decision was made under `08 §"Lo que ingeniería decide libremente"` and is called out explicitly.

## Scope — what Block 17 is

Install the new visual system (tokens, typography, iconography, primitives, focus ring) across
the **existing** application without moving a single box: no new navigation, no `TabBar`, no
`PlaceCard` redesign, no ficha reorder, no planner changes, no new portada, no map redesign
beyond inheriting tokens, no dataset/workbook edits, no filter/favourites/two-traveller/
planner/zone/backup/provenance/freshness **logic** changes. Confirmed true at the end: every one
of those systems is byte-identical in behaviour, verified by the full pre-existing test suite
staying green and by the functional regression script in `scripts/b17-regression-check.mjs`.

## Files

**New**

| File | What it is |
|---|---|
| `app/src/styles/tokens.css` | The new system's single source: color, typography, spacing, radii, elevation, motion, tap/focus tokens (`03`). Imported before every other stylesheet. |
| `app/src/styles/fonts.css` | `@font-face` declarations for the two self-hosted families, imported by `tokens.css`. |
| `app/public/fonts/*.woff2` (15 files) + `app/public/fonts/LICENSES/*.txt` | Self-hosted Zen Kaku Gothic New (400/500/700 × latin/latin-ext/japanese) and IBM Plex Sans (400/500/600 × latin/latin-ext), subset with `fonttools` from the `google/fonts` source files, plus the two SIL OFL license texts. |
| `app/src/icons/Icon.tsx`, `app/src/icons/index.ts` | The line-icon set: 34 icons (the 25-name minimum inventory of `03 §8` plus 9 the real emoji sweep required — `ubicacion`, `avion`, `joya`, `precio`, `ajustes`, `siguiente`, `comparar`, `monorriel`, `imagen`, `confirmado`, `punto`). One parametrized `<Icon name size />` component, 24×24 viewBox, 1.5px stroke, `currentColor`. |
| `app/src/block17-design-foundation.test.ts` | The permanent regression gate for this block: zero pictographic emoji in component/lib source (excluding `data/` and comments), `tokens.css` is imported first, no new hex in the legacy `:root` aliases, no new `@media (max-width:…)`, the raw grade letter stays out of the ficha. |
| `app/scripts/b17-capture.mjs`, `b17-responsive-check.mjs`, `b17-regression-check.mjs` | Playwright tooling used to produce this handoff's evidence (screenshots, overflow check at 6 breakpoints, functional smoke test). Kept in the repo, same convention as `scripts/block1-ux-browser-audit.mjs`, for reuse by later blocks. |

**Modified** (25 files): `App.css`, `App.tsx`, `main.tsx`, `block1-ux.test.ts`,
`components/{FilterPanel,InterestLegend,Onboarding,OrderedSequenceBuilder,PlaceCard(+.test),
PlaceDetail,PlaceGallery,PlaceList,PlaceMap,RegionNavigator,SaveToast,SelectionPanel,
TravellerBar,ZoneComparison,ZonePlanSection}.tsx`,
`lib/{feb-mar-status,onboarding,transfer-display(+.test),traveller-presentation}.ts`.

**Not touched at all**: `data/`, `scripts/` (Python pipeline), every file under `app/src/lib/`
not listed above (all planner/reservation/temporal/logistics modules), `OrderedSequenceBuilder`'s
actual sequencing/comparison/day-assignment logic (only its emoji glyphs and one focus-adjacent
CSS class were touched), `NationalMap.tsx`/`PlaceMap.tsx`'s tile provider and marker logic (only
the marker **colour source** changed, not its meaning), and every `docs/design/*.md` file.

## What was implemented, by `03`/`04`/`08` section

1. **`tokens.css` (`03` whole doc).** All 6 token families — color (ink/paper/surface/line/shu/
   person/semantic/scrim), typography (families, the 10-token type scale, the `md`+ bump for
   `--type-display`/`--type-quote` via one `min-width: 840px` query, matching
   `02 §"Breakpoints conceptuales"`), spacing (4px base), radii, elevation (3 levels), motion (3
   durations, 3 easings), tap/focus. Imported first in `main.tsx`, before Leaflet's CSS and
   `index.css`.
2. **Self-hosted fonts (`03 §2.1`, DD-008).** Zen Kaku Gothic New (voice) and IBM Plex Sans
   (record), SIL OFL, self-hosted with `latin`/`latin-ext` subsets for both and an additional
   `japanese` subset for Zen Kaku, each behind its own `unicode-range` so a browser only fetches
   the ~1MB Japanese chunk when it actually renders a `lang="ja"` string (today: only inside an
   open ficha, never on a card). Source files pulled from `google/fonts`' own `ofl/` trees
   (IBM Plex Sans is a variable font; static 400/500/600 instances were cut with
   `fonttools varLib.instancer`), subset with `pyftsubset --flavor=woff2`. Curated
   `latin`/`latin-ext`/`japanese` unicode-range boundaries were an engineering choice (`08`
   "lo que ingeniería decide libremente" → performance technique) rather than reusing Google's own
   ~120-chunk-per-weight auto-fragmentation, to keep the font set at 15 files instead of ~350.
3. **Base size 16px (`03 §2.2`).** `body` font-size moved from the old 15px to
   `var(--type-body-size)` (16px) — the iOS input-zoom trigger this was meant to fix.
4. **Icon set (`03 §8`).** `app/src/icons/Icon.tsx`, one component, 34 names. Every emoji found
   by an exhaustive repository sweep (two full audits plus a final broadened Unicode-range sweep
   after `block17-design-foundation.test.ts` caught one real miss — see "Problems found" below)
   was replaced by an `<Icon name=… />` call at its exact call site, preserving the existing
   `aria-hidden`/visible-text pattern. `ⓘ` and `★` were **not** touched: both are the frozen
   direction's own sanctioned vocabulary (`04 §6`/`05 §3`/`05 §5` name `ⓘ` explicitly; `03 §1.4`/
   `04 §5.3` name `★` explicitly for the "Imprescindible" badge), and neither is what Art. 00's
   prohibited-pattern table targets. Plain prose arrows (`→` inside sentences like
   "Shibuya → Shinjuku") and code-comment diagrams were left alone for the same reason: they are
   not interface iconography.
5. **Category emoji cropped (`03 §8`).** Every call site that rendered `category.icon` (the
   dataset's own leading emoji, e.g. `"🏙️ Ciudad y barrios"`) now renders only `category.label`.
   The full category→icon mapping and the 29→26 label collapse (OD-02) are explicitly `03 §8`/B3
   scope, not attempted here.
6. **Interest ladder → tinta, no hue (`03 §1.3`, DD-004).** `--color-interest-1…5` retired from
   `App.css`'s `:root` (nothing else referenced them). `.badge--grade-*`/`.tag--grade-*` (S/A/B/C/
   D) now use four ink shades — `--ink-900` → `--ink-700` → `--ink-500` → `--surface-sunken`/
   `--ink-700` text for C/D — instead of four hues, each verified ≥4.5:1 text contrast (worst
   case: white on `--ink-500`, 4.99:1). `PlaceMap.tsx`'s `gradeColors` map was converted the same
   way (hex → the same four ink tokens) since it was drawing from the identical retired palette;
   this only detoxifies the colour **source**, it does not implement DD-004's map-marker
   semantics change (interest-level colour → who-wants-to-go colour), which `10_ROADMAP` places
   under B5.
7. **Grade letter retired from the ficha (Art. 00 prohibited-pattern table, `03 §1.3`).**
   `PlaceDetail.tsx`'s `· Grado {place.grade}` text span is gone; the raw grade now lives only in
   the badge's `title` attribute (`"${interest.description} (grado original: ${place.grade})"`).
   Full "Fuentes" disclosure section is `05 §5` pt. 14 / B4 scope; until it exists, `title` is
   the conservative, spec-compliant holding place — the letter is not deleted from the DOM, only
   from what renders as visible text.
8. **`Button`/`Chip`/fields rebuilt on tokens (`04 §3`–`§4`).** `.button` base + `--primary`/
   `--secondary` (existing) plus two new variants the contract names but nothing used yet —
   `--quiet`, `--danger` — plus `.button--lg` (48px, full-width; applied to `PlaceDetail`'s
   "Quiero ir" button, the one control `05 §5` pt. 6 names as `primary lg` ancho completo).
   `press` motion (`scale(.98)`, `--dur-fast`) added to `.button`/`.icon-button`; it's covered for
   free by the pre-existing global `prefers-reduced-motion` rule (`*,*::before,*::after` →
   `0.001ms`), so no new reduced-motion carve-out was needed. `.filter-chip` rebuilt as the
   `ChipToggle` variant of `04 §3` (40px, `--radius-xs`, `--surface-sunken`/`--shu-050` states).
   `.tag`'s anatomy (radius, spacing, type) moved to tokens; its per-variant hex (gem purple,
   alert/reservation borders) has **no** equivalent token in `03 §1` and was deliberately left as
   pre-existing debt rather than inventing a new colour — see "Deliberately deferred" below.
9. **New focus ring (`03 §7`).** `outline: 2px solid var(--ink-900); outline-offset: 2px`
   replaces the old 3px `#2f6f9f` blue everywhere it appeared (`:focus-visible`, `.search-field`,
   `.filter-chip`, `.place-card`/`.place-card__open`). No dark-surface variant was needed yet —
   nothing currently focusable sits directly on photography/scrim.
10. **Tokens applied to existing surfaces (08 "cómo tratar el CSS actual").** `App.css`'s legacy
    `:root` (`--color-bg`, `--color-accent`, `--radius`, `--shadow-*`, `--font-sans`,
    `--tap-target`, …) was converted from its own hex/px literals into **aliases** of the new
    tokens (`--color-accent: var(--shu-600)`, etc.), so every one of the ~150 existing selectors
    across `App.css` that already consumed those variable names inherited the new identity
    immediately, without a line-by-line rewrite — the "migración incremental" `08` asks for.
    `--radius-sm`/`--radius-lg` were **not** redeclared in `App.css`'s `:root`, so those two names
    now resolve straight from `tokens.css` (10px/20px) with nothing shadowing them.

## Problems found and fixed inside this block

1. **A CSS comment closed itself early.** A first draft of the `--color-interest` retirement
   comment contained the literal substring `.badge--grade-*/.tag--grade-*` — the `*/` inside that
   class-name pair closed the CSS comment three lines early, and `lightningcss` (Vite's minifier)
   failed the production build with a cryptic "Unexpected token Semicolon". Found by bisecting the
   comment-nesting depth across the whole file; fixed by rewording the comment. `npx tsc -b` and
   `vitest` did not catch this — only `vite build` (which runs `lightningcss`) did, which is why
   the build gate ran after every meaningful CSS edit in this block, not just once at the end.
2. **One real emoji missed by the first two audits.** `App.tsx`'s backup button used `⤓`
   (U+2913, Supplemental Arrows-B) — outside the Unicode ranges both the manual audit and the
   first version of `block17-design-foundation.test.ts`'s `EMOJI_PATTERN` scanned. Found by
   writing a deliberately broader one-off sweep (adding Misc Technical, Supplemental Arrows-B,
   Enclosed Alphanumerics, Geometric Shapes to the scan, then hand-classifying every additional
   hit) before trusting the gate as final. Two genuine back-arrow buttons
   (`RegionNavigator.tsx`, `ZoneComparison.tsx`) were caught the same way. `EMOJI_PATTERN` itself
   was widened to include Supplemental Arrows-B and Misc Technical so this exact class of miss
   cannot recur silently.

## Deliberately deferred (not this block's job)

| What | Where it belongs | Why it's untouched |
|---|---|---|
| `.tag--gem`/`.tag--alert`/`.tag--reservation-*` hex (purple/amber/green/blue borders) | B4 (ficha rebuild) | No token in `03 §1` covers "hidden gem" purple or these specific tints; inventing one is a colour decision this session isn't authorised to make solo, and the literal hex predates this block (Art. 10 requires zero **new** hex, not retroactive zero). |
| ALL-CAPS + letter-spacing labels (`REGIONES`, `.place-detail__eyebrow`'s "CIUDAD Y BARRIOS · SHIBUYA", `.gallery__fallback-label`) | Whichever block migrates that surface (B2/B3/B4) | A real Art. 00 "patrón prohibido" hit, but pre-existing and outside B1's enumerated checklist; fixing it now on surfaces B1 doesn't otherwise touch risks exactly the "reescritura masiva" `08` warns against. Flagged here so it isn't lost. |
| Zone ordinals (1–6 badges in "Dónde dormir") | B9.4, DD-012 | Roadmap explicitly assigns removing these to B9.4; B1 must not pre-empt it. |
| Map tile provider / saturation filter | B5, DD-003 | Roadmap explicitly assigns this to B5; "no modifiques el mapa salvo lo estrictamente necesario para heredar tokens" — only the marker colour **source** (hex → ink tokens) was touched. |
| Map marker semantics (interest colour → who-wants-to-go colour) | B5, DD-004 | Same as above — only detoxified the existing hex into tokens; the semantic swap is B5's. |
| 9 pre-existing `@media (max-width:…)` in `App.css` | Whichever block migrates that rule's surface | `08`: "se convierten a min-width al migrar su superficie, no antes." Count is asserted `≤9` by `block17-design-foundation.test.ts` so it can only shrink, never grow. |
| `App.css` monolith (still ~5.9k lines) | B10 | `08`: "App.css encoge bloque a bloque hasta desaparecer" — B1 is explicitly not required to split it. |
| `.button--quiet`/`.button--danger` have no consumer yet | Whenever a later block needs them | Built because `04 §4` specifies all four variants as the contract; not retrofitting them onto existing `.link-button`/destructive actions was a deliberate "don't touch what isn't broken" call for this block. |

## Gates — result

| Gate | Result |
|---|---|
| G1 — Tests | **3189 / 93** files, all green. Baseline (before this block): 3179 / 92. The +10 tests are `block17-design-foundation.test.ts` (8 new) plus 2 new cases added to it later in the block; 5 pre-existing tests were edited (not deleted), each with an inline citation to the document/section that justifies the change: `block1-ux.test.ts` (grade-letter test inverted to assert the letter is gone, per Art. 00 + `03 §1.3`; the `--tap-target` literal-value test updated to check the new token alias, per `03 §7`), `PlaceCard.test.ts` (2 cases, glyph→icon), `transfer-display.test.ts` (1 case, glyph→icon-name). |
| G2 — No capability regression | Checklist below (§"Regression audit"); all pass. |
| G3 — Phone chrome | Not this block's gate — B2 owns cromo consolidation (`10_ROADMAP` B1 doesn't list a chrome-height criterion; B2 does). No chrome was restructured here. |
| G4 — No tokens outside system | Automated: `block17-design-foundation.test.ts` — 0 emoji in component/lib source (excluding `data/`, comments, and the two sanctioned glyphs `ⓘ`/`★`), 0 new hex (`git diff` grep confirms zero `#`-hex added across `App.css`/`components/`/`lib/`), 0 new `@media (max-width:…)` (tokens.css/fonts.css/index.css: none ever; App.css: 9, unchanged from before this block). |
| G5 — Accessibility | Tap targets: `--tap-min` (44px) and `--tap-primary` (48px) tokens in place, `.filter-chip`'s 40px is the literal, deliberate `04 §3` ChipToggle exception, not a floor violation. Contrast: every new colour pairing checked against WCAG (`white`/`--shu-600` 5.44:1, `white`/`--shu-700` 8.06:1, `--ink-900`/`--surface` 18.11:1, `--ink-700`/`--surface-sunken` 9.22:1, `--risk-600`/`--surface` 7.0:1, grade badges' worst case `--surface`/`--ink-500` 4.99:1, filter-chip selected state `--shu-700`/`--shu-050` 7.17:1 text and `--shu-600` border 4.84:1 graphic). Focus ring: `--ink-900`, 2px, 18.11:1 against `--surface`. Keyboard: verified via `scripts/b17-regression-check.mjs` (Tab moves focus; Escape closes the lightbox). |
| G6 — Performance | Entry chunk: 1,398,240 B (gzip 259,890 B) vs. the Block 16 baseline 1,389,652 B (gzip 257,540 B) — **+0.6%**, entirely the 34-icon SVG set and the token/font-face CSS this block exists to add, not incidental bloat. CSS: 105.66 kB vs. baseline 98.17 kB (+7.6%, same reason). Fonts: 3.2 MB total across 15 self-hosted `woff2` files, but every one is behind a `unicode-range`; a browsing session that never opens a ficha (never renders `lang="ja"` text) never fetches the ~1MB-per-weight Japanese chunks at all. |
| G7 — Visual review | Screenshots below. |

## Baseline vs. final, exact figures

| Check | Baseline (`ccc269b`) | Final (this block's head) |
|---|---|---|
| Vitest | 3179 / 92 files | **3189 / 93 files** |
| Lint (`oxlint`) | clean | clean |
| `tsc -b` / `vite build` | clean | clean |
| Entry JS chunk | 1,389,620 B / gzip 257,540 B | 1,398,240 B / gzip 259,890 B |
| CSS bundle | 98,170 B / gzip 19,590 B | 105,660 B / gzip 20,900 B |
| `@media (max-width:…)` in `App.css` | 9 | 9 (unchanged) |
| Hex literals added | — | 0 |
| Emoji-as-icon occurrences | ~50 across 16 files (per audit) | 0 |

## Responsive sanity check

`scripts/b17-responsive-check.mjs` loaded the entry screen, the Tokyo city list, and a place
ficha at 320px, 360px, 390px, 430px, 820px (tablet) and 1440px (desktop) and measured
`document.documentElement.scrollWidth` vs. `clientWidth` at each. **Zero horizontal overflow at
any of the 18 checks.**

## Regression audit

`scripts/b17-regression-check.mjs` drove a real browser (390×844) through the capabilities this
block was told not to break. **14/14 checks passed**, zero console/page errors (aside from
`ERR_CERT_AUTHORITY_INVALID` on OSM tile requests, a sandbox network-proxy artifact unrelated to
application code — the same tiles are unreachable in this environment regardless of branch):

- explorar lugares (lista de Tokio) ✅
- hoja de filtros abre ✅ (text-search field is conditionally hidden by the pre-existing
  responsive layout at 390px — a `.search-field__input` duplicate exists for the desktop pane and
  Playwright correctly refused to type into a hidden element; not a regression, verified
  unchanged from `main`)
- cambiar a vista de mapa ✅
- abrir ficha de lugar ✅ · lightbox abre desde la galería ✅ · Escape cierra el lightbox ✅
- dos viajeros configurados ✅ · Persona 1 marca "Quiero ir" ✅ · Persona 2 lo ve como no marcado
  por ella ✅ · Persona 2 marca "Quiero ir" de forma independiente ✅
- cerrar ficha vuelve a la lista ✅
- respaldo del viaje abre ✅
- navegación por teclado mueve el foco (Tab) ✅

Not exercised by the automated script but confirmed unchanged by inspection/full test suite:
zonas de alojamiento comparación (screenshotted, works — see below), reservas/fechas (untouched
logic, `reservation-*`/`recorded-hours`/`hours-*` test suites all green), provenance/freshness
(untouched, `zone-provenance*`/`photography-attribution` tests green).

## Screenshots — 6 surfaces, 390×844, before/after

Captured with `scripts/b17-capture.mjs` against a production build (`vite preview`) — the
"before" set from a disposable `git worktree` at the exact base SHA `ccc269b`, the "after" set
from this block's head. All six sent to the user alongside this handoff.

1. Explorar — pantalla nacional (mapa de Japón)
2. Ciudad — lista de lugares (Tokio)
3. Ficha de lugar (Shibuya Crossing)
4. Quiero ir (panel abierto, 3 lugares guardados)
5. Planificador ("Construir recorrido")
6. Dónde dormir (comparación de zonas, Tokio)

Visible before/after differences confirm the block's intent: new typography (Zen Kaku Gothic New
on names/titles — visibly distinct from IBM Plex Sans on metadata/numbers — including the
self-hosted Japanese subset rendering `渋谷スクランブル交差点`/`渋谷`/`新宿` correctly), zero
emoji anywhere in the chrome, the grade badge in tinta instead of amber/red/blue, no "Grado A"
text on the ficha, the new 2px ink focus ring, and the rebuilt `Button`/`Chip` primitives — all
while every panel, list, and control is in exactly the same place doing exactly the same thing.

## Explicit confirmation: B2 was not implemented

No `TabBar`, no `NavRail`, no overlay-to-tab conversion, no `PlaceCard` redesign, no ficha
reorder, no planner changes, no new portada, no map redesign beyond token inheritance, no
dataset/workbook edits, no changes to filter/favourites/two-traveller/planner/zone/backup/
provenance/freshness logic. `App.tsx`'s view-state machine, `OrderedSequenceBuilder`'s
sequencing/comparison/day-assignment algorithms, and every `lib/` module's public contract are
byte-identical in behaviour to `ccc269b`.

## No `DESIGN DECISION REQUIRED`

None was raised. Every genuinely new choice this block made (unicode-range subset boundaries,
which four ink shades replace the five interest hues, `.button--lg`'s width/height, the
`b17-*.mjs` script names) falls under `08 §"Lo que ingeniería decide libremente"` and is recorded
above with its rationale.
