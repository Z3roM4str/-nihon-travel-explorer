import type { Place } from "../types";
import { GRADE_ORDER } from "./recommendation";

/** Authority order: grades, then round-robin canonical hubs, stable id within each hub. */
export function orderDiscoveryPlaces(places: readonly Place[], hubs: readonly string[], selectedHub: string): Place[] {
  if (selectedHub) {
    return [...places].sort((a, b) => (GRADE_ORDER[a.grade] ?? 9) - (GRADE_ORDER[b.grade] ?? 9) || a.id.localeCompare(b.id));
  }
  const output: Place[] = [];
  const grades = [...new Set(places.map(place => place.grade))].sort((a,b) => (GRADE_ORDER[a] ?? 9) - (GRADE_ORDER[b] ?? 9));
  for (const grade of grades) {
    const queues = hubs.map(hub => places.filter(place => place.grade === grade && place.hub === hub).sort((a,b) => a.id.localeCompare(b.id)));
    for (let index = 0; queues.some(queue => index < queue.length); index += 1) {
      for (const queue of queues) if (queue[index]) output.push(queue[index]);
    }
    output.push(...places.filter(place => place.grade === grade && !hubs.includes(place.hub)).sort((a,b) => a.id.localeCompare(b.id)));
  }
  return output;
}
