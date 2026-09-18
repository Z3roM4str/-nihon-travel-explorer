# Block 9 — governance of zone editorial ratings

Deciding who owns an editorial rating, what "review" means, and fixing the thing that actually made
the Block 3 debt a debt. **No editor was built, and no rating was changed.**

## The recommendation, and why it could not be taken literally

Block 8 recommended: *"let the two travellers review the editorial zone ratings."* Read as a feature
— the app storing a rating per traveller — that contradicts standing authority.

Block 5 settled the personal-data rule, and `lib/travellers.ts` states it in the code:

> The route, the days, the dates, the visit times, the accommodation anchors, the manual legs, the
> inter-hub segments and **the chosen zones** are decisions they make together… Exactly one thing is
> personal: **does this person want to go here**.

Nothing in Blocks 6, 7 or 8 supersedes that. So the brief's §3 constraint holds and §14 applies.

**What Block 3 actually wrote is the resolution:**

> Editorial ratings are one person's judgement. Sixteen zones × ten axes were authored in one pass.
> They are labelled *criterio* everywhere and each zone carries written drawbacks, but **they have
> had no second reader.** A future block could usefully have the two actual travellers review them.

That is a request for **human peer review of the judgements** — an authoring-process debt, not a
product feature. The humans can only do it if the ratings are legible. They were not.

## What the audit found

`directFromZone` had to be reverse-engineered in Block 8; editorial needed no such work, because it
turned out to be architecturally clean and *presentationally* broken.

**Clean:** editorial affects nothing. `rankZonesBySavedPlaces` orders zones by median straight-line
distance to saved places and reads no rating. No filter, sort, planner or `useZonePlanChoice` path
touches it. There is no composite score and no function that returns one. The validator already
refuses provenance inside `editorial`. The zone layer knows nothing about travellers, and the
travellers layer knows nothing about ratings.

**Broken — four concrete defects, all in how a rating is presented:**

| # | defect | why it matters |
|---|---|---|
| 1 | `Ordinal`'s accessible reading was the bare string `"3 de 5"` | To a screen reader that is the exact shape of a measurement — "3 of 5 platforms". A judgement that does not say it is one **is being presented as a fact**. |
| 2 | The `<details>` showing all ten axes rendered **no direction at all** | Ten rows of marks with nothing saying what more marks mean. The contrasts section above it had that hint all along, from the same `EDITORIAL_AXES[].high` field. |
| 3 | In that list, the two axes with **no good direction** were marked by a muted dot colour and nothing else | The `· ni bueno ni malo` text existed only in the contrasts section. This project forbids colour-only signalling (Blocks 5 and 6 test for it). |
| 4 | That `<details>` was the one editorial heading carrying **no `criterio` tag** | The surface showing every rating said the least about what they are. |

Defect 2 is the sharpest: **the rationale already existed in the model and simply was not shown on
the surface built to show everything.** That is the real Block 3 debt — not "let them edit it".

## The contract

> **A zone editorial rating is Nihon's own judgement about a neighbourhood, on a closed 1–5 ordinal
> scale, authored with the dataset and shipped with it.**

**Who can change one?** Only Nihon, by shipping different data. There is no editor, no
traveller-facing write path, and no per-person rating. Asserted by test in the negative: no
`with…Editorial` transition exists, no control exists in the ratings surface, no storage key exists.

**How does it differ from wanting to visit the zone?** A rating says *what the neighbourhood is
like* and belongs to the product. Wanting to go says *what one person feels* and belongs to that
person — the only personal datum in the app. They may disagree freely and neither corrects the
other.

**Why there is no total, ever.** `tourismIntensity` and `nightlife` have no good direction: some
readers want the buzz and some are fleeing it. Any composite would have to pretend they did.

## The change

One new module, `lib/zone-editorial-presentation.ts`, holding the contract as documentation and the
four strings that express it. Both editorial surfaces now read them from there, so they cannot
drift apart again — which is exactly how defects 2 and 3 arose.

| before | after |
|---|---|
| `"3 de 5"` (screen reader) | `"3 de 5 · criterio de Nihon"` |
| full list: no direction | `Más marcas = <direction>` on all ten axes |
| full list: neutrality in colour only | `· ni bueno ni malo` in words |
| `Ver las diez valoraciones completas` | …plus the `criterio` tag |
| nothing said what a rating is | one sentence, on the surface that shows all ten |

The disclosure sentence:

> Estas diez valoraciones son el criterio de Nihon, no datos verificables ni la opinión de ninguno
> de los dos: describen cómo es la zona, no si queréis ir. No se pueden editar.

It answers both contract questions without the reader needing to know the schema. The disclosure
stays **inside the closed `<details>`**, so the everyday comparison gains nothing: Block 3 put the
full ratings behind a disclosure deliberately and its audit still asserts that.

## No data change

The 160 values were dumped and checked: all integers 1–5, exactly the ten declared axes in every
zone, no composite field, no provenance leak, three written drawbacks per zone. **Internally
sound, with no contradiction to correct.**

And there is no second reader available in this session. Rewriting the judgements here would be a
*third* unreviewed pass by one author — strictly worse than leaving them and saying so. The debt
"they have had no second reader" is therefore **still open**, and correctly so: it can only be
closed by the two actual travellers reading them, which is a human act this block has now made
possible rather than a code change it could fake.

## No persistence

Reading a rating writes nothing. No storage key was added, no document, no field. Asserted by the
audit, which compares the full `nihon.*` key set across the flow, and by test, which forbids
`localStorage` in the new module.

## What the validator now refuses

Beyond the rules Blocks 3 and 7 already enforce:

- **a composite score** at zone level (`score`, `overall`, `total`, `rating`, `nota`, `stars`, …) or
  hiding among the axes — because axes without a good direction cannot be totalled;
- **per-traveller data** anywhere in a zone (`travellerId`, `stances`, `perTraveller`, `votes`,
  `myRating`, …) — because a rating is not a preference, and personal data does not belong in a
  shared document.

Twelve negative cases were run by hand against the real dataset. It rejects all twelve. (Four are
caught by Block 3's pre-existing unknown-axis rule rather than by the new lists; the new rules add
the zone-level coverage that rule cannot see, and a clearer message.)

## Decisions taken

1. **No editor, no per-traveller rating.** Block 5's rule is authority and nothing supersedes it.
2. **"Review" means *scrutinise*, not *edit*.** That is what Block 3's own words ask for.
3. **No data change**, because the data is sound and a third unreviewed pass is not review.
4. **The rationale that already existed is surfaced** rather than a new one invented.
5. **One module owns the strings**, so the two surfaces cannot drift again.
6. **Neutrality is stated in words**, never colour alone.
7. **The ordinal names its owner**, so it cannot read as a measurement.
8. **No persistence**, because nothing needs to survive.
9. **The composite ban is now enforced, not merely documented.**

## Decisions discarded, and why

| discarded | why |
|---|---|
| A rating per traveller ("mi nota" / "su nota") | Contradicts Block 5's rule, which names zones as shared. Would also duplicate "quiero ir" with a second, vaguer like system. |
| One shared, traveller-editable rating | A rating is product content, like a zone's name or its written drawbacks. Making it editable would make Nihon's criterio unfalsifiable — the reader could no longer tell authored judgement from their own past edit. |
| An "agree / disagree with this rating" control | A second opinion system on top of Block 6's, answering a question nobody asked, and with nothing able to act on the answer. |
| Rewriting the 160 values myself | A third unreviewed pass by one author is not a second reader. |
| A composite "overall zone score" | Two axes have no good direction; any total would have to pretend they did. Now banned by validator, not just by prose. |
| Adding provenance to editorial to make it feel solid | The exact fact/editorial confusion Block 3 built the validator to prevent. |
| A per-axis written rationale per zone (160 new strings) | Invents a methodology to fill space. The axis direction plus the zone's three drawbacks already explain the judgement, and they are authored, not generated. |
| A new panel or expanded card for ratings | Block 3 put them behind a closed disclosure on purpose; its audit asserts that, and the everyday view must stay scannable. |
