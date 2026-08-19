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

export type VoiceDraftTarget = "ban" | "pick";

type QueueItem = {
  name: string;
};

const VOICE_START_EVENT = "brawl-draft-lab:voice-start";
const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function nativeSetInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function selectedEntries(targetMode: VoiceDraftTarget) {
  const selector = targetMode === "ban"
    ? ".draft-picker-ban .draft-slot.filled span"
    : ".ordered-pick-slot.filled b";
  return [...document.querySelectorAll<HTMLElement>(selector)]
    .map((element) => element.textContent?.trim() || "")
    .filter(Boolean);
}

function hasSelected(name: string, targetMode: VoiceDraftTarget) {
  const target = normalizeVoice(name);
  return selectedEntries(targetMode).some((value) => normalizeVoice(value) === target);
}

async function waitForSuggestion(name: string, targetMode: VoiceDraftTarget, timeout = 900) {
  const selector = targetMode === "ban"
    ? ".draft-picker-ban .draft-suggestions button"
    : ".common-pick-suggestions button";
  const started = Date.now();

  while (Date.now() - started < timeout) {
    const exact = [...document.querySelectorAll<HTMLButtonElement>(selector)].find((button) =>
      normalizeVoice(button.querySelector("b")?.textContent || "") === normalizeVoice(name)
    );
    if (exact) return exact;
    await sleep(35);
  }
  return undefined;
}

async function waitForCommit(
  name: string,
  targetMode: VoiceDraftTarget,
  beforeCount: number,
  timeout = 1300,
) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const entries = selectedEntries(targetMode);
    if (
      entries.length > beforeCount &&
      entries.some((value) => normalizeVoice(value) === normalizeVoice(name))
    ) return true;
    await sleep(45);
  }
  return false;
}

async function commitVoiceEntry(name: string, targetMode: VoiceDraftTarget) {
  if (hasSelected(name, targetMode)) return false;

  const rootSelector = targetMode === "ban" ? ".draft-picker-ban" : ".common-pick-search";
  const input = document.querySelector<HTMLInputElement>(`${rootSelector} input:not(:disabled)`);
  if (!input) return false;

  const beforeCount = selectedEntries(targetMode).length;
  input.focus();
  nativeSetInputValue(input, name);

  const exact = await waitForSuggestion(name, targetMode);
  if (!exact) {
    nativeSetInputValue(input, "");
    return false;
  }

  // Los pickers existentes usan onMouseDown. Dispararlo conserva exactamente la misma
  // validación de bans, duplicados y huecos que la entrada manual.
  exact.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
  exact.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));

  const committed = await waitForCommit(name, targetMode, beforeCount);
  if (!committed) nativeSetInputValue(input, "");
  return committed;
}

function bestAlternative(result: SpeechResultLike, roster: Brawler[]) {
  let best: { transcript: string; names: string[]; confidence: number } | undefined;
  for (let index = 0; index < result.length; index += 1) {
    const alternative = result[index];
    const names = matchBrawlersInSpeech(alternative.transcript, roster);
    const confidence = alternative.confidence || 0;
    if (
      !best ||
      names.length > best.names.length ||
      (names.length === best.names.length && confidence > best.confidence)
    ) {
      best = { transcript: alternative.transcript, names, confidence };
    }
  }
  return best;
}

export default function VoiceDraftControl({
  roster,
  targetMode,
}: {
  roster: Brawler[];
  targetMode: VoiceDraftTarget;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const defaultStatus = targetMode === "ban" ? "Di los bans" : "Di los picks";
  const listeningStatus = targetMode === "ban" ? "Escuchando bans…" : "Escuchando picks…";
  const [status, setStatus] = useState(defaultStatus);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const keepListeningRef = useRef(false);
  const lastTranscriptRef = useRef({ value: "", at: 0 });
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const generationRef = useRef(0);

  useEffect(() => {
    const selector = targetMode === "ban" ? ".draft-picker-ban .draft-search-wrap" : ".common-pick-search";
    const locate = () => setTarget(document.querySelector(selector));
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [targetMode]);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));

    const stopWhenOtherStarts = (event: Event) => {
      const detail = (event as CustomEvent<VoiceDraftTarget>).detail;
      if (detail === targetMode) return;
      generationRef.current += 1;
      queueRef.current = [];
      keepListeningRef.current = false;
      recognitionRef.current?.abort();
      setListening(false);
      setBusy(false);
      setStatus(defaultStatus);
    };
    window.addEventListener(VOICE_START_EVENT, stopWhenOtherStarts);

    return () => {
      window.removeEventListener(VOICE_START_EVENT, stopWhenOtherStarts);
      generationRef.current += 1;
      queueRef.current = [];
      keepListeningRef.current = false;
      recognitionRef.current?.abort();
    };
  }, [targetMode, defaultStatus]);

  const drainQueue = async (generation: number) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setBusy(true);

    try {
      while (queueRef.current.length && generation === generationRef.current) {
        const item = queueRef.current.shift();
        if (!item) break;

        if (hasSelected(item.name, targetMode)) {
          setStatus(`${item.name} ya estaba introducido · ${queueRef.current.length} pendientes`);
          continue;
        }

        const current = selectedEntries(targetMode).length;
        const max = 6;
        if (current >= max) {
          queueRef.current = [];
          setStatus(targetMode === "ban" ? "Los 6 bans ya están completos" : "Los 6 picks ya están completos");
          break;
        }

        setStatus(`Añadiendo ${targetMode === "ban" ? "ban" : "pick"} ${current + 1}/${max}: ${item.name}…`);
        const added = await commitVoiceEntry(item.name, targetMode);

        if (generation !== generationRef.current) break;

        if (added) {
          const after = selectedEntries(targetMode).length;
          setStatus(`✓ ${item.name} · ${after}/${max}${queueRef.current.length ? ` · ${queueRef.current.length} pendientes` : ""}`);
          // Pequeña pausa deliberada: deja que la UI recalcule unavailable/siguiente turno.
          await sleep(120);
        } else {
          setStatus(`Omitido ${item.name}: ya usado, baneado o no disponible · ${queueRef.current.length} pendientes`);
          await sleep(90);
        }
      }
    } finally {
      processingRef.current = false;
      setBusy(false);
      if (generation === generationRef.current && keepListeningRef.current && !queueRef.current.length) {
        window.setTimeout(() => {
          if (keepListeningRef.current && !processingRef.current) setStatus(listeningStatus);
        }, 700);
      }
    }
  };

  const enqueueNames = (names: string[]) => {
    const selected = new Set(selectedEntries(targetMode).map(normalizeVoice));
    const queued = new Set(queueRef.current.map((item) => normalizeVoice(item.name)));
    const additions = names.filter((name, index) =>
      names.findIndex((other) => normalizeVoice(other) === normalizeVoice(name)) === index &&
      !selected.has(normalizeVoice(name)) &&
      !queued.has(normalizeVoice(name))
    );

    if (!additions.length) {
      setStatus("Los nombres reconocidos ya estaban introducidos");
      return;
    }

    queueRef.current.push(...additions.map((name) => ({ name })));
    setStatus(`Oídos ${additions.length}: ${additions.join(" → ")}`);
    void drainQueue(generationRef.current);
  };

  const stopListening = () => {
    // Detiene nuevas transcripciones, pero deja terminar la cola ya pronunciada.
    keepListeningRef.current = false;
    setListening(false);
    if (!processingRef.current) setStatus("Voz detenida");
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

    generationRef.current += 1;
    queueRef.current = [];
    lastTranscriptRef.current = { value: "", at: 0 };
    window.dispatchEvent(new CustomEvent<VoiceDraftTarget>(VOICE_START_EVENT, { detail: targetMode }));

    let recognition = recognitionRef.current;
    if (!recognition) {
      recognition = new Recognition();
      recognition.lang = "es-ES";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 8;

      recognition.onstart = () => {
        setListening(true);
        if (!processingRef.current) setStatus(listeningStatus);
      };

      recognition.onresult = (event) => {
        for (let resultIndex = event.resultIndex; resultIndex < event.results.length; resultIndex += 1) {
          const result = event.results[resultIndex];
          if (!result.isFinal) continue;
          const alternative = bestAlternative(result, roster);
          if (!alternative) continue;

          const now = Date.now();
          const normalizedTranscript = normalizeVoice(alternative.transcript);
          if (
            normalizedTranscript === lastTranscriptRef.current.value &&
            now - lastTranscriptRef.current.at < 1800
          ) continue;
          lastTranscriptRef.current = { value: normalizedTranscript, at: now };

          if (!alternative.names.length) {
            setStatus(`No reconocí un brawler en “${alternative.transcript}”`);
            continue;
          }

          enqueueNames(alternative.names);
        }
      };

      recognition.onerror = (event) => {
        const error = event.error || "unknown";
        if (error === "no-speech") {
          if (!processingRef.current) setStatus(targetMode === "ban" ? "No oí ningún ban. Sigo escuchando…" : "No oí ningún pick. Sigo escuchando…");
          return;
        }
        if (error === "not-allowed" || error === "service-not-allowed") {
          keepListeningRef.current = false;
          setListening(false);
          setStatus("Permite el micrófono para usar la entrada por voz");
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
            if (!processingRef.current) setStatus("Toca el micrófono para continuar");
          }
        }, 180);
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
    <div className={`voice-draft-control-v185 voice-target-${targetMode} ${listening ? "listening" : ""} ${busy ? "busy" : ""} ${!supported ? "unsupported" : ""}`}>
      <button
        type="button"
        className="voice-draft-button-v185"
        aria-label={listening
          ? `Detener ${targetMode === "ban" ? "bans" : "picks"} por voz`
          : `Introducir ${targetMode === "ban" ? "bans" : "picks"} por voz`}
        aria-pressed={listening}
        disabled={!supported}
        onClick={listening ? stopListening : startListening}
      >
        <span aria-hidden="true">{listening ? "■" : busy ? "…" : "🎙"}</span>
      </button>
      <span className="voice-draft-status-v185" aria-live="polite">{status}</span>
    </div>,
    target,
  );
}
