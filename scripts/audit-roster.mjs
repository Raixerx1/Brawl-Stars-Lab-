import { readFile } from "node:fs/promises";

const path = new URL("../src/data/brawlers.json", import.meta.url);
const brawlers = JSON.parse(await readFile(path, "utf8"));

const names = brawlers.map((brawler) => brawler.name);
const slugs = brawlers.map((brawler) => brawler.slug);
const nameSet = new Set(names);

const duplicates = (values) => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
};

const duplicateNames = duplicates(names);
const duplicateSlugs = duplicates(slugs);
const brokenReferences = [];
const missingCounters = [];
const missingThreats = [];

for (const brawler of brawlers) {
  if (!Array.isArray(brawler.counters) || brawler.counters.length === 0) missingCounters.push(brawler.name);
  if (!Array.isArray(brawler.counteredBy) || brawler.counteredBy.length === 0) missingThreats.push(brawler.name);

  for (const target of brawler.counters || []) {
    if (!nameSet.has(target)) brokenReferences.push(`${brawler.name}.counters -> ${target}`);
  }
  for (const target of brawler.counteredBy || []) {
    if (!nameSet.has(target)) brokenReferences.push(`${brawler.name}.counteredBy -> ${target}`);
  }
}

const bolt = brawlers.find((brawler) => brawler.name === "Bolt");

console.log(`Roster: ${brawlers.length}`);
console.log(`Nombres únicos: ${new Set(names).size}`);
console.log(`Slugs únicos: ${new Set(slugs).size}`);
console.log(`Con counters: ${brawlers.length - missingCounters.length}`);
console.log(`Con amenazas: ${brawlers.length - missingThreats.length}`);
console.log(`Bolt: ${bolt ? `incluido (${bolt.counters.length} counters / ${bolt.counteredBy.length} amenazas)` : "NO INCLUIDO"}`);
console.log(`Referencias rotas: ${brokenReferences.length}`);

const errors = [
  ...duplicateNames.map((value) => `Nombre duplicado: ${value}`),
  ...duplicateSlugs.map((value) => `Slug duplicado: ${value}`),
  ...missingCounters.map((value) => `Sin counters: ${value}`),
  ...missingThreats.map((value) => `Sin amenazas: ${value}`),
  ...brokenReferences,
];

if (errors.length) {
  console.error("\nErrores detectados:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Auditoría correcta.");
}
