# Block 8 — the meaning of `directFromZone`

Determining what the field represents, correcting the records that could not represent it, and
making the panel say it. No zone, rating, ranking or planning decision was touched.

## The finding that opened the block, and why it was the wrong diagnosis

Block 7 read Haneda's own bus page — a direct coach to Shinjuku (≈35 min) and to Ikebukuro
(≈55 min) — and saw both zones carrying `directFromZone: false`. It recorded that as "the booleans
may be wrong" and handed it on rather than reinterpreting a Block 3 decision.

That caution was right, and the diagnosis was wrong.

## What the data actually says

`directFromZone` feeds **nothing** but a CSS emphasis class and one word. No filter, no
calculation, no ranking, no sort reads it. So the only way to recover its meaning was the records
themselves. Testing the candidate interpretations against all 23:

| interpretation | verdict |
|---|---|
| **A.** any direct service exists between airport and zone | **No.** Would make three `false` records wrong, and cannot explain why they are `false`. |
| **B.** direct *rail* exists | **No — refuted by one record.** `ZN-OSA-UMEDA → Itami (ITM)` is `"Autobús limusina"`, a coach, marked **`true`** since Block 3. |
| **C.** the service named in *this* record runs with no change | **Yes. 23 of 23.** |
| **D.** something else demonstrable | Nothing else fits. |

The mechanical check: `directFromZone === !service.matches(/\bvía\b/)` held for **all 23 records**,
with no exception in either direction.

**So the field was not lying.** Three records were:

```
"Autobús limusina / vía Shinagawa"     directFromZone: false
```

That single string packs a **direct coach** and a **rail route with a change**. One boolean cannot
be true of the first and false of the second. `false` was correct for half of what the record
described, and the half the airport publishes had no record of its own.

## The contract

> **`directFromZone` is true when the service named in this record carries the traveller between
> this zone and this airport with no change.**

Three consequences, each tested rather than asserted:

1. **It is a claim about one service, not about the airport.** "Can I reach Haneda without
   changing?" is a zone-level question with more than one answer, and this field is not it.
2. **It is mode-agnostic.** A coach that runs without a change is direct exactly as a train is.
   Umeda → Itami has said so since Block 3, and that was always right.
3. **One record holds one service.** A zone offering both a direct coach and a rail route with a
   change has two records.

## Schema — one field added

```ts
export type ZoneAirportLinkMode = "rail" | "bus";

export type ZoneAirportLink = {
  airport: string;
  service: string;
  directFromZone: boolean;
  mode: ZoneAirportLinkMode;   // NEW, required
};
```

`directFromZone` stays a boolean. It asks a genuinely binary question — *does this service need a
change* — and nothing in the dataset needs a third answer.

**`mode` earns its place on two real cases the old model could not represent**, which is the bar
this block set itself:

1. `ZN-OSA-UMEDA → Itami` is a direct **coach** and rendered the identical word as a direct
   **train**. Both are direct; they are not the same journey — one is bound by traffic and the
   other by a timetable — and nothing in the model could tell them apart.
2. Splitting a bundled record requires saying which half is the coach and which the rail route.
   Free text in `service` is readable but not checkable.

It is a fact about the service. It ranks nothing, and a test forbids the vocabulary that would.

## Records changed

23 airport links audited; **25** after the split. Three records rewritten, every other record
unchanged except for gaining its `mode`.

| zone | before | after |
|---|---|---|
| `ZN-TOK-SHINJUKU` | `Autobús limusina / vía Shinagawa` · false | `Autobús limusina a Shinjuku Station West Exit` · **true** · bus<br>`Vía Shinagawa (Keikyū)` · false · rail |
| `ZN-TOK-IKEBUKURO` | `Autobús limusina / vía Shinagawa` · false | `Autobús limusina a Ikebukuro Station West Exit` · **true** · bus<br>`Vía Shinagawa (Keikyū)` · false · rail |
| `ZN-TOK-IKEBUKURO` | `Autobús limusina / vía Nippori (Skyliner)` · false | `Vía Nippori (Skyliner)` · false · rail |

**The third is a narrowing, not a split.** Every Narita bus page refuses this environment
(`403`, repeatedly, on five URLs), and the limousine-bus operator's own site is a JavaScript
application with no destinations in its HTML. Block 7's rule holds: nothing is claimed on a page
nobody read. The coach was dropped rather than promoted on an unverified source.

## Evidence

One new source, cited on the two zones whose coach claim it supports:

`https://tokyo-haneda.com/en/access/bus/` — Haneda Airport's own express-bus page, tier `operator`,
covering `airportLinks`. It names **"Shinjuku Station West Exit"** (≈35 min, Airport Transport
Service and Tokyu Bus) and **"Ikebukuro Station West Exit"** (≈55 min, Airport Transport Service
and Kokusai Kogyo Bus). Consulted 2026-09-18.

That is the only provenance work in this block. Block 7's sources are reused where they already
support the claim, and nothing else was re-sourced.

## Copy

| before | after |
|---|---|
| `directo` | `tren directo` · `autobús directo` |
| `con enlace` | `tren con transbordo` · `autobús con transbordo` |

Both old labels were ambiguous. *Directo* did not say direct **by what**; *con enlace* did not say
whether the enlace was a connection or a change. The visually-hidden sentence spells it out —
"En tren, sin transbordos" / "requiere al menos un transbordo" — because *directo* is precisely the
word a reader can take two ways.

The green emphasis still keys off `directFromZone` and **not** off the mode: directness is a fact,
and a direct coach is emphasised exactly like a direct train. Nothing in this block says a train is
better than a coach.

## What the validator now refuses

- an `airportLink` with a missing or unknown `mode`;
- a service naming a coach but recorded as `rail`, or `mode: "bus"` naming no coach;
- a service **whose own description routes it via another point** while claiming to be direct — the
  one text rule worth enforcing, because it catches a contradiction rather than guessing at prose;
- the same airport **and service** twice in one zone (two records for one airport are how both
  answers are told; two identical ones say nothing twice).

Ten negative cases were run by hand, including reintroducing the old compound record marked direct.
It rejects all ten.

The converse rule — "no *vía* implies direct" — is deliberately **not** enforced. A rail service can
be named anything, so the absence of a word proves nothing.

## Decisions taken

1. **Interpretation C**, because it is the only one all 23 records support.
2. **`directFromZone` stays a boolean.** The question it asks is genuinely binary.
3. **`mode` is added**, justified by two cases the old model could not represent.
4. **Compound records are split**, because one record must hold one service.
5. **The unverifiable coach is dropped**, not promoted.
6. **The label names the mode and the change**; neither alone is unambiguous.
7. **Emphasis marks directness, never a mode.**
8. **The `vía` rule is enforced in one direction only.**

## Decisions discarded, and why

| discarded | why |
|---|---|
| Flipping the two Haneda booleans to `true` | The brief's first warning, and it would have been wrong: the rail half of each record genuinely does need a change. |
| Reading the field as "direct rail" | Refuted by `ZN-OSA-UMEDA → Itami`, a coach marked direct since Block 3. |
| Reading it as "this airport is reachable without a change" | A zone-level question with more than one answer; the field lives on the service. |
| Replacing the boolean with a connection enum (`direct` / `transfer` / `mixed`) | "Mixed" only existed because a record held two services. Splitting removes the case, and an enum would have preserved the defect in the type system. |
| A `transfers: number` field | The dataset records no transfer counts and inventing them would be derived data dressed as fact. |
| Keeping one record per airport and letting `mode` be a list | The boolean would still have to be true and false at once. |
| Ranking rail above bus, or badging one as faster | Not a fact, and explicitly out of scope. A test forbids the vocabulary. |
| Re-sourcing every airport link to an operator | Block 7's job, deliberately bounded; this block cites one new page, for the one new claim. |
