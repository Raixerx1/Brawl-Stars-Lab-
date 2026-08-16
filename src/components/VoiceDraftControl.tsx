"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Brawler } from "@/lib/types";

type SpeechAlternativeLike = { transcript: string; confidence?: number };
type SpeechResultLike = { isFinal: boolean; length: number; [index: number]: SpeechAlternativeLike };
type SpeechResultListLike = { length: number; [index: number]: SpeechResultLike };
type SpeechEventLike = { resultIndex: number; results: SpeechResultListLike };
type SpeechErrorLike = { error?: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechErrorLike) => void) | null;
  onresult: ((event: SpeechEventLike) => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};
type AliasMap = Record<string, string[]>;

const MANUAL_ALIASES: AliasMap = {
  "8 bit": ["ocho bit", "ocho bits", "eight bit", "eibit", "ait bit"],
  "r t": ["erre te", "rt", "arte"],
  "mr p": ["mister p", "mr p", "señor p", "senor p"],
  "larry y lawrie": ["larry y lawrie", "larry lawrie", "lari y lori", "lari lori", "larry and lawrie"],
  "stu": ["estu", "stew"],
  "crow": ["crou", "crowe"],
  "surge": ["serge", "surg", "surch"],
  "gale": ["gail", "geil"],
  "bo": ["bow"],
  "maisie": ["maisy", "meisi", "macy"],
  "meeple": ["mipel", "meeple"],
  "jae yong": ["jae yong", "jayong", "jaeyong", "ye yong"],
  "ollie": ["oli", "olly"],
  "berry": ["beri", "barry"],
  "shade": ["sheid", "shaid"],
  "moe": ["mou", "mo"],
  "clancy": ["clansi", "clancy"],
  "lily": ["lili"],
  "kaze": ["kase", "case"],
  "pierce": ["pirs", "piers"],
  "starr nova": ["star nova", "starnova"],
  "glowy": ["gloui", "glowi"],
  "ziggy": ["zigi", "zigui"],
  "najia": ["naya", "najia"],
};

const COMMAND_WORDS = new Set([
  "ban", "banea", "banear", "baneamos", "banead", "quita", "bloquea", "bloquear",
  "mete", "pon", "poner", "añade", "anade", "rival", "enemigo", "enemiga", "brawler", "browler", "ahora", "siguiente",
]);

function normalizeVoice(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasesFor(brawler: Brawler) {
  const canonical = normalizeVoice(brawler.name);
  const slug = normalizeVoice(brawler.slug.replace(/-/g, " "));
  return [...new Set([canonical, slug, ...(MANUAL_ALIASES[canonical] || [])].map(normalizeVoice).filter(Boolean))];
}

function levenshtein(left: string, right: string) {
  const rows = right.length + 1;
  const columns = left.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
  for (let column = 0; column < columns; column += 1) matrix[0][column] = column;
  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      matrix[row][column] = right[row - 1] === left[column - 1]
        ? matrix[row - 1][column - 1]
        : Math.min(matrix[row - 1][column - 1] + 1, matrix[row][column - 1] + 1, matrix[row - 1][column] + 1);
    }
  }
  return matrix[rows - 1][columns - 1];
}

function fuzzySimilarity(left: string, right: string) {
  const longest = Math.max(left.length, right.length);
  return longest ? 1 - levenshtein(left, right) / longest : 1;
}

function stripCommands(value: string) {
  return normalizeVoice(value).split(" ").filter((word) => !COMMAND_WORDS.has(word)).join(" ").trim();
}

function matchBrawlers(transcript: string, roster: Brawler[]) {
  const normalized = normalizeVoice(transcript);
  const padded = ` ${normalized} `;
  const candidates: Array<{ name: string; start: number; end: number; aliasLength: number }> = [];

  for (const brawler of roster) {
    for (const alias of aliasesFor(brawler)) {
      const needle = ` ${alias} `;
      let from = 0;
      while (from < padded.length) {
        const index = padded.indexOf(needle, from);
        if (index < 0) break;
        candidates.push({ name: brawler.name, start: index + 1, end: index + 1 + alias.length, aliasLength: alias.length });
        from = index + needle.length;
      }
    }
  }

  candidates.sort((a, b) => a.start - b.start || b.aliasLength - a.aliasLength);
  const chosen: typeof candidates = [];
  for (const candidate of candidates) {
    if (chosen.some((item) => candidate.start < item.end && candidate.end > item.start)) continue;
    if (chosen.some((item) => item.name === candidate.name)) continue;
    chosen.push(candidate);
  }
  if (chosen.length) return chosen.sort((a, b) => a.start - b.start).map((item) => item.name);

  const cleaned = stripCommands(transcript);
  if (!cleaned || cleaned.length < 2) return [];
  let best: { name: string; score: number } | undefined;
  for (const brawler of roster) {
    for (const alias of aliasesFor(brawler)) {
      const score = fuzzySimilarity(cleaned, alias);
      if (!best || score > best.score) best = { name: brawler.name, score };
    }
  }
  const threshold = cleaned.length <= 4 ? .72 : .66;
  return best && best.score >= threshold ? [best.name] : [];
}

function nativeSetInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function commitVoiceBan(name: string) {
  const input = document.querySelector<HTMLInputElement>(".draft-picker-ban .draft-search-wrap input:not(:disabled)");
  if (!input) return false;
  input.focus();
  nativeSetInputValue(input, name);
  await sleep(90);

  const buttons = [...document.querySelectorAll<HTMLButtonElement>(".draft-picker-ban .draft-suggestions button")];
  const exact = buttons.find((button) => normalizeVoice(button.querySelector("b")?.textContent || "") === normalizeVoice(name));
  if (!exact) return false;
  exact.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  exact.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
  await sleep(170);
  return true;
}

function bestAlternative(result: SpeechResultLike, roster: Brawler[]) {
  let best: { transcript: string; names: string[]; confidence: number } | undefined;
  for (let index = 0; index < result.length; index += 1) {
    const alternative = result[index];
    const names = matchBrawlers(alternative.transcript, roster);
    const confidence = alternative.confidence || 0;
    if (!best || names.length > best.names.length || (names.length === best.names.length && confidence > best.confidence)) {
      best = { transcript: alternative.transcript, names, confidence };
    }
  }
  return best;
}

export default function VoiceDraftControl({ roster }: { roster: Brawler[] }) {
  const [target, setTarget] = useState<Element | null>(null);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("Di los bans");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const keepListeningRef = useRef(false);
  const lastTranscriptRef = useRef({ value: "", at: 0 });
  const rosterSignature = useMemo(() => roster.map((brawler) => brawler.name).join("|"), [roster]);

  useEffect(() => {
    const locate = () => setTarget(document.querySelector(".draft-picker-ban .draft-search-wrap"));
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => {
      keepListeningRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!recognitionRef.current) return;
    setStatus(listening ? "Escuchando bans…" : "Di los bans");
  }, [listening, rosterSignature]);

  const stopListening = () => {
    keepListeningRef.current = false;
    setListening(false);
    setStatus("Voz detenida");
    recognitionRef.current?.stop();
  };

  const startListening = () => {
    if (!supported) {
      setStatus("Reconocimiento de voz no disponible en este navegador");
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) return;

    let recognition = recognitionRef.current;
    if (!recognition) {
      recognition = new Recognition();
      recognition.lang = "es-ES";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 5;
      recognition.onstart = () => {
        setListening(true);
        setStatus("Escuchando bans…");
      };
      recognition.onresult = (event) => {
        void (async () => {
          for (let resultIndex = event.resultIndex; resultIndex < event.results.length; resultIndex += 1) {
            const result = event.results[resultIndex];
            if (!result.isFinal) continue;
            const alternative = bestAlternative(result, roster);
            if (!alternative) continue;
            const now = Date.now();
            const normalizedTranscript = normalizeVoice(alternative.transcript);
            if (normalizedTranscript === lastTranscriptRef.current.value && now - lastTranscriptRef.current.at < 1200) continue;
            lastTranscriptRef.current = { value: normalizedTranscript, at: now };

            if (!alternative.names.length) {
              setStatus(`No reconocí un brawler en “${alternative.transcript}”`);
              continue;
            }

            setStatus(`Ban oído: ${alternative.names.join(" + ")}`);
            for (const name of alternative.names) {
              const added = await commitVoiceBan(name);
              if (!added) {
                setStatus(`${name} no se pudo banear: puede estar ya usado, baneado o haberse llenado los 6 bans`);
                break;
              }
            }
          }
        })();
      };
      recognition.onerror = (event) => {
        const error = event.error || "unknown";
        if (error === "no-speech") {
          setStatus("No oí ningún ban. Sigo escuchando…");
          return;
        }
        if (error === "not-allowed" || error === "service-not-allowed") {
          keepListeningRef.current = false;
          setListening(false);
          setStatus("Permite el micrófono para introducir bans por voz");
          return;
        }
        if (error === "audio-capture") {
          keepListeningRef.current = false;
          setListening(false);
          setStatus("No se puede acceder al micrófono");
          return;
        }
        setStatus(`Voz: ${error}`);
      };
      recognition.onend = () => {
        setListening(false);
        if (!keepListeningRef.current) return;
        window.setTimeout(() => {
          if (!keepListeningRef.current) return;
          try {
            recognitionRef.current?.start();
          } catch {
            setStatus("Toca el micrófono para continuar");
          }
        }, 220);
      };
      recognitionRef.current = recognition;
    }

    keepListeningRef.current = true;
    setStatus("Activando micrófono…");
    try {
      recognition.start();
    } catch {
      setStatus("El micrófono ya está activo");
    }
  };

  if (!target) return null;

  return createPortal(
    <div className={`voice-draft-control-v185 ${listening ? "listening" : ""} ${!supported ? "unsupported" : ""}`}>
      <button
        type="button"
        className="voice-draft-button-v185"
        aria-label={listening ? "Detener bans por voz" : "Introducir bans por voz"}
        aria-pressed={listening}
        disabled={!supported}
        onClick={listening ? stopListening : startListening}
      >
        <span aria-hidden="true">{listening ? "■" : "🎙"}</span>
      </button>
      <span className="voice-draft-status-v185" aria-live="polite">{status}</span>
    </div>,
    target,
  );
}
