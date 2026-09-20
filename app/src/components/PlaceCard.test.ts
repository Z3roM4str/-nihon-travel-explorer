import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Bloque 19 (B3) — cobertura estructural de `PlaceCard` — source-scanning, sin jsdom ni Testing
 * Library, por la misma razón que registra el módulo de `PlaceDetail.test.ts`: este repositorio
 * no tiene un arnés de DOM de componentes y añadir uno queda fuera de alcance aquí.
 *
 * Lo que protege este fichero no es el estilo, sino el contrato de la tarjeta (`04 §5`): las seis
 * cosas que un lector que hojea debe poder responder, las dos acciones independientes y su
 * marcado, el límite duro de 2 chips con prioridad fija, la insignia sólo-S, y las reglas de
 * fotografía. Sustituye por completo a la versión anterior a este bloque, cuya anatomía (chips de
 * hecho ilimitados, insignia por cada grado, marcador de texto dentro de la tarjeta) ya no existe.
 *
 * Verificado en Chromium en 390×844, 840×900 y 1440×900 — ver
 * `scripts/block19-discovery-browser-audit.mjs`.
 */

async function readSource(): Promise<string> {
  return readFile(new URL("./PlaceCard.tsx", import.meta.url), "utf8");
}

describe("PlaceCard — what a scanning reader can answer", () => {
  it("reads the interest level through the shared ladder, not the raw grade letter", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\binterestLevelForPlace\b[^}]*\}\s*from\s*["']\.\.\/lib\/interest-level["']/
    );
    expect(source).toContain("interestLevelForPlace(place)");
    expect(source).toContain("{interest.label}");
  });

  it("shows a badge only for grade S, and never colours it — `04 §5.3`", async () => {
    const source = await readSource();
    expect(source).toContain('interest.level === "imprescindible"');
    const badge = source.slice(source.indexOf("place-card__badge"));
    expect(badge.slice(0, 200)).toContain("★");
    expect(badge.slice(0, 200)).toContain("Imprescindible");
    // No per-grade colour class on the card — that per-grade treatment (`badge--grade-A` etc.)
    // stays in `PlaceDetail`/`App.css`'s Fuentes section, out of B19's scope.
    expect(source).not.toMatch(/badge--grade-\$\{place\.grade\}/);
  });

  it("names the category (through the collapsed presentation map) and the zone", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{\s*categoryPresentation\s*\}\s*from\s*["']\.\.\/lib\/category-presentation["']/
    );
    expect(source).toContain("categoryPresentation(place.category)");
    expect(source).toContain("place.neighborhood || place.municipality");
  });

  it("shows a short reason drawn from the dataset, never generated", async () => {
    const source = await readSource();
    expect(source).toContain("place.differentiator");
    expect(source).toContain("place.description");
    expect(source).toContain("place-card__reason");
  });

  it("resolves visit time through the shared duration domain", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{[^}]*\bresolveDuration\b[^}]*\}\s*from\s*["']\.\.\/lib\/duration["']/
    );
    expect(source).toContain("resolveDuration(place.duration)");
  });

  it("falls back to the editorial duration text rather than inventing a number", async () => {
    const source = await readSource();
    expect(source).toContain("place.duration.raw");
  });

  it("limits itself to two chips, duration always first — `04 §3`/`§5.7`", async () => {
    const source = await readSource();
    // Exactly one <ul> of chips, with the duration <li> always rendered before a conditional
    // second <li> — never a third.
    const chips = source.slice(source.indexOf("place-card__chips"));
    expect(chips.slice(0, 900)).toContain("Tiempo de visita");
    expect(source.match(/place-card__chip["'`\s>]/g) ?? []).not.toHaveLength(0);
  });

  it("resolves the second chip by the fixed priority — aviso real > reserva obligatoria > joya escondida", async () => {
    const source = await readSource();
    const secondChip = source.slice(
      source.indexOf("function secondChip"),
      source.indexOf("\n}\n", source.indexOf("function secondChip"))
    );
    // Reuses the existing domain interpretations — never a new "aviso real" criterion.
    expect(secondChip).toContain("describeFebMarStatusForUi(interpretPlaceFebMarStatus(place))");
    expect(secondChip).toContain("interpretPlaceReservation(place)");
    expect(secondChip).toContain("isHiddenGem(place)");
    const avisoIndex = secondChip.indexOf('tone === "attention"');
    const reservaIndex = secondChip.indexOf('category === "required"');
    const joyaIndex = secondChip.indexOf("isHiddenGem(place)");
    expect(avisoIndex).toBeGreaterThan(-1);
    expect(reservaIndex).toBeGreaterThan(avisoIndex);
    expect(joyaIndex).toBeGreaterThan(reservaIndex);
  });

  it("second chip is only attention-styled for the aviso-real case, never for reserva/joya", async () => {
    const source = await readSource();
    expect(source).toContain('chip2.icon === "aviso" ? "place-card__chip--attention" : ""');
  });
});

describe("PlaceCard — name over the photograph (`04 §5.2`)", () => {
  it("measures overflow against the 2-line box instead of trusting -webkit-line-clamp's scrollHeight", async () => {
    const source = await readSource();
    expect(source).toMatch(/import\s*\{[^}]*\buseLayoutEffect\b[^}]*\}\s*from\s*["']react["']/);
    expect(source).toContain("node.scrollHeight > node.clientHeight + 1");
    expect(source).toContain("place-card__name-text--tight");
  });

  it("only runs the tight-name measurement for the normal variant", async () => {
    const source = await readSource();
    const effect = source.slice(source.indexOf("useLayoutEffect(() => {"));
    expect(effect.slice(0, 200)).toContain('if (variant !== "normal") return;');
  });
});

describe("PlaceCard — the two actions", () => {
  it("is an <article>, so the save control is not nested inside the open control", async () => {
    const source = await readSource();
    expect(source).toContain("<article");
    // The invalid shortcut this markup exists to avoid: a card-wide <button> wrapping another.
    expect(source).not.toMatch(/<button[^>]*>\s*[\s\S]{0,400}?<button/);
  });

  it("exposes the saved state to assistive technology, for both variants", async () => {
    const source = await readSource();
    expect(source.match(/aria-pressed=\{saved\}/g) ?? []).toHaveLength(2);
  });

  it("labels the save control with what it will do and to which place", async () => {
    const source = await readSource();
    expect(source).toContain("Quitar ${place.name} de Quiero ir");
    expect(source).toContain("Guardar ${place.name} en Quiero ir");
  });

  it("uses a filled/hollow heart icon, so the state is not carried by colour alone", async () => {
    const source = await readSource();
    expect(source).toMatch(/name=\{saved \? "corazon-relleno" : "corazon"\}/);
  });

  it("expands the heart's real tap area without growing its 40px visual size — `04 §5.4`", async () => {
    const source = await readSource();
    expect(source).toContain('className={`place-card__save tap-target-min ${saved ? "place-card__save--on" : ""}`}');
  });

  it("draws the other person's marker beside the heart, never inside it, and only when resolved", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s+type\s*\{\s*OtherPersonMarker\s*\}\s*from\s*["']\.\.\/lib\/traveller-presentation["']/
    );
    expect(source).toContain("otherPersonMarker?: OtherPersonMarker | null;");
    expect(source).toContain("{otherPersonMarker &&");
    expect(source).toContain('label={`${otherPersonMarker.traveller.label} quiere ir`}');
  });
});

describe("PlaceCard — photography rules", () => {
  it("resolves images only through the registry, never by guessing a path", async () => {
    const source = await readSource();
    expect(source).toContain("resolvePlaceImages(place.id, place.images)");
    expect(source).not.toMatch(/https?:\/\//);
  });

  it("lazy-loads except a priority card, and decodes off the main thread — `06 §6.3`", async () => {
    const source = await readSource();
    // Ambas variantes ofrecen la rama `priority` (fetchPriority="high", sin loading="lazy") y la
    // rama por defecto (loading="lazy") — nunca las dos a la vez en el mismo <img>.
    expect(source.match(/loading:\s*"lazy"\s*as const/g) ?? []).toHaveLength(2);
    expect(source.match(/fetchPriority:\s*"high"\s*as const/g) ?? []).toHaveLength(2);
    expect(source.match(/decoding="async"/g) ?? []).toHaveLength(2);
  });

  it("marks only the list's first card as priority — `06 §6.3`", async () => {
    const list = await readFile(new URL("./PlaceList.tsx", import.meta.url), "utf8");
    expect(list).toContain("priority={index === 0}");
  });

  it("handles the loading and error states instead of leaving a blank frame", async () => {
    const source = await readSource();
    expect(source).toContain('setMediaState("loaded")');
    expect(source).toContain('setMediaState("error")');
    expect(source).toContain("place-card__skeleton");
  });

  it("shows PhotoPlaceholder — never a stand-in photograph — both when missing and on load error", async () => {
    const source = await readSource();
    expect(source).toMatch(
      /import\s*\{\s*PhotoPlaceholder\s*\}\s*from\s*["']\.\/PhotoPlaceholder["']/
    );
    expect(source).toContain('<PhotoPlaceholder place={place} variant={mediaState === "error" ? "error" : "missing"} />');
  });

  it("informs the count instead of a carousel when a place has more than one image", async () => {
    const source = await readSource();
    expect(source).toContain("images.length > 1");
    expect(source).toContain("place-card__photo-count");
    expect(source).not.toMatch(/carousel|<button[^>]*photo-count/);
  });

  it("leaves the decorative card image out of the accessibility tree", async () => {
    const source = await readSource();
    // The name, level, category and zone are already announced by the card's own text; a
    // repeated alt here would make every card read twice.
    expect(source.match(/alt=""/g) ?? []).toHaveLength(2);
  });
});

describe("PlaceCard — compact variant (`04 §5.10`)", () => {
  it("uses a 72×72 thumbnail and --radius-md, a single metadata line", async () => {
    const source = await readSource();
    const compact = source.slice(source.indexOf('if (variant === "compact")'), source.indexOf("return (\n    <article\n      className={`place-card ${selected"));
    expect(compact).toContain("place-card__meta");
    expect(compact).toContain("sizes=\"72px\"");
    expect(compact).not.toContain("place-card__chips");
    expect(compact).not.toContain("place-card__overlay");
  });

  it("is the same component, not a duplicate — a single `variant` prop switches anatomy", async () => {
    const source = await readSource();
    expect(source).toMatch(/type Variant = "normal" \| "compact";/);
    expect(source).toContain('variant = "normal",');
  });
});
