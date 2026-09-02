import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-u69-v32-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];

const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/season53-meta.ts",
  "src/lib/update69-live.ts",
  "src/lib/counter-engine.ts",
  "src/lib/performance.ts",
  "src/lib/first-pick-model.ts",
  "src/lib/draft-engine.ts",
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
const season = require(join(output, "season53-meta.js"));
const update69 = require(join(output, "update69-live.js"));
const counters = require(join(output, "counter-engine.js"));
const draft = require(join(output, "draft-engine.js"));
const rawRoster = JSON.parse(await readFile(join(root, "src/data/brawlers.json"), "utf8"));
const maps = JSON.parse(await readFile(join(root, "src/data/maps.json"), "utf8"));
const tiers = JSON.parse(await readFile(join(root, "src/data/meta-tierlist.json"), "utf8"));
const roster = update69.applyUpdate69Live(season.applySeason53Meta(rawRoster));
const byName = new Map(roster.map((brawler) => [brawler.name, brawler]));
const errors = [];

const expectTier = (name, tier) => {
  if (byName.get(name)?.tier !== tier) errors.push(`${name}: tier ${byName.get(name)?.tier}, esperado ${tier}`);
};

expectTier("Shade", "S");
expectTier("Melodie", "S");
expectTier("El Primo", "A");
expectTier("Amber", "A");
expectTier("Max", "B");
expectTier("Ruffs", "F");

const wendy = byName.get("Wendy");
if (!wendy || wendy.firstPickProfile?.blindSafety > 72 || wendy.firstPickProfile?.counterRisk < 48) {
  errors.push("Wendy no conserva la penalización de first pick posterior al nerf");
}

const pairCases = [
  ["Shade", "Tick", 8],
  ["Gus", "Edgar", 6],
  ["Colette", "El Primo", 5],
];

for (const [candidateName, targetName, minimum] of pairCases) {
  const candidate = byName.get(candidateName);
  const target = byName.get(targetName);
  if (!candidate || !target) {
    errors.push(`Falta pareja de auditoría ${candidateName} -> ${targetName}`);
    continue;
  }
  const adjustment = update69.update69MatchupAdjustment(candidate, target);
  const matchup = counters.evaluateSpecificMatchup(candidate, target);
  if (adjustment.score < minimum) errors.push(`${candidateName} -> ${targetName}: ajuste U69 insuficiente`);
  if (matchup.patchAdjustment !== adjustment.score) errors.push(`${candidateName} -> ${targetName}: el counter engine ignora U69`);
  if (!matchup.reasons.some((reason) => reason.includes("U69"))) errors.push(`${candidateName} -> ${targetName}: falta explicación U69`);
}

const edgar = byName.get("Edgar");
const primo = byName.get("El Primo");
if (edgar) {
  const first = update69.update69DraftAdjustment(edgar, { mode: "Noqueo", layout: "Cerrado" }, "First pick");
  const last = update69.update69DraftAdjustment(edgar, { mode: "Noqueo", layout: "Cerrado" }, "Last pick");
  if (first.score >= last.score) errors.push("Edgar no queda reservado para picks tardíos");
}
if (primo) {
  const closed = update69.update69DraftAdjustment(primo, { mode: "Balón Brawl", layout: "Cerrado" }, "Pick intermedio");
  const open = update69.update69DraftAdjustment(primo, { mode: "Caza Estelar", layout: "Abierto" }, "Pick intermedio");
  if (closed.score < open.score + 7) errors.push("El Primo no distingue mapa cerrado de abierto");
}

for (const targetName of ["Shade", "Wendy", "Nori", "Rico", "Max"]) {
  const target = byName.get(targetName);
  if (!target) continue;
  const ranked = counters.rankCountersAgainst(target, roster, 5);
  if (ranked.length !== 5 || new Set(ranked.map((item) => item.candidate.name)).size !== 5) {
    errors.push(`${targetName}: top 5 de counters incompleto o duplicado`);
  }
}

const observed = tiers.snapshots["NOFF Meta 24 h · 02/09"];
const observedNames = Object.values(observed || {}).flat();
if (observedNames.length !== roster.length || new Set(observedNames).size !== roster.length) {
  errors.push(`Snapshot 02/09 inválido: ${observedNames.length} entradas / ${new Set(observedNames).size} únicas`);
}

const sampleMap = maps.find((map) => map.mode === "Balón Brawl" && map.layout === "Cerrado") || maps[0];
const recommendationRoster = roster.map((brawler) => ({
  ...brawler,
  counters: counters.rankTargetsFor(brawler, roster, 8).filter((item) => item.score >= 72).map((item) => item.target.name),
  counteredBy: counters.rankCountersAgainst(brawler, roster, 8).filter((item) => item.score >= 72).map((item) => item.candidate.name),
}));
const analysis = draft.analyzeDraft({
  map: sampleMap,
  position: "Last pick",
  allies: [],
  enemies: ["Tick", "Piper"],
  bans: [],
  priority: "Counter",
  poolPolicy: "Off",
}, recommendationRoster);

if (analysis.recommendations.length < 5) errors.push("Draft Engine no devuelve suficientes recomendaciones");
for (let index = 1; index < analysis.recommendations.length; index += 1) {
  if (analysis.recommendations[index].score > analysis.recommendations[index - 1].score) {
    errors.push("Las recomendaciones post-U69 no están ordenadas");
    break;
  }
}

console.log(`Roster calibrado: ${roster.length}`);
console.log(`Snapshot observado: ${observedNames.length} brawlers`);
console.log(`Top recomendado de control: ${analysis.recommendations.slice(0, 5).map((item) => item.brawler.name).join(", ")}`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exitCode = 1;
} else {
  console.log("Auditoría post-Update 69 v0.32 correcta.");
}
