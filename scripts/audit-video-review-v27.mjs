import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-video-review-v27-"));
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
const v27 = require(join(output, "video-review-v27.js"));
const errors = [];

function image(width = 320, height = 180) {
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
        const offset = (y * width + x) * 4;
        data[offset] = rgb[0];
        data[offset + 1] = rgb[1];
        data[offset + 2] = rgb[2];
        data[offset + 3] = 255;
      }
    }
  };

  // Jugador local cerca del centro de cámara.
  paint(.47, .49, .53, .56, [35, 185, 235]);
  paint(.455, .405, .555, .42, [40, 220, 65]);
  // Aliado más grande a la izquierda: no debe arrastrar el tracking al centroide del equipo.
  paint(.23, .47, .36, .60, [35, 185, 235]);
  paint(.225, .39, .345, .405, [40, 220, 65]);
  // Señal de munición variable y HUD inferior.
  paint(.78, .75, .90, .80, [245, 185, 45]);
  return { width, height, data };
}

const tracked = v27.sampleVideoHudFrameV27(image(), 3, "Balón Brawl");
if (tracked.playerX === undefined || Math.abs(tracked.playerX - .5) > .09) {
  errors.push(`Tracking de cámara desviado: x=${tracked.playerX}`);
}
if (tracked.hpSignal === undefined) errors.push("El tracking central no conserva lectura de HP");

// Una señal cromática estable sin contraste temporal no debe auto-normalizarse a Super lista.
const flatNoise = Array.from({ length: 24 }, (_, index) => ({
  second: index,
  playerX: .5,
  playerY: .54,
  locatorSignal: .78,
  hpSignal: 80,
  ammoEnergy: .005,
  superEnergy: .006,
  hyperEnergy: .003,
  objectiveEnergy: .002,
}));
const flatSnapshots = v27.finalizeVideoHudSamplesV27(flatNoise);
if (flatSnapshots.some((item) => item.superReady)) errors.push("Falso positivo: señal Super plana marcada como lista");
if (flatSnapshots.some((item) => item.hyperReady)) errors.push("Falso positivo: señal Hyper plana marcada como lista");
if (flatSnapshots.some((item) => item.objectivePossession === "probable")) errors.push("Falso positivo: objetivo plano marcado como posesión");

// Un pico aislado tampoco debe activar histéresis.
const spikeNoise = flatNoise.map((item, index) => ({
  ...item,
  superEnergy: index === 12 ? .045 : .004,
  hyperEnergy: index === 12 ? .030 : .002,
}));
const spikeSnapshots = v27.finalizeVideoHudSamplesV27(spikeNoise);
if (spikeSnapshots.some((item) => item.superReady)) errors.push("Un único pico activa Super lista");
if (spikeSnapshots.some((item) => item.hyperReady)) errors.push("Un único pico activa Hyper lista");

// Una subida sostenida sí debe sobrevivir a mediana + histéresis y generar ventana de revisión.
const sustained = Array.from({ length: 28 }, (_, index) => ({
  second: index,
  playerX: .5,
  playerY: .54,
  locatorSignal: .82,
  hpSignal: 76,
  ammoEnergy: index % 5 < 2 ? .008 : .028,
  superEnergy: index >= 7 && index <= 21 ? .042 : .003,
  hyperEnergy: index >= 13 && index <= 21 ? .026 : .001,
  objectiveEnergy: 0,
}));
const sustainedSnapshots = v27.finalizeVideoHudSamplesV27(sustained);
if (!sustainedSnapshots.some((item) => item.superReady)) errors.push("No detecta Super sostenida tras calibración robusta");
if (!sustainedSnapshots.some((item) => item.hyperReady)) errors.push("No detecta Hyper sostenida tras calibración robusta");

const readout = v27.buildVideoStateReadoutV27(sustainedSnapshots, [], "Balón Brawl", 28);
if (readout.stableTrackingShare < 60) errors.push(`Tracking estable insuficiente: ${readout.stableTrackingShare}%`);
if (readout.hudQualityScore <= 0) errors.push("No calcula calidad agregada del HUD");
if (readout.superHoldSeconds < 8) errors.push(`No identifica retención sostenida de Super: ${readout.superHoldSeconds}s`);
if (!readout.moments.some((item) => item.label.includes("Super lista sostenida"))) errors.push("No expone momento de Super sostenida");

console.log(`Tracking x: ${tracked.playerX?.toFixed(3)}`);
console.log(`Calidad HUD: ${readout.hudQuality} · ${readout.hudQualityScore}/100`);
console.log(`Tracking estable: ${readout.stableTrackingShare}%`);
console.log(`Super sostenida: ${readout.superHoldSeconds}s · Hyper: ${readout.hyperHoldSeconds}s`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de analizador de vídeo v0.27 correcta.");
