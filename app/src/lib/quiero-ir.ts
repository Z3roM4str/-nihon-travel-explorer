import type { Place } from "../types";
import type { DivergenceEntry } from "./interest-divergence";
import type { InterestStance, PlaceInterestSummary, Traveller } from "./travellers";

/**
 * B25 (B7 «Quiero ir», `05 §6`) — how the screen is ORGANISED, and nothing more.
 *
 * Every fact here is read from what Blocks 5 and 6 already derive: the group of each shortlisted
 * place comes from `divergenceEntries` (unchanged), who is behind a one-sided place comes from
 * `summarizeInterest` (unchanged), and a person's own stance comes from `stanceOf` (unchanged).
 * This module only decides which section of the screen a place is drawn in, in the order the
 * shortlist already has. It stores nothing, writes nothing and never reorders a section.
 */

/** The segmented control's value: `both` or a traveller id. It is a lens, never an identity. */
export type QuieroIrLens = "both" | string;

export type PersonSection = {
  traveller: Traveller;
  /** `04 §1`: a/b by order of creation, never by the opaque id. */
  variant: "a" | "b";
  places: Place[];
};

export type QuieroIrSections = {
  agreed: Place[];
  /** One entry per traveller, always in creation order, each with only their one-sided places. */
  onlyBy: PersonSection[];
  /** Block 6's `differing`: someone wants it and someone said explicitly that they do not. */
  differing: Place[];
  /** Carried over from before profiles existed; nobody has spoken yet. */
  unclaimed: Place[];
  /** «No me interesa» from everyone who spoke, and wanted by nobody — not in the shortlist. */
  declined: Place[];
};

type Input = {
  savedPlaces: readonly Place[];
  declinedPlaces: readonly Place[];
  divergence: readonly DivergenceEntry[];
  travellers: readonly Traveller[];
  interestSummary: (placeId: string) => PlaceInterestSummary;
  stanceFor: (placeId: string, travellerId: string) => InterestStance | null;
  lens: QuieroIrLens;
};

export function quieroIrSections({
  savedPlaces,
  declinedPlaces,
  divergence,
  travellers,
  interestSummary,
  stanceFor,
  lens,
}: Input): QuieroIrSections {
  const groupOf = new Map(divergence.map((entry) => [entry.placeId, entry.group]));
  const person = lens === "both" ? null : lens;
  const visible = (place: Place, stance: InterestStance) =>
    person === null || stanceFor(place.id, person) === stance;

  const agreed: Place[] = [];
  const differing: Place[] = [];
  const unclaimed: Place[] = [];
  const onlyBy: PersonSection[] = travellers.map((traveller, index) => ({
    traveller,
    variant: index === 0 ? "a" : "b",
    places: [],
  }));

  for (const place of savedPlaces) {
    const group = groupOf.get(place.id);
    if (!group) continue;
    if (!visible(place, "interested")) continue;
    if (group === "agreed") agreed.push(place);
    else if (group === "differing") differing.push(place);
    else if (group === "unclaimed") unclaimed.push(place);
    else {
      const summary = interestSummary(place.id);
      if (summary.kind !== "only") continue;
      onlyBy.find((section) => section.traveller.id === summary.interestedId)?.places.push(place);
    }
  }

  return {
    agreed,
    onlyBy: person === null ? onlyBy : onlyBy.filter((section) => section.traveller.id === person),
    differing,
    // Unclaimed is nobody's opinion, so a one-person lens cannot show it as theirs.
    unclaimed: person === null ? unclaimed : [],
    declined: declinedPlaces.filter((place) => visible(place, "not-interested")),
  };
}

/** The places the summary row counts: everything shortlisted that the current lens shows. */
export function visibleShortlist(sections: QuieroIrSections): Place[] {
  return [
    ...sections.agreed,
    ...sections.onlyBy.flatMap((section) => section.places),
    ...sections.differing,
    ...sections.unclaimed,
  ];
}

/**
 * `05 §6` «Sólo una persona ha marcado»: exactly two travellers, and every stated interest in the
 * shortlist belongs to the same one. Returns the traveller who has NOT marked anything yet, so the
 * screen can say «Cuando {nombre} marque sus sitios…» instead of an empty «Los dos».
 */
export function travellerYetToMark(
  savedPlaces: readonly Place[],
  travellers: readonly Traveller[],
  stanceFor: (placeId: string, travellerId: string) => InterestStance | null
): Traveller | null {
  if (travellers.length !== 2) return null;
  const marked = travellers.filter((traveller) =>
    savedPlaces.some((place) => stanceFor(place.id, traveller.id) === "interested")
  );
  if (marked.length !== 1) return null;
  return travellers.find((traveller) => traveller.id !== marked[0].id) ?? null;
}
