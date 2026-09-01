import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-video-review-v26-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];
const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/auto-vision.ts",
  "src/lib/video-review.ts",
  "src/lib/video-review-v26.ts",
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
const v26 = require(join(output, "video-review-v26.js"));
const errors = [];

function image(width = 240, height = 135, options = {}) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 55;
    data[index * 4 + 1] = 58;
    data[index * 4 + 2] = 65;
    data[index * 4 + 3] = 255;
  }
  const paint = (x0, y0, x1, y1, rgb) => {
    for (let y = Math.floor(height * y0); y < Math.floor(height * y1); y += 1) {
      for (let x = Math.floor(width * x0); x < Math.floor(width * x1); x += 1) {
        const index = (y * width + x) * 4;
        data[index] = rgb[0]; data[index + 1] = rgb[1]; data[index + 2] = rgb[2]; data[index + 3] = 255;
      }
    }
  };
  // Marcador amigable + barra de HP cerca del centro.
  paint(.47, .48, .53, .56, [35, 185, 235]);
  paint(.455, .40, .455 + .13 * (options.hp ?? .8), .415, [40, 220, 65]);
  // Recursos inferiores derechos.
  paint(.77, .75, .77 + .13 * (options.ammo ?? .8), .80, [245, 185, 45]);
  paint(.83, .58, .91, .67, options.super ? [245, 190, 50] : [55, 105, 125]);
  if (options.hyper) paint(.67, .70, .74, .79, [185, 80, 235]);
  if (options.ball) paint(.50, .54, .55, .61, [245, 220, 165]);
  return { width, height, data };
}

const raw = [];
for (let i = 0; i < 16; i += 1) {
  raw.push(v26.sampleVideoHudFrame(image(240, 135, {
    hp: i === 8 ? .25 : .82,
    ammo: i === 8 ? .18 : .85,
    super: i >= 6,
    hyper: i >= 12,
    ball: i === 8,
  }), i * 2, "Balón Brawl"));
}
const snapshots = v26.finalizeVideoHudSamples(raw);
if (snapshots.length !== 16) errors.push(`Snapshots ${snapshots.length}, esperado 16`);
if (!snapshots.some((item) => item.positionConfidence >= 40)) errors.push("No localiza el marcador del jugador en frame sintético");
if (!snapshots.some((item) => item.hpPercent !== undefined && item.hpPercent <= 35)) errors.push("No detecta ventana de HP bajo sintética");
if (!snapshots.some((item) => item.superReady)) errors.push("No detecta super lista en calibración relativa");
if (!snapshots.some((item) => item.hyperReady)) errors.push("No detecta hipercarga lista en calibración relativa");

let index = 0;
const event = (second, key, confidence = 86) => ({
  id: `v26-${index += 1}`,
  second,
  key,
  label: key,
  category: "Auto · test",
  tone: key === "enemy-death" ? "good" : key.includes("death") ? "bad" : "neutral",
  confidence,
  comment: key,
});
const events = [
  event(10, "enemy-death"),
  event(18, "ally-death"),
  event(19, "death"),
  event(27, "respawn"),
  event(40, "scene", 75),
];
const windows = v26.buildTeamStateWindows(events, "Balón Brawl", 55);
if (!windows.some((item) => item.label === "3v2")) errors.push("Falta ventana 3v2 tras baja rival");
if (!windows.some((item) => item.friendlyAlive < item.enemyAlive)) errors.push("Falta ventana de inferioridad tras bajas amigas");

const readout = v26.buildVideoStateReadout(snapshots, events, "Balón Brawl", 55);
if (readout.snapshots < 8) errors.push(`Pocos snapshots útiles: ${readout.snapshots}`);
if (readout.advantageSeconds <= 0) errors.push("No acumula segundos de ventaja numérica");
if (readout.disadvantageSeconds <= 0) errors.push("No acumula segundos de inferioridad numérica");

console.log(`Snapshots HUD: ${readout.snapshots}`);
console.log(`Jugador localizado: ${readout.playerLocatedShare}%`);
console.log(`HP legible: ${readout.hpReadableShare}%`);
console.log(`Ventaja: ${readout.advantageSeconds}s · inferioridad: ${readout.disadvantageSeconds}s`);
console.log(`Ventanas: ${windows.map((item) => item.label).join(" → ")}`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de analizador de vídeo v0.26 correcta.");
