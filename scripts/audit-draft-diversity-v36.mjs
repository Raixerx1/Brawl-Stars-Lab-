import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "kanna-draft-v36-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];

const sources = [
  "src/lib/types.ts",
  "src/lib/performance.ts",
  "src/lib/first-pick-model.ts",
  "src/lib/season53-meta.ts",
  "src/lib/update69-live.ts",
  "src/lib/post-balance-1709.ts",
  "src/lib/post-balance-2509.ts",
  "src/lib/post-balance-2609.ts",
  "src/lib/update69-maps.ts",
  "src/lib/counter-engine.ts",
  "src/lib/draft-engine.ts",
];

const compilation = spawnSync(command, [
  ...prefix,
  ...sources,
  "--outDir", output,
  "--target", "ES2022",
  "--module", "CommonJS",
  "--moduleResolution", "Node",
  "--lib", "ES2022,DOM",
  "--skipLibCheck",
], { cwd: root, encoding: "utf8" });

if (compilation.status !== 0) {
  console.error(compilation.stdout);
  console.error(compilation.stderr);
  await rm(output, { recursive: true, force: true });
  process.exit(1);
}

const require = createRequire(import.meta.url);
const engine = require(join(output, "draft-engine.js"));
const season53 = require(join(output, "season53-meta.js"));
const update69 = require(join(output, "update69-live.js"));
const post1709 = require(join(output, "post-balance-1709.js"));
const post2509 = require(join(output, "post-balance-2509.js"));
const post2609 = require(join(output, "post-balance-2609.js"));
const mapLayer = require(join(output, "update69-maps.js"));
const counters = require(join(output, "counter-engine.js"));

const rawBrawlers = JSON.parse(await readFile(join(root, "src/data/brawlers.json"), "utf8"));
const rawMaps = JSON.parse(await readFile(join(root, "src/data/maps.json"), "utf8"));

const brawlers = post2609.applyPostBalance2609(
  post2509.applyPostBalance2509(
    post1709.applyPostBalance1709(
      update69.applyUpdate69Live(season53.applySeason53Meta(rawBrawlers)),
    ),
  ),
);

const strong = (matchup) =>
  (matchup.score >= 70 && matchup.confidence !== "Baja") ||
  (matchup.explicit && matchup.score >= 66);

const draftBrawlers = brawlers.map((brawler) => ({
  ...brawler,
  counters: counters.rankTargetsFor(brawler, brawlers, 8).filter(strong).slice(0, 6).map((item) => item.target.name),
  counteredBy: counters.rankCountersAgainst(brawler, brawlers, 8).filter(strong).slice(0, 6).map((item) => item.candidate.name),
}));
const maps = mapLayer.applyUpdate69Maps(rawMaps);

const enemySample = [
  "Shade", "Gus", "Amber", "Rico", "Griff", "El Primo", "Edgar", "Brock",
  "Max", "Maisie", "Mortis", "Emz", "Surge", "Colette", "Colt", "Nori",
  "Trunk", "Ash", "Piper", "Belle", "Lou", "Gale", "Wendy", "R-T",
];

const counts = new Map();
const top3Counts = new Map();
let scenarios = 0;

const inc = (map, name) => map.set(name, (map.get(name) || 0) + 1);
const run = (map, enemies, position, allies = []) => {
  const result = engine.analyzeDraft({
    map,
    position,
    allies,
    enemies,
    bans: [],
    priority: position === "First pick" ? "Seguro" : "Counter",
    poolPolicy: "Off",
    queueMode: "SoloQ",
  }, draftBrawlers);
  const best = result.recommendations[0];
  if (!best) return;
  inc(counts, best.brawler.name);
  result.recommendations.slice(0, 3).forEach((item) => inc(top3Counts, item.brawler.name));
  scenarios += 1;
};

for (const map of maps) {
  run(map, [], "First pick");
  for (const enemy of enemySample) run(map, [enemy], "Pick intermedio");
  for (let left = 0; left < enemySample.length; left += 1) {
    for (let right = left + 1; right < enemySample.length; right += 1) {
      if ((left * 29 + right * 17) % 19 === 0) {
        run(map, [enemySample[left], enemySample[right]], "Last pick");
      }
    }
  }
}

const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const trio = ["Gale", "Wendy", "Lou"];
const trioPrimary = trio.reduce((sum, name) => sum + (counts.get(name) || 0), 0);
const trioShare = scenarios ? trioPrimary / scenarios : 0;
const dominant = sorted[0] || ["—", 0];
const dominantShare = scenarios ? dominant[1] / scenarios : 0;

console.log(`Escenarios v0.36: ${scenarios}`);
console.log(`Top primarios: ${sorted.slice(0, 12).map(([name, count]) => `${name} ${((count / scenarios) * 100).toFixed(1)}%`).join(" · ")}`);
console.log(`Gale/Wendy/Lou como principal: ${trioPrimary} (${(trioShare * 100).toFixed(1)}%)`);
for (const name of trio) {
  console.log(`${name}: principal ${counts.get(name) || 0}; top3 ${top3Counts.get(name) || 0}`);
}

const errors = [];
if (trioShare > 0.30) errors.push(`Gale/Wendy/Lou concentran ${(trioShare * 100).toFixed(1)}% de los picks principales`);
if (dominantShare > 0.22) errors.push(`${dominant[0]} domina ${(dominantShare * 100).toFixed(1)}% de los escenarios`);
if ((counts.get("Gale") || 0) / scenarios > 0.10) errors.push("Gale sigue apareciendo como principal en más del 10% de escenarios");
if (sorted.slice(0, 10).length < 8) errors.push("La recomendación principal no presenta suficiente diversidad");

await rm(output, { recursive: true, force: true });

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría v0.36 correcta: no hay concentración anómala del trío Gale/Wendy/Lou.");
