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
const MAX_SLOTS = 6;
const MAX_COMMIT_ATTEMPTS = 3;
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

function inputFor(targetMode: VoiceDraftTarget) {
  const rootSelector = targetMode === "ban" ? ".draft-picker-ban" : ".common-pick-search";
  return document.querySelector<HTMLInputElement>(`${rootSelector} input:not(:disabled)`);
}

function suggestionSelector(targetMode: VoiceDraftTarget) {
  return targetMode === "ban"
    ? ".draft-picker-ban .draft-suggestions button"
    : ".common-pick-suggestions button";
}

async function reopenSearch(input: HTMLInputElement) {
  // React cierra el desplegable tras cada alta. En iPhone el input puede seguir siendo
  // document.activeElement, así que focus() por sí solo no vuelve a disparar onFocus.
  if (document.activeElement === input) {
    input.blur();
    await sleep(45);
  }
  input.focus();
  input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
  input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  await sleep(55);
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

async function waitForCommit(
  name: string,
  targetMode: VoiceDraftTarget,
  beforeCount: number,
  timeout = 1600,
) {
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
  if (hasSelected(name, targetMode)) return true;

  for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt += 1) {
    if (hasSelected(name, targetMode)) return true;
    const beforeCount = selectedEntries(targetMode).length;
    if (beforeCount >= MAX_SLOTS) return false;

    const input = inputFor(targetMode);
    if (!input) {
      await sleep(140);
      continue;
    }

    nativeSetInputValue(input, "");
    await reopenSearch(input);
    nativeSetInputValue(input, name);

    const exact = await waitForSuggestion(name, targetMode, 850 + attempt * 180);
    if (!exact) {
      nativeSetInputValue(input, "");
      await sleep(120 + attempt * 70);
      continue;
    }

    // Los pickers existentes confirman con onMouseDown. Usamos la misma ruta que el toque manual.
    exact.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    exact.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    exact.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

    const committed = await waitForCommit(name, targetMode, beforeCount);
    if (committed) {
      await sleep(150);
      return true;
    }

    const currentInput = inputFor(targetMode);
    if (currentInput) nativeSetInputValue(currentInput, "");
    await sleep(150 + attempt * 80);
  }

  return hasSelected(name, targetMode);
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
  const defaultStatus = targetMode === "ban" ? "Di hasta 6 bans seguidos" : "Di hasta 6 picks seguidos";
  const listeningStatus = targetMode === "ban" ? "Escuchando bans…" : "Escuchando picks…";
  const [status, setStatus] = useState(defaultStatus);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const keepListeningRef = useRef(false);
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const generationRef = useRef(0);
  const sessionSeenRef = useRef(new Set<string>());
  const activeNameRef = useRef<string | null>(null);
  const recognizedOrderRef = useRef<string[]>([]);

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
      activeNameRef.current = null;
      sessionSeenRef.current.clear();
      recognizedOrderRef.current = [];
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
      activeNameRef.current = null;
      keepListeningRef.current = false;
      recognitionRef.current?.abort();
    };
  }, [targetMode, defaultStatus]);

  const drainQueue = async (generation: number) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setBusy(true);

    try {
      while (generation === generationRef.current) {
        const item = queueRef.current.shift();
        if (!item) break;

        activeNameRef.current = item.name;

        if (hasSelected(item.name, targetMode)) {
          activeNameRef.current = null;
          continue;
        }

        const current = selectedEntries(targetMode).length;
        if (current >= MAX_SLOTS) {
          queueRef.current = [];
          setStatus(targetMode === "ban" ? "✓ Los 6 bans están completos" : "✓ Los 6 picks están completos");
          break;
        }

        setStatus(`Validando ${current + 1}/${MAX_SLOTS}: ${item.name} · ${queueRef.current.length} en cola`);
        const added = await commitVoiceEntry(item.name, targetMode);
        activeNameRef.current = null;

        if (generation !== generationRef.current) break;

        if (added) {
          const after = selectedEntries(targetMode).length;
          const nextName = queueRef.current[0]?.name;
          setStatus(
            after >= MAX_SLOTS
              ? `✓ ${MAX_SLOTS}/${MAX_SLOTS} completos`
              : `✓ ${item.name} validado · ${after}/${MAX_SLOTS}${nextName ? ` · ahora ${nextName}` : ""}`
          );
          await sleep(180);
        } else {
          setStatus(`No pude validar ${item.name} tras ${MAX_COMMIT_ATTEMPTS} intentos; continúo con el siguiente`);
          await sleep(150);
        }
      }
    } finally {
      activeNameRef.current = null;
      processingRef.current = false;
      setBusy(false);
      if (generation === generationRef.current && queueRef.current.length) {
        // Si llegaron nuevos nombres justo al terminar el bucle, no dependemos de otro onresult.
        window.setTimeout(() => void drainQueue(generation), 30);
      } else if (generation === generationRef.current && keepListeningRef.current) {
        const current = selectedEntries(targetMode).length;
        window.setTimeout(() => {
          if (!keepListeningRef.current || processingRef.current) return;
          setStatus(current >= MAX_SLOTS ? `✓ ${MAX_SLOTS}/${MAX_SLOTS} completos` : listeningStatus);
        }, 650);
      }
    }
  };

  const enqueueNames = (names: string[]) => {
    if (!names.length) return;

    const selected = new Set(selectedEntries(targetMode).map(normalizeVoice));
    const queued = new Set(queueRef.current.map((item) => normalizeVoice(item.name)));
    const active = activeNameRef.current ? normalizeVoice(activeNameRef.current) : "";
    const additions: string[] = [];

    for (const name of names) {
      const key = normalizeVoice(name);
      if (!key || selected.has(key) || queued.has(key) || active === key || sessionSeenRef.current.has(key)) continue;
      sessionSeenRef.current.add(key);
      recognizedOrderRef.current.push(name);
      additions.push(name);
    }

    if (!additions.length) return;

    const freeSlots = Math.max(0, MAX_SLOTS - selectedEntries(targetMode).length - queueRef.current.length - (activeNameRef.current ? 1 : 0));
    if (!freeSlots) return;
    const accepted = additions.slice(0, freeSlots);
    queueRef.current.push(...accepted.map((name) => ({ name })));

    setStatus(`Reconocidos: ${recognizedOrderRef.current.slice(0, MAX_SLOTS).join(" → ")} · procesando ${selectedEntries(targetMode).length + 1}/${MAX_SLOTS}`);
    void drainQueue(generationRef.current);
  };

  const stopListening = () => {
    // No borra la cola: dejar de escuchar no debe truncar los nombres ya reconocidos.
    keepListeningRef.current = false;
    setListening(false);
    if (!processingRef.current && !queueRef.current.length) setStatus("Voz detenida");
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
    activeNameRef.current = null;
    sessionSeenRef.current.clear();
    recognizedOrderRef.current = [];
    window.dispatchEvent(new CustomEvent<VoiceDraftTarget>(VOICE_START_EVENT, { detail: targetMode }));

    let recognition = recognitionRef.current;
    if (!recognition) {
      recognition = new Recognition();
      recognition.lang = "es-ES";
      recognition.continuous = true;
      // Clave para listas largas en WebKit/iPhone: capturamos nombres antes de que la frase se cierre.
      recognition.interimResults = true;
      recognition.maxAlternatives = 8;

      recognition.onstart = () => {
        setListening(true);
        if (!processingRef.current) setStatus(listeningStatus);
      };

      recognition.onresult = (event) => {
        // Recorremos toda la hipótesis disponible, no solo los resultados finales nuevos.
        // sessionSeenRef evita duplicados cuando WebKit reescribe la misma frase provisional.
        for (let resultIndex = 0; resultIndex < event.results.length; resultIndex += 1) {
          const result = event.results[resultIndex];
          const alternative = bestAlternative(result, roster);
          if (!alternative?.names.length) continue;
          enqueueNames(alternative.names);
        }
      };

      recognition.onerror = (event) => {
        const error = event.error || "unknown";
        if (error === "no-speech") {
          if (!processingRef.current) setStatus(targetMode === "ban" ? "No oí más bans. Sigo escuchando…" : "No oí más picks. Sigo escuchando…");
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
        if (!processingRef.current) setStatus(`Voz: ${error}`);
      };

      recognition.onend = () => {
        setListening(false);
        // Un cierre de WebKit nunca cancela la cola ya reconocida.
        if (queueRef.current.length && !processingRef.current) void drainQueue(generationRef.current);
        if (!keepListeningRef.current) return;
        window.setTimeout(() => {
          if (!keepListeningRef.current) return;
          try {
            recognitionRef.current?.start();
          } catch {
            if (!processingRef.current) setStatus("Toca el micrófono para continuar");
          }
        }, 240);
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
