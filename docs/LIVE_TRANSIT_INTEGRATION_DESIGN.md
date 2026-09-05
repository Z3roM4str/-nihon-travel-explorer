# Phase 3B3C — Live Transit Integration Design

**Design only.** No provider activated, no account created, no plan purchased, no API key
introduced, no request (authenticated or otherwise) made to Ekispert, NAVITIME, or
openrouteservice. No application code, script, dataset, deployment config, `package.json` or
lockfile changed. No backend implemented, no UI implemented, no Phase 3C work started.

This phase answers *how* Nihon Travel Explorer could add a live, schedule-aware transit layer
later — designed against the system that actually exists in this repository today, not against
an assumed architecture. Every claim in §1 was verified by reading the code in this checkout.

Inherited contract (Phase 3B3B, merged):
[TRANSIT_TERMS_COVERAGE_CONFIRMATION.md](TRANSIT_TERMS_COVERAGE_CONFIRMATION.md) —
**architecture: PROCEED WITH HYBRID DESIGN; provider activation: REQUIRES VENDOR
CONFIRMATION.** That second half is why §12's activation gate exists and defaults to OFF.

---

## 1. The system as it actually is today (verified, not assumed)

Four facts materially shape every decision below. Each was checked directly.

### 1.1 There is no backend. At all.

`app/` is a pure static Vite + React SPA. Verified:

- `app/vite.config.ts` is four lines: the React plugin and nothing else. No proxy, no SSR, no
  adapter.
- Runtime dependencies are exactly `leaflet`, `react`, `react-dom`, `react-leaflet`. **No HTTP
  client, no server framework, no serverless SDK.**
- **No deployment platform has been chosen.** A repository-wide search found no `vercel.json`,
  `netlify.toml`, `wrangler.toml`, `Dockerfile`, CI workflow, or any `.env` file.
- Every dataset is a build-time JSON `import`, not a runtime `fetch` (`app/src/data/store.ts`,
  `app/src/lib/transfer.ts`, `app/src/lib/access-points.ts`). **The application makes zero
  network requests of its own today**, other than map tiles via Leaflet.

This is the single most consequential fact in this document: adding live transit is not "add a
call to an existing data layer." It means **introducing a network boundary, and a server-side
trust boundary, that this project has never had**.

### 1.2 `transfer.ts` currently has no consumers

`app/src/lib/transfer.ts` — the whole `TransferEdge`/`getBestTransfer` domain layer built across
Phases 3B1–3B2B-C — is imported by **exactly one file: its own test** (`transfer.test.ts`).
Verified by searching every `.ts`/`.tsx` under `app/src`. No component, hook, or other module
imports it.

What the UI actually shows is the **raw, unvalidated** `nearby.json` relation:
`App.tsx` passes `getNearby(selectedPlace.id)` (from `app/src/data/store.ts`) into
`PlaceDetail.tsx`, which renders `relation["Distancia km"]`, `relation["Modo"]` and
`~relation["Min aprox."] min` directly, under this footnote:

> "Traslados aproximados en línea recta; no son tiempos de ruta reales."

So: **the 325 snap-clean `validated-static` walking results are not visible to any user today.**
The domain layer was deliberately built ahead of its consumers. That is not a defect — it is why
§8's async decision has far more freedom than it would in a system with entrenched callers — but
it does mean this design must not describe "swapping in" live transit next to a validated walking
time the UI does not yet display.

### 1.3 The vocabulary for this already exists, unused

Three seams were reserved by earlier phases and remain empty:

| Seam | Where | State today |
|---|---|---|
| `TransferConfidence = "…" \| "schedule-aware"` | `transfer.ts:47` | Reserved; produced by nothing |
| `AccessContext = "…" \| "external-local-transit"` | `access-points.ts:14` | Reserved; used by zero access points |
| `TransferProvenance` (closed 2-member union) | `transfer.ts:124` | Awaits a third member |

This design fills those seams on paper only. It adds no code.

### 1.4 There is a standing guard against unordered aggregation

`transfer.test.ts` asserts the module exports nothing named `sumTransfers`,
`selectionTransferTotal`, `hubTransferTotal`, `clusterTransferTotalMinutes`, or
`totalTransferMinutes`. §11's Phase 3C boundary is designed to keep that guard true.

---

## 2. Why the credential cannot live in the frontend

Ekispert's terms make the API key the contractual identity of the contract holder: Article 26 §1
requires the contractor to keep the auth key strictly confidential and states that **every action
taken with that key is deemed the contractor's own action**, with Val Laboratory disclaiming all
liability for third-party use arising from mismanagement. A leaked key is therefore not merely a
billing risk — it is a compliance and liability transfer.

A Vite/React SPA cannot hold that secret. Concretely, each of these fails:

| Placement | Why it fails |
|---|---|
| `VITE_*` env var | Vite **inlines** `VITE_`-prefixed values into the client bundle at build time. It is published, not hidden. |
| Any other env var read in client code | Same outcome — anything reachable from browser code is in the shipped bundle. |
| React component / module constant | Plain source text in the bundle. |
| The built bundle generally | Served publicly; readable by anyone via DevTools, `curl`, or the deployed asset URL. |
| `localStorage` / `sessionStorage` | Client-side, inspectable, and would require the key to have been shipped to the browser first — the leak already happened. |
| Committed to GitHub | This repository is a **public portfolio**. Also directly contradicts the project's own standing rule (`docs/LOGISTICS.md`: `ORS_API_KEY` is "never a hardcoded value, never written to a file, JSON, doc, or log"). |
| Any `data/*.json` or `app/src/data/*.json` | Same as above, plus these are build-time imports — they ship to the browser. |

**Therefore the request cannot originate in the browser.** This is not a preference; it is forced
by the credential model.

### 2.1 The required flow

```
Browser (React)
  │  POST /api/transit/route   — Nihon's own request contract, no provider concepts
  ▼
Nihon-controlled server boundary        ← the trust boundary. Holds the key. Owns validation,
  │                                        rate limiting, timeouts, error sanitization.
  │  provider-specific request (adapter)
  ▼
Ekispert API
  │  provider raw response
  ▼
Nihon server: normalize → discard raw   ← raw response never leaves this process
  │  normalized ephemeral result
  ▼
Browser: render → discard
```

The server boundary is **conceptually ours**, and it exists for three independent reasons, any
one of which would be sufficient: (1) it is the only place the key can live; (2) it is the only
place where the raw provider response can be discarded before it can be persisted or logged by
accident; (3) it is where per-user abuse and cost controls can actually be enforced.

**Not implemented in this phase.**

---

## 3. Server boundary: contract decided, hosting deferred

Since §1.1 established that **no deployment platform has been chosen**, this design must not
invent one. Picking Vercel/Cloudflare/Netlify now would be an unforced, evidence-free
architectural commitment.

**Decision: backend contract decided; hosting provider deferred.**

The contract is expressed in deployment-neutral terms — one HTTP endpoint, JSON in / JSON out,
no platform-specific primitives. Any of the following can satisfy it later without the browser
code changing:

| Option | Fits when | Trade-off |
|---|---|---|
| Serverless function | The eventual host offers functions alongside static assets | Cold starts; per-invocation cost; usually the least new infrastructure |
| Edge function | Latency matters and the runtime's constraints are acceptable | Restricted runtime APIs; regional secret distribution needs care |
| Small dedicated API service | Rate limiting/abuse control grow beyond what a function comfortably holds | A service to operate and pay for continuously |

All three can honour §§4–10 identically. The decision is deferred **because the repository has
not yet chosen how it deploys at all** — not because the options are indistinguishable.

**Conceptual endpoint** (shape only, not code):

```
POST /api/transit/route
Content-Type: application/json
→ 200 { result }            normalized, ephemeral
→ 4xx/5xx { error }         sanitized category + correlation id, never provider internals
```

---

## 4. Request contract

Three layers, kept deliberately separate:

| Layer | Owns | Must never contain |
|---|---|---|
| **Domain** (`app/src/lib/…`) | Nihon place ids, access-point ids, our own vocabulary | Provider ids, provider parameter names |
| **Provider adapter** (server-side) | Translating domain → provider request and provider response → normalized result | Anything that leaks upward unnormalized |
| **HTTP transport** (`/api/transit/route`) | Wire format, validation, correlation id, status codes | Business meaning beyond carrying the two above |

The request the **browser** sends (pseudo-shape, illustrative):

```
TransitRouteRequest {
  from:            RoutingEndpoint      // Nihon ids only — see §5
  to:              RoutingEndpoint
  when:            { kind: "depart-after" | "arrive-by", instant: ISO-8601 with offset }
  serviceDate:     ISO date (YYYY-MM-DD)  // the calendar day the timetable answer is FOR
  timeZone:        IANA id, e.g. "Asia/Tokyo"
  correlationId:   opaque client-generated id, for log correlation only
}
```

Notes on each choice:

- **`from`/`to` are `RoutingEndpoint`, not coordinates.** This reuses the discriminated union
  Phase 3B2E already specified and Phase 3B2H already exercised for walking
  (`{ kind: "place-coordinate", placeId }` | `{ kind: "access-point", placeId, accessPointId }`).
  Coordinates are resolved **server-side** from our own catalog, so the browser never needs to
  carry a provider's station identifiers, and the domain stays free of provider concepts.
- **`when` is a tagged union, not two optional fields.** "Depart after X" and "arrive by Y" are
  mutually exclusive intents; modelling them as two nullable timestamps invites a request that
  specifies both or neither. This mirrors the project's existing preference for closed,
  discriminated shapes over loose optional bags.
- **`serviceDate` is explicit and separate from `when`'s instant.** Phase 3B3A's
  `static-validated`/`schedule-aware` boundary requires knowing which calendar day a timetable
  answer is valid *for*, distinct from when the query happened. Deriving it implicitly from the
  instant would lose that distinction across midnight and time-zone boundaries.
- **`timeZone` is explicit.** A browser's local zone is not necessarily Japan's; the service
  date only means something against a stated zone.
- **No `locale`.** Not justified yet: the UI would render our own labels around a numeric result.
  Add it only if a future phase actually surfaces provider-authored strings.
- **No transit mode/preference options.** Not justified yet either. Adding "avoid Shinkansen",
  "IC card priority" etc. before there is a UI that offers them would be speculative surface.
  The contract can grow additively later.

---

## 5. Access-point resolution

The flow reuses the existing model exactly as Phase 3B2H's walking revalidation did — nothing
new is created, no default is set, `JP-181` is not corrected, no catalog data changes.

```
Place (placeId)
  → getAccessPointsForContext(placeId, "external-local-transit")
  → AccessResolution  (ACCESS_POINT_DESIGN.md §16's existing four outcomes)
  → RoutingEndpoint
  → live transit request
```

The four cases, and what each means here:

| Case | Resolution | Behaviour designed here |
|---|---|---|
| No access point for the place | `use-place-coordinate` | Query with the place coordinate. Result carries a warning noting no catalogued transit endpoint exists (§7 `warnings`). |
| Exactly one eligible active point | `resolved-access-point` | Query with it. Result records which `accessPointId` was used. |
| Several eligible points, no default | `ambiguous` | **Do not silently pick one.** Phase 3B2H proved empirically (JP-029's three gates, best gate flipping by counterpart, 859.1 m spread) that a static choice is wrong. Either surface the choice to the user, or query each candidate and present them side by side — a product decision a later phase makes. This phase's requirement is only that the resolver **must not** collapse it. |
| Chosen endpoint not resolvable by the provider | *(new, provider-specific)* | Not an access-point-model failure. Treated as a provider outcome — see §9's `no-route`/`unresolvable-endpoint` fallback. Never silently retried against a different endpoint, which would misreport which point was measured. |

Important scope note: **zero access points currently declare `"external-local-transit"`.** Every
place therefore resolves to `use-place-coordinate` today. Populating that context is evidence
work for a future phase (the same standard Phase 3B2G applied), explicitly **not** started here.

---

## 6. Provider adapter

A boundary so Nihon is not welded to Ekispert. Naming follows the repository's existing style
(`buildAccessPointReader`, `buildValidatedWalkingIndex`, `bestTransferFromLookups`): a `build…`
factory returning a plain object of functions, injectable for tests.

```
TransitProvider {
  id:      "ekispert" | "navitime" | "synthetic"     // closed set
  lookupRoute(normalizedRequest) -> Promise<TransitLookupOutcome>
}

TransitLookupOutcome =
  | { status: "ok";        result: NormalizedTransitResult }
  | { status: "no-route" }                                     // provider answered: none exists
  | { status: "unresolvable-endpoint"; endpoint: "from" | "to" }
  | { status: "provider-error"; category: ProviderErrorCategory }

ProviderErrorCategory =
  "timeout" | "rate-limited" | "unauthorized" | "malformed-response" | "network" | "unknown"
```

Deliberate properties:

- **`no-route` is a first-class success-shaped outcome, not an error.** This mirrors the walking
  pipeline's existing three-state discipline (`validated` / `no-route` / `request-error`), where
  a definitive "no route exists" was never conflated with a failed request.
- **Errors are categories, never provider text.** §10 requires the browser never receive
  provider internals; making the category the *only* channel enforces that by shape.
- **`unresolvable-endpoint` is separate** from `no-route`: "we could not locate this endpoint"
  and "no service connects these two points" are different facts, and collapsing them would
  misinform the fallback logic in §9.
- **A `synthetic` provider is a first-class member**, not a test-only afterthought — it is what
  makes §11's testing strategy and §12's activation gate work.

The adapter lives **server-side**. The domain never imports it.

---

## 7. Normalized ephemeral result

Two distinct things, and the distinction is the point:

| | Provider raw response | Nihon normalized result |
|---|---|---|
| Lives | Only inside the server process, only during one request | Server → browser, for one render |
| Enters Git | **Never** | **Never** |
| Enters fixtures | **Never** | Never (fixtures are invented — §11) |
| Persisted | **Never** | **Never** (§10) |
| Logged | **Never** | **Never** (body); only §10's metadata |
| Lifetime | Discarded immediately after normalization | Discarded after render |

```
NormalizedTransitResult {
  scheduleAware:     boolean          // false ⇒ typical-duration answer, not a timetable answer
  durationMinutes:   { min: number; max: number }   // range, matching TransferEdge's existing discipline
  departure:         ISO-8601 instant | null        // null when !scheduleAware
  arrival:           ISO-8601 instant | null
  transferCount:     number
  modeSummary:       ("walk" | "rail" | "bus" | "ferry" | "other")[]   // our vocabulary, not the provider's
  accessLegs:        { kind: "walk"; minutes: number }[] | null        // first/last-mile, when reported
  serviceDate:       ISO date          // the day this answer is valid FOR
  provenance:        TransitProviderProvenance      // §8
  warnings:          TransitWarning[]               // e.g. no-catalogued-endpoint, ambiguous-endpoint
}
```

Deliberately **excluded**, each for a reason:

- **Fares.** Not needed for Nihon's logistics question (how long does this take), and every
  additional restricted field carried across the boundary is additional exposure with no
  product benefit.
- **Station/stop names and provider ids.** Same reasoning, plus §10: the less identifying route
  content crosses the boundary, the less there is to accidentally persist. If a future phase
  finds users genuinely need "which line", that is an additive change made deliberately — not a
  default.
- **Polylines/geometry.** Not needed; large; would tempt caching.
- **`minutes` uses a range** because `TransferEdge.minutes` already does, and a schedule-aware
  answer for a *window* legitimately has a spread — but nothing here fabricates one: when the
  provider gives a single value, `min === max`, exactly as `toTransferEdge` already does.

### 7.1 Should the *normalized* result also be treated as ephemeral?

**Yes — decided.** Even though normalization strips the response down to derived numbers, the
prudent reading of Ekispert Article 27(7)'s unqualified "二次利用" prohibition (Phase 3B3B §1.4)
is that a *derived-but-still-provider-sourced* travel time is closer to output data than to our
own analysis. Given that (a) storing it buys nothing this product needs, and (b) the cost of
being wrong is a licensing breach in a public repository, the asymmetry is decisive. The
normalized result is ephemeral too, everywhere: not persisted, not cached across requests, not
written to any store.

---

## 8. `TransitProviderProvenance`, refined

Phase 3B3A sketched this. Refined here, still **specification only** — `transfer.ts` is not
touched by this phase.

```
TransitProviderProvenance {
  kind:            "transit-provider"       // discriminant; extends the closed union in transfer.ts
  provider:        "ekispert" | "navitime" | "synthetic"
  confidence:      "schedule-aware-live" | "static-validated"
  requestedAt:     ISO-8601 UTC             // when we asked
  serviceDate:     ISO date                 // which calendar day the answer is FOR
  timetableVersion: string | null           // provider's own schedule revision, when exposed
  ephemeral:       true                     // literal; see below
}
```

Three-way distinction this must preserve, end to end:

| Confidence | Meaning | Source today |
|---|---|---|
| `estimated` | Haversine + fixed speed model | All 403 `nearby.json` relations |
| `validated-static` | Real routed path, no timetable | 325 snap-clean walking results |
| `schedule-aware-live` | Real timetable answer, bound to `serviceDate` | *Nothing yet* — this design's future output |

- **`ephemeral: true` is a literal, not a boolean field.** A field that could be `false` invites
  a future "just this once" persistence path. Typed as a constant, any attempt to build a
  persisted variant fails at the type level rather than at review time — the same fail-loud
  discipline `normalizeTransferMode` already uses by throwing on unknown modes.
- **Fields that must NOT appear here**: provider station/stop ids, raw timetable payloads, fare
  data, provider response bodies, or a serialized route token. Provenance describes *where an
  answer came from*, never *what the provider said*.
- **`serviceDate` is mandatory for `schedule-aware-live`.** Without it, a stored or forwarded
  result could be silently re-read as valid for a different day — precisely the "false precision"
  failure `TransferConfidence` exists to prevent (`docs/LOGISTICS.md`).

---

## 9. Relationship to `getBestTransfer()`

### 9.1 The options

| | Approach | Assessment |
|---|---|---|
| **A** | `getBestTransfer()` stays sync/static; a separate async API serves live transit | Honest: the function does a precomputed dictionary lookup with no I/O. Two clearly-typed sources. Requires callers to know which to ask. |
| **B** | `getBestTransfer()` becomes async | Would make a pure in-memory lookup *claim* to do I/O, forcing `await` and loading states on every consumer even when the answer is a precomputed constant. Also collapses two genuinely different confidences behind one signature, making it easy to render a `schedule-aware` and an `estimated` answer identically. |
| **C** | A facade/service layer chooses between static walking and live transit | Attractive, but the choice depends on UI intent (has the user *asked* for a live lookup? — §13's cost control makes this explicit-action-only), which a data-layer facade does not know. |

### 9.2 What the verified code says

§1.2 changes the usual calculus: **`getBestTransfer` has no callers**, so "don't break existing
consumers" is nearly moot, and no existing test would need rewriting for B. The argument against
B is therefore not migration cost — it is **correctness of the type's meaning**. `getBestTransfer`
reads two build-time JSON imports through a `Map`. Nothing about it is asynchronous. Making it
`Promise`-returning would be a false statement about the function encoded in its signature, and
would push loading/error handling into every future caller that only ever wanted the precomputed
walking answer.

The same evidence weakens C as a *data-layer* construct: with no consumers yet, a facade would be
an abstraction built before the thing it abstracts over exists.

### 9.3 Recommendation

**Adopt A, with C's arbitration placed in a React hook rather than in the data layer.**

- `getBestTransfer(fromId, toId): TransferEdge | null` — **unchanged, sync, static.** Keeps its
  directed, non-fabricating, never-chaining semantics exactly as documented.
- A new, separate async boundary (server-backed) serves live transit, returning the §7 result.
- The *decision* between them belongs in a UI-layer hook (conceptually `useTransitRoute`) that
  knows the user's intent, owns loading/error/cancellation state, and renders §9's fallbacks.
  This keeps async concerns in React — where `useState`/`useEffect`/`AbortController` already
  live — instead of infecting a pure module.

Impact assessment: existing callers — none, so zero breakage. Existing tests — unchanged, since
`transfer.ts` is untouched. React state — new state lives only in the new hook. Loading/errors —
confined to that hook. Ordered sequences (§11) — a sequence-aware phase can call the same async
boundary per ordered pair without the static layer changing at all.

---

## 10. Fallback behaviour

The app must never break, and — the harder rule — **must never present an estimate as
schedule-aware.**

| Condition | Response |
|---|---|
| Backend unreachable / network failure | Show existing data (validated-static walking if the pair has it, else the `nearby.json` estimate), labelled as what it is, plus "live transit unavailable" |
| Provider timeout | Same as above; offer retry |
| Rate limited | Same as above; "temporarily unavailable", retry discouraged/backed off |
| Provider `no-route` | **No fabricated result.** State that no transit route was found. Fall back to existing data only if it exists, still labelled as estimate/validated-static |
| Unresolvable endpoint | Same as `no-route`, and surface *which* end failed (§6) so a future access-point evidence phase has a signal |
| Schedule unavailable for the requested date | Do not silently return a typical-duration answer as if it were schedule-aware — either mark `scheduleAware: false` explicitly or decline |
| Invalid service date (out of provider horizon) | Reject at the request-validation layer before spending a call (§13) |
| **Provider activation OFF** (§12, current state) | The live path is not offered at all; the UI shows exactly what it shows today. No error, no spinner — the feature simply does not exist yet |

The invariant across every row: **the label always matches the provenance.** A fallback is shown
as `estimated` or `validated-static`; only a real timetable answer is ever shown as
`schedule-aware-live`.

---

## 11. UI states (design only — no component changed)

States the future UI must model:

`idle` → `loading` → one of { `live-result`, `fallback-estimate`, `no-route`, `unavailable` };
plus `activation-disabled` (the live path does not exist yet) and, if a future phase adds it,
`stale`/`retry`.

The user must be able to tell three things apart at a glance:

1. **Validated walking** (real routed path, no timetable) — the 325 results the UI does not yet
   show at all,
2. **Live transit** (real timetable, bound to a service date),
3. **Approximate estimate** (haversine — everything `PlaceDetail.tsx` shows today).

Two constraints on that future work, and no more (visual design is out of scope here):

- The existing footnote — "Traslados aproximados en línea recta; no son tiempos de ruta reales."
  — is currently correct for *everything* shown. The moment any non-estimate appears, that blanket
  footnote becomes wrong and must become per-item.
- A `schedule-aware-live` time must display its `serviceDate`. A time without the day it applies
  to is exactly the false precision this project has avoided since Phase 3B1.

---

## 12. Provider activation gate

**`transitProviderActivation = OFF`** — conceptually, a build/runtime configuration flag, default
off, blocking any real-provider call. It stays off until Phase 3B3B's `REQUIRES VENDOR
CONFIRMATION` is resolved (its §7.3 question answered, or the feature deliberately narrowed).

While OFF:
- No account, no key, no plan, no real traffic.
- The `synthetic` provider (§6) still satisfies the whole interface, so **the entire architecture
  — server boundary, adapter, normalization, provenance, fallbacks, hook, UI states — can be
  built and tested end to end without any provider relationship existing.**
- The UI presents `activation-disabled`: today's behaviour, unchanged.

Turning it ON must require, together: a resolved vendor answer, a server-side key present in a
non-versioned env var, and a deliberate configuration change. No single accidental step enables
live traffic.

---

## 13. Non-persistence guardrails, security, and cost

### 13.1 Non-persistence (hard rules)

Prohibited, without exception, absent a future written vendor authorization: `localStorage`,
`sessionStorage`, IndexedDB, any JSON artifact in `data/` or `app/src/data/`, any Git-committed
fixture derived from a real response, any server-side cache, any analytics event carrying route
payload, and any log line containing a response body.

**Permitted operational logging only** — and even this deserves restraint:

| Field | Rationale |
|---|---|
| Status category (`ok`/`no-route`/`timeout`/…) | Operability; carries no route content |
| Latency (ms) | Operability |
| Provider id | Operability |
| Correlation id | Support/debugging |

Notably **not** logged: origin/destination ids, timestamps requested, service date, duration,
transfer count. A log of "which places, when" would gradually reconstruct a usage dataset the
terms did not license — and it is not needed to operate the endpoint.

### 13.2 Security

Server-side-only secret, in a non-versioned environment variable, never in the repo. Strict
request validation (reject unknown place/access-point ids, malformed instants, out-of-horizon
service dates — before spending a provider call). Per-client rate limiting and abuse protection.
Explicit request timeout. Response size limit. Provider errors sanitized to §6's categories
before crossing to the browser. No provider credential or provider error text ever reaches the
client. CORS/same-origin policy set once the host is chosen (§3). No raw provider body in
production logs.

### 13.3 Cost control (without caching prohibited output)

Requests cost money, and §13.1 forbids the usual answer (cache the result). So:

- **Explicit user action only.** A live lookup happens because the user asked for *this* pair —
  never on map pan, hover, list render, or selection change.
- **No prefetch, no background crawling, no batch validation.** (Batch validation is also what
  the walking pipeline did — and precisely what the terms forbid here.)
- **`AbortController` cancellation** when the user navigates away or changes the pair, so an
  abandoned lookup does not bill for a result nobody sees.
- **In-flight deduplication only**: if the identical request is already in flight, join it rather
  than issuing a second. This is concurrency management within one moment — not a cache — so it
  stays clear of §13.1. Nothing is retained after the in-flight request settles.
- **No retention-based savings.** Explicitly: the answer to "this is expensive" is *fewer,
  intentional calls*, never *stored results*.

---

## 14. Testing without real data

Everything is testable with **zero** provider contact, which is what makes §12's OFF default
sustainable rather than a blocker.

- **Synthetic provider** (§6's third `TransitProvider` member) returns deterministic invented
  data — no captured payload, ever.
- **Obviously-fictional fixtures**, so no reader could mistake one for real output:
  `TEST-STATION-A` → `TEST-STATION-B`, depart `09:00`, arrive `09:24`, 1 transfer, service date
  `2099-01-01`.
- **Contract tests** over *our* normalized shape and *our* endpoint — asserting our invariants,
  not mirroring a provider's schema.
- **Backend boundary mocks** for the browser side, so the hook is tested without a server.
- **Required scenario coverage**: success (schedule-aware), success (not schedule-aware),
  timeout, rate-limited, `no-route`, `unresolvable-endpoint`, malformed provider response,
  partial/missing fields, network failure, and cancellation.
- **Guard tests worth adding** when code eventually exists: no persistence API is referenced on
  the live path; no provenance object is serialized into any committed artifact; the sync
  `getBestTransfer` remains sync.

---

## 15. Phase 3C boundary

This phase starts **no** sequencing. Explicitly not designed, not implemented, not begun:
shortest-path search, route optimization, unordered aggregation, city-sequence comparison, day
planners, itinerary generation.

What it *does* leave is a clean seam for a future ordered-sequence phase: because the async
boundary is **strictly pairwise and directed** —

```
transitRoute(from, to, context) → one directed answer
```

— a later phase given an **explicit ordered sequence** can call it per consecutive pair without
this design changing. Crucially, it can only do so with an order it was *given*: nothing here
accepts a bare `Place[]`, invents an order, or returns a scalar total. §1.4's regression guard
therefore stays true, and `docs/LOGISTICS.md`'s "No aggregation without order" rule is preserved
by construction rather than by convention.

---

## 16. Decisions closed by this phase

| Question | Decision |
|---|---|
| Frontend/backend boundary | **Server-side boundary required** (credential model forces it). Browser → our endpoint → provider. |
| Hosting platform | **Deferred** — contract decided, platform not chosen, because the repo has chosen none. |
| Async API strategy | **`getBestTransfer` stays sync/static; a separate async boundary serves live transit; arbitration lives in a React hook**, not the data layer. |
| Provider adapter boundary | `TransitProvider` factory, server-side, closed outcome union with error *categories*; `synthetic` is a first-class member. |
| Normalized result shape | §7 — minimal, our vocabulary, no fares/station ids/geometry. |
| Ephemerality of the normalized result | **Ephemeral too** — prudent reading of Art. 27(7); storing it buys nothing. |
| Provenance shape | §8 — `kind: "transit-provider"`, `confidence: "schedule-aware-live" \| "static-validated"`, mandatory `serviceDate`, literal `ephemeral: true`. |
| Access-point flow | Existing model reused via `"external-local-transit"`; ambiguity never silently collapsed; no defaults created. |
| Fallback behaviour | §10 — always degrade to existing data or an explicit unavailable state; **never** relabel an estimate as schedule-aware. |
| Non-persistence policy | §13.1 — no client storage, no artifacts, no server cache, no payload logs; operational metadata only. |
| Security boundary | §13.2 — server-only secret, validation, rate limiting, timeouts, sanitized errors. |
| Testing strategy | §14 — synthetic provider + obviously-fictional fixtures + full failure-mode coverage; zero real data. |
| Provider activation gate | **OFF**, and the whole architecture is buildable/testable while OFF. |

## 17. What this phase did NOT do

No code, script, dataset, deployment config, `package.json` or lockfile changed. No backend or UI
built. No provider activated: no account, no plan, no key, no request to Ekispert, NAVITIME, or
openrouteservice. No access point created or modified; `"external-local-transit"` still has zero
members; `JP-181` untouched. No `TransitProviderProvenance` added to `transfer.ts`. No hosting
platform chosen. No Phase 3C work.

## 18. Proposed next phases (not started, not authorized here)

- **Resolve activation** — Phase 3B3B §7.3's vendor question, or a deliberate narrowing of scope.
  Blocks any real traffic.
- **Phase 3B3D — Synthetic-provider walking skeleton** (possible): implement §§3–9 against the
  `synthetic` provider only, activation still OFF — real code, zero provider relationship.
- **Access-point evidence for `"external-local-transit"`** — same evidential standard as Phase
  3B2G, for places where a transit endpoint differs from the display coordinate.

Sequencing between them is a decision for a later session, not this one.
