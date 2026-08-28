"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Brawler } from "@/lib/types";
import { matchBrawlersInSpeech, normalizeVoice } from "@/lib/voice-brawler";

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

type CommitOutcome = "added" | "already" | "wrong" | "failed";

const VOICE_START_EVENT = "brawl-draft-lab:voice-start";
const MAX_SLOTS = 6;
const MAX_COMMIT_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function nativeSetInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function pickSlots() {
  return [...document.querySelectorAll<HTMLButtonElement>(".ordered-pick-slot")].slice(0, MAX_SLOTS);
}

function pickEntries() {
  return pickSlots().map((slot) => slot.querySelector("b")?.textContent?.trim() || "");
}

function nextPickIndex() {
  const index = pickEntries().findIndex((name) => !name);
  return index >= 0 ? index : undefined;
}

function hasPick(name: string) {
  const key = normalizeVoice(name);
  return pickEntries().some((value) => normalizeVoice(value) === key);
}

function pickInput() {
  return document.querySelector<HTMLInputElement>(".common-pick-search input:not(:disabled)");
}

function exactSuggestion(name: string) {
  const key = normalizeVoice(name);
  return [...document.querySelectorAll<HTMLButtonElement>(".common-pick-suggestions button")]
    .find((button) => normalizeVoice(button.querySelector("b")?.textContent || "") === key);
}

function dispatchEnter(input: HTMLInputElement) {
  input.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
  }));
}

async function waitForSuggestion(name: string, timeout = 850) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const suggestion = exactSuggestion(name);
    if (suggestion) return suggestion;
    await sleep(45);
  }
  return undefined;
}

async function waitForPick(name: string, slotIndex: number, timeout = 1700): Promise<CommitOutcome> {
  const key = normalizeVoice(name);
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const entries = pickEntries();
    const current = entries[slotIndex] || "";
    if (normalizeVoice(current) === key) return "added";
    if (current && normalizeVoice(current) !== key) return "wrong";
    if (entries.slice(slotIndex + 1).some(Boolean)) return "wrong";
    await sleep(55);
  }
  return "failed";
}

async function rollbackSlot(slotIndex: number) {
  const slot = pickSlots()[slotIndex];
  if (slot?.querySelector("b")) slot.click();
  await sleep(260);
}

async function commitPick(name: string): Promise<{ outcome: CommitOutcome; slotIndex?: number }> {
  if (hasPick(name)) return { outcome: "already" };
  const slotIndex = nextPickIndex();
  if (typeof slotIndex !== "number") return { outcome: "failed" };

  for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt += 1) {
    const current = pickEntries()[slotIndex] || "";
    if (normalizeVoice(current) === normalizeVoice(name)) return { outcome: "added", slotIndex };
    if (current) await rollbackSlot(slotIndex);

    const input = pickInput();
    if (!input) {
      await sleep(180 + attempt * 100);
      continue;
    }

    nativeSetInputValue(input, "");
    if (document.activeElement === input) {
      input.blur();
      await sleep(60);
    }
    input.focus();
    input.click();
    input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await sleep(90);
    nativeSetInputValue(input, name);
    await sleep(150);

    const suggestion = await waitForSuggestion(name, 600 + attempt * 130);
    if (suggestion) {
      suggestion.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      suggestion.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      suggestion.click();
    } else {
      dispatchEnter(input);
    }

    let outcome = await waitForPick(name, slotIndex, 1350 + attempt * 220);
    if (outcome === "added") return { outcome, slotIndex };
    if (outcome === "wrong") await rollbackSlot(slotIndex);

    const retryInput = pickInput();
    if (retryInput) {
      nativeSetInputValue(retryInput, name);
      await sleep(150);
      dispatchEnter(retryInput);
      outcome = await waitForPick(name, slotIndex, 950);
      if (outcome === "added") return { outcome, slotIndex };
      if (outcome === "wrong") await rollbackSlot(slotIndex);
      nativeSetInputValue(retryInput, "");
    }
    await sleep(180 + attempt * 90);
  }

  return { outcome: "failed", slotIndex };
}

function bestSingleName(result: SpeechResultLike, roster: Brawler[]) {
  let best: { name: string; confidence: number } | undefined;
  for (let index = 0; index < result.length; index += 1) {
    const alternative = result[index];
    const names = matchBrawlersInSpeech(alternative.transcript, roster);
    if (!names.length) continue;
    const candidate = { name: names[0], confidence: alternative.confidence || 0 };
    if (!best || candidate.confidence > best.confidence) best = candidate;
  }
  return best?.name || "";
}

export default function PersistentPickVoiceControlV4({ roster }: { roster: Brawler[] }) {
  const [target, setTarget] = useState<Element | null>(null);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Pulsa una vez y di un pick cada vez");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const keepListeningRef = useRef(false);
  const processingRef = useRef(false);
  const acceptedRef = useRef(false);
  const interimRef = useRef("");
  const restartRef = useRef<number | null>(null);

  useEffect(() => {
    const locate = () => setTarget(document.querySelector(".common-pick-search"));
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { subtree: true, childList: true });

    const speechWindow = window as SpeechWindow;
    setSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));

    const stopWhenOtherStarts = (event: Event) => {
      const detail = (event as CustomEvent<"ban" | "pick">).detail;
      if (detail === "pick") return;
      keepListeningRef.current = false;
      setListening(false);
      setBusy(false);
      setStatus("Micrófono de picks en pausa");
      try { recognitionRef.current?.abort(); } catch { /* no-op */ }
    };
    window.addEventListener(VOICE_START_EVENT, stopWhenOtherStarts);

    return () => {
      observer.disconnect();
      window.removeEventListener(VOICE_START_EVENT, stopWhenOtherStarts);
      keepListeningRef.current = false;
      if (restartRef.current !== null) window.clearTimeout(restartRef.current);
      try { recognitionRef.current?.abort(); } catch { /* no-op */ }
    };
  }, []);

  const readyStatus = () => {
    const next = nextPickIndex();
    return typeof next === "number"
      ? `🎙 Escuchando · di el pick ${next + 1}/${MAX_SLOTS}`
      : `✓ ${MAX_SLOTS}/${MAX_SLOTS} picks completos`;
  };

  const resetUtterance = () => {
    acceptedRef.current = false;
    interimRef.current = "";
  };

  const stopListening = (message = "Micrófono de picks detenido") => {
    keepListeningRef.current = false;
    processingRef.current = false;
    resetUtterance();
    if (restartRef.current !== null) window.clearTimeout(restartRef.current);
    restartRef.current = null;
    setListening(false);
    setBusy(false);
    setStatus(message);
    try { recognitionRef.current?.stop(); } catch { /* no-op */ }
  };

  const scheduleRestart = (delay = 320) => {
    if (!keepListeningRef.current || processingRef.current) return;
    if (typeof nextPickIndex() !== "number") {
      stopListening(`✓ ${MAX_SLOTS}/${MAX_SLOTS} picks completos`);
      return;
    }
    if (restartRef.current !== null) window.clearTimeout(restartRef.current);
    restartRef.current = window.setTimeout(() => {
      restartRef.current = null;
      if (!keepListeningRef.current || processingRef.current) return;
      resetUtterance();
      setStatus(readyStatus());
      try {
        recognitionRef.current?.start();
      } catch {
        scheduleRestart(420);
      }
    }, delay);
  };

  const acceptName = async (name: string) => {
    if (!name || acceptedRef.current || processingRef.current || !keepListeningRef.current) return;
    acceptedRef.current = true;
    processingRef.current = true;
    setBusy(true);

    const expected = nextPickIndex();
    setStatus(typeof expected === "number"
      ? `He oído ${name} · validando pick ${expected + 1}/${MAX_SLOTS}…`
      : `Validando ${name}…`);

    const { outcome, slotIndex } = await commitPick(name);
    processingRef.current = false;
    setBusy(false);

    if (!keepListeningRef.current) return;
    if (outcome === "added") {
      const completed = pickEntries().filter(Boolean).length;
      if (completed >= MAX_SLOTS) {
        stopListening(`✓ ${name} validado · ${MAX_SLOTS}/${MAX_SLOTS} completos`);
        return;
      }
      setStatus(`✓ ${name} en pick ${(slotIndex ?? completed - 1) + 1} · di el siguiente`);
      await sleep(180);
      resetUtterance();
      setStatus(readyStatus());
      return;
    }
    if (outcome === "already") {
      resetUtterance();
      setStatus(`${name} ya estaba elegido · di otro brawler`);
      return;
    }

    resetUtterance();
    setStatus(`No pude validar ${name} · repite ese mismo pick`);
  };

  const startListening = () => {
    if (!supported) {
      setStatus("Reconocimiento de voz no disponible en este navegador");
      return;
    }
    if (typeof nextPickIndex() !== "number") {
      setStatus(`✓ ${MAX_SLOTS}/${MAX_SLOTS} picks completos`);
      return;
    }

    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      setStatus("Reconocimiento de voz no disponible en este navegador");
      return;
    }

    window.dispatchEvent(new CustomEvent<"pick">(VOICE_START_EVENT, { detail: "pick" }));

    let recognition = recognitionRef.current;
    if (!recognition) {
      recognition = new Recognition();
      recognition.lang = "es-ES";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 10;

      recognition.onstart = () => {
        setListening(true);
        if (keepListeningRef.current && !processingRef.current) setStatus(readyStatus());
      };

      recognition.onresult = (event) => {
        if (!keepListeningRef.current || processingRef.current || acceptedRef.current) return;
        let finalName = "";
        for (let resultIndex = event.resultIndex; resultIndex < event.results.length; resultIndex += 1) {
          const result = event.results[resultIndex];
          const name = bestSingleName(result, roster);
          if (!name) continue;
          interimRef.current = name;
          setStatus(`Oyendo ${name}…`);
          if (result.isFinal) {
            finalName = name;
            break;
          }
        }
        if (finalName) void acceptName(finalName);
      };

      recognition.onerror = (event) => {
        const error = event.error || "unknown";
        if (error === "not-allowed" || error === "service-not-allowed") {
          keepListeningRef.current = false;
          setListening(false);
          setStatus("Permite el micrófono para usar picks por voz");
          return;
        }
        if (error === "audio-capture") {
          keepListeningRef.current = false;
          setListening(false);
          setStatus("No se puede acceder al micrófono");
          return;
        }
        if (error === "no-speech") {
          if (!processingRef.current) setStatus(readyStatus());
          return;
        }
        if (error !== "aborted" && !processingRef.current) setStatus(`Voz: ${error}`);
      };

      recognition.onend = () => {
        setListening(false);
        if (!keepListeningRef.current) return;
        if (!processingRef.current && !acceptedRef.current && interimRef.current) {
          void acceptName(interimRef.current);
          return;
        }
        if (!processingRef.current) scheduleRestart(340);
      };

      recognitionRef.current = recognition;
    }

    keepListeningRef.current = true;
    resetUtterance();
    setStatus("Activando micrófono…");
    try {
      recognition.start();
    } catch {
      setStatus("El micrófono ya está activo");
    }
  };

  if (!target) return null;

  return createPortal(
    <div className={`voice-draft-control-v185 voice-target-pick ${listening ? "listening" : ""} ${busy ? "busy" : ""} ${!supported ? "unsupported" : ""}`}>
      <button
        type="button"
        className="voice-draft-button-v185"
        aria-label={listening || busy ? "Detener picks por voz" : "Activar picks por voz"}
        aria-pressed={listening}
        disabled={!supported}
        onClick={listening || busy ? () => stopListening() : startListening}
      >
        <span aria-hidden="true">{listening ? "■" : busy ? "…" : "🎙"}</span>
      </button>
      <span className="voice-draft-status-v185" aria-live="polite">{status}</span>
    </div>,
    target,
  );
}
