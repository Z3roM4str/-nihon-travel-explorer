# Block 7 — handoff

Written so the next session, or an auditor, can continue from GitHub and this repository alone.

## Identity

| | |
|---|---|
| Repository | `Z3roM4str/-nihon-travel-explorer` |
| Branch | `claude/brave-wozniak-f79ie3` |
| Started from | `86ef3c825a2b4ee51103c6c70e7a97939dfa9d1a` (Block 6 closed) |
| `main` reference | `1a11fe8cfd2fb1b2ed31c463472181f2a29cba81` (Nihon v1.0.0) — untouched |
| Merged to `main`? | **No.** No pull request. No merge. No new branch. |
| Working tree | Clean. |
| Block 7 status | **Closed.** |

## Authority situation

The first recommendation in `docs/BLOCK_6_HANDOFF.md`, unclaimed since Block 4. The roadmap
assigned Block 7 to nothing else, and no document contradicted it. No authority conflict was found.

**Preflight discrepancy, unchanged from Block 6 and again left alone:** the local `main` ref is
stale at `b924f5c`. `origin/main` is `1a11fe8`, matching the brief, and work proceeded from the
authorized HEAD. `main` was not to be modified and the stale ref is local only.

## Commits

1. `0a5dc69` `feat(zones): put the airport operators behind the airport links`
2. `docs(block-7): design record, roadmap entry and handoff` — the head commit. It cannot carry its
   own hash; `git log -1 claude/brave-wozniak-f79ie3` is the authority.

## Files

**New**

| File | What it is | Tests |
|---|---|---|
| `app/src/lib/zone-provenance-presentation.ts` | The copy: short source name, tier in words, accessible link label. | 26 (shared) |
| `app/src/lib/zone-provenance.test.ts` | The data and helper contract. | ” |
| `app/src/components/ZoneSources.test.ts` | The wiring contract for the source line. | 13 |
| `app/scripts/block7-zone-provenance-browser-audit.mjs` | 43-check real-viewport audit against the production build. | — |
| `docs/BLOCK_7_DESIGN.md` | The design record. | — |

**Modified:** `data/accommodation/zones.json` and its byte-identical app copy (provenance on all 16
zones; `sources` on 5; one service string narrowed), `app/src/lib/accommodation-zone.ts` (types and
four helpers), `app/src/components/ZoneComparison.tsx` (the source line),
`scripts/validate-accommodation-zones.py` (the new contract), `app/src/App.css`, `docs/ROADMAP.md`.

**Deleted:** nothing.

## Facts audited

All 16 zones × 3 fact areas = **48 fact areas**, every one of which was backed by a single
Wikipedia station article and nothing else.

| fact area | zones | state before | state after |
|---|---|---|---|
| `railLines` | 16 | encyclopedia | encyclopedia — **not migrated** |
| `shinkansen` | 16 | encyclopedia | encyclopedia — **not migrated** |
| `airportLinks` | 16 | encyclopedia | **5 zones now carry an operator source**; 11 unchanged |

## Facts migrated — old source → new source

All five replace a Wikipedia station article as the *best* source for that claim.

| zone | claim | old | new | tier |
|---|---|---|---|---|
| `ZN-TOK-SHINJUKU` | Narita by N'EX, direct | `en.wikipedia.org/wiki/Shinjuku_Station` | `narita-airport.jp/en/access/train/` | operator |
| `ZN-TOK-MARUNOUCHI` | Narita by N'EX, direct | `en.wikipedia.org/wiki/Tokyo_Station` | `narita-airport.jp/en/access/train/` | operator |
| `ZN-TOK-SHIBUYA` | Narita by N'EX, direct | `en.wikipedia.org/wiki/Shibuya_Station` | `narita-airport.jp/en/access/train/` | operator |
| `ZN-TOK-UENO` | Narita by Keisei Skyliner from Keisei-Ueno | `en.wikipedia.org/wiki/Ueno_Station` | `narita-airport.jp/en/access/train/` | operator |
| `ZN-OSA-NAMBA` | Kansai by Nankai Rapi:t, direct | `en.wikipedia.org/wiki/Namba_Station` | `nankai.co.jp/en_railway/ticket/rapit` | operator |

**What each source actually states** (consulted 2026-09-18):

- Narita International Airport, rail access: Narita Express (JR-East) serves "Tokyo Station,
  Shinagawa Station, Shibuya Station, Shinjuku Station, Yokohama Station"; Keisei Skyliner (Keisei
  Electric Railway) serves "Nippori Station, Keisei Ueno Station".
- Nankai Electric Railway, Rapi:t: the service runs "Kansai Airport Station→Sakai Station,
  Sumiyoshitaisha Station, Tengachaya Station, Shin-Imamiya Station, Namba Station".

**One claim narrowed.** `ZN-OSA-NAMBA`'s service text changed from `"Nankai Rapi:t (andén 9)"` to
`"Nankai Rapi:t"`. The operator page states the route and no platform. Airport, service identity
and `directFromZone` are unchanged; this is the only non-provenance data change in the block.

## Facts deliberately NOT migrated, and why

| what | why |
|---|---|
| `railLines`, all 16 zones | Every relevant operator refuses automated requests from this environment: JR East, JR Central, JR West (`403`), Tokyo Metro (`403`), Toei (WAF), Kyoto and Osaka municipal subways (unreachable). Several private railways *are* reachable, but a Tokyo station's line list spans four or five operators and a partial citation would be less honest than the encyclopedia it replaced. |
| `shinkansen`, all 16 zones | JR Central, JR East and JR West are all `403`. |
| Haneda links (4 Tokyo zones) | Haneda's own pages are readable and confirm Keikyu and Tokyo Monorail as the direct rail operators, and list limousine buses to Shinjuku and Ikebukuro. But the dataset records `directFromZone: false` for those zones, and attaching a page showing a direct limousine bus to a claim of "not direct" would make the source contradict the claim. `directFromZone` is a Block 3 decision and re-interpreting it is out of scope. **Recorded below as a real finding.** |
| `ZN-TOK-ASAKUSA`, both links | The through-service onto the Toei Asakusa Line is the substance of the claim. Toei is behind a WAF; Keisei's page names Shinagawa, Shimbashi and Nihombashi but never Asakusa. Reading the claim off that list is an inference the page does not make. |
| `ZN-TOK-IKEBUKURO`, Narita | Narita's page lists Ikebukuro under conventional JR, so using it to support "not direct" needs more care than it repays. |
| Kansai links for Kyoto Station, Shin-Ōsaka, Tennōji, Umeda | The Haruka is JR West (`403`) and Kansai Airport is `403`. |

**A fabricated primary source is not an improvement in authority; it is an improvement in the
appearance of authority.** Nothing was cited that was not read.

## Schema changes

Additive only; no field removed, renamed or retyped.

```ts
type ZoneFactArea  = "railLines" | "shinkansen" | "airportLinks";
type ZoneSourceTier = "operator" | "authority" | "official-tourism" | "secondary";

ZoneProvenance += { tier: ZoneSourceTier; covers: ZoneFactArea[] }   // both required, covers never empty
ZoneFacts      += { sources?: ZoneProvenance[] }                     // optional
```

Helpers added to `accommodation-zone.ts`: `zoneSources`, `sourcesForFactArea`,
`bestSourceForFactArea` (best tier, ties by declaration order), `distinctZoneSources`.

`tier` is **stored, not derived from the hostname**: whether a page is "the operator" is a
judgement about the claim, not a fact about a domain name.

## Persistence

**None added.** Block 7 touches a static dataset and one presentational line. No `localStorage`
key, no document, no migration. Asserted by the browser audit, which compares the full `nihon.*`
key set across the flow.

## Visible change

One line per zone column, from:

> `[Fuente] · consultada el 2026-09-17`

to:

> `Fuentes: [Narita International Airport] (operador) · [Wikipedia] (fuente secundaria)`

The date moved into the link's accessible name, which also carries the zone name so the same source
backing several columns stays distinguishable to a screen reader. The tier is a word, never a
colour or icon alone, and is never presented as a rating. Long names wrap; the link is underlined;
pressing a source stops propagation so it can never become choosing a zone.

## Tests added

| file | tests |
|---|---|
| `app/src/lib/zone-provenance.test.ts` | 26 |
| `app/src/components/ZoneSources.test.ts` | 13 |
| **Vitest total** | **+39** |
| `app/scripts/block7-zone-provenance-browser-audit.mjs` | 43 per viewport × 3 = **129** |

Plus 13 hand-run negative cases against the extended Python validator, all rejected correctly.

## Gates

| check | baseline | result |
|---|---|---|
| Vitest | 2930 / 84 files | **2969 passed**, 0 failed, **86 files** |
| oxlint | clean | clean |
| `tsc --noEmit -p tsconfig.app.json` | clean | clean |
| `vite build` | OK | OK |
| Python suites | 13 | **13 of 13 pass** |
| Validators | 8 | **8 of 8 argument-free pass** |
| Block 1 UX audit | 142/142 | **142/142**, unmodified |
| Block 2 photography audit | 69/69 | **69/69**, unmodified |
| Block 3 zone audit | 105/105 | **105/105**, unmodified |
| Block 4 zone → planner audit | 261/261 | **261/261**, unmodified |
| Block 5 two-traveller audit | 225/225 | **225/225**, unmodified |
| Block 6 divergence audit | 216/216 | **216/216**, unmodified |
| **Block 7 zone-provenance audit** | — | **129/129** (43 per viewport × 3) |
| `git diff --check` | clean | clean |

The baseline was measured on this branch at `86ef3c8` **before any edit** and matched the Block 6
handoff exactly.

### The gate list a future block must run

```
cd app && npm ci && npm test && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run build
pip install -r scripts/requirements.txt          # Pillow, for test_photography_rendition.py
for t in scripts/test_*.py; do python3 "$t"; done                 # 13, all must pass
for v in scripts/validate-*.py; do python3 "$v"; done             # 8 argument-free
cd app && node scripts/block1-ux-browser-audit.mjs
          node scripts/block2-photography-browser-audit.mjs
          node scripts/block3-zones-browser-audit.mjs
          node scripts/block4-zone-planner-browser-audit.mjs
          node scripts/block5-travellers-browser-audit.mjs
          node scripts/block6-divergence-browser-audit.mjs
          node scripts/block7-zone-provenance-browser-audit.mjs
```

Add `--browser=/opt/pw-browsers/chromium`. Do **not** run `playwright install`.

## Browser audit, per viewport

`block7-zone-provenance-browser-audit.mjs` runs against the production build via `vite preview` at
**390×844 DPR 2**, **820×1180 DPR 2** and **1440×900** — 43 checks each, 129 total, all passing.

It opens the real comparison and checks: every column carries a provenance line, introduced as
"Fuente(s):" → the source is named rather than being the bare word "Fuente" → no raw URL is shown →
the auditor's qualifier is not dumped into the link text → each source says how close it is, in
words, with no number or rating → a Tokyo zone names **Narita International Airport** as
**(operador)** while the station article reads **(fuente secundaria)**, so the two are told apart by
text rather than position → no horizontal page scroll, the line never widens its column, nothing is
clipped or ellipsised → every link has a unique accessible name naming its zone and consultation
date, opens in a new tab with `rel=noreferrer`, points at https, and is underlined rather than
distinguished by colour → a link can take focus, tab moves past it, focus stays visible → pressing
a source leaves the compared zones exactly as they were, does not drop back to the browse list,
writes no planning decision and no storage key → Back/Forward leaves a usable app and throws
nothing → and Block 3 and Block 4's card is otherwise unchanged: facts still "verificables",
geometry still "calculado", no zone called the best, provenance never presented as a quality
rating, and the tier never attached to an editorial axis.

## Regressions found

**None.** All six historical audits pass at their exact baseline counts and none was modified.

One real accuracy defect was found **in Block 7's own new code** before the commit: the comment
beside the source link's `stopPropagation` claimed "the column is itself clickable". It is not —
`.zone-column` is a plain `<section>` with no handler. The comment now says what is true (defence
in depth against a handler being added later) and a test pins the column's handler-free state.

## False positives of the new gate, and what was done

Three, all in `block7-zone-provenance-browser-audit.mjs` itself, all found and fixed before the
commit. None was a product defect; none led to weakening anything.

1. **Focus trap.** The check compared the focused element's *class name* before and after `Tab`.
   Two sibling source links share a class, so a correct tab looked like a trap. It now tags the
   origin element and compares identity.
2. **History navigation.** Loading the same URL twice does not create a second history entry —
   Chromium **replaces** it — so `goBack` stepped onto the context's initial `about:blank` and the
   check reported a broken app. It now uses a `#audit` hash entry, giving history a real app
   document on both sides.
3. **A `SecurityError` blamed on the product.** `addInitScript` runs in *every* document the
   context creates, including that `about:blank`, where touching `localStorage` throws. The audit's
   own harness was being reported as a page error in the app. The seeding call is now guarded.

## Findings recorded but not acted on

**`directFromZone` for the Haneda links may be wrong.** Haneda's own bus page lists a limousine bus
running Haneda → Shinjuku Station West Exit (approx. 35 min, Airport Transport Service) and
Haneda → Ikebukuro Station West Exit (approx. 55 min). The dataset records those zones as
`directFromZone: false`, which is defensible if the field means *direct rail*, and wrong if it means
*direct service*. Block 3 defined the field; deciding what it means is a product decision and is
out of Block 7's scope. **This is the single most concrete thing a follow-up could settle.**

## Remaining technical debt

| | |
|---|---|
| `railLines` and `shinkansen` are still encyclopedia-sourced on all 16 zones | Not a defect of this block: the operators are unreachable from this environment. A session with different network egress could finish the job; the schema is already ready for it, and the work is per-fact-area rather than a migration. |
| Four zones inline the same Narita source record | Real duplication. A source registry with ids would remove it but is larger than any provenance block should be; the existing model already inlines `provenance` 16 times. |
| `directFromZone` semantics are undefined in the data contract | See the finding above. |
| `consultedAt` has no staleness policy | Nothing warns that a 2026-09-17 citation is old. A validator rule would be easy; what the threshold should be is a product decision. |
| `.icon-button--small` remains a 36px control in the saved list | Pre-existing and explicitly allowed since Block 1. |
| Two travellers share one browser profile | By design, from Block 5. |
| `useZonePlanChoice` relies on comparison and planner being mutually exclusive | Re-examined again; Block 7 adds no writer and no reader of the draft. |
| `RC-05` | Single JS chunk above Vite's 500 kB advisory. Pre-existing, untouched. |
| Editorial zone ratings still have no second reader | Inherited from Block 3. |

---

## ¿BLOQUE 7 CERRADO? **SÍ**

Preflight correct; scope explicitly bounded and justified by verifiability; every substituted
source materially superior and actually read; every updated fact genuinely supported;
fact/derived/editorial intact; no new persistence; Blocks 1–6 unbroken; all gates green; tree
clean; branch pushed; `main` untouched; no merge, no pull request.

---

## Recommendation for Block 8

**Settle what `directFromZone` means, and make the airport links say it.** It is the one concrete
defect this block surfaced and could not fix: Haneda's own page shows a direct limousine bus to
Shinjuku and Ikebukuro while the dataset marks both `false`. The question — does "direct" mean
direct *rail*, or direct *service of any mode* — is a small product decision, it is fully
answerable from sources already reachable (Haneda's bus page, Narita's rail page), and whichever
answer is chosen the field becomes checkable instead of ambiguous. It is bounded, it improves
factual quality rather than adding surface, and it finishes the thread Block 7 opened.

**Second choice:** let the two travellers review the editorial zone ratings. Carried since Block 3,
now actionable because both readers exist. Needs a small product decision about whether a rating is
shared or personal — by Block 5's own rule almost certainly *shared*, since it is a claim about a
place rather than a preference about one.

**Explicitly NOT recommended now:**

- **Re-sourcing `railLines` and `shinkansen` from this environment.** The operators are unreachable
  and the only way to "finish" it here would be to cite pages nobody read.
- **A source registry with ids.** The duplication is four records; the machinery is not worth it yet.
- **Any use of `tier` as a score, a ranking input or a quality badge.** The tests exist to forbid it.
- **The backend / two-device layer**, more photography (both Block 2 STOP criteria hold), more
  zones (the 4–7 rule), travel-time estimation without a routing-provider decision.
