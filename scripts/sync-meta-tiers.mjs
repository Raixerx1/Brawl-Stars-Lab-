import { readFile, writeFile } from "node:fs/promises";

const metaPath = new URL("../src/data/meta-tierlist.json", import.meta.url);
const rosterPath = new URL("../src/data/brawlers.json", import.meta.url);

const snapshots = {
  "NOFF Meta 24 h · 02/09": {
    S: ["Shade", "Wendy", "El Primo", "Edgar", "Melodie"],
    A: ["Bibi", "Nori", "Brock", "Amber", "Mortis", "Gus", "8-Bit", "Griff"],
    B: ["Shelly", "Gray", "Surge", "Rico", "Lumi", "Bo", "Max", "Rosa", "Bull", "Moe", "Starr Nova", "Belle"],
    C: ["Pierce", "Otis", "Emz", "Hank", "Stu", "Colt", "Lou", "Eve", "Doug", "Poco", "Piper", "Nani", "Kaze", "Meeple", "Ash", "Mina", "Mandy"],
    D: ["Colette", "Trunk", "Buster", "Ollie", "Byron", "Buzz", "Maisie", "Gene", "Carl", "Meg", "Berry", "Finx", "Crow"],
    F: ["Sirius", "Leon", "Chuck", "Dynamike", "Kit", "Gigi", "Angelo", "Damian", "Bea", "Lily", "Pearl", "Ruffs", "Charlie", "Grom", "Kenji", "Juju", "Nita", "Cordelius", "Bonnie", "Sprout", "Frank", "Sam", "Spike", "Bolt", "Mico", "Barley", "Najia", "Darryl", "Lola", "Fang", "Jessie", "Gale", "Tick", "Clancy", "Willow", "Janet", "Chester", "Alli", "Glowy", "Tara", "Penny", "R-T", "Pam", "Jae-Yong", "Ziggy", "Squeak", "Sandy", "Larry & Lawrie", "Jacky", "Draco", "Mr. P"],
  },
  "Meta 24 h · 30/08": {
    S: ["Wendy", "Griff", "Max", "Mortis", "Edgar", "Nori", "Brock", "8-Bit"],
    A: ["Surge", "Mandy", "Emz", "Fang", "Rico", "Meg", "Bibi", "Stu", "Lumi"],
    B: ["Colt", "Pierce", "Piper", "Carl", "Starr Nova", "Otis", "Gray", "Melodie", "Ash", "Juju", "Angelo", "Belle", "Gene", "Mina"],
    C: ["Lou", "Bo", "Bea", "Tick", "Moe", "Bonnie", "Frank", "Pearl", "Gale", "Bolt", "Bull", "Sandy", "Chester", "Meeple", "Glowy", "Rosa", "Jessie", "Leon", "Eve", "Sirius", "El Primo"],
    D: ["Shelly", "Shade", "Sprout", "Doug", "Chuck", "Nani", "Damian", "Spike", "Ruffs", "Kaze", "Crow", "Buzz", "Amber", "Kenji", "Kit", "Berry", "Nita", "Squeak", "Gigi", "Charlie", "Byron"],
    F: ["Alli", "Buster", "Hank", "Colette", "Mico", "Lily", "Dynamike", "Willow", "Barley", "Penny", "Ollie", "Lola", "R-T", "Trunk", "Cordelius", "Maisie", "Darryl", "Tara", "Jae-Yong", "Gus", "Mr. P", "Finx", "Draco", "Ziggy", "Poco", "Jacky", "Grom", "Pam", "Najia", "Janet", "Clancy", "Larry & Lawrie", "Sam"],
  },
  "General 30 d · 30/08": {
    S: ["Wendy", "Edgar", "Surge", "Griff", "Nori", "Brock", "8-Bit", "Mortis"],
    A: ["Max", "Starr Nova", "Meg", "Bibi", "Colt", "Emz", "Rico"],
    B: ["Mandy", "Stu", "Piper", "Lumi", "Shelly", "Pierce", "Rosa", "Bo", "Bolt", "Crow", "Melodie", "Bull", "Kit", "Nani", "Ash", "Damian", "Gray"],
    C: ["Mina", "Lou", "Kenji", "Otis", "Meeple", "Byron", "Shade", "Sirius", "Buzz", "Pearl", "Chester", "Carl", "Doug", "Gale", "Belle", "Bea", "Ruffs", "Fang", "Buster"],
    D: ["Charlie", "Spike", "Angelo", "Kaze", "Tick", "Sandy", "Jae-Yong", "Eve", "Colette", "Cordelius", "Sprout", "Leon", "Frank", "Gene", "Amber", "Janet", "Hank", "Penny", "Juju", "Grom", "Glowy", "Alli", "El Primo", "Lola", "Nita", "Dynamike", "Lily", "Trunk", "Squeak", "Moe", "Berry", "Willow"],
    F: ["R-T", "Jessie", "Mico", "Tara", "Bonnie", "Larry & Lawrie", "Chuck", "Draco", "Darryl", "Mr. P", "Maisie", "Gigi", "Finx", "Ollie", "Gus", "Najia", "Barley", "Poco", "Ziggy", "Sam", "Pam", "Jacky", "Clancy"],
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
for (const [tier, names] of Object.entries(snapshots["NOFF Meta 24 h · 02/09"])) {
  for (const name of names) liveTier.set(name, tier);
}

for (const brawler of roster) brawler.tier = liveTier.get(brawler.name);
meta.updated = "2026-09-02";
meta.source = "NOFF Meta 24 h · top 200 global · datos post-Update 69 revisados 02/09/2026";
meta.sourceUrl = "https://www.noff.gg/brawl-stars/tier-list";
meta.method = "Meta 24 h post-U69 como señal de actualidad; General 30 d y balance oficial como control de estabilidad. El Draft Engine sigue priorizando mapa, modo, geometría, orden y matchup recíproco.";
meta.snapshots = snapshots;

await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
await writeFile(rosterPath, `${JSON.stringify(roster, null, 2)}\n`, "utf8");
console.log(`Meta sincronizado: ${roster.length} brawlers, snapshot post-U69 02/09/2026.`);
