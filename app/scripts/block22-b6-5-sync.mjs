/**
 * Synchronisation helpers for the B6.5 browser audit.
 *
 * Both helpers replace fixed-delay assumptions with the real lifecycle of the thing being measured:
 * network accounting is keyed to the request that produced each response, and image checks wait for
 * each image to reach a terminal load/error state before judging it.
 */

/**
 * Epoch-based request accounting. Every request is stamped with the epoch that was current when the
 * browser issued it; `reset()` opens a new epoch. A response is only attributed to the current epoch
 * when its own request was issued in that epoch, so a request started on the previous screen and
 * answered after the reset can never be charged to the next one.
 */
export function createRequestEpochs() {
  const epochByRequest = new WeakMap();
  let epoch = 0;
  return {
    get epoch() {
      return epoch;
    },
    stamp(request) {
      if (!epochByRequest.has(request)) epochByRequest.set(request, epoch);
    },
    isCurrent(request) {
      return epochByRequest.get(request) === epoch;
    },
    reset() {
      epoch += 1;
    },
  };
}

/**
 * Runs in the page (via `locator.evaluateAll`) and must stay self-contained: Playwright serialises
 * the function source, so it cannot reference anything outside its own body.
 *
 * Waits until every image has reached a terminal state — `load` or `error` — or has been detached
 * (the gallery replaces a failed slide with `.gallery__error`). `complete === true` is terminal. An
 * image that stays pending until `timeoutMs` is reported as `pending`, never silently accepted.
 * Returns one record per image with the state observed once it settled.
 */
export async function settleImages(images, timeoutMs) {
  const results = await Promise.all(images.map((img) => new Promise((resolve) => {
    if (img.complete) {
      resolve("complete");
      return;
    }
    const finish = (outcome) => {
      clearTimeout(timer);
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      resolve(outcome);
    };
    const onLoad = () => finish("load");
    const onError = () => finish("error");
    const timer = setTimeout(() => finish("pending"), timeoutMs);
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
  })));
  // An `error` event is what makes the gallery swap the slide for `.gallery__error`; that swap is a
  // React commit, which lands before the next painted frame. Read the DOM only after it.
  if (results.includes("error") && typeof requestAnimationFrame === "function") {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  return images.map((img, index) => ({
    outcome: results[index],
    connected: img.isConnected !== false,
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    inErrorSlide: Boolean(img.closest?.(".gallery__slide")?.querySelector(".gallery__error")),
    src: img.currentSrc || img.getAttribute?.("src") || "",
  }));
}

/**
 * An image is safe once settled when it is either detached (replaced by the error state), decoded
 * with real pixels, or sitting inside a slide that already shows `.gallery__error`. A pending image,
 * an `error` outcome still in the DOM outside an error slide, or a terminal image with
 * `naturalWidth === 0` is a real failure.
 */
export function isSettledImageSafe(record) {
  if (!record.connected) return true;
  if (record.inErrorSlide) return true;
  if (record.outcome === "pending" || record.outcome === "error") return false;
  return record.complete && record.naturalWidth > 0;
}
