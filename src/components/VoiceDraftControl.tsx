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
type QueueSource = "final" | "stable-interim" | "recovery";
type QueueItem = { name: string; retries: number };
type CommitOutcome = "added" | "already" | "wrong" | "failed";
type HeardEvidence = {
  name: string;
  order: number;
  finalWeight: number;
  interimWeight: number;
};
type TranscriptLedgerItem = { transcript: string; isFinal: boolean };

const VOICE_START_EVENT = "brawl-draft-lab:voice-start";
const MAX_SLOTS = 6;
const MAX_COMMIT_ATTEMPTS = 3;
const MAX_QUEUE_RETRIES = 1;
const FAILED_RETRY_COOLDOWN = 2200;
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
  const key = normalizeVoice(name);
  return selectedEntries(targetMode).some((value) => normalizeVoice(value) === key);
}

function inputFor(targetMode: VoiceDraftTarget) {
  const root = targetMode === "ban" ? ".draft-picker-ban" : ".common-pick-search";
  return document.querySelector<HTMLInputElement>(`${root} input:not(:disabled)`);
}

function suggestionSelector(targetMode: VoiceDraftTarget) {
  return targetMode === "ban"
    ? ".draft-picker-ban .draft-suggestions button"
    : ".common-pick-suggestions button";
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
  await sleep(85);
  nativeSetInputValue(input, name);
  await sleep(145);
}

async function exactSuggestion(name: string, targetMode: VoiceDraftTarget, timeout = 650) {
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

function dispatchEnter(input: HTMLInputElement) {
  input.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
  }));
}

async function waitForCommitOutcome(
  name: string,
  targetMode: VoiceDraftTarget,
  before: string[],
  timeout = 1500,
): Promise<CommitOutcome> {
  const target = normalizeVoice(name);
  const beforeSet = new Set(before.map(normalizeVoice));
  const started = Date.now();

  while (Date.now() - started < timeout) {
    const entries = selectedEntries(targetMode);
    if (entries.some((value) => normalizeVoice(value) === target)) return "added";
    if (entries.length > before.length) {
      const unexpected = entries.find((value) => !beforeSet.has(normalizeVoice(value)));
      if (unexpected) return "wrong";
    }
    await sleep(50);
  }
  return "failed";
}

async function rollbackUnexpected(targetMode: VoiceDraftTarget, before: string[]) {
  const beforeSet = new Set(before.map(normalizeVoice));
  const entries = selectedEntries(targetMode);
  const unexpected = entries.find((value) => !beforeSet.has(normalizeVoice(value)));
  if (!unexpected) return;

  if (targetMode === "ban") {
    const button = [...document.querySelectorAll<HTMLButtonElement>(".draft-picker-ban .draft-slot.filled")]
      .find((item) => normalizeVoice(item.querySelector("span")?.textContent || "") === normalizeVoice(unexpected));
    button?.click();
  } else {
    const button = [...document.querySelectorAll<HTMLButtonElement>(".ordered-pick-slot.filled")]
      .find((item) => normalizeVoice(item.querySelector("b")?.textContent || "") === normalizeVoice(unexpected));
    button?.click();
  }
  await sleep(220);
}

async function commitVoiceEntry(name: string, targetMode: VoiceDraftTarget): Promise<CommitOutcome> {
  if (hasSelected(name, targetMode)) return "already";

  for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt += 1) {
    if (hasSelected(name, targetMode)) return "already";
    if (selectedEntries(targetMode).length >= MAX_SLOTS) return "failed";

    const input = inputFor(targetMode);
    if (!input) {
      await sleep(190 + attempt * 95);
      continue;
    }

    const before = selectedEntries(targetMode);
    await prepareInput(input, name);
    const exact = await exactSuggestion(name, targetMode, 480 + attempt * 110);

    if (exact) {
      exact.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      exact.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      exact.click();
    } else {
      dispatchEnter(input);
    }

    let outcome = await waitForCommitOutcome(name, targetMode, before, 1250 + attempt * 220);
    if (outcome === "added") return "added";

    if (outcome === "wrong") {
      await rollbackUnexpected(targetMode, before);
    } else {
      const currentInput = inputFor(targetMode);
      if (currentInput) {
        nativeSetInputValue(currentInput, name);
        await sleep(145);
        dispatchEnter(currentInput);
        outcome = await waitForCommitOutcome(name, targetMode, before, 950);
        if (outcome === "added") return "added";
        if (outcome === "wrong") await rollbackUnexpected(targetMode, before);
      }
    }

    const currentInput = inputFor(targetMode);
    if (currentInput) {
      nativeSetInputValue(currentInput, "");
      currentInput.blur();
    }
    await sleep(220 + attempt * 110);
  }

  return hasSelected(name, targetMode) ? "already" : "failed";
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

function orderedUnique(names: string[]) {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = normalizeVoice(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function VoiceDraftControl({ roster, targetMode }: { roster: Brawler[]; targetMode: VoiceDraftTarget }) {
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
  const queuedKeysRef = useRef(new Set<string>());
  const activeNameRef = useRef<string | null>(null);
  const processingRef = useRef(false);
  const generationRef = useRef(0);
  const failedUntilRef = useRef(new Map<string, number>());
  const finalSignaturesRef = useRef(new Set<string>());
  const stableSignaturesRef = useRef(new Set<string>());
  const interimRef = useRef({ signature: "", repeats: 0 });
  const transcriptLedgerRef = useRef(new Map<number, TranscriptLedgerItem>());
  const heardEvidenceRef = useRef(new Map<string, HeardEvidence>());
  const heardOrderRef = useRef(0);

  useEffect(() => {
    const selector = targetMode === "ban" ? ".draft-picker-ban .draft-search-wrap" : ".common-pick-search";
    const locate = () => setTarget(document.querySelector(selector));
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [targetMode]);

  const resetSessionRefs = () => {
    queueRef.current = [];
    queuedKeysRef.current.clear();
    activeNameRef.current = null;
    failedUntilRef.current.clear();
    finalSignaturesRef.current.clear();
    stableSignaturesRef.current.clear();
    interimRef.current = { signature: "", repeats: 0 };
    transcriptLedgerRef.current.clear();
    heardEvidenceRef.current.clear();
    heardOrderRef.current = 0;
  };

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));

    const stopWhenOtherStarts = (event: Event) => {
      const detail = (event as CustomEvent<VoiceDraftTarget>).detail;
      if (detail === targetMode) return;
      generationRef.current += 1;
      resetSessionRefs();
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
      resetSessionRefs();
      keepListeningRef.current = false;
      recognitionRef.current?.abort();
    };
  }, [targetMode, defaultStatus]);

  const drainQueue = async (generation: number) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setBusy(true);

    try {
      while (generation === generationRef.current && queueRef.current.length) {
        const item = queueRef.current.shift();
        if (!item) break;
        const key = normalizeVoice(item.name);
        queuedKeysRef.current.delete(key);
        activeNameRef.current = item.name;

        if (hasSelected(item.name, targetMode)) {
          activeNameRef.current = null;
          continue;
        }

        const current = selectedEntries(targetMode).length;
        if (current >= MAX_SLOTS) {
          queueRef.current = [];
          queuedKeysRef.current.clear();
          keepListeningRef.current = false;
          recognitionRef.current?.stop();
          setStatus(`✓ ${MAX_SLOTS}/${MAX_SLOTS} completos`);
          break;
        }

        setStatus(`Validando ${current + 1}/${MAX_SLOTS}: ${item.name} · ${queueRef.current.length} pendientes`);
        const outcome = await commitVoiceEntry(item.name, targetMode);
        activeNameRef.current = null;

        if (generation !== generationRef.current) break;

        if (outcome === "added" || outcome === "already") {
          const after = selectedEntries(targetMode).length;
          setStatus(after >= MAX_SLOTS
            ? `✓ ${MAX_SLOTS}/${MAX_SLOTS} completos`
            : `✓ ${item.name} · ${after}/${MAX_SLOTS}${queueRef.current[0] ? ` · ahora ${queueRef.current[0].name}` : ""}`);
          if (after >= MAX_SLOTS) {
            keepListeningRef.current = false;
            recognitionRef.current?.stop();
          }
          await sleep(260);
        } else if (item.retries < MAX_QUEUE_RETRIES && selectedEntries(targetMode).length < MAX_SLOTS) {
          failedUntilRef.current.set(key, Date.now() + 450);
          queueRef.current.push({ ...item, retries: item.retries + 1 });
          queuedKeysRef.current.add(key);
          setStatus(`Reintento reservado para ${item.name} · sigo con la cola`);
          await sleep(280);
        } else {
          failedUntilRef.current.set(key, Date.now() + FAILED_RETRY_COOLDOWN);
          setStatus(`No pude validar ${item.name}; sigo con ${queueRef.current[0]?.name || "el siguiente"}`);
          await sleep(180);
        }
      }
    } finally {
      activeNameRef.current = null;
      processingRef.current = false;
      setBusy(false);

      if (generation === generationRef.current && queueRef.current.length) {
        window.setTimeout(() => void drainQueue(generation), 60);
      } else if (generation === generationRef.current && keepListeningRef.current) {
        const count = selectedEntries(targetMode).length;
        window.setTimeout(() => {
          if (!keepListeningRef.current || processingRef.current) return;
          setStatus(count >= MAX_SLOTS ? `✓ ${MAX_SLOTS}/${MAX_SLOTS} completos` : listeningStatus);
        }, 650);
      }
    }
  };

  const enqueueNames = (rawNames: string[], source: QueueSource) => {
    const names = orderedUnique(rawNames);
    if (!names.length) return;

    const occupiedKeys = new Set(selectedEntries(targetMode).map(normalizeVoice));
    for (const item of queueRef.current) occupiedKeys.add(normalizeVoice(item.name));
    if (activeNameRef.current) occupiedKeys.add(normalizeVoice(activeNameRef.current));

    const remaining = Math.max(0, MAX_SLOTS - occupiedKeys.size);
    if (!remaining) return;

    const accepted: string[] = [];
    for (const name of names) {
      if (accepted.length >= remaining) break;
      const key = normalizeVoice(name);
      const failedUntil = failedUntilRef.current.get(key) || 0;
      if (!key || occupiedKeys.has(key) || queuedKeysRef.current.has(key)) continue;
      if (source !== "final" && failedUntil > Date.now()) continue;
      occupiedKeys.add(key);
      queuedKeysRef.current.add(key);
      accepted.push(name);
    }

    if (!accepted.length) return;
    queueRef.current.push(...accepted.map((name) => ({ name, retries: 0 })));
    const prefix = source === "final" ? "Confirmados" : source === "recovery" ? "Recuperados" : "Estables";
    setStatus(`${prefix}: ${accepted.join(" → ")} · ${queueRef.current.length} en cola`);
    void drainQueue(generationRef.current);
  };

  const recordEvidence = (result: SpeechResultLike) => {
    const counts = new Map<string, { name: string; hits: number }>();
    const best = bestAlternative(result, roster);

    for (let alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex += 1) {
      const names = matchBrawlersInSpeech(result[alternativeIndex].transcript, roster);
      for (const name of names) {
        const key = normalizeVoice(name);
        const current = counts.get(key) || { name, hits: 0 };
        current.hits += 1;
        counts.set(key, current);
      }
    }

    const ordered = orderedUnique([
      ...(best?.names || []),
      ...[...counts.values()].filter((item) => item.hits >= 2).map((item) => item.name),
    ]);

    for (const name of ordered) {
      const key = normalizeVoice(name);
      const consensus = counts.get(key)?.hits || 0;
      const isBest = best?.names.some((candidate) => normalizeVoice(candidate) === key) || false;
      const current = heardEvidenceRef.current.get(key) || {
        name,
        order: heardOrderRef.current++,
        finalWeight: 0,
        interimWeight: 0,
      };
      const weight = (isBest ? 2 : 0) + (consensus >= 2 ? 1 : 0);
      if (result.isFinal) current.finalWeight += Math.max(1, weight);
      else current.interimWeight += Math.max(1, weight);
      heardEvidenceRef.current.set(key, current);
    }
  };

  const recoverHeardNames = () => {
    const names = [...heardEvidenceRef.current.values()]
      .filter((item) => item.finalWeight >= 1 || item.interimWeight >= 2)
      .sort((a, b) => a.order - b.order)
      .map((item) => item.name);
    enqueueNames(names, "recovery");
  };

  const stopListening = () => {
    keepListeningRef.current = false;
    setListening(false);
    recoverHeardNames();
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
    resetSessionRefs();
    window.dispatchEvent(new CustomEvent<VoiceDraftTarget>(VOICE_START_EVENT, { detail: targetMode }));

    let recognition = recognitionRef.current;
    if (!recognition) {
      recognition = new Recognition();
      recognition.lang = "es-ES";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 10;

      recognition.onstart = () => {
        setListening(true);
        if (!processingRef.current) setStatus(listeningStatus);
      };

      recognition.onresult = (event) => {
        let finalChanged = false;

        for (let resultIndex = event.resultIndex; resultIndex < event.results.length; resultIndex += 1) {
          const result = event.results[resultIndex];
          const best = bestAlternative(result, roster);
          if (best?.transcript) {
            transcriptLedgerRef.current.set(resultIndex, {
              transcript: best.transcript,
              isFinal: result.isFinal,
            });
          }
          recordEvidence(result);
          if (result.isFinal) finalChanged = true;
        }

        const ledger = [...transcriptLedgerRef.current.entries()].sort((a, b) => a[0] - b[0]);
        const finalTranscript = ledger
          .filter(([, item]) => item.isFinal)
          .map(([, item]) => item.transcript)
          .join(" ");
        const allTranscript = ledger.map(([, item]) => item.transcript).join(" ");

        if (finalChanged) {
          const finalNames = matchBrawlersInSpeech(finalTranscript, roster);
          const signature = finalNames.map(normalizeVoice).join("|");
          if (signature && !finalSignaturesRef.current.has(signature)) {
            finalSignaturesRef.current.add(signature);
            enqueueNames(finalNames, "final");
          }
        }

        const stableNames = matchBrawlersInSpeech(allTranscript, roster);
        const signature = stableNames.map(normalizeVoice).join("|");
        if (!signature) return;

        if (interimRef.current.signature === signature) {
          interimRef.current.repeats += 1;
        } else {
          interimRef.current = { signature, repeats: 1 };
        }

        if (interimRef.current.repeats >= 2 && !stableSignaturesRef.current.has(signature)) {
          stableSignaturesRef.current.add(signature);
          enqueueNames(stableNames, "stable-interim");
        }
      };

      recognition.onerror = (event) => {
        const error = event.error || "unknown";
        if (error === "no-speech") {
          recoverHeardNames();
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
        recoverHeardNames();
        if (queueRef.current.length && !processingRef.current) void drainQueue(generationRef.current);
        if (!keepListeningRef.current || selectedEntries(targetMode).length >= MAX_SLOTS) return;
        window.setTimeout(() => {
          if (!keepListeningRef.current || selectedEntries(targetMode).length >= MAX_SLOTS) return;
          try {
            recognitionRef.current?.start();
          } catch {
            if (!processingRef.current) setStatus("Toca el micrófono para continuar");
          }
        }, 320);
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
        aria-label={listening || busy
          ? `Detener ${targetMode === "ban" ? "bans" : "picks"} por voz`
          : `Introducir ${targetMode === "ban" ? "bans" : "picks"} por voz`}
        aria-pressed={listening}
        disabled={!supported}
        onClick={listening || busy ? stopListening : startListening}
      >
        <span aria-hidden="true">{listening ? "■" : busy ? "…" : "🎙"}</span>
      </button>
      <span className="voice-draft-status-v185" aria-live="polite">{status}</span>
    </div>,
    target,
  );
}
