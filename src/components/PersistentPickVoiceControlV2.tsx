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

function pickSlotEntries() {
  return pickSlots().map((slot) => slot.querySelector("b")?.textContent?.trim() || "");
}

function nextPickSlotIndex() {
  const index = pickSlotEntries().findIndex((value) => !value);
  return index >= 0 ? index : undefined;
}

function hasSelected(name: string) {
  const key = normalizeVoice(name);
  return pickSlotEntries().some((value) => normalizeVoice(value) === key);
}

function pickInput() {
  return document.querySelector<HTMLInputElement>(".common-pick-search input:not(:disabled)");
}

async function prepareInput(input: HTMLInputElement, name: string) {
  nativeSetInputValue(input, "");
  if (document.activeElement === input) {
    input.blur();
    await sleep(55);
  }
  input.focus();
  input.click();
  input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
  input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  await sleep(80);
  nativeSetInputValue(input, name);
  await sleep(140);
}

async function exactSuggestion(name: string, timeout = 780) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const exact = [...document.querySelectorAll<HTMLButtonElement>(".common-pick-suggestions button")]
      .find((button) => normalizeVoice(button.querySelector("b")?.textContent || "") === normalizeVoice(name));
    if (exact) return exact;
    await sleep(40);
  }
  return undefined;
}

function dispatchEnter(input: HTMLInputElement) {
  input.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
  }));
}

async function waitForExpectedPick(name: string, slotIndex: number, timeout = 1700): Promise<CommitOutcome> {
  const target = normalizeVoice(name);
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const entries = pickSlotEntries();
    const value = entries[slotIndex] || "";
    if (normalizeVoice(value) === target) return "added";
    if (value && normalizeVoice(value) !== target) return "wrong";
    if (entries.slice(slotIndex + 1).some(Boolean)) return "wrong";
    await sleep(50);
  }
  return "failed";
}

async function rollbackUnexpected(slotIndex: number) {
  const slot = pickSlots()[slotIndex];
  if (slot?.querySelector("b")) slot.click();
  await sleep(240);
}

async function commitOnePick(name: string): Promise<{ outcome: CommitOutcome; slotIndex?: number }> {
  if (hasSelected(name)) return { outcome: "already" };
  const expectedIndex = nextPickSlotIndex();
  if (typeof expectedIndex !== "number") return { outcome: "failed" };

  for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt += 1) {
    const currentValue = pickSlotEntries()[expectedIndex] || "";
    if (normalizeVoice(currentValue) === normalizeVoice(name)) return { outcome: "added", slotIndex: expectedIndex };
    if (currentValue) await rollbackUnexpected(expectedIndex);

    const input = pickInput();
    if (!input) {
      await sleep(180 + attempt * 100);
      continue;
    }

    await prepareInput(input, name);
    const suggestion = await exactSuggestion(name, 560 + attempt * 130);
    if (suggestion) {
      suggestion.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      suggestion.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      suggestion.click();
    } else {
      dispatchEnter(input);
    }

    let outcome = await waitForExpectedPick(name, expectedIndex, 1350 + attempt * 230);
    if (outcome === "added") return { outcome, slotIndex: expectedIndex };
    if (outcome === "wrong") {
      await rollbackUnexpected(expectedIndex);
    } else {
      const retryInput = pickInput();
      if (retryInput) {
        nativeSetInputValue(retryInput, name);
        await sleep(150);
        dispatchEnter(retryInput);
        outcome = await waitForExpectedPick(name, expectedIndex, 950);
        if (outcome === "added") return { outcome, slotIndex: expectedIndex };
        if (outcome === "wrong") await rollbackUnexpected(expectedIndex);
      }
    }
    await sleep(210 + attempt * 100);
  }

  return { outcome: "failed", slotIndex: expectedIndex };
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
  return best;
}

export default function PersistentPickVoiceControlV2({ roster }: { roster: Brawler[] }) {
  const [target, setTarget] = useState<Element | null>(null);
  const [supported, setSupported] = useState(true);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Pulsa una vez: el micro queda abierto para los 6 picks");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const armedRef = useRef(false);
  const runningRef = useRef(false);
  const processingRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const interimRef = useRef({ name: "", repeats: 0 });
  const acceptedThisCycleRef = useRef(false);

  useEffect(() => {
    const locate = () => setTarget(document.querySelector(".common-pick-search"));
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { subtree: true, childList: true });

    const speechWindow = window as SpeechWindow;
    setSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));

    return () => {
      observer.disconnect();
      armedRef.current = false;
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      try { recognitionRef.current?.abort(); } catch { /* no-op */ }
    };
  }, []);

  const readyStatus = () => {
    const next = nextPickSlotIndex();
    return typeof next === "number"
      ? `🎙 Micro abierto · di el pick ${next + 1}/${MAX_SLOTS}`
      : `✓ ${MAX_SLOTS}/${MAX_SLOTS} picks completos`;
  };

  const clearRestart = () => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const stopPersistent = (message = "Micrófono de picks detenido") => {
    armedRef.current = false;
    clearRestart();
    setArmed(false);
    setBusy(false);
    setStatus(message);
    try { recognitionRef.current?.abort(); } catch { /* no-op */ }
  };

  const resetCycle = () => {
    acceptedThisCycleRef.current = false;
    interimRef.current = { name: "", repeats: 0 };
  };

  const scheduleRestart = (delay = 220) => {
    if (!armedRef.current || processingRef.current || runningRef.current) return;
    if (typeof nextPickSlotIndex() !== "number") {
      stopPersistent(`✓ ${MAX_SLOTS}/${MAX_SLOTS} picks completos`);
      return;
    }

    clearRestart();
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      if (!armedRef.current || processingRef.current || runningRef.current) return;
      resetCycle();
      setStatus(readyStatus());
      try {
        recognitionRef.current?.start();
      } catch {
        scheduleRestart(360);
      }
    }, delay);
  };

  const acceptOneName = async (name: string) => {
    if (!name || !armedRef.current || processingRef.current || acceptedThisCycleRef.current) return;
    acceptedThisCycleRef.current = true;
    processingRef.current = true;
    setBusy(true);

    if (runningRef.current) {
      try { recognitionRef.current?.stop(); } catch { /* onend rearma */ }
    }

    const expected = nextPickSlotIndex();
    setStatus(typeof expected === "number"
      ? `He oído ${name} · validando pick ${expected + 1}/${MAX_SLOTS}…`
      : `Validando ${name}…`);

    const { outcome, slotIndex } = await commitOnePick(name);
    processingRef.current = false;
    setBusy(false);

    if (!armedRef.current) return;
    if (outcome === "added") {
      const completed = pickSlotEntries().filter(Boolean).length;
      if (completed >= MAX_SLOTS) {
        stopPersistent(`✓ ${name} validado · ${MAX_SLOTS}/${MAX_SLOTS} completos`);
        return;
      }
      setStatus(`✓ ${name} en pick ${(slotIndex ?? completed - 1) + 1} · preparando siguiente…`);
      await sleep(180);
      scheduleRestart(180);
      return;
    }
    if (outcome === "already") {
      setStatus(`${name} ya estaba elegido · di otro brawler`);
      scheduleRestart(220);
      return;
    }
    setStatus(`No pude validar ${name} · repítelo; el micro sigue abierto`);
    scheduleRestart(260);
  };

  const wireRecognition = (recognition: SpeechRecognitionLike) => {
    recognition.lang = "es-ES";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 10;

    recognition.onstart = () => {
      runningRef.current = true;
      setArmed(true);
      if (armedRef.current && !processingRef.current) setStatus(readyStatus());
    };

    recognition.onresult = (event) => {
      if (!armedRef.current || processingRef.current || acceptedThisCycleRef.current) return;
      let finalName = "";
      for (let resultIndex = event.resultIndex; resultIndex < event.results.length; resultIndex += 1) {
        const result = event.results[resultIndex];
        const candidate = bestSingleName(result, roster);
        if (!candidate?.name) continue;
        if (result.isFinal) {
          finalName = candidate.name;
          break;
        }
        const key = normalizeVoice(candidate.name);
        if (normalizeVoice(interimRef.current.name) === key) interimRef.current.repeats += 1;
        else interimRef.current = { name: candidate.name, repeats: 1 };
        setStatus(`Oyendo ${candidate.name}…`);
      }
      if (finalName) void acceptOneName(finalName);
    };

    recognition.onerror = (event) => {
      runningRef.current = false;
      const error = event.error || "unknown";
      if (error === "not-allowed" || error === "service-not-allowed") {
        armedRef.current = false;
        setArmed(false);
        setStatus("Permite el micrófono para usar picks por voz");
        return;
      }
      if (error === "audio-capture") {
        armedRef.current = false;
        setArmed(false);
        setStatus("No se puede acceder al micrófono");
        return;
      }
      if (armedRef.current && !processingRef.current && error !== "aborted") scheduleRestart(260);
    };

    recognition.onend = () => {
      runningRef.current = false;
      if (!armedRef.current || processingRef.current) return;
      if (!acceptedThisCycleRef.current && interimRef.current.name && interimRef.current.repeats >= 1) {
        void acceptOneName(interimRef.current.name);
        return;
      }
      scheduleRestart(180);
    };
  };

  const ensureRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) return null;
    const recognition = new Recognition();
    wireRecognition(recognition);
    recognitionRef.current = recognition;
    return recognition;
  };

  const startPersistent = () => {
    if (typeof nextPickSlotIndex() !== "number") {
      setStatus(`✓ ${MAX_SLOTS}/${MAX_SLOTS} picks completos`);
      return;
    }
    const recognition = ensureRecognition();
    if (!recognition) {
      setSupported(false);
      setStatus("Reconocimiento de voz no disponible en este navegador");
      return;
    }

    window.dispatchEvent(new CustomEvent<"pick">(VOICE_START_EVENT, { detail: "pick" }));
    armedRef.current = true;
    setArmed(true);
    resetCycle();
    clearRestart();
    setStatus("Activando micrófono de picks…");
    try {
      recognition.start();
    } catch {
      scheduleRestart(280);
    }
  };

  const toggleFromPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (armedRef.current) stopPersistent();
    else startPersistent();
  };

  const toggleFromKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (armedRef.current) stopPersistent();
    else startPersistent();
  };

  if (!target) return null;

  return createPortal(
    <div className={`voice-draft-control-v185 voice-target-pick persistent-pick-voice-v216 ${armed ? "listening" : ""} ${busy ? "busy" : ""} ${!supported ? "unsupported" : ""}`}>
      <button
        type="button"
        className="voice-draft-button-v185"
        aria-label={armed ? "Detener micrófono persistente de picks" : "Activar micrófono persistente de picks"}
        aria-pressed={armed}
        disabled={!supported}
        onPointerDown={toggleFromPointer}
        onKeyDown={toggleFromKeyboard}
      >
        <span aria-hidden="true">{armed ? "■" : busy ? "…" : "🎙"}</span>
      </button>
      <span className="voice-draft-status-v185" aria-live="polite">{status}</span>
    </div>,
    target,
  );
}
