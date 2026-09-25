import { describe, expect, it } from "vitest";
import type { Place } from "../types";
import { getAllPlaces, getHubs } from "../data/store";
import { orderDiscoveryPlaces } from "./discovery-order";

const place = (id: string, hub: string, grade = "S") => ({ id, hub, grade } as Place);
describe("Astra discovery ordering", () => {
  it("round-robins uneven hub queues within a grade", () => {
    const input = [place("JP-003","A"), place("JP-001","A"), place("JP-002","A"), place("JP-010","B")];
    expect(orderDiscoveryPlaces(input, ["A","B"], "").map(p => p.id)).toEqual(["JP-001","JP-010","JP-002","JP-003"]);
  });
  it("uses grade then id in an explicit hub", () => {
    expect(orderDiscoveryPlaces([place("JP-003","A","B"),place("JP-002","A","S")], ["A"], "A").map(p=>p.id)).toEqual(["JP-002","JP-003"]);
  });
  it("returns every canonical id once and deterministically", () => {
    const first = orderDiscoveryPlaces(getAllPlaces(), getHubs(), "").map(p=>p.id);
    const second = orderDiscoveryPlaces(getAllPlaces(), getHubs(), "").map(p=>p.id);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(214);
    expect(first).toHaveLength(214);
  });
});
