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
type QueueItem = { name: string };

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

function inputSelector(targetMode: VoiceDraftTarget) {
  return targetMode === "ban"
    ? ".draft-picker-ban .draft-search-wrap input:not(:disabled)"
    : ".common-pick-search input:not(:disabled)";
}

function suggestionSelector(targetMode: VoiceDraftTarget) {
  return targetMode === "ban"
    ? ".draft-picker-ban .draft-suggestions button"
    : ".common-pick-suggestions button";
}

async function prepareInput(name: string, targetMode: VoiceDraftTarget) {
  const input = document.querySelector<HTMLInputElement>(inputSelector(targetMode));
  if (!input) return undefined;

  // Tras validar un brawler, React cierra las sugerencias pero el input puede seguir
  // teniendo foco. Forzamos blur y esperamos al onBlur retardado antes de reabrirlo.
  if (document.activeElement === input) {
    input.blur();
    await sleep(155);
  }

  input.focus();
  // React escucha focusin para onFocus; este evento adicional hace el flujo estable
  // en Safari/PWA cuando focus() no vuelve a notificar tras una actualización rápida.
  input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  await sleep(35);
  nativeSetInputValue(input, name);
  return input;
}

async function waitForSuggestion(name: string, targetMode: VoiceDraftTarget, timeout = 1100) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const exact = [...document.querySelectorAll<HTMLButtonElement>(suggestionSelector(targetMode))].find((button) =>
      normalizeVoice(button.querySelector("b")?.textContent || "") === normalizeVoice(name)
    );
    if (exact) return exact;
    await sleep(40);
  }
  return undefined;
}

async function waitForCommit(name: string, targetMode: VoiceDraftTarget, beforeCount: number, timeout = 1700) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const entries = selectedEntries(targetMode);
    if (
      entries.length > beforeCount &&
      entries.some((value) => normalizeVoice(value) === normalizeVoice(name))
    ) return true;
    await sleep(50);
  }
  return false;
}

async function commitVoiceEntry(name: string, targetMode: VoiceDraftTarget) {
  if (hasSelected(name, targetMode)) return "already" as const;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const beforeCount = selectedEntries(targetMode).length;
    const input = await prepareInput(name, targetMode);
    if (!input) return "unavailable" as const;

    const exact = await waitForSuggestion(name, targetMode);
    if (!exact) {
      nativeSetInputValue(input, "");
      input.blur();
      await sleep(170);
      continue;
    }

    // Los pickers de la web validan en onMouseDown. Usamos exactamente la misma ruta
    // que un toque manual y después comprobamos el slot antes de seguir con la cola.
    exact.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    exact.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));

    const committed = await waitForCommit(name, targetMode, beforeCount);
    if (committed) return "added" as const;

    nativeSetInputValue(input, "");
    input.blur();
    await sleep(180 + attempt * 70);
  }

  return "failed" as const;
}

function bestAlternative(result: SpeechResultLike, roster: Brawler[]) {
  let best: { transcript: string; names: string[]; confidence: number } | undefined;
  for (let index = 0; index < result.length; index += 1) {
    const alternative = result[index];
    const names = matchBrawlersInSpeech(alternative.transcript, roster);
    const confidence = alternative.confidence || 0;
    if (!best || names.length > best.names.length || (names.length === best.names.length && confidence > best.confidence)) {
      best = { transcript: alternative.transcript, names, confidence };
    }
  }
  return best;
}

export default function VoiceDraftControlV2({ roster, targetMode }: { roster: Brawler[]; targetMode: VoiceDraftTarget }) {
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

        const current = selectedEntries(targetMode).length;
        if (current >= 6) {
          queueRef.current = [];
          setStatus(targetMode === "ban" ? "Los 6 bans ya están completos" : "Los 6 picks ya están completos");
          break;
        }

        if (hasSelected(item.name, targetMode)) {
          setStatus(`✓ ${item.name} ya estaba introducido · ${queueRef.current.length} pendientes`);
          continue;
        }

        setStatus(`Validando ${current + 1}/6: ${item.name} · ${queueRef.current.length} después`);
        const result = await commitVoiceEntry(item.name, targetMode);
        if (generation !== generationRef.current) break;

        if (result === "added") {
          const after = selectedEntries(targetMode).length;
          setStatus(`✓ ${item.name} validado · ${after}/6${queueRef.current.length ? ` · ahora ${queueRef.current[0].name}` : ""}`);
          await sleep(190);
          continue;
        }

        if (result === "already") {
          setStatus(`✓ ${item.name} ya estaba introducido · ${queueRef.current.length} pendientes`);
          continue;
        }

        setStatus(`No pude validar ${item.name}; continúo con ${queueRef.current[0]?.name || "el siguiente"}`);
        await sleep(160);
      }
    } finally {
      processingRef.current = false;
      setBusy(false);
      if (generation === generationRef.current && keepListeningRef.current && !queueRef.current.length) {
        window.setTimeout(() => {
          if (keepListeningRef.current && !processingRef.current) setStatus(listeningStatus);
        }, 800);
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
    setStatus(`Cola: ${additions.join(" → ")}`);
    void drainQueue(generationRef.current);
  };

  const stopListening = () => {
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
          if (normalizedTranscript === lastTranscriptRef.current.value && now - lastTranscriptRef.current.at < 1800) continue;
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
