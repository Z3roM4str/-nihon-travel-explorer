// A quiet value is not a published value while the real document writer is
// waiting for a Web Lock. A busy queue does not count as a quiet sample.
// Keep the original three samples, 40 ms intervals and document checks.
export async function readSettledPlanningDraft(page) {
  return page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let last = localStorage.getItem("nihon.manualPlanningDraft"), calm = 0;
      const tick = async () => {
        try {
          const { held, pending } = typeof navigator.locks?.query === "function"
            ? await navigator.locks.query() : { held: [], pending: [] };
          const busy = [...held, ...pending].some(lock => lock.name === "nihon:nihon.manualPlanningDraft");
          const now = localStorage.getItem("nihon.manualPlanningDraft");
          if (busy || now !== last) { last = now; calm = 0; } else calm += 1;
          if (calm >= 3) resolve(); else setTimeout(tick, 40);
        } catch (error) { reject(error); }
      };
      setTimeout(tick, 40);
    });
    const doc = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft"));
    delete doc._w;
    return doc;
  });
}
