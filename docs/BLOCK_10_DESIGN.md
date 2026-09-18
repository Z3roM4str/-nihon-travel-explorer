# Block 10 — freshness and governance of `consultedAt`

Defining what a consultation date means, and what it means for one to have aged. **No source was
re-visited, no date was changed, and no fact was touched.**

## The inventory came first

35 provenance records, across three independent systems:

| system | records | dates | age at 2026-09-18 |
|---|---|---|---|
| zone facts (`zones.json`) | 23 | 2026-09-17, 2026-09-18 | 0–1 days |
| reservation mechanisms | 8 | 2026-09-12 … 2026-09-15 | 3–6 days |
| access points | 4 | 2026-09-05 | 13 days |

No missing date. No duplicate URL carrying two different dates. **No future date.** Oldest check:
13 days. **Nothing in this repository is stale by any reading.**

That is the single most important fact about this block: it writes a policy that **does not fire
today**, and it says so rather than manufacturing a problem to solve.

## What `consultedAt` means

> **The civil date on which Nihon opened that source and confirmed it supported the claim beside
> it.**

Interpretation **C**, and the history is what settles it:

| candidate | verdict |
|---|---|
| A. the source's publication date | **No.** Nothing in the data resembles one; `narita-airport.jp/en/access/train/` has no publication date at all. |
| B. the page's last-modified date | **No.** Operators rarely publish one, and Blocks 7–8 never read one. Inferring it would be inventing a fact — the precise failure those blocks were built to avoid. |
| C. the date Nihon checked the source against the claim | **Yes.** Blocks 7 and 8 wrote each date on the day they actually read the page, and each record's `evidence` string quotes what the page said on that day. The date and the evidence are one act. |
| D. the date the row entered the repository | **No.** Close in practice, but it would make a copy-paste of an old record look freshly checked, which is the confusion this field exists to prevent. |

## Age is not falsehood

| state | meaning |
|---|---|
| `current` | checked within the horizon its claims deserve |
| `needs-recheck` | still valid, and due for a look |
| `no-periodic-recheck` | nothing periodic governs these claims, so no clock applies |

**`unsupported` is deliberately not a freshness state.** A source stops supporting a claim when
somebody reads it and finds it no longer does — that is evidence, not arithmetic, and no function
in this block can produce it. Nothing here deletes a fact, weakens a claim, or downgrades a tier
because a date got old. It is not representable in the schema either, because no source is in it;
when one is, it will be a *stored* flag written by whoever read the page, not a computed one.

## Model B, and why the domain forces it

| fact area | horizon | why |
|---|---|---|
| `airportLinks` | **365 days** | These track *services*: which train or coach runs, and where it stops. Japanese operators revise timetables on an annual cycle. This dataset already carries the scar of one such change — Umeda's Haruka platforms, recorded as *"desde 2023"*. A check older than one full cycle has provably not seen the current timetable. |
| `railLines` | **none** | Infrastructure. Which lines serve a station changes when a line opens or closes — an announced event years in the making, not a scheduled revision. |
| `shinkansen` | **none** | Same, more so. New Shinkansen stations are decade-scale projects. |

**365 is not a round number chosen for comfort; it is one revision cycle.** And where no periodic
event governs a claim, there is deliberately no horizon at all: a calendar cannot tell you a new
line opened, and the calendar expiring tells you nothing. Re-reading structural facts on a timer
would be theatre.

**A source covering several areas takes the strictest horizon**, because it is due for a look as
soon as any claim it carries is due.

### The "no horizon" branch is real, not hypothetical

After Block 8 moved Namba's airport link to Nankai's own page, **`ZN-OSA-NAMBA`'s station article
backs `railLines` and `shinkansen` alone** — one genuine record in the shipped dataset with no
clock on it. That single record is why the model is per-area rather than one number for everything,
and a test asserts it exists.

Model A (one threshold) would have put a fictitious annual deadline on "does the Yamanote line
serve Shinjuku". Model C (no automatic policy) would have left the question the Block 9 handoff
asked entirely unanswered while the domain plainly supplies one rhythm.

## Determinism

`freshnessFor(source, today)` is pure and takes the date as an argument. `source-freshness.ts`
contains no `new Date()` and no `Date.now()`, asserted by test.

Arithmetic goes through `civil-date.ts`: whole-day, leap-year-correct, timezone-invariant by
construction. The boundary is **inclusive** — a source checked exactly `horizonDays` ago is still
`current`, and becomes `needs-recheck` the following day, because a cycle is over only once it is
over.

**The clock lives alone in `lib/today.ts`.** The first attempt put it in `civil-date.ts`, and that
module's own source scan rejected it — correctly: `civil-date.ts` is contractually clock-free and
forbids local getters, while "today" must be read from *local* calendar components, since a reader
in Tokyo at 08:00 must not be told yesterday's date because UTC has not caught up. The existing
gate caught the mistake; the fix was to put the function where it belongs, not to relax the gate.

## The trip's dates are deliberately not involved

The repository does know a trip horizon — `startDate` / `endDate` live in the planning draft. They
are **not** consulted here, and must not be: the freshness of a source is a property of the dataset
and is identical for every reader, while "check this again before you fly" is a property of one
trip. Coupling them would make a shared, canonical dataset produce different verdicts depending on
somebody's personal dates — exactly the shared/personal boundary Block 5 settled.

## What the validator now refuses

The zone validator checked only the **shape** `\d{4}-\d{2}-\d{2}` until this block, so it accepted
`2026-02-30`, `2026-13-01` and `2099-01-01`. The other two validators already used a real
`valid_date`; the zone one was the weak outlier, and now matches them.

- **an impossible date** — `2026-02-30`, `2026-13-01`, `2027-02-29`;
- **a date in the future** — a check dated tomorrow was never made;
- on the primary record **and** the extra sources alike.

**Age is never an error.** A source checked eleven years ago passes the validator and is reported
as `needs-recheck` by the derived function — which is the entire distinction this block exists to
draw, enforced in both directions.

## The visible consequence, which today is none

A discreet note — *"conviene volver a comprobarla"* — renders beside a source past its horizon.
With today's dataset that is **no source at all**, so the everyday line is exactly what Block 7
left: name and tier, no date, no badge.

It is muted and deliberately **not red**: an unrepeated check has not been contradicted, and
colouring it as a fault would say something the data does not support. The wording is about *our
checking*, never about the claim.

The accessible name now says what the date means — *"comprobada recientemente"*, *"no necesita
comprobaciones periódicas"*, or, with the denial spelled out, *"conviene volver a comprobarla; no
significa que el dato sea incorrecto"*. It is threaded **through** `sourceLinkLabel` rather than
appended after it, so the consultation date stays last and Block 7's `$`-anchored audit keeps
passing untouched.

## Decisions taken

1. **Interpretation C**, because the evidence strings and the dates were written in one act.
2. **Model B**, because the domain supplies exactly one rhythm and it governs only one area.
3. **365 days = one timetable-revision cycle**, derived rather than chosen.
4. **No horizon at all for infrastructure**, because no periodic event governs it.
5. **The strictest horizon wins** for a multi-area source.
6. **`unsupported` is not a freshness state** and cannot be computed.
7. **Everything is derived; nothing is stored.**
8. **The clock is injected and lives alone** in `lib/today.ts`.
9. **The trip's dates stay out of it.**
10. **Impossible and future dates are invalid; old dates are not.**

## Decisions discarded, and why

| discarded | why |
|---|---|
| A single threshold for every fact area | Would put a fictitious annual deadline on which lines serve a station. |
| No automatic policy at all (Model C) | The domain supplies a real rhythm for one area; ignoring it would leave the Block 9 question unanswered. |
| 90 or 180 days | Not derived from anything. The only periodic event in this domain is the annual revision. |
| Failing the build on an old source | Confuses "due for a look" with "invalid", which is the one confusion this block exists to prevent. |
| Storing a `status: "stale"` field | Deterministic from `consultedAt`; storing it would create a second truth that can drift. |
| Deriving freshness from the trip's dates | Makes a shared dataset produce per-reader verdicts. |
| Putting `todayCivilDate` in `civil-date.ts` | Its source scan rejected it, correctly: that module is clock-free and timezone-invariant, and "today" needs local getters. |
| Downgrading an old `operator` source to `secondary` | Authority and freshness are independent dimensions. Blocks 7–8 said so; a test now enforces it. |
| Re-visiting sources to refresh dates | §15 of the brief, and it would be a different block. Nothing is due anyway. |
| Extending the policy to reservation mechanisms and access points | Their provenance has no `covers` field, so Model B cannot be expressed there. Inventoried and left alone; the same function serves them the day they gain a volatility signal. |
| Showing the date on the everyday line | Administrative metadata. It is already in the accessible name, and the project's own discipline is to speak only when there is something to say. |
