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

type VoicePhase = "idle" | "starting" | "listening" | "busy" | "error";
type CommitOutcome = "added" | "already" | "wrong" | "failed";

const VOICE_START_EVENT = "brawl-draft-lab:voice-start";
const MAX_SLOTS = 6;
const MAX_COMMIT_ATTEMPTS = 3;
const RESTART_MS = 260;
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

function suggestionFor(name: string) {
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
    const suggestion = suggestionFor(name);
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
    const input = pickInput();
    if (!input) {
      await sleep(180 + attempt * 100);
      continue;
    }

    nativeSetInputValue(input, "");
    input.focus();
    input.click();
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await sleep(90);
    nativeSetInputValue(input, name);
    await sleep(150);

    const suggestion = await waitForSuggestion(name, 600 + attempt * 120);
    if (suggestion) {
      suggestion.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
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
      await sleep(130);
      dispatchEnter(retryInput);
      outcome = await waitForPick(name, slotIndex, 900);
      if (outcome === "added") return { outcome, slotIndex };
      if (outcome === "wrong") await rollbackSlot(slotIndex);
      nativeSetInputValue(retryInput, "");
    }
    await sleep(180 + attempt * 90);
  }

  return { outcome: "failed", slotIndex };
}

function bestName(result: SpeechResultLike, roster: Brawler[]) {
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

export default function PersistentPickVoiceControlV3({ roster }: { roster: Brawler[] }) {
  const [target, setTarget] = useState<Element | null>(null);
  const [supported, setSupported] = useState(false);
  const [armed, setArmed] = useState(false);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [status, setStatus] = useState("Pulsa el micro una vez para activar los picks por voz");

  const armedRef = useRef(false);
  const processingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const restartRef = useRef<number | null>(null);
  const cycleAcceptedRef = useRef(false);
  const interimNameRef = useRef("");

  useEffect(() => {
    const locate = () => setTarget(document.querySelector(".common-pick-search"));
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { subtree: true, childList: true });

    const speechWindow = window as SpeechWindow;
    setSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));

    const stopForOtherVoice = (event: Event) => {
      const detail = (event as CustomEvent<"ban" | "pick">).detail;
      if (detail === "pick") return;
      armedRef.current = false;
      setArmed(false);
      setPhase("idle");
      setStatus("Micrófono de picks en pausa");
      try { recognitionRef.current?.abort(); } catch { /* no-op */ }
    };
    window.addEventListener(VOICE_START_EVENT, stopForOtherVoice);

    return () => {
      observer.disconnect();
      window.removeEventListener(VOICE_START_EVENT, stopForOtherVoice);
      armedRef.current = false;
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

  const clearRestart = () => {
    if (restartRef.current !== null) {
      window.clearTimeout(restartRef.current);
      restartRef.current = null;
    }
  };

  const stop = (message = "Micrófono de picks detenido") => {
    armedRef.current = false;
    processingRef.current = false;
    cycleAcceptedRef.current = false;
    interimNameRef.current = "";
    clearRestart();
    setArmed(false);
    setPhase("idle");
    setStatus(message);
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try { recognition?.abort(); } catch { /* no-op */ }
  };

  const makeRecognition = () => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) return null;
    const recognition = new Recognition();
    recognition.lang = "es-ES";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 10;
    recognitionRef.current = recognition;
    return recognition;
  };

  const scheduleNextCycle = (delay = RESTART_MS) => {
    if (!armedRef.current || processingRef.current) return;
    if (typeof nextPickIndex() !== "number") {
      stop(`✓ ${MAX_SLOTS}/${MAX_SLOTS} picks completos`);
      return;
    }
    clearRestart();
    restartRef.current = window.setTimeout(() => {
      restartRef.current = null;
      if (!armedRef.current || processingRef.current) return;
      startCycle(false);
    }, delay);
  };

  const acceptName = async (name: string) => {
    if (!name || !armedRef.current || processingRef.current || cycleAcceptedRef.current) return;
    cycleAcceptedRef.current = true;
    processingRef.current = true;
    setPhase("busy");

    const expected = nextPickIndex();
    setStatus(typeof expected === "number"
      ? `He oído ${name} · validando pick ${expected + 1}/${MAX_SLOTS}…`
      : `Validando ${name}…`);

    try { recognitionRef.current?.stop(); } catch { /* no-op */ }
    const { outcome, slotIndex } = await commitPick(name);
    processingRef.current = false;

    if (!armedRef.current) return;
    if (outcome === "added") {
      const completed = pickEntries().filter(Boolean).length;
      if (completed >= MAX_SLOTS) {
        stop(`✓ ${name} validado · ${MAX_SLOTS}/${MAX_SLOTS} completos`);
        return;
      }
      setStatus(`✓ ${name} en pick ${(slotIndex ?? completed - 1) + 1} · escuchando siguiente…`);
      setPhase("starting");
      scheduleNextCycle(220);
      return;
    }
    if (outcome === "already") {
      setStatus(`${name} ya estaba elegido · di otro brawler`);
      setPhase("starting");
      scheduleNextCycle(220);
      return;
    }

    setStatus(`No pude validar ${name} · repite el mismo pick`);
    setPhase("starting");
    scheduleNextCycle(300);
  };

  const startCycle = (fromUserClick: boolean) => {
    if (!armedRef.current || processingRef.current) return;
    const recognition = makeRecognition();
    if (!recognition) {
      setSupported(false);
      stop("Reconocimiento de voz no disponible en este navegador");
      return;
    }

    cycleAcceptedRef.current = false;
    interimNameRef.current = "";
    setPhase("starting");
    setStatus(fromUserClick ? "Activando micrófono de picks…" : "Reabriendo micrófono…");

    recognition.onstart = () => {
      if (!armedRef.current) return;
      setPhase("listening");
      setStatus(readyStatus());
    };

    recognition.onresult = (event) => {
      if (!armedRef.current || processingRef.current || cycleAcceptedRef.current) return;
      let final = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const name = bestName(result, roster);
        if (!name) continue;
        interimNameRef.current = name;
        setStatus(`Oyendo ${name}…`);
        if (result.isFinal) {
          final = name;
          break;
        }
      }
      if (final) void acceptName(final);
    };

    recognition.onerror = (event) => {
      const error = event.error || "unknown";
      if (!armedRef.current) return;
      if (error === "not-allowed" || error === "service-not-allowed") {
        armedRef.current = false;
        setArmed(false);
        setPhase("error");
        setStatus("Permite el micrófono en el navegador para usar picks por voz");
        return;
      }
      if (error === "audio-capture") {
        armedRef.current = false;
        setArmed(false);
        setPhase("error");
        setStatus("No se puede acceder al micrófono");
        return;
      }
      if (error !== "aborted" && !processingRef.current) {
        setPhase("starting");
        setStatus(`Micrófono: ${error} · reintentando…`);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (!armedRef.current || processingRef.current || cycleAcceptedRef.current) return;
      if (interimNameRef.current) {
        void acceptName(interimNameRef.current);
        return;
      }
      setPhase("starting");
      setStatus("Micrófono abierto · esperando siguiente nombre…");
      scheduleNextCycle(220);
    };

    try {
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      setPhase("error");
      setStatus(`No se pudo iniciar el micro${error instanceof Error && error.message ? `: ${error.message}` : ""}`);
      scheduleNextCycle(420);
    }
  };

  const toggle = () => {
    if (armedRef.current) {
      stop();
      return;
    }
    if (!supported) {
      setPhase("error");
      setStatus("Reconocimiento de voz no disponible en este navegador");
      return;
    }
    if (typeof nextPickIndex() !== "number") {
      setStatus(`✓ ${MAX_SLOTS}/${MAX_SLOTS} picks completos`);
      return;
    }

    armedRef.current = true;
    setArmed(true);
    clearRestart();
    // El evento cierra el micro de bans antes de iniciar la sesión de picks.
    window.dispatchEvent(new CustomEvent<"pick">(VOICE_START_EVENT, { detail: "pick" }));
    startCycle(true);
  };

  if (!target) return null;

  return createPortal(
    <div className={`voice-draft-control-v185 voice-target-pick persistent-pick-voice-v218 phase-${phase} ${armed ? "listening" : ""}`}>
      <button
        type="button"
        className="voice-draft-button-v185 persistent-pick-button-v218"
        aria-label={armed ? "Detener micrófono persistente de picks" : "Activar micrófono persistente de picks"}
        aria-pressed={armed}
        disabled={!supported}
        onClick={toggle}
      >
        <span aria-hidden="true">{phase === "busy" ? "…" : armed ? "●" : "🎙"}</span>
      </button>
      <span className="voice-draft-status-v185 persistent-pick-status-v218" aria-live="polite">{status}</span>
    </div>,
    target,
  );
}
