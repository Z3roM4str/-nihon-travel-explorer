import {
  HORIZON_NONE,
  HORIZON_UNKNOWN,
  TIMETABLE_CYCLE_DAYS,
  freshnessForHorizon,
  horizonOfDays,
  type RecheckHorizon,
  type SourceFreshness,
} from "./source-freshness";
import type { AccessPointRole, LogisticsAccessPoint } from "./access-points";
import type {
  ReservationMechanism,
  ReservationMechanismEvidenceRecord,
} from "./reservation-mechanism-evidence";

/**
 * Block 11 — what the other twelve provenance records actually claim, and whether a clock applies.
 *
 * ## The problem, as found rather than as predicted
 *
 * Block 10 left a recommendation: give `access-points` and `reservation-mechanisms` "the equivalent
 * of `covers`", so the freshness model could serve all 35 provenance records instead of 23. Block 11
 * audited the twelve and found that recommendation **half right, for the wrong reason**.
 *
 * `covers` exists on a zone because one zone record makes *three separable claims* — which rail
 * lines serve the station, whether the Shinkansen stops, which airport links run — and one source
 * may back any subset of them. Without `covers`, a source stands silently behind all three, and the
 * airport-link claim it never spoke to inherits its authority.
 *
 * **Neither of these two systems has that shape.** An access point is one arrival point and carries
 * one provenance; a reservation mechanism is one sales rule and carries one provenance. There is no
 * subset for a `covers` field to pick out, and adding one would ask each record to restate, in a
 * field that can drift, what the record already *is*. That is the failure mode `covers` was built to
 * prevent, reintroduced as ceremony.
 *
 * So no `covers` field was added to either schema, and **no data file was touched by this block.**
 *
 * ## What was actually missing
 *
 * Not *which* claim a source backs — that was never ambiguous — but **what kind of claim it is**,
 * because the twelve are not one kind, and the schemas already say so:
 *
 * * an access point's `role` separates built fabric from a *served* stop;
 * * a reservation mechanism's `kind` separates a standing rule from one dated sale.
 *
 * Both distinctions are already stored, already validated against a closed set, and cannot
 * contradict the fact they describe. So the claim class is **derived from them, never stored
 * beside them.** A stored class could be wrong; a derived one is wrong only if this file is.
 *
 * ## Volatility, and where a threshold is honest
 *
 * | class | volatility | horizon | why |
 * |---|---|---|---|
 * | `built-arrival-point` | structural | **none** | Where a gate stands changes by construction: announced, years long, on no publication cycle. Block 10's `railLines` argument, same domain of fact. |
 * | `served-transit-stop` | operational | **365 d** | Whether a stop is *served* is a timetable fact, and Japanese operators revise timetables annually. Not `airportLinks` borrowed — the same rhythm, re-derived. |
 * | `dated-sale-instance` | temporal | **none** | The record carries its own absolute dates. Re-reading the page on a cadence discovers nothing it does not already state; what ends it is the calendar, not our checking. |
 * | `standing-sales-rule` | commercial | **unknown** | The one place this block refuses to pick a number. See below. |
 *
 * ### Why `standing-sales-rule` gets no threshold
 *
 * Block 10 derived 365 from an event you can point at: operators publish a revised timetable once a
 * year, so a check older than one cycle has provably not seen the current one. Ticketing policy
 * supplies no such event. A museum may change its release day, its hour, its lead time or its
 * lottery next Tuesday and announce it only by editing the page. There is no cycle, so there is no
 * number to derive — and a number not derived from anything would be false precision dressed as
 * policy, which is worse than an admitted gap because it would look decided.
 *
 * It is equally **not** `no-periodic-recheck`. That state means *relax*, and these are the most
 * volatile claims in the dataset. Hence the fourth state, whose whole content is: this wants
 * re-reading and we cannot say how often. **Recorded as debt, not as a verdict.**
 *
 * ## What this file may not do
 *
 * It never reads a clock, never reads `confidence`, never reads a tier, never reads an editorial
 * rating, and never writes anything. `confidence` in both systems records how *directly* the source
 * states the claim — `official-explicit` versus a coordinate or window Nihon derived from what the
 * page published. That is a property of the inference, not of the source's authority and not of its
 * age, and freshness here is a function of `(consultedAt, class, today)` alone.
 */

/** What kind of claim one access-point provenance record backs. Derived from `role`. */
export type AccessPointClaimClass = "built-arrival-point" | "served-transit-stop";

/** What kind of claim one reservation-mechanism provenance record backs. Derived from `kind`. */
export type ReservationClaimClass = "standing-sales-rule" | "dated-sale-instance";

/**
 * Every access-point role, mapped to the kind of claim its provenance backs.
 *
 * Exhaustive by type: a role added to `AccessPointRole` without a decision here fails `tsc`, which
 * is the same no-silent-default discipline Block 10 gave `RECHECK_HORIZON_DAYS`.
 *
 * Only `transit-stop` is a *service* claim. The rest name built fabric — a gate, a door, a desk, a
 * trailhead, a place a road arrives — whose existence and position are facts about the world, not
 * about a schedule. `reception` is deliberately on that side: a reception desk belongs to a
 * building, and a business relocating one is an announced move, not a periodic revision.
 */
export const ACCESS_POINT_CLAIM_CLASS: Readonly<Record<AccessPointRole, AccessPointClaimClass>> = {
  "visitor-entrance": "built-arrival-point",
  gate: "built-arrival-point",
  reception: "built-arrival-point",
  trailhead: "built-arrival-point",
  "road-access": "built-arrival-point",
  "transit-stop": "served-transit-stop",
  "general-access": "built-arrival-point",
};

/**
 * Every reservation mechanism kind, mapped to the kind of claim its provenance backs.
 *
 * Exhaustive by type against `ReservationMechanism["kind"]`: a new mechanism kind cannot reach the
 * dataset without someone deciding, here, whether it is a rule or an instance.
 *
 * The split is one question: **does the record describe how sales work, or one sale?** Five kinds
 * express a rule relative to the visit date and hold until the operator revises them.
 * `fixed-sale-date` is the odd one and the reason this distinction exists at all — it stores an
 * absolute `saleDate` and the absolute window it applies to, so it describes one dated event and
 * expires by its own terms rather than by neglect.
 */
export const RESERVATION_CLAIM_CLASS: Readonly<
  Record<ReservationMechanism["kind"], ReservationClaimClass>
> = {
  "monthly-fixed-release": "standing-sales-rule",
  "rolling-calendar-month-release": "standing-sales-rule",
  "rolling-day-release": "standing-sales-rule",
  "monthly-application-window": "standing-sales-rule",
  "relative-application-window": "standing-sales-rule",
  "fixed-sale-date": "dated-sale-instance",
};

/**
 * The volatility Nihon claims for each class, in the vocabulary Block 11 used to reason about them.
 *
 * Carried as data rather than prose because it is the premise of the horizon beside it: if this
 * label is wrong, the horizon is wrong, and both should be re-argued together.
 */
export type ClaimVolatility = "structural" | "operational" | "commercial" | "temporal";

export const ACCESS_POINT_VOLATILITY: Readonly<Record<AccessPointClaimClass, ClaimVolatility>> = {
  "built-arrival-point": "structural",
  "served-transit-stop": "operational",
};

export const RESERVATION_VOLATILITY: Readonly<Record<ReservationClaimClass, ClaimVolatility>> = {
  "standing-sales-rule": "commercial",
  "dated-sale-instance": "temporal",
};

/**
 * The horizon governing each access-point class.
 *
 * `served-transit-stop` reuses `TIMETABLE_CYCLE_DAYS` — the *constant*, not the `airportLinks`
 * value, which §3 of this block's brief rightly forbids exporting outside its domain. The argument
 * is re-made rather than borrowed: whether a stop is served is published in a timetable, and the
 * operators that publish timetables revise them annually. Same rhythm, independently reached.
 *
 * **No shipped record is a `transit-stop` today**, so this branch is exercised by constructed
 * records in the tests and not by the dataset. It is decided in advance on purpose: the alternative
 * is that the first such record silently inherits whichever branch happens to run.
 */
export const ACCESS_POINT_HORIZON: Readonly<Record<AccessPointClaimClass, RecheckHorizon>> = {
  "built-arrival-point": HORIZON_NONE,
  "served-transit-stop": horizonOfDays(TIMETABLE_CYCLE_DAYS),
};

/** The horizon governing each reservation class. See the file header for why one is `unknown`. */
export const RESERVATION_HORIZON: Readonly<Record<ReservationClaimClass, RecheckHorizon>> = {
  "standing-sales-rule": HORIZON_UNKNOWN,
  "dated-sale-instance": HORIZON_NONE,
};

/** What kind of claim this access point's provenance backs. */
export function accessPointClaimClass(
  point: Pick<LogisticsAccessPoint, "role">
): AccessPointClaimClass {
  return ACCESS_POINT_CLAIM_CLASS[point.role];
}

/** What kind of claim this reservation record's provenance backs. */
export function reservationClaimClass(
  record: Pick<ReservationMechanismEvidenceRecord, "mechanism">
): ReservationClaimClass {
  return RESERVATION_CLAIM_CLASS[record.mechanism.kind];
}

/** The horizon governing this access point's provenance. */
export function accessPointHorizon(
  point: Pick<LogisticsAccessPoint, "role">
): RecheckHorizon {
  return ACCESS_POINT_HORIZON[accessPointClaimClass(point)];
}

/** The horizon governing this reservation record's provenance. */
export function reservationHorizon(
  record: Pick<ReservationMechanismEvidenceRecord, "mechanism">
): RecheckHorizon {
  return RESERVATION_HORIZON[reservationClaimClass(record)];
}

/**
 * The freshness of one access point's provenance, as of `today`.
 *
 * A thin adapter over the one engine, which is the whole of Block 11's "unification": the domain
 * knowledge is the horizon lookup above, and nothing about gates or tickets crosses into
 * `source-freshness.ts`.
 */
export function accessPointFreshness(
  point: Pick<LogisticsAccessPoint, "role" | "provenance">,
  today: string
): SourceFreshness {
  return freshnessForHorizon(point.provenance.consultedAt, accessPointHorizon(point), today);
}

/** The freshness of one reservation record's provenance, as of `today`. */
export function reservationMechanismFreshness(
  record: Pick<ReservationMechanismEvidenceRecord, "mechanism" | "provenance">,
  today: string
): SourceFreshness {
  return freshnessForHorizon(record.provenance.consultedAt, reservationHorizon(record), today);
}
