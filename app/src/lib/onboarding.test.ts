import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS, ONBOARDING_STORAGE_KEY } from "./onboarding";

/**
 * Block 1. The first-run explainer is the one piece of UI that can stand between a reader and
 * the product, so its constraints are worth pinning: it stays short, it states the actual loop,
 * it can always be closed, and dismissing it sticks.
 */

describe("onboarding content", () => {
  it("stays at three steps — the brief was 2–3, never a tutorial", () => {
    expect(ONBOARDING_STEPS.length).toBe(3);
  });

  it("gives every step an icon, a title and a body", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.icon.trim().length, step.title).toBeGreaterThan(0);
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.body.trim().length).toBeGreaterThan(20);
    }
  });

  it("keeps each step to a couple of sentences", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.body.length, step.title).toBeLessThan(220);
    }
  });

  it("states the whole loop: explore, mark, compare afterwards", () => {
    const text = ONBOARDING_STEPS.map((step) => `${step.title} ${step.body}`)
      .join(" ")
      .toLowerCase();
    expect(text).toContain("explora");
    expect(text).toContain("corazón");
    expect(text).toContain("compara");
  });

  it("promises nothing Block 1 does not ship — no sync, no accounts, no two-person mode", () => {
    const text = ONBOARDING_STEPS.map((step) => step.body).join(" ").toLowerCase();
    for (const forbidden of ["sincroniza", "cuenta", "inicia sesión", "tu pareja", "en tiempo real"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });
});

describe("onboarding persistence", () => {
  it("uses a versioned storage key, so a future rewrite can show a new explainer", () => {
    expect(ONBOARDING_STORAGE_KEY).toBe("nihon.onboarding.seen.v1");
  });

  it("never touches the saved-places key", () => {
    expect(ONBOARDING_STORAGE_KEY).not.toContain("savedPlaceIds");
  });

  it("treats unavailable storage as not-yet-seen rather than throwing", async () => {
    const source = await readFile(new URL("./onboarding.ts", import.meta.url), "utf8");
    expect(source).toContain("catch");
    expect(source).toContain("return false");
  });
});

describe("Onboarding component — never a wall", () => {
  async function readComponent(): Promise<string> {
    return readFile(new URL("../components/Onboarding.tsx", import.meta.url), "utf8");
  }

  it("closes on Escape", async () => {
    expect(await readComponent()).toContain('event.key === "Escape"');
  });

  it("closes on a backdrop click", async () => {
    expect(await readComponent()).toContain("event.target === event.currentTarget");
  });

  it("offers an explicit skip and an explicit close", async () => {
    const source = await readComponent();
    expect(source).toContain("Saltar");
    expect(source).toContain("Cerrar la introducción");
  });

  it("marks itself seen on every exit path, not only on finishing", async () => {
    const source = await readComponent();
    // A single `close` used by all four exits, rather than markOnboardingSeen sprinkled around.
    expect(source).toContain("markOnboardingSeen();");
    expect(source.match(/markOnboardingSeen\(\)/g)?.length).toBe(1);
  });

  it("keeps keyboard focus inside itself while open", async () => {
    const source = await readComponent();
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain('aria-modal="true"');
  });
});

describe("App wiring", () => {
  it("shows the explainer only when it has not been seen", async () => {
    const source = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
    expect(source).toContain("useState(() => !hasSeenOnboarding())");
  });

  it("keeps a way back to it, so dismissing is not a one-way door", async () => {
    const source = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
    expect(source).toContain("setOnboardingOpen(true)");
    expect(source).toContain("Cómo se usa Nihon");
  });
});
