import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getZones } from "../lib/accommodation-zone";
import photographyMetadata from "../data/photography-metadata.json";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

describe("B30 — Dónde dormir presents alternatives without an ordinal ranking", () => {
  it("has no zone position badges in the list, comparison columns, contrast rows or map pins", async () => {
    const source = (await readSource("./ZoneComparison.tsx"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/zone-card__index|zone-column__index|index\s*\+\s*1/);
    expect(source).toContain("zoneIcon(true)");
    expect(source).not.toMatch(/la mejor zona|segunda mejor|orden recomendado|recomendamos/i);
  });

  it("feeds the existing proximity calculation only places already in this trip and hub", async () => {
    const panel = await readSource("./ZoneComparison.tsx");
    const context = await readSource("../lib/zone-journey-context.ts");
    expect(panel).toContain("loadReconciledDraft(deviceStorage, savedIds).routeIds");
    expect(panel).toContain("zones.map((zone) => ({ zone, fit: zoneSavedPlacesFit(zone, hubTripPlaces) }))");
    expect(panel).not.toContain("rankZonesBySavedPlaces");
    expect(panel).toContain("Preserve the catalogue order");
    expect(panel).toContain("alternativas conservan el orden del");
    expect(panel).not.toContain("La lista sigue esa proximidad");
    expect(panel).toContain("zoneSavedPlacesFit(zone, hubTripPlaces)");
    expect(context).toContain("routeIds");
    expect(context).toContain("place?.hub === hub");
  });

  it("labels fact, calculation and opinion separately in both list and comparison", async () => {
    const source = await readSource("./ZoneComparison.tsx");
    expect(source).toContain("Hechos <EvidenceMark level=\"registrado\" />");
    expect(source).toContain("Cálculo de cercanía a este viaje");
    expect(source).toContain("EvidenceMark level=\"estimado\" detail=\"línea recta\"");
    expect(source).toContain("Opinión · Nihon dice <EvidenceMark level=\"nihon\" label={false} />");
    expect(source).toContain("<ZoneSources zone={zone} />");
    expect(source).toContain("zone.summary");
    expect(source).toContain("zone.tradeoffs.map");
  });

  it("uses a zone-specific fallback because the current licensed photo catalogue has no zone subjects", async () => {
    const records = (photographyMetadata as { images: { placeId?: string; assetPath: string }[] }).images;
    const zoneIds = new Set(getZones().map((zone) => zone.id));
    expect(records.some((record) => record.placeId && zoneIds.has(record.placeId))).toBe(false);
    expect(records.some((record) => /zone|accommodation/i.test(record.assetPath))).toBe(false);

    const panel = await readSource("./ZoneComparison.tsx");
    const fallback = await readSource("./ZonePhotoFallback.tsx");
    expect(panel.match(/<ZonePhotoFallback zoneName=\{zone.name\} \/>/g)).toHaveLength(2);
    expect(fallback).toContain("Fotografía pendiente");
    expect(fallback).toContain("aria-label={`Fotografía pendiente de ${zoneName}`}");
  });

  it("keeps the existing choice explicit and does not turn proximity into a booking or time", async () => {
    const source = (await readSource("./ZoneComparison.tsx"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).toContain("Dormir aquí");
    expect(source).toContain("Cambiar a esta zona");
    expect(source).toMatch(/no es un hotel reservado/i);
    expect(source).not.toMatch(/getBestTransfer|lookupTransfer|getBestCommute/);
    expect(source).not.toMatch(/fetch\s*\(|navigator\.geolocation/);
  });

  it("skips the initial selection write while preserving the existing storage key", async () => {
    const hook = await readSource("../useZoneComparison.ts");
    expect(hook).toContain('const STORAGE_KEY = "nihon.zoneComparison.v1"');
    expect(hook).toContain("const initialSelection = useRef(selection)");
    expect(hook).toContain("if (selection === initialSelection.current) return");
    expect(hook).toContain("deviceStorage.setItem(STORAGE_KEY, JSON.stringify(selection))");
  });
});
