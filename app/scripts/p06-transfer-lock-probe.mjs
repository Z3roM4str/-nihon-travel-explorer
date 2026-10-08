import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launch, newPage, tripFixture } from "./lib/modern-trip.mjs";

// Causal witness of the historical 3 x 40 ms quiet-read heuristic. Holding the
// real Web Lock is an explicit intervention, not a claim about an old trace.
const out = resolve(process.env.NIHON_EVIDENCE_OUT ?? "/tmp/nihon-transfer-lock");
mkdirSync(out, { recursive: true });
const env = await launch();
const results = [];
try {
  for (const held of [false, true]) {
    const { context, page } = await newPage(env.browser, { width: 390, height: 844, dpr: 2 }, { fixture: tripFixture() });
    try {
      await page.goto(env.url);
      await page.getByRole("button", { name: "Viaje", exact: true }).click();
      await page.locator(".day-card").first().waitFor();
      await page.getByRole("button", { name: "Herramientas del viaje" }).tap();
      const section = page.locator(".inter-hub-segments");
      await section.locator("select").first().selectOption({ index: 1 });
      await section.locator("select").nth(1).selectOption("shinkansen");
      await section.locator('input[type="number"]').first().fill("135");
      if (held) await page.evaluate(() => new Promise(resolve => {
        void navigator.locks.request("nihon:nihon.manualPlanningDraft", () => { resolve(); return new Promise(release => { window.__auditReleaseLock = release; }); });
      }));
      await section.getByRole("button", { name: /Añadir traslado/ }).tap();
      // Exact historical heuristic and exact document assertion, unchanged.
      const originalRead = await page.evaluate(async () => { await new Promise((resolve) => { let last = localStorage.getItem("nihon.manualPlanningDraft"), calm = 0; const tick = () => { const now = localStorage.getItem("nihon.manualPlanningDraft"); if (now !== last) { last = now; calm = 0; } else calm += 1; if (calm >= 3) resolve(); else setTimeout(tick, 40); }; setTimeout(tick, 40); }); const doc = JSON.parse(localStorage.getItem("nihon.manualPlanningDraft")); delete doc._w; return doc; });
      const observed = await page.evaluate(async () => ({
        uiCount: document.querySelectorAll(".inter-hub-segments__item").length,
        pending: sessionStorage.getItem("nihon.pending.v1.nihon.manualPlanningDraft"),
        locks: await navigator.locks.query(),
      }));
      if (held) await page.evaluate(() => window.__auditReleaseLock());
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("nihon.manualPlanningDraft")).interHubSegments.length === 1);
      const final = await page.evaluate(() => localStorage.getItem("nihon.manualPlanningDraft"));
      await page.reload();
      const afterReload = await page.evaluate(() => localStorage.getItem("nihon.manualPlanningDraft"));
      const originalAssertion = originalRead.interHubSegments.length === 1;
      const pendingCount = JSON.parse(JSON.parse(observed.pending ?? "null")?.value ?? "null")?.interHubSegments?.length;
      const result = { held, originalAssertion, originalRead, observed, pendingCount, final, afterReload,
        ok: (held ? !originalAssertion && observed.uiCount === 1 && pendingCount === 1 : originalAssertion) && JSON.parse(afterReload).interHubSegments.length === 1 };
      results.push(result); console.log(JSON.stringify(result));
    } finally { await context.close(); }
  }
} finally { await env.close(); writeFileSync(out + "/results.json", JSON.stringify({ productIntervention: false, controlledLockIntervention: true, historicalCauseProven: false, results }, null, 2)); }
process.exitCode = results.every(result => result.ok) ? 0 : 1;
