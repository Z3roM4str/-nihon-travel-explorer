/**
 * Block 5 — two local travellers, and the one thing that is genuinely personal.
 *
 * ## What belongs to a person, and what belongs to the trip
 *
 * Two adults travelling together have ONE itinerary. The route, the day assignment, the dates,
 * the visit times, the accommodation anchors, the manual legs, the inter-hub segments and the
 * chosen zones are decisions they make together, and duplicating any of them per person would
 * produce two plans rather than one trip. None of them is touched by this module, and
 * `ManualPlanningDraftV8` is deliberately NOT versioned by Block 5.
 *
 * Exactly one thing is personal: **does this person want to go here**. That is what lives here.
 *
 * ```
 * TravellersDocumentV1          nihon.travellers.v1       ← this module
 *   travellers[]                who is planning
 *   activeTravellerId           who is using this device right now
 *   interests[]                 per place, per person: interested / not interested
 *          │
 *          └── shortlistPlaceIds() ──▶ savedIds ──▶ ManualPlanningDraftV8 (unchanged, shared)
 * ```
 *
 * The shortlist the planner reconciles against is **derived**, never stored twice: a place is in
 * play when at least one traveller wants it. That keeps the existing draft contract working
 * untouched — it still receives a `string[]` and still prunes against it.
 *
 * ## Five categories, kept apart
 *
 * Nihon already separates FACT ("cierra a las 17:00"), DERIVED ("a 1,2 km del anchor") and
 * EDITORIAL ("zona animada de noche"). Block 5 adds two more and does not blur any of them:
 *
 * * **PREFERENCIA PERSONAL** — "Persona 1 lo quiere visitar". A stance, recorded because someone
 *   pressed a button. It is never inferred, never scored, and never averaged.
 * * **DECISIÓN DE PLANIFICACIÓN** — "va el martes". That lives in the planning draft and is
 *   shared. A preference never becomes a plan on its own.
 *
 * "Both want it" is reported as a **coincidence of two preferences**, in those words. It is not a
 * score, not a percentage, not a compatibility rating and not a ranking input. There is
 * deliberately no function in this module that returns a number per place.
 *
 * ## Designed so a backend would not force a rewrite
 *
 * `travellers` is a list, not a `person1`/`person2` pair, and a stance is keyed by traveller id
 * rather than by slot. Raising the cap, or later attaching a remote identity to a traveller, is a
 * parser change and a field addition — not a reshaping of every stored record. Nothing here
 * assumes one device, one browser, or a single writer; it simply does not yet synchronise.
 */

export type InterestStance = "interested" | "not-interested";

export type Traveller = {
  id: string;
  label: string;
};

export type TravellerStance = {
  travellerId: string;
  stance: InterestStance;
};

/**
 * One place, and what each traveller has said about it.
 *
 * A traveller with no entry in `stances` **has expressed no opinion**. That is a real, distinct
 * state from "not interested" and the two are never collapsed — the same discipline
 * `AccommodationBoundaryChoice` already applies to `unselected` vs `no-accommodation`.
 */
export type PlaceInterest = {
  placeId: string;
  stances: TravellerStance[];
  /**
   * Carried over from the single-list era, before profiles existed.
   *
   * Such a place is genuinely in the shortlist, but nobody can honestly be said to have chosen
   * it: attributing it to Persona 1 would invent an opinion, and attributing it to both would
   * invent two. It stays unclaimed, says so on screen, and the flag clears the moment any
   * traveller states a stance on that place.
   */
  carriedOver: boolean;
};

export type TravellersDocumentV1 = {
  version: 1;
  travellers: Traveller[];
  /** Who is using this device right now. Always resolves to a live traveller, or is null. */
  activeTravellerId: string | null;
  interests: PlaceInterest[];
};

export const TRAVELLERS_STORAGE_KEY = "nihon.travellers.v1";
/** The pre-Block-5 shortlist. Read ONLY when no travellers document exists; never written. */
export const LEGACY_SAVED_PLACES_KEY = "nihon.savedPlaceIds";
export const TRAVELLERS_VERSION = 1 as const;

/**
 * The trip is for two adults, so the product fixes the roster at two.
 *
 * The cap lives in the parser rather than in the shape: `travellers` is a list, so raising it for
 * a three-person trip later is one constant, with no stored record needing to change form.
 */
export const MAX_TRAVELLERS = 2;
export const DEFAULT_TRAVELLER_LABELS = ["Persona 1", "Persona 2"] as const;

export type Storage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isInterestStance(value: unknown): value is InterestStance {
  return value === "interested" || value === "not-interested";
}

// ── Parsing ───────────────────────────────────────────────────────────────────────────────────

function parseTraveller(value: unknown): Traveller | null {
  if (!isPlainObject(value)) return null;
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.label)) return null;
  return { id: value.id, label: value.label };
}

function parseStance(value: unknown): TravellerStance | null {
  if (!isPlainObject(value)) return null;
  if (!isNonEmptyString(value.travellerId) || !isInterestStance(value.stance)) return null;
  return { travellerId: value.travellerId, stance: value.stance };
}

function parseInterest(value: unknown): PlaceInterest | null {
  if (!isPlainObject(value)) return null;
  if (!isNonEmptyString(value.placeId)) return null;
  if (typeof value.carriedOver !== "boolean") return null;
  if (!Array.isArray(value.stances)) return null;

  const stances: TravellerStance[] = [];
  for (const entry of value.stances) {
    const stance = parseStance(entry);
    if (!stance) return null;
    stances.push(stance);
  }
  // One stance per traveller per place. Two are not "the later one wins"; they are uninterpretable.
  if (new Set(stances.map((entry) => entry.travellerId)).size !== stances.length) return null;
  // A record with nothing in it could not have been produced by any setter below.
  if (stances.length === 0 && !value.carriedOver) return null;

  return { placeId: value.placeId, stances, carriedOver: value.carriedOver };
}

/**
 * Parses a stored document, or returns `null` for anything it cannot interpret — never a repaired
 * or partially trusted one. Same fail-closed policy as the planning draft: the caller falls back
 * to a fresh document rather than guessing what was meant.
 *
 * Beyond each record's own shape, three relational rules are enforced here because only this level
 * can see them:
 *
 * * traveller ids are unique, and there are between 1 and {@link MAX_TRAVELLERS} of them;
 * * every stance references a traveller that exists in the same document — a dangling stance is
 *   rejected outright, never silently dropped and never reattributed to the other person;
 * * `activeTravellerId`, when set, resolves to a live traveller.
 */
export function parseTravellersDocument(raw: unknown): TravellersDocumentV1 | null {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== TRAVELLERS_VERSION) return null;
  if (!Array.isArray(raw.travellers) || !Array.isArray(raw.interests)) return null;

  const travellers: Traveller[] = [];
  for (const entry of raw.travellers) {
    const traveller = parseTraveller(entry);
    if (!traveller) return null;
    travellers.push(traveller);
  }
  if (travellers.length === 0 || travellers.length > MAX_TRAVELLERS) return null;
  if (new Set(travellers.map((entry) => entry.id)).size !== travellers.length) return null;

  const interests: PlaceInterest[] = [];
  for (const entry of raw.interests) {
    const interest = parseInterest(entry);
    if (!interest) return null;
    interests.push(interest);
  }
  if (new Set(interests.map((entry) => entry.placeId)).size !== interests.length) return null;

  const liveIds = new Set(travellers.map((entry) => entry.id));
  for (const interest of interests) {
    for (const stance of interest.stances) {
      if (!liveIds.has(stance.travellerId)) return null;
    }
  }

  const activeRaw = raw.activeTravellerId;
  if (activeRaw !== null && !isNonEmptyString(activeRaw)) return null;
  if (activeRaw !== null && !liveIds.has(activeRaw)) return null;

  return {
    version: TRAVELLERS_VERSION,
    travellers,
    activeTravellerId: activeRaw,
    interests,
  };
}

// ── Creation and migration ────────────────────────────────────────────────────────────────────

/** Opaque traveller id: no slot, no ordinal, no name, no device and no clock payload. It exists
 * only so two people the reader considers different stay different. */
export function createTravellerId(
  existingIds: readonly string[],
  idFactory: () => string,
  maxAttempts = 8
): string | null {
  const taken = new Set(existingIds);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = idFactory();
    if (candidate.length > 0 && !taken.has(candidate)) return candidate;
  }
  return null;
}

/** Two travellers with neutral default labels and no opinions. Nobody is asked to fill in a setup
 * form before the app is usable: the roster exists so the first tap has somewhere to land. */
export function freshTravellersDocument(idFactory: () => string): TravellersDocumentV1 {
  const travellers: Traveller[] = [];
  for (const label of DEFAULT_TRAVELLER_LABELS) {
    const id = createTravellerId(
      travellers.map((entry) => entry.id),
      idFactory
    );
    if (id === null) break;
    travellers.push({ id, label });
  }
  return {
    version: TRAVELLERS_VERSION,
    travellers,
    activeTravellerId: travellers[0]?.id ?? null,
    interests: [],
  };
}

/**
 * Brings a pre-Block-5 shortlist forward.
 *
 * Those places were saved when there was one list and no people, so **no stance is invented for
 * anyone**. They arrive as `carriedOver`, stay in the shortlist, and the UI says they are
 * unclaimed and offers to claim them. Attributing them to Persona 1 would be a fabricated opinion
 * about a real person; attributing them to both would be two.
 */
export function migrateLegacySavedIds(
  savedIds: readonly unknown[],
  idFactory: () => string
): TravellersDocumentV1 {
  const document = freshTravellersDocument(idFactory);
  const seen = new Set<string>();
  const interests: PlaceInterest[] = [];
  for (const id of savedIds) {
    if (!isNonEmptyString(id) || seen.has(id)) continue;
    seen.add(id);
    interests.push({ placeId: id, stances: [], carriedOver: true });
  }
  return { ...document, interests };
}

// ── Reading ───────────────────────────────────────────────────────────────────────────────────

export function findTraveller(
  document: TravellersDocumentV1,
  travellerId: string | null
): Traveller | null {
  if (travellerId === null) return null;
  return document.travellers.find((entry) => entry.id === travellerId) ?? null;
}

export function findInterest(
  document: TravellersDocumentV1,
  placeId: string
): PlaceInterest | null {
  return document.interests.find((entry) => entry.placeId === placeId) ?? null;
}

export function stanceOf(
  interest: PlaceInterest | null,
  travellerId: string | null
): InterestStance | null {
  if (!interest || travellerId === null) return null;
  return interest.stances.find((entry) => entry.travellerId === travellerId)?.stance ?? null;
}

/** In the shared shortlist when at least one traveller wants it, or when it was carried over from
 * before profiles existed and nobody has spoken yet. Explicit disinterest from one person does not
 * remove a place the other still wants — disagreement is shown, never resolved automatically. */
export function isInShortlist(interest: PlaceInterest): boolean {
  return interest.carriedOver || interest.stances.some((entry) => entry.stance === "interested");
}

/**
 * The shared shortlist, in the order places entered it.
 *
 * This is what the planner reconciles against, and it is the ONLY place the two-person layer
 * touches the shared plan. It is derived on read and never stored, so there is no second copy of
 * the list to drift.
 */
export function shortlistPlaceIds(document: TravellersDocumentV1): string[] {
  return document.interests.filter(isInShortlist).map((entry) => entry.placeId);
}

/**
 * What the two of them have said about one place.
 *
 * Every branch is a statement about stated preferences. None is a verdict, a score, or a
 * recommendation, and "both" is explicitly a coincidence rather than a rating.
 */
export type PlaceInterestSummary =
  /** No record, or a record nobody is in the shortlist for. */
  | { kind: "none" }
  /** Carried over from before profiles existed; nobody has claimed it yet. */
  | { kind: "unclaimed" }
  /** Exactly one traveller wants it; the others have said nothing. */
  | { kind: "only"; interestedId: string; silentIds: string[] }
  /** Every traveller wants it. */
  | { kind: "both" }
  /** At least one wants it and at least one explicitly does not. */
  | { kind: "split"; interestedIds: string[]; notInterestedIds: string[] }
  /** Everyone who spoke said no, and nobody wants it. */
  | { kind: "declined"; notInterestedIds: string[] };

export function summarizeInterest(
  document: TravellersDocumentV1,
  placeId: string
): PlaceInterestSummary {
  const interest = findInterest(document, placeId);
  if (!interest) return { kind: "none" };

  const interestedIds = interest.stances
    .filter((entry) => entry.stance === "interested")
    .map((entry) => entry.travellerId);
  const notInterestedIds = interest.stances
    .filter((entry) => entry.stance === "not-interested")
    .map((entry) => entry.travellerId);

  if (interestedIds.length === 0) {
    if (notInterestedIds.length > 0) return { kind: "declined", notInterestedIds };
    return interest.carriedOver ? { kind: "unclaimed" } : { kind: "none" };
  }
  if (notInterestedIds.length > 0) return { kind: "split", interestedIds, notInterestedIds };
  if (interestedIds.length === document.travellers.length && document.travellers.length > 1) {
    return { kind: "both" };
  }
  const silentIds = document.travellers
    .map((entry) => entry.id)
    .filter((id) => !interestedIds.includes(id));
  return { kind: "only", interestedId: interestedIds[0], silentIds };
}

/** Counts, for the saved list's header. Plain tallies of stated preferences — never a score, a
 * percentage or a compatibility figure. */
export type ShortlistTally = {
  total: number;
  both: number;
  onlyOne: number;
  split: number;
  unclaimed: number;
};

export function tallyShortlist(document: TravellersDocumentV1): ShortlistTally {
  const tally: ShortlistTally = { total: 0, both: 0, onlyOne: 0, split: 0, unclaimed: 0 };
  for (const interest of document.interests) {
    if (!isInShortlist(interest)) continue;
    tally.total += 1;
    const summary = summarizeInterest(document, interest.placeId);
    if (summary.kind === "both") tally.both += 1;
    else if (summary.kind === "only") tally.onlyOne += 1;
    else if (summary.kind === "split") tally.split += 1;
    else if (summary.kind === "unclaimed") tally.unclaimed += 1;
  }
  return tally;
}

// ── Mutations ─────────────────────────────────────────────────────────────────────────────────

/** Drops records that can no longer mean anything: no stance left, and not carried over. Such a
 * record is exactly what the parser refuses, so it must never be written either. */
function pruneEmptyInterests(interests: readonly PlaceInterest[]): PlaceInterest[] {
  return interests.filter((entry) => entry.stances.length > 0 || entry.carriedOver);
}

/**
 * Records — or clears — ONE traveller's stance on ONE place.
 *
 * `stance: null` clears that person's entry, returning them to "no opinion". It never writes
 * `not-interested` in its place: those are different statements and the reader makes each of them
 * deliberately.
 *
 * Stating any stance clears `carriedOver`, because the place is no longer unclaimed. The other
 * traveller's stance is never read, copied, inverted or inferred.
 */
export function withStance(
  document: TravellersDocumentV1,
  placeId: string,
  travellerId: string,
  stance: InterestStance | null
): TravellersDocumentV1 {
  if (placeId.trim().length === 0) return document;
  if (!findTraveller(document, travellerId)) return document;

  const index = document.interests.findIndex((entry) => entry.placeId === placeId);
  const current = index === -1 ? null : document.interests[index];
  // A no-op stays a no-op. This matters most for a carried-over place nobody has spoken about:
  // clearing a stance that was never there must not strip `carriedOver` and drop it from the
  // shortlist.
  if (stanceOf(current, travellerId) === stance) return document;

  const others = current ? current.stances.filter((entry) => entry.travellerId !== travellerId) : [];
  const next: PlaceInterest = {
    placeId,
    stances: stance === null ? others : [...others, { travellerId, stance }],
    // Any stated stance claims the place, and clearing one afterwards does NOT resurrect the
    // unclaimed flag: once somebody has spoken, going quiet again is not the same as never having
    // been asked. Every path that actually changes something therefore lands on `false`.
    carriedOver: false,
  };

  const interests = [...document.interests];
  if (index === -1) interests.push(next);
  else interests[index] = next;
  return { ...document, interests: pruneEmptyInterests(interests) };
}

/**
 * The one-tap "❤️ Quiero ir" the app already had, now attributed to whoever is using it.
 *
 * Pressing it when the active traveller is already interested clears their interest — the same
 * toggle as before. Pressing it when they had said "not interested" replaces that with interest,
 * because the reader has plainly changed their mind.
 */
export function withToggledInterest(
  document: TravellersDocumentV1,
  placeId: string,
  travellerId: string
): TravellersDocumentV1 {
  const existing = stanceOf(findInterest(document, placeId), travellerId);
  return withStance(document, placeId, travellerId, existing === "interested" ? null : "interested");
}

export function withActiveTraveller(
  document: TravellersDocumentV1,
  travellerId: string
): TravellersDocumentV1 {
  if (!findTraveller(document, travellerId)) return document;
  if (document.activeTravellerId === travellerId) return document;
  return { ...document, activeTravellerId: travellerId };
}

/** Renames one traveller. A blank label is rejected rather than stored or replaced by a default. */
export function withTravellerLabel(
  document: TravellersDocumentV1,
  travellerId: string,
  label: string
): TravellersDocumentV1 {
  const traveller = findTraveller(document, travellerId);
  if (!traveller) return document;
  const trimmed = label.trim();
  if (trimmed.length === 0 || trimmed === traveller.label) return document;
  return {
    ...document,
    travellers: document.travellers.map((entry) =>
      entry.id === travellerId ? { ...entry, label: trimmed } : entry
    ),
  };
}

/**
 * Clears everything one traveller has said, keeping the person.
 *
 * The other traveller's stances are untouched, and a place only they wanted stays in the
 * shortlist. A place that was only in the shortlist because of the reset traveller leaves it —
 * which is correct, and which the caller surfaces beforehand so the reader is not surprised.
 */
export function withTravellerReset(
  document: TravellersDocumentV1,
  travellerId: string
): TravellersDocumentV1 {
  if (!findTraveller(document, travellerId)) return document;
  const interests = pruneEmptyInterests(
    document.interests.map((entry) => ({
      ...entry,
      stances: entry.stances.filter((stance) => stance.travellerId !== travellerId),
    }))
  );
  return { ...document, interests };
}

/**
 * Removes one traveller entirely, with their stances.
 *
 * Never reattributes anything to whoever is left. Refused when only one traveller remains: the app
 * needs somebody to be using it, and an empty roster has no honest meaning. If the removed person
 * was the active one, the remaining traveller becomes active — that is a device-level fact about
 * who is holding the phone, not an opinion being transferred.
 */
export function withoutTraveller(
  document: TravellersDocumentV1,
  travellerId: string
): TravellersDocumentV1 {
  if (!findTraveller(document, travellerId)) return document;
  if (document.travellers.length <= 1) return document;

  const travellers = document.travellers.filter((entry) => entry.id !== travellerId);
  const reset = withTravellerReset(document, travellerId);
  return {
    ...reset,
    travellers,
    activeTravellerId:
      document.activeTravellerId === travellerId
        ? travellers[0].id
        : document.activeTravellerId,
  };
}

/** Adds a traveller back after a removal, up to the cap. */
export function withNewTraveller(
  document: TravellersDocumentV1,
  label: string,
  idFactory: () => string
): TravellersDocumentV1 {
  if (document.travellers.length >= MAX_TRAVELLERS) return document;
  const trimmed = label.trim();
  if (trimmed.length === 0) return document;
  const id = createTravellerId(
    document.travellers.map((entry) => entry.id),
    idFactory
  );
  if (id === null) return document;
  return { ...document, travellers: [...document.travellers, { id, label: trimmed }] };
}

/**
 * Drops interests for places the catalogue no longer resolves.
 *
 * The parse-then-reconcile split the planning draft already uses: shape is validated at parse,
 * and staleness against live data is handled separately, so a place removed from the dataset
 * cannot leave an unreachable record behind.
 */
export function reconcileTravellers(
  document: TravellersDocumentV1,
  knownPlaceIds: readonly string[]
): TravellersDocumentV1 {
  const known = new Set(knownPlaceIds);
  const interests = document.interests.filter((entry) => known.has(entry.placeId));
  if (interests.length === document.interests.length) return document;
  return { ...document, interests };
}

// ── Storage ───────────────────────────────────────────────────────────────────────────────────

/**
 * Loads the travellers document, migrating the pre-Block-5 shortlist when there is not one yet.
 *
 * The legacy `nihon.savedPlaceIds` key is read **only** when no travellers document exists, and is
 * never written. It is left in place rather than deleted: it becomes inert the moment this
 * document is written, and removing it would add a data-loss path for no benefit.
 */
export function loadTravellersDocument(
  storage: Storage,
  idFactory: () => string
): TravellersDocumentV1 {
  let raw: string | null = null;
  try {
    raw = storage.getItem(TRAVELLERS_STORAGE_KEY);
  } catch {
    return freshTravellersDocument(idFactory);
  }

  if (raw) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return freshTravellersDocument(idFactory);
    }
    const parsed = parseTravellersDocument(decoded);
    if (parsed) return parsed;
    return freshTravellersDocument(idFactory);
  }

  let legacyRaw: string | null = null;
  try {
    legacyRaw = storage.getItem(LEGACY_SAVED_PLACES_KEY);
  } catch {
    return freshTravellersDocument(idFactory);
  }
  if (!legacyRaw) return freshTravellersDocument(idFactory);

  try {
    const decoded = JSON.parse(legacyRaw);
    if (!Array.isArray(decoded)) return freshTravellersDocument(idFactory);
    return migrateLegacySavedIds(decoded, idFactory);
  } catch {
    return freshTravellersDocument(idFactory);
  }
}

export function writeTravellersDocument(storage: Storage, document: TravellersDocumentV1): void {
  try {
    storage.setItem(TRAVELLERS_STORAGE_KEY, JSON.stringify(document));
  } catch {
    /* storage unavailable — the roster stays in memory for this session */
  }
}
