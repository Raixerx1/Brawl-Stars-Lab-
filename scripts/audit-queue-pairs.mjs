import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-queue-pairs-"));

const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];

const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/performance.ts",
  "src/lib/first-pick-model.ts",
  "src/lib/draft-engine.ts",
  "src/lib/pair-engine.ts",
  "--outDir", output,
  "--target", "ES2022",
  "--module", "CommonJS",
  "--moduleResolution", "Node",
  "--lib", "ES2022,DOM",
  "--skipLibCheck",
], {
  cwd: root,
  encoding: "utf8",
});

if (compilation.status !== 0) {
  console.error(compilation.stdout);
  console.error(compilation.stderr);
  await rm(output, { recursive: true, force: true });
  process.exit(1);
}

const require = createRequire(import.meta.url);
const pairEngine = require(join(output, "pair-engine.js"));
const brawlers = JSON.parse(await readFile(join(root, "src/data/brawlers.json"), "utf8"));
const maps = JSON.parse(await readFile(join(root, "src/data/maps.json"), "utf8"));

const enemies = [
  "Edgar", "Mortis", "Piper", "Brock", "Surge", "Gale",
  "Damian", "Charlie", "Rico", "Tick", "Colette", "8-Bit",
];

const fragileRoles = new Set(["Asesino", "Artillero", "Apoyo", "Tanque"]);
const queueModes = ["SoloQ", "Dúo", "Trío"];
const reports = {};
const errors = [];

for (const queueMode of queueModes) {
  let scenarios = 0;
  let supportMembers = 0;
  let coordinationTotal = 0;
  let rtMembers = 0;
  let fragileDuplicates = 0;
  let invalidPairs = 0;

  for (const map of maps) {
    for (const enemy of enemies) {
      const pair = pairEngine.recommendDoublePick({
        map,
        position: "Pick intermedio",
        allies: [],
        enemies: [enemy],
        bans: [],
        priority: "Counter",
        poolPolicy: "Off",
        queueMode,
      }, brawlers, 1)[0];

      if (!pair) {
        errors.push(`${queueMode} · ${map.name} · ${enemy}: sin pareja`);
        continue;
      }

      scenarios += 1;
      coordinationTotal += pair.coordination;

      const members = [pair.first.brawler, pair.second.brawler];
      if (members[0].name === members[1].name) invalidPairs += 1;
      if (pair.score < 0 || pair.score > 100) invalidPairs += 1;

      for (const brawler of members) {
        if (brawler.role === "Apoyo" || brawler.tags.includes("support")) supportMembers += 1;
        if (brawler.name === "R-T") rtMembers += 1;
      }

      if (
        members[0].role === members[1].role &&
        fragileRoles.has(members[0].role)
      ) {
        fragileDuplicates += 1;
      }
    }
  }

  reports[queueMode] = {
    scenarios,
    supportRate: scenarios ? supportMembers / (scenarios * 2) : 0,
    averageCoordination: scenarios ? coordinationTotal / scenarios : 0,
    rtMemberShare: scenarios ? rtMembers / (scenarios * 2) : 0,
    fragileDuplicates,
    invalidPairs,
  };

  if (invalidPairs) errors.push(`${queueMode}: ${invalidPairs} parejas inválidas`);
  if (fragileDuplicates) errors.push(`${queueMode}: ${fragileDuplicates} parejas con rol frágil duplicado`);
  if (reports[queueMode].rtMemberShare > .10) {
    errors.push(`${queueMode}: R-T ocupa ${(reports[queueMode].rtMemberShare * 100).toFixed(1)}% de los puestos`);
  }
}

if (!(reports["SoloQ"].supportRate < reports["Dúo"].supportRate)) {
  errors.push("Dúo no aumenta el uso coordinado de soportes frente a SoloQ");
}
if (!(reports["Dúo"].supportRate < reports["Trío"].supportRate)) {
  errors.push("Trío no aumenta el uso coordinado de soportes frente a Dúo");
}
if (!(reports["SoloQ"].averageCoordination < reports["Dúo"].averageCoordination)) {
  errors.push("La coordinación media de Dúo no supera a SoloQ");
}
if (!(reports["Dúo"].averageCoordination < reports["Trío"].averageCoordination)) {
  errors.push("La coordinación media de Trío no supera a Dúo");
}

for (const queueMode of queueModes) {
  const report = reports[queueMode];
  console.log(
    `${queueMode}: ${report.scenarios} escenarios · soporte ${(report.supportRate * 100).toFixed(1)}% · ` +
    `coordinación ${report.averageCoordination.toFixed(1)} · R-T ${(report.rtMemberShare * 100).toFixed(1)}%`
  );
}

console.log(`Errores: ${errors.length}`);
await rm(output, { recursive: true, force: true });

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Auditoría de colas y doble pick correcta.");
}
