import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = process.argv[2];
const outputDir = process.argv[3] ?? "./data";
if (!inputPath) throw new Error("Usage: export-dataset.mjs <workbook.xlsx> [output-dir]");

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

function rows(sheetName, range) {
  return workbook.worksheets.getItem(sheetName).getRange(range).values;
}

function objects(matrix) {
  const [headers, ...data] = matrix;
  return data.filter(row => row.some(value => value !== null && value !== ""))
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
}

const asNumber = value => {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
};

function parseDuration(raw) {
  const text = String(raw ?? "").trim();
  const range = text.match(/(\d+)\s*[–-]\s*(\d+)\s*(min|h|hora|horas|día|días)/i);
  if (!range) return { raw: text || null };
  const multiplier = /h|hora/i.test(range[3]) ? 60 : /día/i.test(range[3]) ? 1440 : 1;
  return { raw: text, minMinutes: Number(range[1]) * multiplier, maxMinutes: Number(range[2]) * multiplier };
}

function normalizePlace(row) {
  const reservationRaw = String(row.Reserva ?? "").trim();
  return {
    id: row.ID,
    hub: row.Hub,
    region: row["Región"],
    prefecture: row.Prefectura,
    municipality: row.Municipio,
    neighborhood: row["Zona/barrio"],
    cluster: row.Cluster,
    name: row["Nombre oficial"],
    japaneseName: row["Nombre japonés"],
    mapTitle: row["Título mapa"],
    category: row.Categoría,
    type: row.Tipo,
    grade: row.Grado,
    description: row["Descripción corta"],
    differentiator: row["Qué lo hace diferente"],
    experience: row["Qué se hace/ve"],
    duration: parseDuration(row.Duración),
    bestTime: row["Mejor momento"],
    bestSeason: row["Mejor época"],
    crowdLevel: row.Aglomeración,
    tourismLevel: row["Qué tan turístico"],
    price: { currency: "JPY", min: asNumber(row["Precio JPY mín"]), max: asNumber(row["Precio JPY máx"]), mxnMin: asNumber(row["Precio MXN mín"]), mxnMax: asNumber(row["Precio MXN máx"]) },
    reservation: { required: /^sí$/i.test(reservationRaw), leadTime: row.Anticipación, raw: reservationRaw },
    schedule: { hours: row.Horario, closures: row["Días de cierre"] },
    transport: row["Estación/transporte útil"],
    accessibility: row["Accesibilidad aproximada"],
    coordinates: { lat: asNumber(row.Latitud), lng: asNumber(row.Longitud) },
    officialUrl: row["Página oficial/fuente"],
    googleMapsUrl: row["Google Maps"],
    imageBrief: row["Imagen recomendada"],
    imageStatus: "brief-only",
    nearbyIds: [],
    hiddenGemStatus: row["Hidden Gem Status"],
    alternativeTo: row["Alternativa a"],
    updatedAt: row.Actualizado,
    febMar2027: { status: row["Estado Feb–Mar 2027"], warning: row["Advertencia / oportunidad Feb–Mar 2027"], action: row["Acción recomendada Feb–Mar 2027"] },
  };
}

await fs.mkdir(outputDir, { recursive: true });
const collections = {
  places: objects(rows("Lugares", "A1:AY215")).map(normalizePlace),
  clusters: objects(rows("Clusters", "A1:I89")),
  nearby: objects(rows("Cercanos", "A1:I404")),
  seasonalAlerts: objects(rows("Feb-Mar 2027", "A1:F34")),
  sources: objects(rows("Fuentes", "A1:F40")),
};

const nearbyByPlace = new Map();
for (const relation of collections.nearby) {
  const current = nearbyByPlace.get(relation["Desde ID"]) ?? [];
  current.push(relation["Hacia ID"]);
  nearbyByPlace.set(relation["Desde ID"], current);
}
for (const place of collections.places) place.nearbyIds = nearbyByPlace.get(place.id) ?? [];

for (const [name, value] of Object.entries(collections)) {
  await fs.writeFile(`${outputDir}/${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}.json`, JSON.stringify(value, null, 2));
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(collections).map(([key, value]) => [key, value.length]))));
