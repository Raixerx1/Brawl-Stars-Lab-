import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-voice-v25-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];

const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/voice-brawler.ts",
  "src/lib/voice-order.ts",
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
const { matchBrawlersInSpeech } = require(join(output, "voice-brawler.js"));
const { buildOrderedPendingVoicePlan } = require(join(output, "voice-order.js"));

const roster = [
  ["surge", "Surge"],
  ["8-bit", "8-Bit"],
  ["amber", "Amber"],
  ["gale", "Gale"],
  ["edgar", "Edgar"],
  ["damian", "Damian"],
  ["wendy", "Wendy"],
  ["nori", "Nori"],
  ["bolt", "Bolt"],
  ["griff", "Griff"],
  ["finx", "Finx"],
  ["gigi", "Gigi"],
  ["r-t", "R-T"],
  ["larry-lawrie", "Larry & Lawrie"],
  ["mr-p", "Mr. P"],
  ["kaze", "Kaze"],
  ["moe", "Moe"],
].map(([slug, name]) => ({ slug, name }));

const cases = [
  {
    speech: "Surge, Abit, Amber, Gale, Edgar y Damián",
    expected: ["Surge", "8-Bit", "Amber", "Gale", "Edgar", "Damian"],
  },
  {
    speech: "guendi nory volt grif finks y yiyi",
    expected: ["Wendy", "Nori", "Bolt", "Griff", "Finx", "Gigi"],
  },
  {
    speech: "banea Wendy luego Nori luego Bolt, Griff, Surge y ocho bits",
    expected: ["Wendy", "Nori", "Bolt", "Griff", "Surge", "8-Bit"],
  },
  {
    speech: "pickea erre te, Larry y Lawrie y mister p",
    expected: ["R-T", "Larry & Lawrie", "Mr. P"],
  },
  {
    speech: "case normal y arte moderno",
    expected: [],
  },
];

const errors = [];
for (const test of cases) {
  const actual = matchBrawlersInSpeech(test.speech, roster);
  if (JSON.stringify(actual) !== JSON.stringify(test.expected)) {
    errors.push(`${test.speech} => ${JSON.stringify(actual)}; esperado ${JSON.stringify(test.expected)}`);
  }
  console.log(`${test.speech} => ${actual.join(" → ") || "sin brawlers"}`);
}

const spokenSix = ["Surge", "8-Bit", "Amber", "Gale", "Edgar", "Damian"];
const planCases = [
  {
    label: "seis nombres conservan el orden",
    input: { spoken: spokenSix, selected: [], active: null, maxSlots: 6 },
    expected: spokenSix,
  },
  {
    label: "el pick activo no se cuenta dos veces",
    input: { spoken: spokenSix, selected: ["Surge"], active: "8-Bit", maxSlots: 6 },
    expected: ["Amber", "Gale", "Edgar", "Damian"],
  },
  {
    label: "tras cuatro validados quedan quinto y sexto en orden",
    input: { spoken: spokenSix, selected: ["Surge", "8-Bit", "Amber", "Gale"], active: null, maxSlots: 6 },
    expected: ["Edgar", "Damian"],
  },
  {
    label: "una revisión del transcript puede insertar un nombre intermedio",
    input: { spoken: ["Surge", "8-Bit", "Amber"], selected: [], active: null, maxSlots: 6 },
    expected: ["Surge", "8-Bit", "Amber"],
  },
];

for (const test of planCases) {
  const actual = buildOrderedPendingVoicePlan(test.input);
  if (JSON.stringify(actual) !== JSON.stringify(test.expected)) {
    errors.push(`${test.label}: ${JSON.stringify(actual)}; esperado ${JSON.stringify(test.expected)}`);
  }
  console.log(`${test.label}: ${actual.join(" → ") || "sin pendientes"}`);
}

console.log(`Errores: ${errors.length}`);
await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de voz secuencial v0.25 correcta.");
