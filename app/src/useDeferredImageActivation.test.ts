import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaceCard } from "./components/PlaceCard";
import { IMAGE_ACTIVATION_ROOT_MARGIN } from "./useDeferredImageActivation";
import { getAllPlaces } from "./data/store";
import { resolvePlaceImages } from "./data/place-images";
import type { Place } from "./types";

// B10 (#177, `design/09` «autorización del lote de activación diferida de imágenes»): la fotografía de
// una tarjeta no prioritaria no inicia su respuesta hasta estar a ≤ 2 viewports. El recorrido real
// (observadores, scroll, Portada → ciudad inmediata, fallback, reintento y presupuesto) lo ejerce
// `scripts/b10-deferred-images-check.mjs` en Chromium y WebKit; aquí se fija el contrato verificable sin DOM.

const withPhoto = (): Place => {
  const place = getAllPlaces().find((p) => resolvePlaceImages(p.id, p.images).length > 0);
  if (!place) throw new Error("fixture requires a place with a photograph");
  return place;
};
const withoutPhoto = (): Place | undefined => getAllPlaces().find((p) => resolvePlaceImages(p.id, p.images).length === 0);

const props = (place: Place, extra: Record<string, unknown> = {}) => ({
  place, selected: false, saved: false, onSelect: () => {}, onToggleSaved: () => {}, ...extra,
});
const imgTag = (html: string) => html.match(/<img\b[^>]*>/)?.[0] ?? "";

class IdleObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("deferred image activation — markup before any observation", () => {
  // Node has no IntersectionObserver; an observer that never reports is the state before the first observation.
  beforeEach(() => vi.stubGlobal("IntersectionObserver", IdleObserver));
  afterEach(() => vi.unstubAllGlobals());

  it.each(["normal", "compact"] as const)("a non-priority %s card renders its box and no src, keeping loading=lazy", (variant) => {
    const img = imgTag(renderToStaticMarkup(createElement(PlaceCard, props(withPhoto(), { variant }))));
    expect(img).not.toBe("");
    expect(img).not.toMatch(/\ssrc=/);
    expect(img).not.toMatch(/\ssrcset=/);
    expect(img).toContain('loading="lazy"');
    expect(img).toMatch(/\swidth="\d+"/);
    expect(img).toMatch(/\sheight="\d+"/);
    expect(img).toContain('alt=""');
  });

  it.each(["normal", "compact"] as const)("a priority %s card is active at once: src, fetchpriority=high, no loading=lazy", (variant) => {
    const img = imgTag(renderToStaticMarkup(createElement(PlaceCard, props(withPhoto(), { variant, priority: true }))));
    expect(img).toMatch(/\ssrc="[^"]+-800w\.webp"/);
    expect(img).toContain('fetchPriority="high"');
    expect(img).not.toContain('loading="lazy"');
  });

  it("without IntersectionObserver the card degrades to the previous behaviour: src present, native loading=lazy", () => {
    vi.unstubAllGlobals();
    const img = imgTag(renderToStaticMarkup(createElement(PlaceCard, props(withPhoto()))));
    expect(img).toMatch(/\ssrc="[^"]+-800w\.webp"/);
    expect(img).toContain('loading="lazy"');
  });

  it("keeps the skeleton, the open control and the accessible name of a deferred card", () => {
    const place = withPhoto();
    const html = renderToStaticMarkup(createElement(PlaceCard, props(place)));
    expect(html).toContain("place-card__skeleton");
    expect(html).toMatch(/<button[^>]*class="place-card__open"[^>]*aria-label="[^"]+"/);
    expect(html).toContain(`Quiero ir: ${place.name}`);
  });

  it("a place without a photograph keeps its placeholder and gets nothing to defer", () => {
    const place = withoutPhoto();
    if (!place) return; // every place has a photograph in this dataset
    const html = renderToStaticMarkup(createElement(PlaceCard, props(place)));
    expect(html).toContain("photo-placeholder");
    expect(html).not.toContain("<img");
  });
});

describe("deferred image activation — contract of the hook", () => {
  const read = async () => (await readFile(new URL("./useDeferredImageActivation.ts", import.meta.url), "utf8")).replace(/\r\n/g, "\n");

  it("anticipates at most two viewports on every side", () => {
    expect(IMAGE_ACTIVATION_ROOT_MARGIN).toBe("200% 200% 200% 200%");
    for (const value of IMAGE_ACTIVATION_ROOT_MARGIN.split(" ")) expect(Number.parseInt(value, 10)).toBeLessThanOrEqual(200);
  });

  it("observes with IntersectionObserver only; no timers, no scroll listeners, no image prefetch", async () => {
    const source = await read();
    expect(source).toContain("new IntersectionObserver(");
    expect(source).not.toMatch(/setTimeout|setInterval|requestIdleCallback|addEventListener\(["']scroll|new Image\(|\.preload|rel=["']preload/);
  });

  it("disconnects the shared observer with its last subscriber and releases on activation and unmount", async () => {
    const source = await read();
    expect(source).toContain("current.observer.disconnect()");
    expect(source).toContain("current.observer.unobserve(target)");
    expect(source).toMatch(/return release;/);
    expect(source).toMatch(/if \(active\) return;/);
  });

  it("never defers a priority card", async () => {
    const source = await read();
    expect(source).toMatch(/const active = priority \|\| near/);
  });

  it("PlaceCard hands only the activation of src to the hook; loading, dimensions, fallback and retry stay in the card", async () => {
    const card = await readFile(new URL("./components/PlaceCard.tsx", import.meta.url), "utf8");
    expect(card).toContain("useDeferredImageActivation<HTMLDivElement>(");
    expect(card).toContain("priority || !image");
    expect(card.match(/src=\{photoActive \? cardSrc : undefined\}/g) ?? []).toHaveLength(2);
    expect(card.match(/loading:\s*"lazy"\s*as const/g) ?? []).toHaveLength(2);
    expect(card).toContain("setPhotoAttempt((attempt) => attempt + 1);");
  });
});
