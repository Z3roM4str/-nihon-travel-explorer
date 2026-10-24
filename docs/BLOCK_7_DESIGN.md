# Block 7 — provenance and authority of zone facts

Raising the authority of statements the zone layer already made. No new zone, no new axis, no
change to any ranking, rating or planning decision.

## What the audit found

All 16 zones carried **one** `facts.provenance` record, and all 16 were Wikipedia station articles.

That single record stood silently behind three different kinds of claim:

| fact area | what it asserts | who actually knows |
|---|---|---|
| `railLines` | which lines serve the station | each line's operator (often four or five per station) |
| `shinkansen` | whether the Shinkansen stops, and which lines | JR Central / JR East / JR West |
| `airportLinks` | how the airports are reached from here | the airport, and the operator of the named service |

One page cannot be the authority for all three, and the model had no way to say which claim a
source supported. The panel then rendered it as a link whose entire text was the word **"Fuente"**,
so an operator's own page and an encyclopedia article were indistinguishable until opened.

## What decided the scope: what could actually be verified

The brief's authority ladder is only worth following if the higher rung can be read. From this
environment it frequently cannot:

| source | result |
|---|---|
| `narita-airport.jp` (rail access) | **200 — readable**, and it names the stations each service serves |
| `nankai.co.jp` (Rapi:t) | **200 — readable**, and it names the stations the service connects |
| `tokyo-haneda.com` (rail, bus) | 200 — readable, but see below |
| `keisei.co.jp` (Skyliner) | 200 — readable |
| `jreast.co.jp`, `global.jr-central.co.jp`, `westjr.co.jp`, `jr-odekake.net` | **403** |
| `tokyometro.jp`, `kotsu.metro.tokyo.jp` (Toei) | **403 / WAF** |
| `kansai-airport.or.jp` | **403** |
| `kotsu.city.kyoto.lg.jp`, `kotsu.city.osaka.lg.jp` | unreachable |

So `railLines` and `shinkansen` could not be re-sourced at all without citing pages nobody had
read, which is worse than an honest encyclopedia citation. **A fabricated primary source is not an
improvement in authority; it is an improvement in the appearance of authority.** They stay as they
were, and the handoff records exactly why.

## Schema — additive only

```ts
export type ZoneFactArea = "railLines" | "shinkansen" | "airportLinks";
export type ZoneSourceTier = "operator" | "authority" | "official-tourism" | "secondary";

export type ZoneProvenance = {
  sourceUrl: string;
  sourceEntity: string;
  consultedAt: string;
  evidence: string;
  tier: ZoneSourceTier;      // NEW
  covers: ZoneFactArea[];    // NEW — never empty
};

export type ZoneFacts = {
  railLines: string[];
  shinkansen: ZoneShinkansen;
  airportLinks: ZoneAirportLink[];
  provenance: ZoneProvenance;   // the station-level source, unchanged in meaning
  sources?: ZoneProvenance[];   // NEW — optional, each scoped by `covers`
};
```

No field was removed or retyped. A zone with no `sources` is exactly the Block 3 record it always
was, and every existing consumer of `sourceUrl` / `consultedAt` keeps working.

`tier` is **stored, not inferred from the host**. Whether a page is "the operator" is a judgement
about the claim being made, not a fact about a domain name, and a regex over hostnames would be a
heuristic dressed as a fact — the precise thing this layer exists to prevent.

**Two sources may both cover an area.** That means each supports *some* claim in it, not that
either supports all of them; `evidence` is what says which. Over-claiming in `covers` would rebuild
the original problem under a newer name.

## What was migrated, and what it is grounded in

| zone | claim | new source | tier |
|---|---|---|---|
| `ZN-TOK-SHINJUKU` | Narita by N'EX, direct | Narita Airport, rail access | operator |
| `ZN-TOK-MARUNOUCHI` | Narita by N'EX, direct | Narita Airport, rail access | operator |
| `ZN-TOK-SHIBUYA` | Narita by N'EX, direct | Narita Airport, rail access | operator |
| `ZN-TOK-UENO` | Narita by Keisei Skyliner from Keisei-Ueno | Narita Airport, rail access | operator |
| `ZN-OSA-NAMBA` | Kansai by Nankai Rapi:t, direct | Nankai Electric Railway, Rapi:t | operator |

Narita's page lists, for each service, the stations it serves — "Tokyo Station, Shinagawa Station,
Shibuya Station, Shinjuku Station, Yokohama Station" for the Narita Express, and "Nippori Station,
Keisei Ueno Station" for the Skyliner. That is the airport operator stating the exact fact the
zone claims. Nankai's page states the Rapi:t runs "Kansai Airport Station→…Tengachaya Station,
Shin-Imamiya Station, Namba Station".

**Namba's service text lost "(andén 9)".** The operator page states the route and does not state a
platform. A detail is not kept alive by a source that does not make it, and a platform number is
exactly the kind of claim that quietly goes stale. The airport, the service and `directFromZone`
are unchanged.

The encyclopedia is relieved of `airportLinks` **only for Namba**, whose single link the operator
page fully carries. Every other migrated zone also has a Haneda or Kansai link that no reachable
operator page states, so the station article still stands behind it — and `covers` says so.

## What the validator now refuses

`scripts/validate-accommodation-zones.py`, still offline and dependency-free:

- a source with an unknown `tier`, or none;
- an encyclopedia URL claiming `operator`, `authority` or `official-tourism`;
- `covers` empty, repeated, or naming an unknown area;
- **a fact area that no source covers** — which is what makes "which facts have no source"
  unrepresentable rather than merely undocumented;
- the same `sourceUrl` twice within one zone;
- a non-https or undated source, in the extras as well as the primary;
- `tier`, `covers` or `sources` appearing in an `editorial` block.

Thirteen negative cases were checked by hand against the real dataset; it rejects all thirteen.

## The visible change

One line per zone column. Before:

> [Fuente] · consultada el 2026-09-17

After:

> **Fuentes:** [Narita International Airport] (operador) · [Wikipedia] (fuente secundaria)

The consultation date moves into the link's accessible name, which also carries the zone, because
the same source legitimately backs several columns and a screen reader listing the same name four
times would not say which was which.

The tier is a **word**, never a colour or an icon alone, and it is deliberately not a rating: it
says where a statement comes from, not whether the zone is a good place to sleep. Long operator
names wrap rather than truncating; the link is underlined, because the reader needs to know it
leaves the app.

## Fact / derived / editorial

Untouched. `tier` attaches to a *source*, never to a zone and never to an editorial axis, and both
the validator and the tests refuse it in an `editorial` block. A higher tier never converts a
judgement into a fact — it only says how close the source of an already-checkable claim is to the
thing it describes.

## Decisions taken

1. **Scope follows verifiability.** Only claims backed by a page actually read were re-sourced.
2. **Additive schema.** `provenance` keeps its meaning; `sources` is optional.
3. **`tier` is stored, not inferred** from the hostname.
4. **`covers` is required and never empty**, so no source stands silently behind everything.
5. **Every fact area must be covered**, enforced by the validator.
6. **The encyclopedia is kept, not deleted**, wherever it still carries a claim.
7. **An unsupported detail is dropped** rather than left cited to a source that does not make it.
8. **The source line names the source**, which is the whole of the UI change.

## Decisions discarded, and why

| discarded | why |
|---|---|
| Re-sourcing `railLines` and `shinkansen` to the rail operators | Every relevant operator refuses automated requests here. Citing them unread would fake the authority this block exists to raise. |
| Citing the airports for the Haneda links | Haneda's pages confirm the operators and list bus destinations, but the dataset's `directFromZone: false` for those zones would then sit beside a page showing a direct limousine bus. Recorded as a finding rather than silently reinterpreted — `directFromZone` is a Block 3 decision. |
| Citing Narita for Asakusa's through-service | Keisei's page names Shinagawa, Shimbashi and Nihombashi, not Asakusa. Reading the through-service off that list is an inference the page does not make. |
| Citing Narita for Ikebukuro's "not direct" | The page's own conventional-rail list includes Ikebukuro. Supporting a negative from it needs care it does not repay. |
| Replacing `provenance` with a single `sources[]` | A breaking rename of a field every consumer reads, for a tidier shape and no new fact. |
| A shared source registry with ids | Real duplication — four zones cite the same Narita page — but a registry means a new file, id resolution and dangling-reference rules. Larger than the block, and the existing model already inlines provenance 16 times. |
| Deriving `tier` from the hostname | A heuristic presented as a fact. |
| Showing the tier as a colour, a badge or a score | It is not a quality rating and must not read as one. |
