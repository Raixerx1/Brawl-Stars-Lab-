import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-video-review-v28-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];
const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/auto-vision.ts",
  "src/lib/video-review.ts",
  "src/lib/video-review-v26.ts",
  "src/lib/video-review-v27.ts",
  "src/lib/video-review-v28.ts",
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
const v28 = require(join(output, "video-review-v28.js"));
const errors = [];
let id = 0;
const event = (second, key, confidence = 88) => ({
  id: `v28-${id += 1}`,
  second,
  key,
  label: key,
  category: "Auto · test",
  tone: key === "enemy-death" ? "good" : key.includes("death") ? "bad" : "neutral",
  confidence,
  comment: key,
});

// Noqueo: las tres bajas rivales deben producir 3v0 hasta el cambio de ronda.
const knockout = [
  event(4, "enemy-death"),
  event(6, "enemy-death"),
  event(8, "enemy-death"),
  event(13, "scene"),
];
const knockoutWindows = v28.buildTeamStateWindowsV28(knockout, "Noqueo", 20);
const enemyWipe = knockoutWindows.find((item) => item.label === "3v0");
if (!enemyWipe) errors.push("No reconstruye 3v0 tras las tres bajas rivales en Noqueo");
if (enemyWipe && enemyWipe.endSecond < 12.9) errors.push(`3v0 termina demasiado pronto: ${enemyWipe.endSecond}s`);
if (!knockoutWindows.some((item) => item.startSecond >= 13 && item.label === "3v3")) errors.push("El cambio de ronda no reinicia 3v3");

// Wipe propio: dos aliados + jugador local pueden dejar 0v3.
const ownWipeEvents = [
  event(5, "ally-death"),
  event(6, "ally-death"),
  event(7, "death"),
  event(16.5, "respawn"),
];
const ownWipeWindows = v28.buildTeamStateWindowsV28(ownWipeEvents, "Balón Brawl", 22);
if (!ownWipeWindows.some((item) => item.label === "0v3")) errors.push("No reconstruye 0v3 con dos aliados + muerte propia");
if (!ownWipeWindows.some((item) => item.startSecond >= 15 && item.friendlyAlive >= 2)) errors.push("No recupera miembros tras expiración/respawn");

// En modos con respawn una baja rival no puede permanecer activa indefinidamente.
const respawnEvents = [event(2, "enemy-death"), event(3, "enemy-death"), event(4, "enemy-death")];
const respawnWindows = v28.buildTeamStateWindowsV28(respawnEvents, "Balón Brawl", 18);
if (!respawnWindows.some((item) => item.label === "3v0")) errors.push("No detecta wipe rival transitorio en modo con respawn");
if (!respawnWindows.some((item) => item.startSecond >= 12.4 && item.label === "3v3")) errors.push("Las bajas rivales no caducan de vuelta a 3v3");

const readout = v28.buildVideoStateReadoutV28([], knockout, "Noqueo", 20);
if (readout.teamWipesFor !== 1) errors.push(`Wipes a favor: ${readout.teamWipesFor}, esperado 1`);
if (readout.wipeForSeconds < 4) errors.push(`Duración de wipe rival insuficiente: ${readout.wipeForSeconds}s`);
if (!readout.strengths.some((text) => text.includes("wipe"))) errors.push("El coaching no prioriza el wipe rival");
if (!readout.actions.some((text) => text.includes("3v0"))) errors.push("Falta acción de conversión tras wipe");

console.log(`Noqueo: ${knockoutWindows.map((item) => item.label).join(" → ")}`);
console.log(`Wipe propio: ${ownWipeWindows.map((item) => item.label).join(" → ")}`);
console.log(`Wipes a favor: ${readout.teamWipesFor} · ${readout.wipeForSeconds}s`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de analizador de vídeo v0.28 correcta.");
