import { readFile, writeFile } from "node:fs/promises";

const metaPath = new URL("../src/data/meta-tierlist.json", import.meta.url);
const rosterPath = new URL("../src/data/brawlers.json", import.meta.url);

const snapshots = {
  "Meta 24 h": {
    S: ["Surge", "Edgar", "Nori", "Griff", "Brock", "Meg", "Max", "8-Bit"],
    A: ["Colt", "Mortis", "Starr Nova", "Rico", "Lumi", "Stu"],
    B: ["Shelly", "Bibi", "Gale", "Crow", "Ash", "Rosa", "Piper", "Bo", "Colette", "Gray", "Emz", "Mina", "Kenji", "Melodie", "Nani", "Mandy", "Pierce", "Cordelius", "Lou", "Jae-Yong", "Spike", "Ruffs", "Shade", "Meeple", "Kit", "Eve"],
    C: ["Byron", "Gene", "Bull", "Bea", "Sandy", "Otis", "Doug", "Bolt", "Willow", "Chester", "Pearl", "Moe", "Damian", "Buster", "Kaze", "Lily", "Hank"],
    D: ["Angelo", "Carl", "Mico", "Leon", "Fang", "Berry", "Bonnie", "Buzz", "Sirius", "Draco", "Trunk", "Alli", "El Primo", "Gus", "Sprout", "Poco", "Tara", "Clancy", "Belle"],
    F: ["Grom", "Frank", "Janet", "Amber", "Pam", "Charlie", "Dynamike", "Nita", "Chuck", "Larry & Lawrie", "Barley", "Penny", "Finx", "Maisie", "Glowy", "Darryl", "Tick", "R-T", "Gigi", "Lola", "Squeak", "Mr. P", "Ziggy", "Juju", "Najia", "Jessie", "Sam", "Ollie", "Jacky"],
    "Sin datos": ["Wendy"],
  },
  "General 30 d": {
    S: ["Surge", "Edgar", "Nori", "Brock", "Sirius", "Starr Nova", "8-Bit", "Griff", "Max"],
    A: ["Mortis", "Meg", "Damian", "Colt", "Crow", "Bolt", "Emz"],
    B: ["Bibi", "Mandy", "Rosa", "Shelly", "Lumi", "Kit", "Piper", "Pierce", "Bo", "Melodie", "Rico", "Chester", "Stu", "Bull", "Nani", "Otis"],
    C: ["Gray", "Byron", "Bea", "Kenji", "Meeple", "Colette", "Belle", "Lou", "Alli", "Buzz", "Mina", "Angelo", "Sandy", "Carl", "Shade", "Fang", "Doug"],
    D: ["Charlie", "Buster", "Cordelius", "Spike", "Gale", "Leon", "Ruffs", "Jae-Yong", "Ash", "Gene", "Eve", "Amber", "Frank", "Janet", "Pearl", "Draco", "Mico", "Kaze", "Sprout", "Lily", "El Primo", "Juju", "Lola", "Bonnie", "Hank", "Penny", "Glowy", "Berry", "Tara", "Squeak", "Maisie", "Tick"],
    F: ["Dynamike", "Grom", "Chuck", "Sam", "Jessie", "Moe", "Ollie", "Mr. P", "Gigi", "Darryl", "Trunk", "Ziggy", "Gus", "Willow", "Finx", "Poco", "Nita", "R-T", "Pam", "Jacky", "Larry & Lawrie", "Najia", "Barley", "Clancy"],
    "Sin datos": ["Wendy"],
  },
};

const roster = JSON.parse(await readFile(rosterPath, "utf8"));
const meta = JSON.parse(await readFile(metaPath, "utf8"));
const rosterNames = new Set(roster.map((brawler) => brawler.name));

for (const [period, tiers] of Object.entries(snapshots)) {
  const names = Object.values(tiers).flat();
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  const unknown = names.filter((name) => !rosterNames.has(name));
  const missing = [...rosterNames].filter((name) => !names.includes(name));
  if (duplicates.length || unknown.length || missing.length) {
    throw new Error(`${period}: duplicados=${duplicates.join(",") || "—"}; desconocidos=${unknown.join(",") || "—"}; ausentes=${missing.join(",") || "—"}`);
  }
}

const liveTier = new Map();
for (const [tier, names] of Object.entries(snapshots["Meta 24 h"])) {
  for (const name of names) liveTier.set(name, tier === "Sin datos" ? "Sin evaluar" : tier);
}

for (const brawler of roster) brawler.tier = liveTier.get(brawler.name);
meta.updated = "2026-08-11";
meta.snapshots = snapshots;

await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
await writeFile(rosterPath, `${JSON.stringify(roster, null, 2)}\n`, "utf8");
console.log(`Meta sincronizado: ${roster.length} brawlers, snapshot 2026-08-11.`);
