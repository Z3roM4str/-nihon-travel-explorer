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

describe("Block 8 — the airport links say what kind of journey they are", () => {
  it("renders the mode-explicit label rather than the bare word 'directo'", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain("{airportLinkConnection(link)}");
    // The old ambiguous ternary is gone.
    expect(panel).not.toMatch(/directFromZone \? "directo" : "con enlace"/);
  });

  it("spells the connection out for assistive technology", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain(
      '<span className="visually-hidden">. {airportLinkDescription(link)}</span>'
    );
  });

  it("keys a link by airport AND service, so one airport may hold two answers", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain("key={airportLinkKey(link)}");
    expect(panel).not.toContain("key={link.airport}");
  });

  it("emphasises directness, never a mode", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    const block = panel.slice(panel.indexOf("function AirportFacts"));
    const component = block.slice(0, block.indexOf("\n}"));
    expect(component).toContain('link.directFromZone ? "zone-fact--strong" : ""');
    // Nothing keys a style off the mode.
    expect(component).not.toMatch(/mode === "bus" \?[^\n]*class|zone-fact--(bus|rail)/);
  });

  it("adds no control to the fact row", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    const block = panel.slice(panel.indexOf("function AirportFacts"));
    const component = block.slice(0, block.indexOf("\n}"));
    expect(component).not.toMatch(/<button|onClick|useState/);
  });
});

describe("Block 9 — the editorial ratings say what they are", () => {
  it("makes every ordinal read as criterio rather than a measurement", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain("{ratingAccessibleText(value)}");
    // The bare measurement-shaped string is gone.
    expect(panel).not.toMatch(/visually-hidden">\{value\} de 5</);
  });

  it("labels the full-ratings disclosure as criterio, like every other editorial heading", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    const block = panel.slice(panel.indexOf('<details className="zone-axes">'));
    const details = block.slice(0, block.indexOf("</details>"));
    expect(details).toContain('zone-column__tag--editorial">criterio</span>');
  });

  it("states what a rating is on the surface that shows all ten", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    const block = panel.slice(panel.indexOf('<details className="zone-axes">'));
    const details = block.slice(0, block.indexOf("</details>"));
    expect(details).toContain("{editorialDisclosure()}");
  });

  it("gives the full list the direction hint the contrasts section already had", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    const block = panel.slice(panel.indexOf('<details className="zone-axes">'));
    const details = block.slice(0, block.indexOf("</details>"));
    expect(details).toContain("{axisDirectionHint(axis.high)}");
  });

  it("names neutrality in words in the full list, not only in a colour", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    const block = panel.slice(panel.indexOf('<details className="zone-axes">'));
    const details = block.slice(0, block.indexOf("</details>"));
    expect(details).toContain("{NEUTRAL_AXIS_NOTE}");
    expect(details).toContain("NEUTRAL_AXES.has(axis.key)");
  });

  it("shares one source of truth for the neutral note and the direction hint", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    // Neither string is written inline anywhere, so the two surfaces cannot drift apart.
    expect(panel).not.toContain("ni bueno ni malo");
    expect(panel).not.toContain("Más marcas =");
  });

  it("keeps the full ratings behind a closed disclosure, as Block 3 required", async () => {
    const panel = await readSource("ZoneComparison.tsx");
    expect(panel).toContain('<details className="zone-axes">');
    // No `open` attribute: it must still start closed.
    expect(panel).not.toMatch(/<details className="zone-axes" open/);
  });

  it("adds no control for editing a rating", async () => {
    const panel = withoutComments(await readSource("ZoneComparison.tsx"));
    const block = panel.slice(panel.indexOf('<details className="zone-axes">'));
    const details = block.slice(0, block.indexOf("</details>"));
    expect(details).not.toMatch(/<button|<input|<select|onClick|onChange/);
  });

  it("keeps the disclosure summary at the tap-target floor", async () => {
    const css = await readFile(new URL("../App.css", import.meta.url), "utf8");
    const rule = css.slice(css.indexOf(".zone-axes > summary {"));
    expect(rule.slice(0, 320)).toContain("min-height: var(--tap-target)");
  });

  it("lets the disclosure wrap rather than widening the panel", async () => {
    const css = await readFile(new URL("../App.css", import.meta.url), "utf8");
    const rule = css.slice(css.indexOf(".zone-axes__disclosure {"));
    expect(rule.slice(0, 260)).toContain("overflow-wrap: anywhere");
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
