import { readFile } from "node:fs/promises";

const brawlers = JSON.parse(await readFile(new URL("../src/data/brawlers.json", import.meta.url), "utf8"));
const roster = new Map(brawlers.map((brawler) => [brawler.name, brawler]));
const errors = [];

for (const brawler of brawlers) {
  for (const field of ["counters", "counteredBy"]) {
    const values = brawler[field] || [];
    if (values.includes(brawler.name)) errors.push(`${brawler.name}: autorreferencia en ${field}`);
    if (new Set(values).size !== values.length) errors.push(`${brawler.name}: duplicados en ${field}`);
    for (const target of values) {
      if (!roster.has(target)) errors.push(`${brawler.name}.${field}: ${target} no existe`);
    }
  }
}

const bolt = roster.get("Bolt");
const expectedFavorable = ["Piper", "Belle", "Mandy", "Brock", "Angelo"];
const expectedThreats = ["Gale", "Damian", "Charlie", "Otis", "Lou"];

if (!bolt) {
  errors.push("Bolt no existe");
} else {
  if (JSON.stringify(bolt.counters) !== JSON.stringify(expectedFavorable)) {
    errors.push(`Bolt.counters incorrecto: ${bolt.counters.join(", ")}`);
  }
  if (JSON.stringify(bolt.counteredBy) !== JSON.stringify(expectedThreats)) {
    errors.push(`Bolt.counteredBy incorrecto: ${bolt.counteredBy.join(", ")}`);
  }
  if (bolt.role !== "Tanque") errors.push(`Bolt debe figurar como Tanque, no ${bolt.role}`);
  if (bolt.matchupReviewedAt !== "09/08/2026") errors.push("Bolt no tiene fecha de revisión específica");
  for (const threat of expectedThreats) {
    if (!bolt.matchupNotes?.threats?.[threat]) errors.push(`Falta explicación específica de ${threat} contra Bolt`);
  }
}

const reviewed = brawlers.filter((brawler) => brawler.matchupReviewedAt === "09/08/2026");
console.log(`Brawlers: ${brawlers.length}`);
console.log(`Perfiles recientes revisados: ${reviewed.length}`);
console.log(`Errores: ${errors.length}`);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Auditoría de matchups correcta.");
}
