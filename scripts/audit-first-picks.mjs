import { readFile } from "node:fs/promises";

const maps = JSON.parse(await readFile(new URL("../src/data/maps.json", import.meta.url), "utf8"));
const brawlers = JSON.parse(await readFile(new URL("../src/data/brawlers.json", import.meta.url), "utf8"));
const roster = new Map(brawlers.map((brawler) => [brawler.name, brawler]));

const errors = [];
const warnings = [];

for (const map of maps) {
  if (!Array.isArray(map.firstPicks) || map.firstPicks.length !== 3) {
    errors.push(`${map.name}: debe tener exactamente tres first picks`);
    continue;
  }

  if (new Set(map.firstPicks).size !== map.firstPicks.length) {
    errors.push(`${map.name}: first picks duplicados`);
  }

  for (const name of map.firstPicks) {
    if (!roster.has(name)) errors.push(`${map.name}: first pick inexistente: ${name}`);
  }

  if (map.firstPickReviewedAt !== "09/08/2026") {
    errors.push(`${map.name}: falta la fecha de auditoría 09/08/2026`);
  }

  if (!map.firstPickNotes) errors.push(`${map.name}: falta la explicación editorial`);

  if (map.layout === "Abierto") {
    const longOrOpen = map.firstPicks.filter((name) => {
      const brawler = roster.get(name);
      if (!brawler) return false;
      return ["Largo", "Muy largo", "Medio-largo"].includes(brawler.range)
        || brawler.tags.includes("open")
        || brawler.tags.includes("sniper");
    });
    if (!longOrOpen.length) warnings.push(`${map.name}: mapa abierto sin ningún pick de rango largo`);
  }
}

const rustic = maps.find((map) => map.slug === "rustic-arcade");
if (!rustic) {
  errors.push("Falta Rustic Arcade");
} else {
  if (rustic.layout !== "Abierto") errors.push("Rustic Arcade debe estar clasificado como abierto");
  const expected = ["Piper", "8-Bit", "Brock"];
  if (JSON.stringify(rustic.firstPicks) !== JSON.stringify(expected)) {
    errors.push(`Rustic Arcade: first picks esperados ${expected.join(", ")}`);
  }
  if (rustic.firstPicks.includes("Sandy")) errors.push("Rustic Arcade: Sandy no debe ser first pick");
}

console.log(`Mapas auditados: ${maps.length}`);
console.log(`Errores: ${errors.length}`);
console.log(`Advertencias: ${warnings.length}`);
for (const warning of warnings) console.log(`AVISO: ${warning}`);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Auditoría de first picks correcta.");
}
