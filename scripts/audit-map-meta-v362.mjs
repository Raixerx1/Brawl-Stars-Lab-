import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "kanna-map-meta-v362-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];

const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/first-pick-model.ts",
  "src/lib/season53-meta.ts",
  "src/lib/update69-live.ts",
  "src/lib/post-balance-1709.ts",
  "src/lib/post-balance-2509.ts",
  "src/lib/post-balance-2609.ts",
  "src/lib/draft-calibration-2709.ts",
  "src/lib/update69-maps.ts",
  "src/lib/ranked-pool-2709.ts",
  "src/lib/map-meta-2509.ts",
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
const live = require(join(output, "update69-live.js"));
const post1709 = require(join(output, "post-balance-1709.js"));
const post2509 = require(join(output, "post-balance-2509.js"));
const post2609 = require(join(output, "post-balance-2609.js"));
const calibration = require(join(output, "draft-calibration-2709.js"));
const updateMaps = require(join(output, "update69-maps.js"));
const ranked = require(join(output, "ranked-pool-2709.js"));
const mapMeta = require(join(output, "map-meta-2509.js"));

const rawBrawlers = JSON.parse(await readFile(join(root, "src/data/brawlers.json"), "utf8"));
const rawMaps = JSON.parse(await readFile(join(root, "src/data/maps.json"), "utf8"));

const roster = calibration.applyDraftCalibration2709(
  post2609.applyPostBalance2609(
    post2509.applyPostBalance2509(
      post1709.applyPostBalance1709(
        live.applyUpdate69Live(season.applySeason53Meta(rawBrawlers)),
      ),
    ),
  ),
);

const pool = ranked.applyRankedPool2709(updateMaps.applyUpdate69Maps(rawMaps));
const calibrated = mapMeta.applyMapMeta2509(pool);
const maps = ranked.recalibrateRankedFirstPicks2709(calibrated, roster);
const current = maps.filter((map) => map.rotationStatus === "Actual");
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

const expectedPool = new Set([
  "Dry Season", "Hideout", "Layer Cake", "Shooting Star",
  "Center Stage", "Pinball Dreams", "Sneaky Fields", "Triple Dribble", "Spiraling Out", "Beach Ball",
  "Double Swoosh", "Gem Fort", "Hard Rock Mine", "Undermine",
  "Bridge Too Far", "Hot Potato", "Kaboom Canyon", "Safe Zone",
  "Dueling Beetles", "Open Business", "Parallel Plays", "Ring of Fire", "In the Liminal", "Quick Travel",
  "New Horizons", "Out in the Open", "Belle's Rock", "Flaring Phoenix",
]);

expect(current.length === 28, `Pool actual ${current.length}/28`);
expect(current.every((map) => expectedPool.has(map.name)), "Hay un mapa no perteneciente al pool Ranked comprobado");
expect([...expectedPool].every((name) => current.some((map) => map.name === name)), "Falta algún mapa del pool Ranked comprobado");
for (const stale of ["Call of the Water", "Stroke of Luck"]) {
  expect(!current.some((map) => map.name === stale), `${stale} sigue entrando en Draft Assist`);
}

expect(Object.keys(mapMeta.mapMeta2509).length === 28, `Hay ${Object.keys(mapMeta.mapMeta2509).length} priors, esperado 28`);
for (const map of current) {
  const evidence = mapMeta.mapMeta2509[map.name];
  expect(Boolean(evidence), `${map.name}: falta evidencia Ranked por mapa`);
  if (!evidence) continue;
  expect(JSON.stringify(map.tierS) === JSON.stringify(evidence.core), `${map.name}: tierS no refleja el core Ranked actual`);
  expect(JSON.stringify(map.bans) === JSON.stringify(evidence.core.slice(0, 3)), `${map.name}: bans no parten del core actual`);
  expect(map.firstPicks.length === 3, `${map.name}: no tiene top 3 first-pick`);
  expect(map.firstPickCandidates?.length === 8, `${map.name}: no tiene 8 candidatos auditables`);
  expect(map.firstPickModelVersion === "v0.36.2-ranked-pool-2709", `${map.name}: versión first-pick antigua`);
  expect(map.firstPickNotes?.includes("Prior estadístico Ranked"), `${map.name}: perdió la trazabilidad del prior estadístico`);
}

const belle = current.find((map) => map.name === "Belle's Rock");
const flaring = current.find((map) => map.name === "Flaring Phoenix");
const quick = current.find((map) => map.name === "Quick Travel");
expect(belle?.tierS.join("|") === "Wendy|Brock|Gus|Shade|Sprout", "Belle's Rock no usa el core 25/09");
expect(flaring?.tierS.join("|") === "Brock|Wendy|Pearl|Gus|Shade", "Flaring Phoenix no usa el core 25/09");
expect(quick?.tierS.join("|") === "Nita|Shade|Ash|Bibi|Emz", "Quick Travel conserva un perfil genérico obsoleto");

const leaders = new Map();
for (const map of current) leaders.set(map.firstPicks[0], (leaders.get(map.firstPicks[0]) || 0) + 1);
const topLeaders = [...leaders.entries()].sort((a, b) => b[1] - a[1]);
expect(!topLeaders[0] || topLeaders[0][1] <= 12, `${topLeaders[0]?.[0]} monopoliza ${topLeaders[0]?.[1]}/28 first picks`);

console.log(`Mapas auditados: ${current.length}`);
console.log(`Priors específicos: ${Object.keys(mapMeta.mapMeta2509).length}`);
console.log(`Líderes first pick: ${topLeaders.map(([name, count]) => `${name} ${count}`).join(" · ")}`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría v0.36.2 correcta: pool y meta mapa por mapa sincronizados.");
