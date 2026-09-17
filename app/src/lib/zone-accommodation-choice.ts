/**
 * Block 4 — the persisted record of "we decided to sleep in this zone, for this hub".
 *
 * ## What this record is, and what it deliberately is not
 *
 * A chosen zone is **not** a new kind of accommodation. `docs/ACCOMMODATION_COMMUTE_DESIGN.md`
 * settled that the only lodging entity in this repository is `AccommodationAnchor`, and Block 4
 * does not add a second one. What a choice adds is exactly one thing the planner could not say
 * before: **which zone an anchor came from, and for which hub**.
 *
 * ```
 * ZoneAccommodationChoice ──hub──▶ one hub, at most one choice
 *          │
 *          ├──zoneId──────────▶ data/accommodation/zones.json  (resolved elsewhere)
 *          └──accommodationId─▶ an AccommodationAnchor IN THE SAME DRAFT
 * ```
 *
 * The anchor is the single truth about *where* the accommodation is; this record is the single
 * truth about *why that anchor exists*. There is no second copy of the label, no second copy of
 * the coordinate, and no `selectedZone` living in a store the planner cannot see — the choice and
 * the anchor it points at are written, reconciled and deleted inside one draft.
 *
 * ## Registry-free on purpose
 *
 * This module never imports `accommodation-zone.ts`. `planning-draft-v8.ts` imports *this*, and a
 * planning draft that dragged the 40 KB zone registry into its own module graph would make the
 * persistence layer depend on catalogue data it has no business reading. `zoneId` is therefore
 * carried as an opaque string here and resolved against the registry one layer up, in
 * `zone-plan-link.ts`, where an unknown id becomes an honest "this zone is no longer in the
 * catalogue" state rather than a crash or a silent deletion.
 *
 * ## Nothing here is derived
 *
 * No distance, no duration, no route, no hub inference from a coordinate, no "best zone", and no
 * ranking. A choice records a decision the user made by pressing a button, and nothing else.
 */

export type ZoneAccommodationChoice = {
  /** The hub this decision is about. At most one choice per hub, enforced below. */
  hub: string;
  /** Opaque here; resolved against the zone registry by `zone-plan-link.ts`. */
  zoneId: string;
  /** The `AccommodationAnchor` this choice seeded, in the same draft. Never dangling. */
  accommodationId: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One record's shape. Every field is required and non-blank; nothing is defaulted or trimmed
 * into existence. */
export function parseZoneAccommodationChoice(value: unknown): ZoneAccommodationChoice | null {
  if (!isPlainObject(value)) return null;
  if (!isNonEmptyString(value.hub)) return null;
  if (!isNonEmptyString(value.zoneId)) return null;
  if (!isNonEmptyString(value.accommodationId)) return null;
  return { hub: value.hub, zoneId: value.zoneId, accommodationId: value.accommodationId };
}

/**
 * The whole list, or `null` for a malformed one.
 *
 * Two structural rules are checked here rather than repaired, exactly as the rest of the draft
 * treats its own uniqueness invariants (design §8.2: rejected, never first-wins or last-wins):
 *
 * * **one choice per hub** — two choices for "Tokio" do not mean the later one won, they mean the
 *   stored value cannot be interpreted;
 * * **one choice per anchor** — an anchor is seeded by at most one zone, so two choices pointing
 *   at the same `accommodationId` are equally uninterpretable.
 *
 * Array order carries no meaning and is never used to resolve anything.
 */
export function parseZoneAccommodationChoices(value: unknown): ZoneAccommodationChoice[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: ZoneAccommodationChoice[] = [];
  for (const entry of value) {
    const choice = parseZoneAccommodationChoice(entry);
    if (!choice) return null;
    parsed.push(choice);
  }
  if (!hasUniqueZoneChoiceHubs(parsed)) return null;
  if (!hasUniqueZoneChoiceAnchors(parsed)) return null;
  return parsed;
}

export function hasUniqueZoneChoiceHubs(choices: readonly ZoneAccommodationChoice[]): boolean {
  return new Set(choices.map((choice) => choice.hub)).size === choices.length;
}

export function hasUniqueZoneChoiceAnchors(choices: readonly ZoneAccommodationChoice[]): boolean {
  return new Set(choices.map((choice) => choice.accommodationId)).size === choices.length;
}

export function findZoneChoiceForHub(
  choices: readonly ZoneAccommodationChoice[],
  hub: string
): ZoneAccommodationChoice | null {
  return choices.find((choice) => choice.hub === hub) ?? null;
}

export function findZoneChoiceForAnchor(
  choices: readonly ZoneAccommodationChoice[],
  accommodationId: string
): ZoneAccommodationChoice | null {
  return choices.find((choice) => choice.accommodationId === accommodationId) ?? null;
}

/** Drops every choice whose anchor is no longer among `liveAccommodationIds`.
 *
 * This is the reconciliation half of the parse-then-reconcile split the draft already uses for
 * stale place-scoped state: a choice never outlives the anchor it seeded, and it is never rebound
 * to a different anchor to keep it alive. */
export function pruneZoneChoices(
  choices: readonly ZoneAccommodationChoice[],
  liveAccommodationIds: readonly string[]
): ZoneAccommodationChoice[] {
  const live = new Set(liveAccommodationIds);
  return choices.filter((choice) => live.has(choice.accommodationId));
}
