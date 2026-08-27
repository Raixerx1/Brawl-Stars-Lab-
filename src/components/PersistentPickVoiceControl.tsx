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
type InterimCandidate = { name: string; repeats: number };

const VOICE_START_EVENT = "brawl-draft-lab:voice-start";
const MAX_SLOTS = 6;
const MAX_COMMIT_ATTEMPTS = 3;
const RESTART_AFTER_END_MS = 180;
const RESTART_AFTER_COMMIT_MS = 260;
const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

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
    await sleep(70);
  }
  input.focus();
  input.click();
  input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
  input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  await sleep(90);
  nativeSetInputValue(input, name);
  await sleep(155);
}

async function exactSuggestion(name: string, timeout = 820) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const exact = [...document.querySelectorAll<HTMLButtonElement>(".common-pick-suggestions button")]
      .find((button) => normalizeVoice(button.querySelector("b")?.textContent || "") === normalizeVoice(name));
    if (exact) return exact;
    await sleep(45);
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

async function waitForExpectedPick(name: string, slotIndex: number, timeout = 1750): Promise<CommitOutcome> {
  const target = normalizeVoice(name);
  const started = Date.now();

  while (Date.now() - started < timeout) {
    const entries = pickSlotEntries();
    const value = entries[slotIndex] || "";
    if (normalizeVoice(value) === target) return "added";
    if (value && normalizeVoice(value) !== target) return "wrong";
    if (entries.slice(slotIndex + 1).some(Boolean)) return "wrong";
    await sleep(55);
  }
  return "failed";
}

async function rollbackUnexpected(slotIndex: number) {
  const slot = pickSlots()[slotIndex];
  if (slot?.querySelector("b")) slot.click();
  await sleep(280);
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
      await sleep(220 + attempt * 120);
      continue;
    }

    await prepareInput(input, name);
    const suggestion = await exactSuggestion(name, 620 + attempt * 140);
    if (suggestion) {
      suggestion.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      suggestion.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      suggestion.click();
    } else {
      dispatchEnter(input);
    }

    let outcome = await waitForExpectedPick(name, expectedIndex, 1450 + attempt * 230);
    if (outcome === "added") return { outcome, slotIndex: expectedIndex };

    if (outcome === "wrong") {
      await rollbackUnexpected(expectedIndex);
    } else {
      const retryInput = pickInput();
      if (retryInput) {
        nativeSetInputValue(retryInput, name);
        await sleep(170);
        dispatchEnter(retryInput);
        outcome = await waitForExpectedPick(name, expectedIndex, 1050);
        if (outcome === "added") return { outcome, slotIndex: expectedIndex };
        if (outcome === "wrong") await rollbackUnexpected(expectedIndex);
      }
    }

    const currentInput = pickInput();
    if (currentInput) {
      nativeSetInputValue(currentInput, "");
      currentInput.blur();
    }
    await sleep(260 + attempt * 120);
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

export default function PersistentPickVoiceControl({ roster }: { roster: Brawler[] }) {
  const [target, setTarget] = useState<Element | null>(null);
  const [supported, setSupported] = useState(true);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Activa una vez y di un pick cada vez");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const keepAliveRef = useRef(false);
  const runningRef = useRef(false);
  const processingRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const utteranceCommittedRef = useRef(false);
  const interimCandidateRef = useRef<InterimCandidate>({ name: "", repeats: 0 });

  useEffect(() => {
    const locate = () => setTarget(document.querySelector(".common-pick-search"));
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  const clearRestartTimer = () => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const readyStatus = () => {
    const next = nextPickSlotIndex();
    if (typeof next !== "number") return `✓ ${MAX_SLOTS}/${MAX_SLOTS} picks completos`;
    return `🎙 Micrófono abierto · di el pick ${next + 1}/${MAX_SLOTS}`;
  };

  const resetUtterance = () => {
    utteranceCommittedRef.current = false;
    interimCandidateRef.current = { name: "", repeats: 0 };
  };

  const stopPersistent = (message = "Micrófono de picks detenido") => {
    keepAliveRef.current = false;
    clearRestartTimer();
    generationRef.current += 1;
    setArmed(false);
    setBusy(false);
    setStatus(message);
    try {
      recognitionRef.current?.abort();
    } catch {
      // El reconocimiento puede haberse cerrado ya por el navegador.
    }
  };

  const scheduleRestart = (delay = RESTART_AFTER_END_MS) => {
    if (!keepAliveRef.current || processingRef.current || runningRef.current) return;
    if (typeof nextPickSlotIndex() !== "number") {
      stopPersistent(`✓ ${MAX_SLOTS}/${MAX_SLOTS} picks completos`);
      return;
    }

    clearRestartTimer();
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      if (!keepAliveRef.current || processingRef.current || runningRef.current) return;
      resetUtterance();
      setStatus(readyStatus());
      try {
        recognitionRef.current?.start();
      } catch {
        window.setTimeout(() => scheduleRestart(260), 120);
      }
    }, delay);
  };

  const acceptOneName = async (name: string) => {
    if (!name || processingRef.current || utteranceCommittedRef.current || !keepAliveRef.current) return;
    utteranceCommittedRef.current = true;
    processingRef.current = true;
    setBusy(true);

    if (runningRef.current) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // onend/restart se ocupa de rearmar la escucha.
      }
    }

    const expected = nextPickSlotIndex();
    setStatus(typeof expected === "number"
      ? `He oído ${name} · validando en pick ${expected + 1}/${MAX_SLOTS}…`
      : `Validando ${name}…`);

    const { outcome, slotIndex } = await commitOnePick(name);
    processingRef.current = false;
    setBusy(false);

    if (!keepAliveRef.current) return;

    if (outcome === "added") {
      const completed = pickSlotEntries().filter(Boolean).length;
      if (completed >= MAX_SLOTS) {
        stopPersistent(`✓ ${name} validado · ${MAX_SLOTS}/${MAX_SLOTS} completos`);
        return;
      }
      setStatus(`✓ ${name} en pick ${(slotIndex ?? completed - 1) + 1} · esperando actualización…`);
      await sleep(220);
      if (!keepAliveRef.current) return;
      setStatus(readyStatus());
      scheduleRestart(RESTART_AFTER_COMMIT_MS);
      return;
    }

    if (outcome === "already") {
      setStatus(`${name} ya estaba seleccionado · di otro brawler`);
      scheduleRestart(RESTART_AFTER_COMMIT_MS);
      return;
    }

    setStatus(`No pude validar ${name} · el micro sigue abierto, repite ese pick`);
    scheduleRestart(320);
  };

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    setSupported(Boolean(Recognition));
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "es-ES";
    // Un nombre por ciclo da finales más fiables. onend rearma automáticamente
    // la sesión, de modo que para el usuario el micrófono permanece abierto.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 10;

    recognition.onstart = () => {
      runningRef.current = true;
      if (keepAliveRef.current) {
        setArmed(true);
        if (!processingRef.current) setStatus(readyStatus());
      }
    };

    recognition.onresult = (event) => {
      if (!keepAliveRef.current || processingRef.current || utteranceCommittedRef.current) return;

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
        if (normalizeVoice(interimCandidateRef.current.name) === key) {
          interimCandidateRef.current.repeats += 1;
        } else {
          interimCandidateRef.current = { name: candidate.name, repeats: 1 };
        }
        setStatus(`Oyendo ${candidate.name}…`);
      }

      if (finalName) void acceptOneName(finalName);
    };

    recognition.onerror = (event) => {
      const error = event.error || "unknown";
      runningRef.current = false;

      if (error === "not-allowed" || error === "service-not-allowed") {
        keepAliveRef.current = false;
        setArmed(false);
        setStatus("Permite el micrófono para usar picks por voz");
        return;
      }
      if (error === "audio-capture") {
        keepAliveRef.current = false;
        setArmed(false);
        setStatus("No se puede acceder al micrófono");
        return;
      }
      if (error === "no-speech" || error === "aborted") {
        if (keepAliveRef.current && !processingRef.current) setStatus(readyStatus());
        return;
      }
      if (keepAliveRef.current && !processingRef.current) setStatus(`Voz: ${error} · reintentando…`);
    };

    recognition.onend = () => {
      runningRef.current = false;
      if (!keepAliveRef.current) return;

      if (!processingRef.current && !utteranceCommittedRef.current && interimCandidateRef.current.name) {
        const recovered = interimCandidateRef.current.name;
        void acceptOneName(recovered);
        return;
      }

      if (!processingRef.current) scheduleRestart(RESTART_AFTER_END_MS);
    };

    recognitionRef.current = recognition;

    const stopWhenOtherStarts = (event: Event) => {
      const detail = (event as CustomEvent<"ban" | "pick">).detail;
      if (detail === "pick") return;
      stopPersistent("Micrófono de picks en pausa");
    };
    window.addEventListener(VOICE_START_EVENT, stopWhenOtherStarts);

    return () => {
      window.removeEventListener(VOICE_START_EVENT, stopWhenOtherStarts);
      keepAliveRef.current = false;
      clearRestartTimer();
      try {
        recognition.abort();
      } catch {
        // Sin acción.
      }
    };
  // El roster es estable durante la sesión de Draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  const startPersistent = () => {
    if (!supported || !recognitionRef.current) {
      setStatus("Reconocimiento de voz no disponible en este navegador");
      return;
    }
    if (typeof nextPickSlotIndex() !== "number") {
      setStatus(`✓ ${MAX_SLOTS}/${MAX_SLOTS} picks completos`);
      return;
    }

    generationRef.current += 1;
    keepAliveRef.current = true;
    resetUtterance();
    clearRestartTimer();
    setArmed(true);
    setStatus("Activando micrófono persistente…");
    window.dispatchEvent(new CustomEvent<"pick">(VOICE_START_EVENT, { detail: "pick" }));

    try {
      recognitionRef.current.start();
    } catch {
      scheduleRestart(220);
    }
  };

  if (!target) return null;

  return createPortal(
    <div className={`voice-draft-control-v185 voice-target-pick ${armed ? "listening" : ""} ${busy ? "busy" : ""} ${!supported ? "unsupported" : ""}`}>
      <button
        type="button"
        className="voice-draft-button-v185"
        aria-label={armed ? "Detener micrófono persistente de picks" : "Activar micrófono persistente de picks"}
        aria-pressed={armed}
        disabled={!supported}
        onClick={armed ? () => stopPersistent() : startPersistent}
      >
        <span aria-hidden="true">{armed ? "■" : "🎙"}</span>
      </button>
      <span className="voice-draft-status-v185" aria-live="polite">{status}</span>
    </div>,
    target,
  );
}
