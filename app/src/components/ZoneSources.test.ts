import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Block 7 — the wiring contract for the zone source line.
 *
 * The data rule lives in `lib/zone-provenance.test.ts` and in the Python validator; the
 * real-viewport behaviour in `scripts/block7-zone-provenance-browser-audit.mjs`. These assertions
 * hold the one thing only the component can promise: that the link is named, that opening it does
 * not also select the zone, and that Block 7 changed nothing else on this card.
 */

function readSource(name: string): Promise<string> {
  return readFile(new URL(`./${name}`, import.meta.url), "utf8");
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("the source line names its source", () => {
  it("renders the source name as the link text, not the word 'Fuente'", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain("{sourceName(source)}");
    // The old bare link is gone.
    expect(panel).not.toMatch(/>\s*Fuente\s*<\/a>/);
  });

  it("says how close the source is, in words", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain("{tierLabel(source.tier)}");
  });

  it("gives the link an accessible name carrying the zone and the date", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain("aria-label={sourceLinkLabel(source, zone.name)}");
  });

  it("lists every distinct source rather than only the first", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain("distinctZoneSources(zone)");
  });

  it("labels one source and several differently", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain('sources.length === 1 ? "Fuente:" : "Fuentes:"');
  });
});

describe("opening a source is not choosing a zone", () => {
  it("keeps the column a plain section, with no click handler to reach", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain('<section key={zone.id} className="zone-column"');
    const head = panel.slice(panel.indexOf('className="zone-column"'));
    expect(head.slice(0, 160)).not.toContain("onClick");
  });

  it("stops the click anyway, so a future handler cannot capture it", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain("onClick={(event) => event.stopPropagation()}");
  });

  it("opens the source in a new tab, safely", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    const block = panel.slice(panel.indexOf("function ZoneSources"));
    const component = block.slice(0, block.indexOf("\n}"));
    expect(component).toContain('target="_blank"');
    expect(component).toContain('rel="noreferrer"');
  });
});

describe("Block 7 changed nothing else on the card", () => {
  it("adds no control, only a link", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    const block = panel.slice(panel.indexOf("function ZoneSources"));
    const component = block.slice(0, block.indexOf("\n}"));
    expect(component).not.toMatch(/<button|onChange|useState/);
  });

  it("leaves the editorial and derived sections untouched by provenance", async () => {
    const panel = withoutComments(await readSource("ZoneComparison.tsx"));
    // The tier never reaches an editorial axis or the derived distance block.
    expect(panel).not.toMatch(/editorial[^\n]*tier|tier[^\n]*editorial/i);
    expect(panel).not.toMatch(/tierLabel\([^)]*editorial/);
  });

  it("presents the tier as text, never as colour alone", async () => {
    const css = await readFile(new URL("../App.css", import.meta.url), "utf8");
    const rule = css.slice(css.indexOf(".zone-source__tier"));
    expect(rule.slice(0, 200)).toContain("color:");
    const panel = await readSource("ZoneComparison.tsx");
    // Whatever the colour does, the word is always rendered.
    expect(panel).toContain('<span className="zone-source__tier"> ({tierLabel(source.tier)})</span>');
  });

  it("lets a long operator name wrap instead of widening the column", async () => {
    const css = await readFile(new URL("../App.css", import.meta.url), "utf8");
    const rule = css.slice(css.indexOf(".zone-column__provenance {"));
    expect(rule.slice(0, 300)).toContain("overflow-wrap: anywhere");
  });

  it("marks the link as a link, not by colour alone", async () => {
    const css = await readFile(new URL("../App.css", import.meta.url), "utf8");
    const rule = css.slice(css.indexOf(".zone-source__link"));
    expect(rule.slice(0, 200)).toContain("text-decoration: underline");
  });
});
