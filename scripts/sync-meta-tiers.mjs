import { readFile, writeFile } from "node:fs/promises";

const metaPath = new URL("../src/data/meta-tierlist.json", import.meta.url);
const rosterPath = new URL("../src/data/brawlers.json", import.meta.url);
const ACTIVE_SNAPSHOT = "Motor post-balance · 16/09";

const roster = JSON.parse(await readFile(rosterPath, "utf8"));
const meta = JSON.parse(await readFile(metaPath, "utf8"));
const tiers = meta.snapshots?.[ACTIVE_SNAPSHOT];

if (!tiers) throw new Error(`No existe el snapshot activo: ${ACTIVE_SNAPSHOT}`);

const rosterNames = new Set(roster.map((brawler) => brawler.name));
const names = Object.values(tiers).flat();
const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
const unknown = names.filter((name) => !rosterNames.has(name));
const missing = [...rosterNames].filter((name) => !names.includes(name));

if (duplicates.length || unknown.length || missing.length) {
  throw new Error(`${ACTIVE_SNAPSHOT}: duplicados=${duplicates.join(",") || "—"}; desconocidos=${unknown.join(",") || "—"}; ausentes=${missing.join(",") || "—"}`);
}

const liveTier = new Map();
for (const [tier, tierNames] of Object.entries(tiers)) {
  for (const name of tierNames) liveTier.set(name, tier);
}

for (const brawler of roster) brawler.tier = liveTier.get(brawler.name);

await writeFile(rosterPath, `${JSON.stringify(roster, null, 2)}\n`, "utf8");
console.log(`Meta sincronizado desde ${ACTIVE_SNAPSHOT}: ${roster.length} brawlers.`);
