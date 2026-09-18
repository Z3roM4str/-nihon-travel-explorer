import type { PlaceInterestSummary, Traveller } from "./travellers";

/**
 * Block 5 — how the two-person layer shows up on screen, and how rarely.
 *
 * The brief for this layer is mostly a list of things it must NOT become: a Persona 1 / Persona 2
 * pair stamped on every card, a wall of chips, a dating app, a scoreboard. The rule that keeps it
 * out of all of those is a single one:
 *
 * > **A marker appears only when it tells the reader something they do not already know.**
 *
 * So the marker is computed from the ACTIVE reader's point of view, and returns `null` — no chip,
 * no badge, nothing — for the two commonest states: a place nobody has an opinion about, and a
 * place *you* saved and the other person has not seen yet. The heart already says the second one.
 * What is left is exactly the information that is worth interrupting for: the other person also
 * wants this, only they want it, or somebody has said no.
 *
 * Every marker carries **text**. `tone` exists for styling, never as the sole signal, so the layer
 * survives greyscale, colour blindness and a screen reader intact.
 *
 * Nothing here ranks, scores or recommends. "Los dos" is a coincidence of two stated preferences
 * and is worded as one; it is not a rating, and there is no arithmetic anywhere in this file.
 */

export type InterestMarkerTone = "agreement" | "other" | "declined" | "unclaimed";

export type InterestMarker = {
  /** The primary signal, always present. Never replaced by colour alone. */
  label: string;
  /** Decorative only; every caller renders it `aria-hidden`. */
  glyph: string;
  tone: InterestMarkerTone;
  /** Spelled out for assistive technology, where the short label would lose its subject. */
  description: string;
};

function labelOf(travellers: readonly Traveller[], id: string): string {
  return travellers.find((entry) => entry.id === id)?.label ?? "La otra persona";
}

function firstOther(ids: readonly string[], activeId: string | null): string | null {
  return ids.find((id) => id !== activeId) ?? null;
}

/**
 * The marker for one place, seen by one reader, or `null` when there is nothing worth saying.
 *
 * `null` is the common case by design — on a browse screen most cards carry no marker at all.
 */
export function interestMarker(
  summary: PlaceInterestSummary,
  travellers: readonly Traveller[],
  activeTravellerId: string | null
): InterestMarker | null {
  switch (summary.kind) {
    case "none":
      return null;

    case "unclaimed":
      return {
        label: "Sin reclamar",
        glyph: "•",
        tone: "unclaimed",
        description:
          "Estaba en la lista antes de crear los perfiles. Todavía nadie ha dicho si le interesa.",
      };

    case "both":
      return {
        label: "Los dos",
        glyph: "✓",
        tone: "agreement",
        description: "Las dos personas han dicho que quieren ir.",
      };

    case "only": {
      // You saved it and nobody else has spoken: the heart already says that. No marker.
      if (summary.interestedId === activeTravellerId) return null;
      const who = labelOf(travellers, summary.interestedId);
      return {
        label: `Sólo ${who}`,
        glyph: "♥",
        tone: "other",
        description: `${who} quiere ir. Tú todavía no has dicho nada.`,
      };
    }

    case "split": {
      const activeWantsIt =
        activeTravellerId !== null && summary.interestedIds.includes(activeTravellerId);
      if (activeWantsIt) {
        const otherId = firstOther(summary.notInterestedIds, activeTravellerId);
        const who = otherId ? labelOf(travellers, otherId) : "La otra persona";
        return {
          label: `${who}: no`,
          glyph: "✕",
          tone: "declined",
          description: `Tú quieres ir. ${who} ha dicho que no le interesa.`,
        };
      }
      const otherId = firstOther(summary.interestedIds, activeTravellerId);
      const who = otherId ? labelOf(travellers, otherId) : "La otra persona";
      return {
        label: `${who} sí`,
        glyph: "♥",
        tone: "other",
        description: `${who} quiere ir. Tú has dicho que no te interesa.`,
      };
    }

    case "declined": {
      const activeDeclined =
        activeTravellerId !== null && summary.notInterestedIds.includes(activeTravellerId);
      if (activeDeclined && summary.notInterestedIds.length === 1) {
        return {
          label: "No te interesa",
          glyph: "✕",
          tone: "declined",
          description: "Has dicho que no te interesa. La otra persona no ha dicho nada.",
        };
      }
      if (activeDeclined) {
        return {
          label: "Ninguno",
          glyph: "✕",
          tone: "declined",
          description: "Las dos personas han dicho que no les interesa.",
        };
      }
      const otherId = firstOther(summary.notInterestedIds, activeTravellerId);
      const who = otherId ? labelOf(travellers, otherId) : "La otra persona";
      return {
        label: `${who}: no`,
        glyph: "✕",
        tone: "declined",
        description: `${who} ha dicho que no le interesa. Tú todavía no has dicho nada.`,
      };
    }
  }
}

/**
 * The full, unabbreviated picture, for the place detail — the one surface with room for it.
 *
 * One line per traveller, each a plain statement of what that person said, including "no ha dicho
 * nada" as a first-class answer. No total, no verdict, no suggestion about what to do next.
 */
export type TravellerStanceLine = {
  travellerId: string;
  label: string;
  text: string;
  stance: "interested" | "not-interested" | "silent";
};

export function stanceLines(
  summary: PlaceInterestSummary,
  travellers: readonly Traveller[]
): TravellerStanceLine[] {
  const interested = new Set<string>();
  const declined = new Set<string>();

  if (summary.kind === "both") for (const entry of travellers) interested.add(entry.id);
  if (summary.kind === "only") interested.add(summary.interestedId);
  if (summary.kind === "split") {
    for (const id of summary.interestedIds) interested.add(id);
    for (const id of summary.notInterestedIds) declined.add(id);
  }
  if (summary.kind === "declined") for (const id of summary.notInterestedIds) declined.add(id);

  return travellers.map((traveller) => {
    if (interested.has(traveller.id)) {
      return {
        travellerId: traveller.id,
        label: traveller.label,
        text: "quiere ir",
        stance: "interested" as const,
      };
    }
    if (declined.has(traveller.id)) {
      return {
        travellerId: traveller.id,
        label: traveller.label,
        text: "no le interesa",
        stance: "not-interested" as const,
      };
    }
    return {
      travellerId: traveller.id,
      label: traveller.label,
      text: "no ha dicho nada",
      stance: "silent" as const,
    };
  });
}

/**
 * The saved list's one-line header.
 *
 * Plain counts of what the two of them said — never a percentage, a compatibility figure or a
 * "you agree on 60%". A count is a fact about the list; a percentage would be a judgement about
 * the relationship.
 */
export function tallySentence(tally: {
  total: number;
  both: number;
  onlyOne: number;
  split: number;
  unclaimed: number;
}): string {
  if (tally.total === 0) return "Todavía no habéis guardado nada.";
  const parts: string[] = [];
  if (tally.both > 0) parts.push(`${tally.both} que queréis los dos`);
  if (tally.onlyOne > 0) parts.push(`${tally.onlyOne} que quiere sólo uno`);
  if (tally.split > 0) parts.push(`${tally.split} con desacuerdo`);
  if (tally.unclaimed > 0) parts.push(`${tally.unclaimed} sin reclamar`);
  const lugar = tally.total === 1 ? "lugar" : "lugares";
  if (parts.length === 0) return `${tally.total} ${lugar} en la lista.`;
  return `${tally.total} ${lugar}: ${parts.join(" · ")}.`;
}
