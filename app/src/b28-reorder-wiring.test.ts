import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * B28 (B9.2) — pruebas de cableado por fuente (línea Claude). El comportamiento real lo mide el gate
 * `scripts/b28-viaje-reordenar-check.mjs` en Chromium; aquí se fijan las decisiones estructurales que
 * no deben degradarse sin querer: una sola ruta de commit, sin estado paralelo, sin HTML5 drag, el
 * asa como único elemento `touch-action: none`, «Mover a…» y `aria-live` presentes.
 */

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("B28 — una sola fuente de verdad y una sola ruta de commit", () => {
  it("«Mover a…», el asa y el teclado terminan en commitStopMove, que usa las mutaciones del borrador", async () => {
    const source = strip(await read("./components/OrderedSequenceBuilder.tsx"));
    expect(source).toMatch(/function commitStopMove\(/);
    expect((source.match(/commitStopMove\(/g) ?? []).length).toBeGreaterThanOrEqual(4); // def + sheet ×2 + hook
    expect(source).toMatch(/movePlaceToPosition\(fromDay\.id, toDay\.id, origin\.index, target\.index\)/);
    expect(source).toMatch(/addPlaceToDay\(toDay\.id, placeId, target\.index\)/);
    expect(source).toMatch(/removePlaceFromDay\(placeId\)/);
  });

  it("no crea una segunda estructura persistente: el hook de arrastre no toca el borrador ni el almacenamiento", async () => {
    const hook = strip(await read("./components/useStopReorder.ts"));
    expect(hook).not.toMatch(/localStorage|sessionStorage|usePlanningDraft|setDraft|routeIds/);
    const pure = strip(await read("./lib/stop-reorder.ts"));
    expect(pure).not.toMatch(/localStorage|document\.|window\.(?!innerWidth)/);
  });

  it("añadir/quitar ya no rehacen el reparto: el builder no llama a setRoute para ello", async () => {
    const source = strip(await read("./components/OrderedSequenceBuilder.tsx"));
    expect(source).not.toMatch(/setRouteIds\(/);
    expect(source).not.toMatch(/addUnassignedToRoute|routeChangeDiscardsSplit/);
  });
});

describe("B28 — interacción y accesibilidad", () => {
  it("usa eventos de puntero, no HTML5 drag ni aria-grabbed", async () => {
    for (const file of [
      "components/useStopReorder.ts",
      "components/TripStop.tsx",
      "components/UnassignedDrawer.tsx",
      "components/DayTimeline.tsx",
      "components/StopDragGhost.tsx",
      "components/OrderedSequenceBuilder.tsx",
    ]) {
      const source = strip(await read(`./${file}`));
      expect(source, file).not.toMatch(/draggable|aria-grabbed|onDragStart|onDragOver|onDrop\b/);
    }
    const hook = strip(await read("./components/useStopReorder.ts"));
    expect(hook).toMatch(/pointerdown|onPointerDown/);
    expect(hook).toMatch(/pointercancel/);
    expect(hook).toMatch(/setPointerCapture/);
  });

  it("el asa es un <button> nombrado y descrito, con teclado (Espacio/Intro, flechas, Escape)", async () => {
    const stop = strip(await read("./components/TripStop.tsx"));
    expect(stop).toMatch(/aria-label=\{`Reordenar \$\{place\.name\}, parada \$\{position\} de \$\{total\}`\}/);
    expect(stop).toMatch(/aria-describedby="reorder-instructions"/);
    const hook = strip(await read("./components/useStopReorder.ts"));
    for (const key of ["ArrowUp", "ArrowDown", "Escape", "Enter"]) expect(hook).toContain(key);
    expect(hook).toMatch(/onBlur/);
  });

  it("existe la región en vivo y las instrucciones de uso; «Mover a…» sigue ofrecido", async () => {
    const builder = await read("./components/OrderedSequenceBuilder.tsx");
    expect(builder).toContain('aria-live="polite" data-day-announcer');
    expect(builder).toContain('id="reorder-instructions"');
    expect(await read("./components/StopActionsSheet.tsx")).toContain("Mover a…");
    expect(await read("./components/StopActionsSheet.tsx")).toContain("Añadir aquí");
  });

  it("`touch-action: none` sólo en las asas; nada más lo declara", async () => {
    const css = strip(await read("./App.css"));
    const declarations = css.split("\n").filter((line) => /touch-action:\s*none/.test(line));
    expect(declarations).toHaveLength(1);
    const ruleStart = css.lastIndexOf("{", css.indexOf(declarations[0]));
    const selector = css.slice(css.lastIndexOf("}", ruleStart) + 1, ruleStart);
    expect(selector).toMatch(/\.trip-stop__handle/);
    expect(selector).toMatch(/\.unassigned__handle-grip/);
  });

  it("los indicadores no usan color crudo ni tamaños fuera de tokens (Art. 10)", async () => {
    const css = await read("./App.css");
    const block = css.slice(css.indexOf("B28 (B9.2) Reordenar"), css.indexOf("/* --- Acciones de la parada"));
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(block).toMatch(/var\(--info-600\)/);
  });
});
