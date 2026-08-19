import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-video-review-v22-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];
const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/video-review.ts",
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
const review = require(join(output, "video-review.js"));
const errors = [];
let index = 0;
const event = (second, key, label, tone, confidence) => ({
  id: `e-${index += 1}`,
  second,
  key,
  label,
  category: `Auto · ${label}`,
  tone,
  confidence,
  comment: label,
});

const events = [
  event(18, "combat", "Interacción intensa", "neutral", 74),
  event(21, "death", "Muerte", "bad", 86),
  event(23, "objective", "Cambio de objetivo", "objective", 82),
  event(61, "super", "Super utilizada", "neutral", 76),
  event(64, "combat", "Interacción intensa", "neutral", 72),
  event(112, "objective", "Cambio de objetivo", "objective", 84),
  event(114, "death", "Muerte", "bad", 88),
];

const report = review.buildVideoReviewReport(events, 150);
if (report.moments.length !== 3) errors.push(`Se esperaban 3 ventanas agrupadas y hay ${report.moments.length}`);
if (!report.moments.some((moment) => moment.events.length === 3 && moment.reason.includes("conversión rival"))) {
  errors.push("La secuencia muerte + objetivo no se interpreta como posible conversión rival");
}
if (report.phases.length !== 3) errors.push("El informe no separa Inicio/Medio/Final");
if (report.phases[0].events !== 3) errors.push(`Inicio debería contener 3 señales y contiene ${report.phases[0].events}`);
if (report.phases[2].events !== 2) errors.push(`Final debería contener 2 señales y contiene ${report.phases[2].events}`);
if (report.signalQuality === "Baja") errors.push("Una muestra coherente de 7 señales no debería clasificarse como evidencia baja");
if (!report.headline.includes("Muerte") && !report.headline.includes("Cambio de objetivo")) {
  errors.push(`Headline inesperado: ${report.headline}`);
}

const sparse = review.buildVideoReviewReport([event(35, "scene", "Cambio de fase", "neutral", 61)], 180);
if (sparse.signalQuality !== "Baja") errors.push("Una única señal débil debe conservar evidencia baja");

console.log(`Momentos: ${report.moments.length}`);
console.log(`Evidencia: ${report.signalQuality} · confianza ${report.averageConfidence}%`);
console.log(`Fases: ${report.phases.map((phase) => `${phase.label}:${phase.events}`).join(" · ")}`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de analizador de vídeo v0.22 correcta.");
