import { readFile } from "node:fs/promises";

const maps = JSON.parse(await readFile(new URL("../src/data/maps.json", import.meta.url), "utf8"));
const brawlers = JSON.parse(await readFile(new URL("../src/data/brawlers.json", import.meta.url), "utf8"));
const roster = new Set(brawlers.map((brawler) => brawler.name));
const errors = [];

for (const map of maps) {
  if (!Array.isArray(map.firstPicks) || map.firstPicks.length !== 3) {
    errors.push(`${map.name}: debe tener exactamente tres first picks`);
    continue;
  }
  if (new Set(map.firstPicks).size !== 3) errors.push(`${map.name}: first picks duplicados`);
  for (const name of map.firstPicks) {
    if (!roster.has(name)) errors.push(`${map.name}: first pick inexistente ${name}`);
  }
  if (!map.firstPickNotes) errors.push(`${map.name}: falta explicación editorial`);
  if (!map.firstPickConfidence) errors.push(`${map.name}: falta confianza editorial`);
  if (map.firstPickModelVersion !== "v0.12") errors.push(`${map.name}: modelo distinto de v0.12`);
}

console.log(`Mapas auditados: ${maps.length}`);
console.log(`Errores: ${errors.length}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Auditoría editorial de first picks correcta.");
}
