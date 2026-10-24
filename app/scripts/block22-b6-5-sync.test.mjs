import { describe, expect, it } from "vitest";
import { createRequestEpochs, isSettledImageSafe, settleImages } from "./block22-b6-5-sync.mjs";

class FakeImage extends EventTarget {
  constructor({ complete = false, naturalWidth = 0, inErrorSlide = false } = {}) {
    super();
    this.complete = complete;
    this.naturalWidth = naturalWidth;
    this.isConnected = true;
    this.currentSrc = "/images/places/JP-000/photo-800w.webp";
    this.inErrorSlide = inErrorSlide;
  }
  closest() {
    return { querySelector: () => (this.inErrorSlide ? {} : null) };
  }
  load() {
    this.complete = true;
    this.naturalWidth = 800;
    this.dispatchEvent(new Event("load"));
  }
  fail() {
    this.complete = true;
    this.naturalWidth = 0;
    this.dispatchEvent(new Event("error"));
  }
}

async function settleOne(img, act, timeoutMs = 200) {
  const pending = settleImages([img], timeoutMs);
  act?.();
  const [record] = await pending;
  return record;
}

describe("B6.5 request epochs (hub-list accounting)", () => {
  it("does not charge a request issued before reset to the next screen, even when answered after it", () => {
    const epochs = createRequestEpochs();
    const previousScreen = {};
    epochs.stamp(previousScreen);
    epochs.reset();
    expect(epochs.isCurrent(previousScreen)).toBe(false);
  });

  it("charges a request issued after reset to the current screen", () => {
    const epochs = createRequestEpochs();
    epochs.reset();
    const nextScreen = {};
    epochs.stamp(nextScreen);
    expect(epochs.isCurrent(nextScreen)).toBe(true);
  });

  it("keeps the original epoch when a request is seen twice", () => {
    const epochs = createRequestEpochs();
    const request = {};
    epochs.stamp(request);
    epochs.reset();
    epochs.stamp(request);
    expect(epochs.isCurrent(request)).toBe(false);
  });

  it("never attributes an unseen request", () => {
    expect(createRequestEpochs().isCurrent({})).toBe(false);
  });
});

describe("B6.5 fallback image settling", () => {
  it("accepts a sibling that is incomplete when checked and then loads (transient)", async () => {
    const img = new FakeImage();
    expect(img.complete).toBe(false);
    const record = await settleOne(img, () => img.load());
    expect(record.outcome).toBe("load");
    expect(isSettledImageSafe(record)).toBe(true);
  });

  it("rejects an image that fires error and stays in the DOM outside an error slide", async () => {
    const img = new FakeImage();
    const record = await settleOne(img, () => img.fail());
    expect(record.outcome).toBe("error");
    expect(isSettledImageSafe(record)).toBe(false);
  });

  it("rejects a terminal image with no pixels", async () => {
    const record = await settleOne(new FakeImage({ complete: true, naturalWidth: 0 }));
    expect(isSettledImageSafe(record)).toBe(false);
  });

  it("rejects an image that never reaches load or error", async () => {
    const record = await settleOne(new FakeImage(), undefined, 20);
    expect(record.outcome).toBe("pending");
    expect(isSettledImageSafe(record)).toBe(false);
  });

  it("accepts a failed image that the gallery replaced with its error state", async () => {
    const img = new FakeImage();
    const record = await settleOne(img, () => {
      img.isConnected = false;
      img.fail();
    });
    expect(isSettledImageSafe(record)).toBe(true);
  });

  it("accepts an image inside a slide that already shows .gallery__error", async () => {
    const record = await settleOne(new FakeImage({ complete: true, naturalWidth: 0, inErrorSlide: true }));
    expect(isSettledImageSafe(record)).toBe(true);
  });

  it("accepts an image that had already loaded", async () => {
    const record = await settleOne(new FakeImage({ complete: true, naturalWidth: 800 }));
    expect(record.outcome).toBe("complete");
    expect(isSettledImageSafe(record)).toBe(true);
  });
});
