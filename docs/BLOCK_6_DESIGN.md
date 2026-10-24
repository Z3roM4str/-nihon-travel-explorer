# Block 6 — dónde no coincidimos

A derived view over the state Block 5 already stores. It creates no data, decides nothing, and
adds no surface of its own.

## The question it answers

Block 5 made a new state real — *we disagree about this place* — and the app reported it one row at
a time, as a short marker beside a name. There was no way to ask the list *which* of these do only
one of us want, and which has one of us actually said no to. That question is a question about the
saved list, so the answer lives in the saved list.

## The distinction the block exists to protect

| what happened | what it is | group |
|---|---|---|
| *yo quiero ir / tú aún no has opinado* | **falta una opinión** | `only-you` / `only-them` |
| *yo quiero ir / tú has dicho que no* | **opiniones distintas** | `differing` |

Collapsing those into one bucket called "desacuerdo" would tell the reader that their travelling
companion had rejected a place they have not even looked at. They are separate kinds, with separate
copy and separate counts, and only `differing` is ever worded as a difference of opinion.
`hasDifferingOpinions()` is deliberately about `differing` alone, and `emptyFilterSentence
("differing")` says so out loud: *"No hay opiniones distintas: nadie ha dicho que no a un lugar que
la otra persona quiere."*

## The model

Nothing is stored. Everything is a function of the Block 5 document plus, for one informational
flag, the ids the shared planner has put in a day.

```ts
type DivergenceGroupKind = "agreed" | "only-you" | "only-them" | "differing" | "unclaimed";

type DivergenceEntry = {
  placeId: string;
  group: DivergenceGroupKind;   // from the ACTIVE reader's side
  planned: boolean;             // the planner already holds it — information only
};

type ShortlistFilterKind = "all" | "agreed" | "only-one" | "differing" | "unclaimed";
```

`divergenceEntries(document, plannedPlaceIds)` walks the shortlist in the order it already has and
classifies each place. It introduces no ordering of its own. A place that is not in the shortlist —
one both of them have refused — is not in the view at all.

`only-you` and `only-them` are the same stored state read from two chairs. They are separate groups
because the copy for each is different, and one filter chip (`only-one`) covers both, because
*which* of the two it is belongs on the row rather than on a second chip.

## Persistence

**None.** No document, no version, no migration, no `localStorage` key. Asserted by test across
every Block 6 module, and by the browser audit, which compares the full set of `nihon.*` keys
before and after the whole flow.

The filter itself is React state in `SelectionPanel`, not storage. A filter is what the reader is
looking at right now, not a decision about the trip, and the app stores decisions. Reopening Nihon
shows the list, not the question somebody asked of it last Tuesday.

## Reading the planner without writing it

`plannedPlaceIds` is a **read**. `usePlannedPlaceIds` hands `loadReconciledDraft` a `DraftStorage`
whose `setItem` is a no-op, so there is no path from Block 6 to `localStorage.setItem` — a property
of the object rather than a promise in a comment.

It re-reads when the planner closes. `usePlanningDraft` persists on every change, so storage is
always current; what a snapshot in `App` would not know is that a day assignment had changed.
Rather than polling or subscribing, this leans on the lifecycle Block 4 already made structural:
the planner is the only live writer while it is mounted, so the moment it closes is exactly when
the draft has settled.

**"In the planner" means assigned to a day, not present in the route.** `freshDraft` seeds
`routeIds` from the saved list, so route membership is not a decision anybody made; day assignment
is. With `days` still `null`, `dayAssignedPlaceIds` returns the empty list.

## Preference is not a planning decision

A place the planner already holds whose interest is one-sided or disputed says so:

> Ya está en un día del recorrido. Esto no lo cambia.

and that is the end of it. Nothing is removed, moved, rescheduled or proposed for replacement. The
browser audit asserts the planning draft is **byte-for-byte** what the planner left, after the view
has been opened, filtered and read.

The note is silent for an agreed place, where "los dos quieren ir y está planificado" is not news —
the same *silent by default* rule Block 5 applied to the card marker, one level up.

## UX

**One row of filter chips inside the saved list.** Not a second main surface: that would have meant
a second place to look for the same places, a second navigation state and a second idea of what
"the list" is.

**The row appears only when it could partition the list.** With every saved place in one bucket,
"Todo" and that bucket's chip select the same rows, so the row would be two controls that do the
same thing. `shouldOfferFilters` requires at least two populated buckets — with one exception: a
filter the reader has already pressed stays offered even when it has emptied, because vanishing
mid-use would strand them in a filtered list with no way back, and because staying is how they
learn the answer is now *none*.

**One indicator per row, never two.** In "Todo" the list is Block 5's exactly, short markers and
all. Inside a filtered view the derived line states the same fact in full, from the reader's own
side, and the marker stands down rather than sitting beside it.

### Accessibility

`role="group"` with a derived label on the row; `aria-pressed` on each chip; the count inside the
accessible name, because the visible badge is a number with no subject; the visible label is text
and pressed is marked by weight, background **and** border, so the row survives greyscale; 44px
floor on every chip, with no allowance; the row scrolls horizontally rather than widening the panel
or wrapping into three lines on a phone; `prefers-reduced-motion` honoured.

## Copy

Reused from Block 5 wherever Block 5 had a word for it — "Los dos", "Sólo <nombre>", "no le
interesa", "Sin reclamar". The one phrase Block 6 adds is **"Opiniones distintas"**, used for
exactly one situation.

| group | line |
|---|---|
| `agreed` | Los dos quieren ir. |
| `only-you` | Sólo tú lo guardaste. <otra> aún no ha opinado. |
| `only-them` | Sólo <otra> lo guardó. Tú aún no has opinado. |
| `differing` | Opiniones distintas: una persona quiere ir y la otra ha dicho que no le interesa. |
| `unclaimed` | Estaba en la lista antes de crear los perfiles. Nadie ha dicho todavía si le interesa. |

Forbidden by test across every Block 6 module: a percentage, a score, a compatibility figure, a
ratio, `conflicto`, `deberíais`, `mejor opción`, `os conviene`, `ceder`, `votar`, a winner, or any
sentence that cannot be traced straight back to a stored stance.

## Decisions taken

1. **A derived view, not a document.** Everything is a function of Block 5's state.
2. **Silence and refusal stay different kinds**, in domain, copy and tests.
3. **A filter inside the saved list**, not a second main surface.
4. **The row hides when it cannot partition**, so the everyday view is unchanged.
5. **The derived line replaces the marker** rather than joining it.
6. **"Planned" means assigned to a day**, because route membership is nobody's decision.
7. **The draft reader's setter is a no-op**, making read-only a property rather than a promise.
8. **The filter is not persisted**, because it is not a decision.

## Decisions discarded, and why

| discarded | why |
|---|---|
| A "desacuerdos" document or key | Every value derives from Block 5. A second store could only drift. |
| One bucket for "sólo uno" and "opiniones distintas" | It would report silence as rejection. The whole point of the block. |
| A separate "Dónde no coincidimos" screen | A second place to look for the same places, for one question about the saved list. |
| A chip per side (`Sólo tú` / `Sólo <otra>`) | Six chips on a 390px phone, to say something the row itself already says. |
| Showing every chip including the zeroes | A `0` beside a name reads as a verdict about the trip. |
| Keeping the marker beside the derived line | Two indicators saying the same thing, which the brief rules out. |
| Marking a one-sided planned place for removal or replacement | A preference is not a planning decision. The view reports; Block 4 decides. |
| Persisting the active filter | Not a decision about the trip, and it would have meant a new key for a convenience. |
| A "% de acuerdo", a compatibility figure, a ranking, a vote | Forbidden by the brief and by the project's own discipline, and covered by tests that exist to forbid them. |
