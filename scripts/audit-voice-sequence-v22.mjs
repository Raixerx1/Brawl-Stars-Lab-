import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(join(tmpdir(), "brawl-voice-v22-"));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const command = existsSync(localTsc) ? process.execPath : "tsc";
const prefix = existsSync(localTsc) ? [localTsc] : [];

const compilation = spawnSync(command, [
  ...prefix,
  "src/lib/types.ts",
  "src/lib/voice-brawler.ts",
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

const roster = [
  ["surge", "Surge"],
  ["8-bit", "8-Bit"],
  ["amber", "Amber"],
  ["gale", "Gale"],
  ["edgar", "Edgar"],
  ["damian", "Damian"],
  ["r-t", "R-T"],
  ["larry-lawrie", "Larry & Lawrie"],
  ["mr-p", "Mr. P"],
].map(([slug, name]) => ({ slug, name }));

const cases = [
  {
    speech: "Surge, Abit, Amber, Gale, Edgar y Damián",
    expected: ["Surge", "8-Bit", "Amber", "Gale", "Edgar", "Damian"],
  },
  {
    speech: "surge abit amber gale edgar damian",
    expected: ["Surge", "8-Bit", "Amber", "Gale", "Edgar", "Damian"],
  },
  {
    speech: "banea Surge luego ocho bit luego Amber y Gale",
    expected: ["Surge", "8-Bit", "Amber", "Gale"],
  },
  {
    speech: "pickea erre te, Larry y Lawrie y mister p",
    expected: ["R-T", "Larry & Lawrie", "Mr. P"],
  },
];

const errors = [];
for (const test of cases) {
  const actual = matchBrawlersInSpeech(test.speech, roster);
  if (JSON.stringify(actual) !== JSON.stringify(test.expected)) {
    errors.push(`${test.speech} => ${JSON.stringify(actual)}; esperado ${JSON.stringify(test.expected)}`);
  }
  console.log(`${test.speech} => ${actual.join(" → ")}`);
}

console.log(`Errores: ${errors.length}`);
await rm(output, { recursive: true, force: true });
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Auditoría de voz secuencial v0.22 correcta.");
