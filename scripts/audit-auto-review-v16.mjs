import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-auto-review-v16-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];
const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/live-review.ts",
  "src/lib/auto-learning.ts",
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
const review = require(join(output, "live-review.js"));
const learning = require(join(output, "auto-learning.js"));
const errors = [];
let id = 0;
const event = (label, second, extra = {}) => ({
  id: `event-${id += 1}`,
  second,
  label,
  category: "Auditoría",
  tone: "neutral",
  source: "Manual",
  ...extra,
});

const strong = [
  event("Eliminación", 12),
  event("Buena rotación", 25),
  event("Super decisiva", 39),
  event("Objetivo ganado", 44),
  event("Matchup favorable", 58),
  event("Cambio de línea", 64),
];
const weak = [
  event("Muerte", 10),
  event("Sobreextensión", 18),
  event("Super desperdiciada", 27),
  event("Objetivo perdido", 31),
  event("Muerte con coste de objetivo", 48),
  event("Cadena de muertes", 55),
];

const strongCard = review.buildAutoReviewScorecard(strong);
const weakCard = review.buildAutoReviewScorecard(weak);
if (strongCard.overall <= weakCard.overall + 20) errors.push("La ejecución favorable no se separa suficientemente de la crítica");
if (weakCard.verdict !== "Crítica") errors.push(`Veredicto débil inesperado: ${weakCard.verdict}`);
if (weakCard.keyMoment?.label !== "Muerte con coste de objetivo") errors.push("No se identifica la muerte con coste como momento clave");

const rejectedBad = event("Sobreextensión", 20, { source: "Auto", confidence: 90, feedback: "rejected" });
const acceptedGood = event("Objetivo ganado", 24, { source: "Auto", confidence: 74, feedback: "accepted" });
const pendingGood = event("Super con impacto", 27, { source: "Auto", confidence: 80 });
const reviewedCard = review.buildAutoReviewScorecard([rejectedBad, acceptedGood, pendingGood]);
if (reviewedCard.reviewCoverage !== 67) errors.push(`Cobertura de revisión inesperada: ${reviewedCard.reviewCoverage}`);
if (reviewedCard.objective <= 50) errors.push("Un falso positivo rechazado sigue penalizando el objetivo");

const sequenceEvents = [
  event("Interacción intensa", 40, { source: "Auto", confidence: 72 }),
  event("Cambio de objetivo", 45, { source: "Auto", confidence: 76 }),
  event("Matchup desfavorable", 60),
  event("Cambio de línea", 69),
];
const insights = learning.deriveSequenceInsights(sequenceEvents, new Set());
if (!insights.some((insight) => insight.label === "Presión convertida")) errors.push("Falta la secuencia de presión convertida");
if (!insights.some((insight) => insight.label === "Matchup corregido")) errors.push("Falta la secuencia de matchup corregido");

const empty = review.buildAutoReviewScorecard([]);
if (empty.verdict !== "Sin datos" || empty.overall !== 0) errors.push("El estado vacío no es estable");

console.log(`Score favorable: ${strongCard.overall} · ${strongCard.verdict}`);
console.log(`Score crítico: ${weakCard.overall} · ${weakCard.verdict}`);
console.log(`Secuencias nuevas: ${insights.map((insight) => insight.label).join(" · ")}`);
console.log(`Errores: ${errors.length}`);

await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de Auto Review v0.16 correcta.");
