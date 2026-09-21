import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Bloque 20 (B4) — el guardián del contrato del bloque, en el nivel de fuente.
 *
 * Lo que se puede probar leyendo el código vive aquí; lo que exige un navegador real —geometría,
 * foco, lo que un lector de pantalla llega a oír— vive en
 * `scripts/block20-place-detail-check.mjs`. Los dos juntos son lo que permite firmar la matriz
 * de 55 filas de `docs/BLOCK_20_INVENTORY.md`.
 *
 * Las tres decisiones cerradas antes de implementar (`09`) tienen aquí sus gates explícitos:
 *
 * - **DDR-04** — «Fuentes» no inventa `provenance`, `consultedAt`, frescura ni versión del
 *   dataset, y `updatedAt` no se presenta como fecha de consulta.
 * - **DDR-05** — `Dato:` no aparece en la ficha ni en nada que B20 introduzca, y **el
 *   planificador no se toca**: eso sigue siendo de B9.5.
 * - **DDR-06** — «Cerca de aquí» no renderiza `transferListFootnote`, cada traslado lleva su
 *   `EvidenceMark`, y la distinción semántica que la nota explicaba sigue siendo recuperable
 *   desde el marcador. Reubicación, no pérdida.
 */

async function read(path: string): Promise<string> {
  return readFile(new URL(`./${path}`, import.meta.url), "utf8");
}

/**
 * El código sin sus comentarios. Los gates prohibitivos de DDR-04 buscan vocabulario que la
 * ficha **no puede renderizar** («provenance», «consultado en», …), y ese mismo vocabulario
 * aparece —necesariamente— en los comentarios que explican por qué está prohibido. Buscar sobre
 * el fichero entero convertiría el gate en un detector de su propia documentación.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
/** SHA de partida del Bloque 20: el cierre definitivo de B19. */
const PRE_B20_SHA = "62050c2";

/** Ficheros que B20 ha tocado respecto a su SHA de partida. `null` si el SHA no está en el
 * histórico local (clon poco profundo): el gate se salta en vez de fallar por una causa ajena. */
function changedFiles(): string[] | null {
  try {
    return execFileSync("git", ["diff", "--name-only", PRE_B20_SHA], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------
// DDR-04 — «Fuentes» sólo muestra evidencia que existe
// ---------------------------------------------------------------------------------------

describe("DDR-04 — «Fuentes» no inventa procedencia que el modelo no tiene", () => {
  it("la sección existe, está plegada por defecto y es un `<details>` cerrado", async () => {
    const source = await read("components/PlaceDetail.tsx");
    expect(source).toContain('<details className="place-sources">');
    expect(source).toContain('<summary className="place-sources__summary">Fuentes</summary>');
    // `05 §5` pt. 14: «desplegable **cerrado** por defecto». Un `open` lo abriría.
    expect(source).not.toMatch(/<details className="place-sources"[^>]*\bopen\b/);
  });

  it("muestra exactamente lo que existe: grado original, updatedAt y enlaces reales", async () => {
    const source = await read("components/PlaceDetail.tsx");
    const block = source.slice(
      source.indexOf('<details className="place-sources">'),
      source.indexOf("</details>")
    );
    expect(block).toContain("{place.grade}");
    expect(block).toContain("{place.updatedAt}");
    expect(block).toContain("{place.officialUrl}");
  });

  it("no crea ni deriva provenance, consultedAt, frescura por lugar ni versión del dataset", async () => {
    const source = code(await read("components/PlaceDetail.tsx"));
    const lower = source.toLowerCase();
    for (const forbidden of [
      "provenance",
      "consultedat",
      "consultado en",
      "freshness",
      "frescura",
      "versión del dataset",
      "version del dataset",
      "dataset v",
    ]) {
      expect(lower, forbidden).not.toContain(forbidden);
    }
    // Y no se enchufa la maquinaria de frescura, que sirve a zonas y mecanismos, no al catálogo.
    expect(source).not.toContain("source-freshness");
  });

  it("no presenta `updatedAt` como fecha de consulta de una fuente", async () => {
    const source = await read("components/PlaceDetail.tsx");
    const block = source.slice(
      source.indexOf('<details className="place-sources">'),
      source.indexOf("</details>")
    );
    // El rótulo dice lo único que `updatedAt` significa: cuándo se actualizó el REGISTRO.
    expect(block).toContain("<dt>Registro actualizado</dt>");
    for (const forbidden of ["Consultado", "consultado", "Verificado el", "Comprobado"]) {
      expect(block, forbidden).not.toContain(forbidden);
    }
  });

  it("no renderiza placeholders de campos inexistentes", async () => {
    const source = await read("components/PlaceDetail.tsx");
    for (const forbidden of ["no disponible", "No disponible", "Sin datos", "—"]) {
      const block = source.slice(
        source.indexOf('<details className="place-sources">'),
        source.indexOf("</details>")
      );
      expect(block, forbidden).not.toContain(forbidden);
    }
  });
});

// ---------------------------------------------------------------------------------------
// DDR-05 — `Dato:` acotado a la superficie B4; el planificador es de B9.5
// ---------------------------------------------------------------------------------------

describe("DDR-05 — `Dato:` no entra en la ficha, y el planificador no se toca", () => {
  it("ni PlaceDetail ni ninguna superficie nueva de B20 contiene la cadena `Dato:`", async () => {
    for (const file of [
      "components/PlaceDetail.tsx",
      "components/PlaceGallery.tsx",
      "components/CreditsSheet.tsx",
    ]) {
      expect(await read(file), file).not.toContain("Dato:");
    }
  });

  it("B20 no modifica OrderedSequenceBuilder.tsx — su retirada sigue siendo de B9.5", () => {
    const files = changedFiles();
    if (files === null) return; // SHA base no disponible en este checkout.
    expect(files).not.toContain("app/src/components/OrderedSequenceBuilder.tsx");
  });

  it("las cuatro apariciones siguen donde el roadmap las asigna, intactas", async () => {
    const planner = await read("components/OrderedSequenceBuilder.tsx");
    const occurrences = planner.split("Dato:").length - 1;
    // Si alguien las retira «de paso» en este bloque, este gate lo dice: no es un fallo de
    // calidad, es un alcance que pertenece a B9.5 (`10 §B9.5`).
    expect(occurrences).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------
// DDR-06 — el marcador sustituye a la nota, y se queda con su información
// ---------------------------------------------------------------------------------------

describe("DDR-06 — «Cerca de aquí»: reubicación de la nota al pie, no pérdida", () => {
  it("la ficha ya no renderiza transferListFootnote ni ningún párrafo de descargo", async () => {
    const source = await read("components/PlaceDetail.tsx");
    expect(source).not.toContain("transferListFootnote");
    expect(source).not.toContain("place-detail__footnote");
    expect(source).not.toContain("nearbyFootnote");
  });

  it("pero la función sigue existiendo y probada — otras superficies pueden usarla", async () => {
    const lib = await read("lib/transfer-display.ts");
    expect(lib).toContain("export function transferListFootnote");
    const tests = await read("lib/transfer-display.test.ts");
    expect(tests).toContain("transferListFootnote");
  });

  it("cada traslado lleva su EvidenceMark, con nivel y detalle derivados del dominio", async () => {
    const source = await read("components/PlaceDetail.tsx");
    expect(source).toContain("level={transferEvidenceLevel(transfer)}");
    expect(source).toContain("detail={transferEvidenceDetail(transfer)}");
  });

  it("el detalle conserva las cuatro distinciones que la nota explicaba", async () => {
    const lib = await read("lib/transfer-display.ts");
    // Ruta validada: datos estáticos, NO un horario en vivo.
    expect(lib).toContain("datos estáticos, no un horario en vivo");
    // Estimación geográfica: NO una ruta validada ni un horario en vivo.
    expect(lib).toContain("no es un tiempo de ruta validado ni un horario en vivo");
    // Horario en vivo: se distingue explícitamente.
    expect(lib).toContain("se identifica explícitamente como tal");
  });

  it("no hay ascensos de confianza: el nivel sale del `confidence` ya resuelto", async () => {
    const lib = await read("lib/transfer-display.ts");
    const fn = lib.slice(lib.indexOf("export function transferEvidenceLevel"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    // Sin traslado registrado ⇒ estimado. Nunca lo contrario.
    expect(body).toContain('if (!edge) return "estimado"');
    expect(body).toContain('edge.confidence === "estimated" ? "estimado" : "verificado"');
  });
});

// ---------------------------------------------------------------------------------------
// El contrato del bloque: ningún dato desaparece
// ---------------------------------------------------------------------------------------

describe("B20 — ningún dato de PlaceDetail v1.1.0 desaparece (las 55 filas)", () => {
  it("todos los campos del lugar que la ficha mostraba siguen leyéndose", async () => {
    const source = await read("components/PlaceDetail.tsx");
    for (const field of [
      "place.name",
      "place.japaneseName",
      "place.description",
      "place.experience",
      "place.differentiator",
      "place.duration",
      "place.bestTime",
      "place.bestSeason",
      "place.schedule.hours",
      "place.schedule.closures",
      "place.transport",
      "place.accessibility",
      "place.crowdLevel",
      "place.tourismLevel",
      "place.hiddenGemStatus",
      "place.officialUrl",
      "place.googleMapsUrl",
      "place.updatedAt",
      "place.grade",
      "place.febMar2027.status",
      "place.febMar2027.warning",
      "place.febMar2027.action",
    ]) {
      expect(source, field).toContain(field);
    }
    // Los que llegan por función de dominio, no por acceso directo.
    expect(source).toContain("formatPrice(place)");
    expect(source).toContain("reservation.practicalRow");
    expect(source).toContain("resolvePlaceImages(place.id, place.images)");
    expect(source).toContain("imageBriefText(place)");
  });

  it("los seis campos de atribución siguen renderizándose, en CreditsSheet", async () => {
    const sheet = await read("components/CreditsSheet.tsx");
    for (const field of [
      "image.source",
      "image.credit",
      "image.license",
      "image.sourceFileTitle",
      "image.attributionTitle",
      "image.processing",
    ]) {
      expect(sheet, field).toContain(field);
    }
    expect(sheet).toContain("image.sourceUrl");
    expect(sheet).toContain("image.licenseUrl");
  });

  it("D2 — entre la fotografía y el nombre no queda texto de atribución", async () => {
    const gallery = await read("components/PlaceGallery.tsx");
    expect(gallery).not.toContain("describePhotographyProcessing");
    expect(gallery).toContain("gallery__credits");
  });

  it("D4 — no queda `×` flotante ni la barra que lo contenía", async () => {
    const source = await read("components/PlaceDetail.tsx");
    expect(source).not.toContain("place-detail__bar");
    expect(source).not.toMatch(/<Icon name="cerrar"/);
    expect(source).toContain('className="place-detail__back"');
  });

  it("D8 — la franja de los dos sólo se renderiza si alguien ha opinado", async () => {
    const source = await read("components/PlaceDetail.tsx");
    expect(source).toContain('someoneHasSpoken = lines.some((line) => line.stance !== "silent")');
    expect(source).toContain("someoneHasSpoken && (");
  });

  it("DD-011 — el aviso es condicional, y degrada a una línea de «Horario» con ◧", async () => {
    const source = await read("components/PlaceDetail.tsx");
    expect(source).toContain('febMarIsRealProblem = febMarStatus.tone === "attention"');
    expect(source).toContain('febMarDegradesToScheduleLine = febMarStatus.tone === "pending"');
    expect(source).toContain("Sin cierre confirmado para feb–mar 2027 · reconfirmar antes de ir");
    expect(source).toContain("{febMarIsRealProblem && (");
  });

  it("pt. 5 — la insignia de nivel es sólo para grado S", async () => {
    const source = await read("components/PlaceDetail.tsx");
    expect(source).toContain('interest.level === "imprescindible" && (');
    expect(source).not.toContain("tag--grade-");
  });

  it("pt. 10 — cada valor práctico lleva su EvidenceMark", async () => {
    const source = await read("components/PlaceDetail.tsx");
    // El marcador está en los dos moldes por los que pasan TODOS los valores prácticos.
    const quickFact = source.slice(source.indexOf("function QuickFact("), source.indexOf("/** Una fila de dato"));
    expect(quickFact).toContain("<RecordedMark />");
    const row = source.slice(source.indexOf("function Row("), source.indexOf("export function PlaceDetail"));
    expect(row).toContain("<RecordedMark />");
    // `Registrado`, nunca `Verificado`: nada de esta pantalla se consulta en vivo (`03 §1.4`).
    expect(source).toContain('const RECORDED = "registrado" as const');
  });
});
