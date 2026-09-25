import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFile(resolve(root, path), "utf8");

const [page, guard, control, css] = await Promise.all([
  read("src/app/draft/page.tsx"),
  read("src/components/DraftVoicePermissionGuard.tsx"),
  read("src/components/VoiceDraftControl.tsx"),
  read("src/app/draft/draft-voice-permission-v350.css"),
]);

const checks = [
  ["guard montado", page.includes("<DraftVoicePermissionGuard />")],
  ["micrófono de bans montado", page.includes('targetMode="ban"')],
  ["micrófono de picks montado", page.includes('targetMode="pick"')],
  ["permiso de audio explícito", guard.includes("getUserMedia({ audio: true })")],
  ["permiso compartido entre ambos controles", guard.includes("setReadyOnAllControls") && guard.includes("microphoneGrantedForPage")],
  ["sin restricción exclusiva de escritorio", !guard.includes("min-width") && !guard.includes("matchMedia")],
  ["fallback SpeechRecognition/webkitSpeechRecognition", guard.includes("SpeechRecognition") && guard.includes("webkitSpeechRecognition")],
  ["coordinación ban/pick existente", control.includes("VOICE_START_EVENT")],
  ["picks solo cuentan slots realmente llenos", control.includes('slot.classList.contains("filled")')],
  ["estado de solicitud visible", css.includes("mic-requesting-v350")],
  ["estado de permiso denegado visible", css.includes("mic-denied-v350")],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? "OK" : "ERROR"}: ${label}`);

if (failed.length) {
  console.error(`Auditoría de micrófono fallida: ${failed.map(([label]) => label).join(", ")}`);
  process.exit(1);
}

console.log("Auditoría de micrófono v0.35 correcta: bans + picks, móvil + escritorio, sin contar placeholders como picks.");
