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
| Block 17 status | **Closed**, after one compliance correction (see below). All closing gates green. |

**This handoff was corrected after an independent compliance audit found three violations in
the first close.** The record below is the corrected, final state; the section
"Corrección de cumplimiento normativo" documents exactly what was wrong and how it was fixed.
Nothing in the sections above that heading should be read as still describing the first,
non-compliant close — every figure and file list below is post-correction.

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
| `app/src/block17-design-foundation.test.ts` | The permanent regression gate for this block: zero pictographic emoji in component/lib source (excluding `data/` and comments), `tokens.css` is imported first, no new hex in the legacy `:root` aliases, no new `@media (max-width:…)`, the raw grade letter stays out of the ficha (`title`/`aria-label` included), every 44px hit-area fix is in place, no icon-only `<button>` lacks `aria-label` **and** `title`. |
| `app/scripts/b17-capture.mjs`, `b17-responsive-check.mjs`, `b17-regression-check.mjs`, `b17-tap-target-check.mjs` | Playwright tooling used to produce this handoff's evidence (screenshots, overflow check at 6 breakpoints, functional smoke test, real hit-area measurement + click-through proof). Kept in the repo, same convention as `scripts/block1-ux-browser-audit.mjs`, for reuse by later blocks. |

**Modified** (29 files): `App.css`, `App.tsx`, `main.tsx`, `block1-ux.test.ts`,
`components/{FilterPanel,InterestLegend,Onboarding,OrderedSequenceBuilder,PlaceCard(+.test),
PlaceDetail,PlaceGallery,PlaceList,PlaceMap,PrefecturePanel,RegionNavigator,SaveToast,
SelectionAnalysis,SelectionPanel,TravellerBar,TravellerManager,TripBackup,ZoneComparison,
ZonePlanSection}.tsx`, `lib/{feb-mar-status,onboarding,transfer-display(+.test),
traveller-presentation}.ts`. (The last 5 of these — `PrefecturePanel`, `SelectionAnalysis`,
`TravellerManager`, `TripBackup`, plus a second pass on `ZoneComparison` — were touched only in
the compliance correction, adding `title` to an already-`aria-label`led close button; see below.)

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
7. **Grade letter retired from the ficha, including `title` (Art. 00 prohibited-pattern table,
   `03 §1.3`).** `PlaceDetail.tsx`'s `· Grado {place.grade}` text span is gone, and — after the
   compliance correction below — the raw letter no longer appears in `title` either; the badge's
   `title` is `interest.description` alone (plain language, e.g. "Vale mucho la pena. La mayoría
   de los días deberían llevar una de estas."). `place.grade` still exists in the data model and
   still drives the `tag--grade-${grade}`/`badge--grade-${grade}` CSS class name (never rendered
   as text or announced) and the `interestLevelForGrade`/`markerIcon` lookups. Full "Fuentes"
   disclosure section is `05 §5` pt. 14 / B4 scope; until it exists, the letter surfaces nowhere
   in the UI, per Art. 00's literal "Sólo en «Fuentes» plegado."
8. **`Button`/`Chip`/fields rebuilt on tokens (`04 §3`–`§4`).** `.button` base + `--primary`/
   `--secondary` (existing) plus two new variants the contract names but nothing used yet —
   `--quiet`, `--danger` — plus `.button--lg` (48px, full-width; applied to `PlaceDetail`'s
   "Quiero ir" button, the one control `05 §5` pt. 6 names as `primary lg` ancho completo).
   `press` motion (`scale(.98)`, `--dur-fast`) added to `.button`/`.icon-button`; it's covered for
   free by the pre-existing global `prefers-reduced-motion` rule (`*,*::before,*::after` →
   `0.001ms`), so no new reduced-motion carve-out was needed. `.filter-chip` rebuilt as the
   `ChipToggle` variant of `04 §3` — visual box stays 40px (`--radius-xs`,
   `--surface-sunken`/`--shu-050` states), but its **real, effective hit area is 44×44px**, per
   the compliance correction below: `04`'s 40px is a visual-design number, and Art. 11's 44px
   floor governs the actual click/tap target whenever the two are read as being in tension (`08`
   "Orden de precedencia": the Constitution outranks a specific document). `.tag`'s anatomy
   (radius, spacing, type) moved to tokens; its per-variant hex (gem purple, alert/reservation
   borders) has **no** equivalent token in `03 §1` and was deliberately left as pre-existing debt
   rather than inventing a new colour — see "Deliberately deferred" below.
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

## Corrección de cumplimiento normativo (post-close audit)

An independent audit of this branch, run after the first close, found three real violations.
All three are fixed on this branch; nothing here reopened B2 or redesigned any surface — every
fix is additive (a class, an attribute, a CSS pseudo-element) or subtractive (deleting text that
should never have rendered).

### 1. Grade letter still exposed through `title`

**Finding.** `PlaceDetail.tsx` had removed the visible `· Grado {place.grade}` text, but the tag's
`title` attribute still read `` `${interest.description} (grado original: ${place.grade})` `` —
the raw S/A/B/C/D letter, reachable via any tooltip or accessibility inspector. Art. 00's
prohibited-pattern table is explicit: the letter belongs "Sólo en «Fuentes» plegado," and that
section does not exist until B4. `title` is not "Fuentes"; B17 must not expose the letter
anywhere in the UI meanwhile.

**Fix.** `title` is now `interest.description` alone — the plain-language sentence
(`"Vale mucho la pena. La mayoría de los días deberían llevar una de estas."`), no grade suffix.
`place.grade` still exists in the data model and still drives the `tag--grade-${grade}` /
`badge--grade-${grade}` CSS **class name** (never rendered as text, never read aloud — a class
name is not visible or accessible content) and the internal `interestLevelForGrade`/`markerIcon`
colour lookups. Nothing was deleted from the model; only the leak into `title` was.

**Guard added.** `block17-design-foundation.test.ts` gained three tests: an exact re-check on
`PlaceDetail.tsx` (no `"grado original"` string, no `title={...place.grade...}` pattern, `title`
is exactly `interest.description`), a repo-wide scan of every `title=`/`aria-label=` attribute
in `components/`+`lib/` for a `.grade` reference (catches the same mistake anywhere else, present
or future), and a **self-test** that feeds the detector the exact original buggy string and
asserts it fires — so this gate cannot silently stop working.

### 2. `.filter-chip` (ChipToggle) hit target was 40px, not 44px

**Finding.** `04 §3` specifies `ChipToggle` at 40px, and the first close treated that as settling
the question. It doesn't: Art. 11 sets 44×44px as the floor with no visual-size exception, and
`08 §"Orden de precedencia"` puts the Constitution ahead of any specific document (`04` included)
when the two are read as being in tension. 40px visual is fine — 40px as the *actual click
target* is not.

**Fix.** `.tap-target-min`, a new shared CSS primitive (`App.css`, next to `.icon-button--small`):
`position: relative` on the control plus a `::after` — `content: ""`, `position: absolute`,
centered, `width`/`height: max(100%, var(--tap-min))`. A generated pseudo-element is part of its
host element for click-forwarding purposes in every current rendering engine, so this genuinely
enlarges the *clickable* area to at least 44×44px without enlarging anything that paints — the
visual chip stays exactly 40px tall. `.filter-chip` carries the identical `position: relative` +
`::after` pair on its own selector (not a `className`, since it's a shared base class with 6+
call sites across category/block/reservation/level/grade/radio filters — fixing the rule fixes
every instance and every future one).

**Verified, not asserted.** `scripts/b17-tap-target-check.mjs` measures the real
`getBoundingClientRect()` union (element + its `::after`) in a live browser — not the CSS source,
the actual rendered geometry — and additionally fires a synthetic click at a point *inside* the
44px zone but *outside* the 40px visual box, then confirms `document.elementFromPoint` resolves
to the chip. Both the geometry check and the live click-through passed for
`.filter-chip--grade` (the narrowest instance — a single-letter label).

**Guard added.** Three `block17-design-foundation.test.ts` tests: `--tap-min` is 44px in
`tokens.css`, `.tap-target-min`'s CSS mechanically does what's claimed (`position: absolute`,
`max(100%, var(--tap-min))` on both axes), and `.filter-chip`'s own rule (not a utility class)
carries the same mechanism.

### 3. Legacy controls under 44px, and icon-only buttons missing `title`

**Finding.** The audit named `.icon-button--small` (36px) explicitly and asked for a full sweep.
That sweep found, beyond `.icon-button--small`: `.app__help` (36px, and its own code comment
called this "a named historical allowance" — exactly the framing the audit says cannot survive),
`.trip-backup__close` (40px), `.gallery__dot` (28px, and *its* comment called 28px "a real … 
target"), and `.search-field__clear` (no explicit size, resolved to roughly 21×29px from
font-size/padding alone). Separately, a systematic parse of every `<button>` in `components/`
(102 total) found **22 icon-only buttons** that had `aria-label` but no `title`, across
`App.tsx`, `FilterPanel.tsx`, `Onboarding.tsx`, `OrderedSequenceBuilder.tsx` (10),
`PlaceDetail.tsx`, `PlaceGallery.tsx` (3, including a self-closing `<button/>` a naive
`<button>…</button>` regex silently mis-paired with the *next* button in the file — the parser
was rewritten to track self-closing tags explicitly after that first pass under-counted),
`PrefecturePanel.tsx`, `SelectionAnalysis.tsx`, `SelectionPanel.tsx`, `TravellerManager.tsx`,
`TripBackup.tsx`, `ZoneComparison.tsx`. None was missing `aria-label` outright — every icon-only
button already had *an* accessible name — but `04 §4` requires both.

**Fix.**
- `.tap-target-min` applied (as a `className`, since each is its own distinct rule) to
  `.app__help`, `.trip-backup__close`, and `.search-field__clear`. `.gallery__dot` and all 11
  `.icon-button--small` call sites (`OrderedSequenceBuilder.tsx` ×10, `SelectionPanel.tsx` ×1)
  initially received the same treatment in this pass, but a second audit (§4 below) found that
  technique unsafe for those two specifically — they were moved to a different mechanism there,
  not left on `.tap-target-min`. `.app__backup` (already 44px) needed no change; its comment,
  which had framed `.app__help`'s 36px as an accepted exemption, was rewritten to state the
  actual fix instead.
- `title={<same text as the existing aria-label>}` added to all 22 buttons found missing it
  (a literal string where the label was static, the identical template expression where it was
  computed from props — e.g. `` title={`Mover ${place.name} hacia arriba${labelSuffix}`} ``
  next to the equivalent `aria-label`).

**Verified.** `scripts/b17-tap-target-check.mjs` additionally measured `.app__help`
(36→44 effective) and `.trip-backup__close` (40→44) live in the browser; both passed.
`.icon-button--small` and `.gallery__dot`'s live verification is covered in §4 below, under the
mechanism they actually ended up using.

**Guard added.** A new `block17-design-foundation.test.ts` describe block ports the exact
22-button audit into a permanent, browser-free gate: it parses every `<button>` (including
self-closing ones) in every `components/` file, strips `aria-hidden` decorative content,
`<Icon/>` calls, comments and whitespace-only expressions from what's left, and fails if any
button with no remaining visible text lacks either `aria-label` or `title`. A second test
confirms the exact `className` string (`"... tap-target-min"`) is present at the three
single-instance call sites that kept this mechanism (`.app__help`, `.trip-backup__close`,
`.search-field__clear`); `.icon-button--small` and `.gallery__dot`'s guards moved to §4.

### 4. Overlapping hit targets between neighbouring controls

**Finding.** §3's fix gave `.icon-button--small` and `.gallery__dot` the same `.tap-target-min`
treatment as every other under-sized control: an invisible, absolutely-positioned `::after`
centered on the element, sized `max(100%, var(--tap-min))`. That technique is correct for a
control with no same-sized neighbour close by, but wrong wherever several such controls sit in a
tight row — `.sequence-item__controls` (5 `.icon-button--small` buttons, `0.3rem`/4.8px real
gap), `.day-card__header-actions` (3 buttons, `0.25rem`/4px gap), and `.gallery__dots` (up to
several dots, `0.15rem`/2.4px gap). In every one of these, the gap between two real 36px (or
28px) boxes is smaller than the sum of the two invisible 4–8px-per-side expansions those boxes
would need to reach 44px, so the expanded zones would overlap: a click near the shared border
between two adjacent controls would land on whichever pseudo-element painting order happened to
resolve first, not deterministically on the nearer control — an ambiguity Art. 11 does not allow,
even though each individual box measured ≥44×44px in isolation.

**Fix.** Both groups moved to a second technique instead of the invisible-`::after` expansion:
the control's own real layout box — the thing `getBoundingClientRect()` reports with no
pseudo-element involved — now measures `var(--tap-min)` (44×44px) directly, and the small visual
appearance (the 36px circle, the small dot) is drawn by an inner element that stays compact and
centered:
- `.icon-button--small`: `width`/`height: var(--tap-min)`, no background/border of its own; a
  `::before` (absolute, centered, `2.25rem`/36px, `border-radius: 50%`) paints the circle that
  was always the visual size. `.icon-button--small:hover` explicitly resets `background: none`
  (the base `.icon-button:hover` rule would otherwise paint the enlarged real box, not just the
  circle) and `.icon-button--small:hover::before` carries the hover fill instead.
- `.gallery__dot`: already painted its visible dot via a `::before` inside a flex-centered real
  box (never absolute positioning), so the fix is a one-line change — `width`/`height` on the
  real box go from `1.75rem` (28px) to `var(--tap-min)` (44px); flex centering keeps the small
  dot centered with no further change.
Because both are now real layout boxes, not painted-over invisible zones, two neighbours
literally cannot overlap — it is the same geometric guarantee that keeps two adjacent `<div>`s in
a flex row from occupying the same pixels, not a claim that needs a runtime check to believe, but
one this correction still measures directly (below) rather than trusting by inspection alone.

**Verified.** `scripts/b17-tap-target-check.mjs` gained a `checkDenseRow()` helper, run against
the densest real row of each group in a live browser (390×844 viewport): `.sequence-item__controls`
(3 buttons visible for that list position), `.day-card__header-actions` (3 buttons), and
`.gallery__dots` (2 dots — Tokyo National Museum, JP-021, is one of only 6 places in the dataset
with a 2-photo gallery, and is now targeted directly by name instead of guessing through the
first N cards, which is why this group's live verification was previously incomplete; see §3's
note in the first correction pass). For every adjacent pair in each group it asserts three things
in the same pass: (a) each control's own `getBoundingClientRect()` is ≥44×44px with no
pseudo-element involved, (b) the two neighbours' real boxes do not overlap on both axes, and (c)
`document.elementFromPoint()` 1px inside each box's edge facing its neighbour resolves to that
box's own control — never to the neighbour, never to nothing. All 26 checks in the script pass,
including the 15 added by this correction (3 dense-row checks × the box/overlap/boundary triplet,
across the three groups, plus the new direct gallery-dot reachability and box tests).

**Guard added.** `block17-design-foundation.test.ts`'s tap-target describe block was split: one
test still confirms `.tap-target-min` on the three controls that legitimately keep it
(isolated, no same-sized neighbour close enough to conflict); a new test asserts
`.icon-button--small` and `.gallery__dot` **do not** carry `tap-target-min` (a regression here
would silently reintroduce the overlap); and two more tests read `App.css` directly to confirm
each control's own rule sets `width`/`height: var(--tap-min)` while its paired `::before` rule
stays a fixed, small size (never `var(--tap-min)`) — so the box and its painted content cannot
grow back into lockstep and the row stop being dense.

### Verification after the correction

Lint, `tsc -b`, `vite build`, the full Vitest suite, the responsive overflow check (6
breakpoints), the functional regression script, and the tap-target script were all re-run
end to end after every fix above, including this document's second pass covering §4. Results
are folded into the "Gates — result" and "Baseline vs. final" tables below, which already
reflect the corrected numbers.

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
| G1 — Tests | **3200 / 93** files, all green. Baseline (before this block): 3179 / 92. `block17-design-foundation.test.ts` grew from 8 tests at the first close to 17 after the first compliance correction, then to **21** after the second (overlapping-hit-target) correction — the single test asserting `.tap-target-min` on `.icon-button--small`/`.gallery__dot` was replaced with four narrower ones: isolated controls still carry it, the two dense-row controls explicitly do not, and each of those two has its own real-box/small-visual CSS assertion. 5 pre-existing tests were edited across the whole block (not deleted), each with an inline citation to the document/section that justifies the change: `block1-ux.test.ts` (grade-letter test inverted to assert the letter is gone, per Art. 00 + `03 §1.3`; the `--tap-target` literal-value test updated to check the new token alias, per `03 §7`), `PlaceCard.test.ts` (2 cases, glyph→icon), `transfer-display.test.ts` (1 case, glyph→icon-name). |
| G2 — No capability regression | Checklist below (§"Regression audit"); all pass, re-verified after the correction. |
| G3 — Phone chrome | Not this block's gate — B2 owns cromo consolidation (`10_ROADMAP` B1 doesn't list a chrome-height criterion; B2 does). No chrome was restructured here. |
| G4 — No tokens outside system | Automated: `block17-design-foundation.test.ts` — 0 emoji in component/lib source (excluding `data/`, comments, and the two sanctioned glyphs `ⓘ`/`★`), 0 new hex (`git diff` grep confirms zero `#`-hex added across `App.css`/`components/`/`lib/`, re-checked after the correction too), 0 new `@media (max-width:…)` (tokens.css/fonts.css/index.css: none ever; App.css: 9, unchanged from before this block). |
| G5 — Accessibility | Tap targets: **every** identified control now has a real, measured ≥44×44px hit area with no ambiguous overlap between neighbours — `.filter-chip`'s 40px, `.app__help`'s 36px and `.trip-backup__close`'s 40px are *visual* sizes only, made ≥44px via `.tap-target-min`'s invisible `::after` expansion (safe here: no same-sized sibling sits close enough for the expansions to reach each other); `.icon-button--small`'s 36px circle and `.gallery__dot`'s dot sit inside a real 44×44px layout box instead, because both live in tight rows (`.sequence-item__controls`, `.day-card__header-actions`, `.gallery__dots`) where the invisible-expansion technique would have let adjacent controls' expanded zones overlap. `scripts/b17-tap-target-check.mjs` measures all of this live in a browser — box size, and for the dense-row groups also no overlap between neighbours and correct `elementFromPoint()` resolution at each box's own edge — not just declared in CSS (see "Corrección de cumplimiento normativo," §§2–4). All 102 `<button>` elements in `components/` were audited; the 22 icon-only ones missing `title` now have it alongside their existing `aria-label`, per `04 §4`. Contrast: every new colour pairing checked against WCAG (`white`/`--shu-600` 5.44:1, `white`/`--shu-700` 8.06:1, `--ink-900`/`--surface` 18.11:1, `--ink-700`/`--surface-sunken` 9.22:1, `--risk-600`/`--surface` 7.0:1, grade badges' worst case `--surface`/`--ink-500` 4.99:1, filter-chip selected state `--shu-700`/`--shu-050` 7.17:1 text and `--shu-600` border 4.84:1 graphic). Focus ring: `--ink-900`, 2px, 18.11:1 against `--surface`. Keyboard: verified via `scripts/b17-regression-check.mjs` (Tab moves focus; Escape closes the lightbox). |
| G6 — Performance | Entry chunk: 1,398,734 B (gzip 258,978 B) vs. the Block 16 baseline 1,389,652 B (gzip 257,540 B) — **+0.7%**, the 34-icon SVG set, the token/font-face CSS, and the two compliance corrections' `title`/class/CSS additions this block exists to add, not incidental bloat. CSS: 106,443 B vs. baseline 98,170 B (+8.4%, same reason plus `.tap-target-min` and the dense-row real-box rules). Fonts: 3.2 MB total across 15 self-hosted `woff2` files, but every one is behind a `unicode-range`; a browsing session that never opens a ficha (never renders `lang="ja"` text) never fetches the ~1MB-per-weight Japanese chunks at all. |
| G7 — Visual review | Screenshots below (unaffected by the correction — every fix is invisible or near-invisible by design). |

## Baseline vs. final, exact figures

| Check | Baseline (`ccc269b`) | Final (this block's head, post-correction) |
|---|---|---|
| Vitest | 3179 / 92 files | **3200 / 93 files** |
| Lint (`oxlint`) | clean | clean |
| `tsc -b` / `vite build` | clean | clean |
| Entry JS chunk | 1,389,620 B / gzip 257,540 B | 1,398,734 B / gzip 258,978 B |
| CSS bundle | 98,170 B / gzip 19,590 B | 106,443 B / gzip 20,525 B |
| `@media (max-width:…)` in `App.css` | 9 | 9 (unchanged) |
| Hex literals added | — | 0 |
| Emoji-as-icon occurrences | ~50 across 16 files (per audit) | 0 |
| Icon-only `<button>`s missing `title` (of 102 total) | n/a (pre-existing condition) | 0 |
| Interactive controls with a visual size <44px and no measured ≥44px hit area | n/a (pre-existing condition) | 0 |
| Adjacent same-sized controls whose ≥44px hit zones could ambiguously overlap | n/a (pre-existing condition) | 0 |
| Raw grade letter reachable anywhere in rendered UI (text, `title`, `aria-label`) | n/a (pre-existing condition) | 0 |

## Responsive sanity check

`scripts/b17-responsive-check.mjs` loaded the entry screen, the Tokyo city list, and a place
ficha at 320px, 360px, 390px, 430px, 820px (tablet) and 1440px (desktop) and measured
`document.documentElement.scrollWidth` vs. `clientWidth` at each. **Zero horizontal overflow at
any of the 18 checks.**

## Regression audit

`scripts/b17-regression-check.mjs` drove a real browser (390×844) through the capabilities this
block was told not to break. Run once at the first close and again after the compliance
correction. **14/14 checks passed both times**, zero console/page errors (aside from
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

None was raised, in the original close or in the compliance correction. Every genuinely new
choice this block made (unicode-range subset boundaries, which four ink shades replace the five
interest hues, `.button--lg`'s width/height, the `b17-*.mjs` script names, the
`.tap-target-min` invisible-hit-area technique and where to anchor it) falls under
`08 §"Lo que ingeniería decide libremente"` — implementation technique for a Constitutional
requirement (Art. 11), not a new visual value — and is recorded above with its rationale. The
one genuine document-vs-document tension the correction resolved (`04 §3`'s 40px vs. Art. 11's
44px) was resolved by `08`'s own explicit precedence order, not by invention: "1.
`00_CONSTITUCION_DE_DISENO.md` … " outranks "2. El documento específico (`03`–`07`)."
