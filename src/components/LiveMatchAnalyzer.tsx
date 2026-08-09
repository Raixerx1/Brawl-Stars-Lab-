"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AutoFeedbackProfile,
  AutoFeedbackVerdict,
  AutoLiveComment,
  AutoReviewHealth,
  AutoReviewSensitivity,
  AutoReviewStatus,
  Brawler,
  LiveEventTone,
  LiveMatchEvent,
  LiveReviewSession,
  MapProfile,
  MatchResult,
  PersonalMatch,
} from "@/lib/types";
import {
  buildLiveSummary,
  formatLiveTime,
  readLiveReviews,
  saveLiveReviews,
} from "@/lib/live-review";
import {
  readMatchHistory,
  saveMatchHistory,
} from "@/lib/performance";
import {
  analyzeFrame,
  createAutoDetectorState,
  detectFrameEvents,
  type FrameMetrics,
} from "@/lib/auto-vision";
import {
  adjustConfidence,
  deriveSequenceInsights,
  feedbackSummary,
  isDetectionSuppressed,
  readAutoFeedback,
  registerAutoFeedback,
  saveAutoFeedback,
} from "@/lib/auto-learning";
import { BrawlerPortrait } from "./GameArtwork";

type CaptureStatus = "idle" | "sharing" | "review";

type EventTemplate = {
  label: string;
  category: string;
  tone: LiveEventTone;
  shortcut: string;
};

const AUTO_SETTINGS_KEY = "brawl-lab:auto-review-settings-v1";
const AUTO_FRAME_WIDTH = 160;
const AUTO_FRAME_HEIGHT = 90;
const AUTO_SAMPLE_MS = 650;

const EVENT_TEMPLATES: EventTemplate[] = [
  { label: "Eliminación", category: "Combate", tone: "good", shortcut: "E" },
  { label: "Muerte", category: "Combate", tone: "bad", shortcut: "M" },
  { label: "Buena rotación", category: "Macro", tone: "good", shortcut: "R" },
  { label: "Sobreextensión", category: "Macro", tone: "bad", shortcut: "X" },
  { label: "Cambio de línea", category: "Líneas", tone: "neutral", shortcut: "L" },
  { label: "Matchup favorable", category: "Líneas", tone: "good", shortcut: "F" },
  { label: "Matchup desfavorable", category: "Líneas", tone: "bad", shortcut: "D" },
  { label: "Super decisiva", category: "Recursos", tone: "good", shortcut: "S" },
  { label: "Super desperdiciada", category: "Recursos", tone: "bad", shortcut: "W" },
  { label: "Hipercarga decisiva", category: "Recursos", tone: "good", shortcut: "H" },
  { label: "Hipercarga desperdiciada", category: "Recursos", tone: "bad", shortcut: "J" },
  { label: "Objetivo ganado", category: "Objetivo", tone: "objective", shortcut: "O" },
  { label: "Objetivo perdido", category: "Objetivo", tone: "bad", shortcut: "P" },
];

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function LiveMatchAnalyzer({
  maps,
  brawlers,
}: {
  maps: MapProfile[];
  brawlers: Brawler[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const detectorStateRef = useRef(createAutoDetectorState());
  const voiceCommentsRef = useRef(false);
  const feedbackProfileRef = useRef<AutoFeedbackProfile>({});
  const emittedSequenceKeysRef = useRef(new Set<string>());
  const lastMotionAtRef = useRef(Date.now());

  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [events, setEvents] = useState<LiveMatchEvent[]>([]);
  const [mapSlug, setMapSlug] = useState(maps[0]?.slug || "");
  const [brawlerName, setBrawlerName] = useState(brawlers[0]?.name || "");
  const [result, setResult] = useState<MatchResult>("Victoria");
  const [note, setNote] = useState("");
  const [customEvent, setCustomEvent] = useState("");
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LiveReviewSession[]>([]);
  const [message, setMessage] = useState("");
  const [savedToLearning, setSavedToLearning] = useState(false);
  const [captureSupported, setCaptureSupported] = useState(false);
  const [autoAnalysis, setAutoAnalysis] = useState(true);
  const [autoSensitivity, setAutoSensitivity] = useState<AutoReviewSensitivity>("Media");
  const [voiceComments, setVoiceComments] = useState(false);
  const [autoStatus, setAutoStatus] = useState<AutoReviewStatus>("idle");
  const [calibration, setCalibration] = useState(0);
  const [autoComments, setAutoComments] = useState<AutoLiveComment[]>([]);
  const [lastMetrics, setLastMetrics] = useState<FrameMetrics | null>(null);
  const [feedbackProfile, setFeedbackProfile] = useState<AutoFeedbackProfile>({});
  const [streamHealth, setStreamHealth] = useState<AutoReviewHealth>("Calibrando");

  useEffect(() => {
    setSessions(readLiveReviews());
    const storedFeedback = readAutoFeedback();
    setFeedbackProfile(storedFeedback);
    feedbackProfileRef.current = storedFeedback;
    setCaptureSupported(Boolean(navigator.mediaDevices?.getDisplayMedia));
    try {
      const stored = JSON.parse(window.localStorage.getItem(AUTO_SETTINGS_KEY) || "{}") as {
        autoAnalysis?: boolean;
        autoSensitivity?: AutoReviewSensitivity;
        voiceComments?: boolean;
      };
      if (typeof stored.autoAnalysis === "boolean") setAutoAnalysis(stored.autoAnalysis);
      if (stored.autoSensitivity && ["Baja", "Media", "Alta"].includes(stored.autoSensitivity)) setAutoSensitivity(stored.autoSensitivity);
      if (typeof stored.voiceComments === "boolean") setVoiceComments(stored.voiceComments);
    } catch {
      // Mantener la configuración por defecto.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(AUTO_SETTINGS_KEY, JSON.stringify({
        autoAnalysis,
        autoSensitivity,
        voiceComments,
      }));
    } catch {
      // El análisis sigue funcionando aunque no se guarden las preferencias.
    }
  }, [autoAnalysis, autoSensitivity, voiceComments]);

  useEffect(() => {
    voiceCommentsRef.current = voiceComments;
  }, [voiceComments]);

  useEffect(() => {
    feedbackProfileRef.current = feedbackProfile;
  }, [feedbackProfile]);

  useEffect(() => {
    if (status !== "sharing") return;
    const interval = window.setInterval(() => {
      if (!startedAtRef.current) return;
      const nextElapsed = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
      elapsedRef.current = nextElapsed;
      setElapsed(nextElapsed);
    }, 250);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (status !== "sharing" || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      const template = EVENT_TEMPLATES.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase());
      if (!template) return;
      event.preventDefault();
      setEvents((current) => [...current, {
        id: crypto.randomUUID(),
        second: elapsed,
        label: template.label,
        category: template.category,
        tone: template.tone,
        source: "Manual",
      }]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [elapsed, status]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const selectedMap = maps.find((map) => map.slug === mapSlug) || maps[0];
  const selectedBrawler = brawlers.find((brawler) => brawler.name === brawlerName) || brawlers[0];
  const summary = useMemo(() => buildLiveSummary(events, elapsed), [events, elapsed]);


  const speakAutoComment = (text: string, confidence: number) => {
    if (!voiceCommentsRef.current || confidence < .68 || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (window.speechSynthesis.speaking) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 1.08;
    utterance.pitch = .96;
    utterance.volume = .88;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (status !== "sharing") {
      setAutoStatus(status === "idle" ? "idle" : "paused");
      return;
    }

    if (!autoAnalysis) {
      setAutoStatus("paused");
      setStreamHealth("Estática");
      return;
    }

    detectorStateRef.current = createAutoDetectorState();
    lastMotionAtRef.current = Date.now();
    setCalibration(0);
    setStreamHealth("Calibrando");
    setAutoStatus("calibrating");

    const canvas = analysisCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = AUTO_FRAME_WIDTH;
    canvas.height = AUTO_FRAME_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    const processFrame = () => {
      if (
        video.readyState < video.HAVE_CURRENT_DATA ||
        !video.videoWidth ||
        !video.videoHeight
      ) return;

      context.drawImage(video, 0, 0, AUTO_FRAME_WIDTH, AUTO_FRAME_HEIGHT);
      const image = context.getImageData(0, 0, AUTO_FRAME_WIDTH, AUTO_FRAME_HEIGHT);
      const detectorState = detectorStateRef.current;
      const { metrics, gray } = analyzeFrame(image, detectorState.previousGray);
      detectorState.previousGray = gray;
      setLastMetrics(metrics);

      if (metrics.motion > .012) lastMotionAtRef.current = Date.now();

      const result = detectFrameEvents(
        detectorState,
        metrics,
        elapsedRef.current,
        selectedMap?.mode || "",
        autoSensitivity,
      );

      setCalibration(result.calibration);
      setAutoStatus(result.status);
      setStreamHealth(
        result.status === "calibrating" ? "Calibrando" :
        Date.now() - lastMotionAtRef.current > 10000 ? "Estática" :
        metrics.motion > .38 ? "Inestable" :
        "Buena",
      );

      if (!result.detections.length) return;

      const detectedEvents: LiveMatchEvent[] = [];
      const detectedComments: AutoLiveComment[] = [];

      for (const detection of result.detections) {
        const adjustedConfidence = adjustConfidence(
          detection.confidence,
          detection.key,
          feedbackProfileRef.current,
        );
        if (isDetectionSuppressed(adjustedConfidence, detection.key, feedbackProfileRef.current)) continue;

        const confidencePercent = Math.round(adjustedConfidence * 100);
        const comment: AutoLiveComment = {
          id: crypto.randomUUID(),
          second: elapsedRef.current,
          text: detection.comment,
          confidence: confidencePercent,
          tone: detection.tone,
          eventLabel: detection.eventLabel,
          autoKey: detection.key,
          kind: "frame",
        };
        detectedComments.push(comment);

        if (detection.eventLabel) {
          detectedEvents.push({
            id: crypto.randomUUID(),
            second: elapsedRef.current,
            label: detection.eventLabel,
            category: detection.category,
            tone: detection.tone,
            source: "Auto",
            confidence: confidencePercent,
            note: detection.comment,
            autoKey: detection.key,
          });
        }

        speakAutoComment(detection.comment, adjustedConfidence);
      }

      if (detectedComments.length) {
        setAutoComments((current) => [...detectedComments, ...current].slice(0, 40));
      }
      if (detectedEvents.length) {
        setEvents((current) => [...current, ...detectedEvents]);
      }
    };

    processFrame();
    const interval = window.setInterval(processFrame, AUTO_SAMPLE_MS);
    return () => window.clearInterval(interval);
  }, [status, autoAnalysis, autoSensitivity, selectedMap?.mode]);

  useEffect(() => {
    if (!autoAnalysis || status === "idle" || events.length < 2) return;

    const insights = deriveSequenceInsights(events, emittedSequenceKeysRef.current);
    if (!insights.length) return;

    const insightComments: AutoLiveComment[] = [];
    const insightEvents: LiveMatchEvent[] = [];

    for (const insight of insights) {
      const autoKey = `sequence:${insight.label}`;
      const adjusted = adjustConfidence(
        insight.confidence / 100,
        autoKey,
        feedbackProfileRef.current,
      );
      if (isDetectionSuppressed(adjusted, autoKey, feedbackProfileRef.current)) continue;

      const confidence = Math.round(adjusted * 100);
      insightComments.push({
        id: crypto.randomUUID(),
        second: insight.second,
        text: insight.comment,
        confidence,
        tone: insight.tone,
        eventLabel: insight.label,
        autoKey,
        kind: "sequence",
      });
      insightEvents.push({
        id: crypto.randomUUID(),
        second: insight.second,
        label: insight.label,
        category: insight.category,
        tone: insight.tone,
        source: "Auto",
        confidence,
        note: insight.comment,
        autoKey,
        sequenceKey: insight.key,
      });
      speakAutoComment(insight.comment, adjusted);
    }

    if (insightComments.length) {
      setAutoComments((current) => [...insightComments, ...current].slice(0, 50));
    }
    if (insightEvents.length) {
      setEvents((current) => [...current, ...insightEvents]);
    }
  }, [events, autoAnalysis, status]);

  const recalibrateAutoReview = () => {
    detectorStateRef.current = createAutoDetectorState();
    lastMotionAtRef.current = Date.now();
    setCalibration(0);
    setLastMetrics(null);
    setStreamHealth("Calibrando");
    setAutoStatus(autoAnalysis && status === "sharing" ? "calibrating" : "paused");
    setMessage("Calibración reiniciada con la imagen actual");
  };

  const resetAutoLearning = () => {
    feedbackProfileRef.current = {};
    setFeedbackProfile({});
    saveAutoFeedback({});
    setAutoComments((current) => current.map((comment) => ({ ...comment, feedback: undefined })));
    setEvents((current) => current.map((event) => ({ ...event, feedback: undefined })));
    setMessage("Aprendizaje de detecciones restaurado");
  };

  const captureFrame = (download = false) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setMessage("Todavía no hay una imagen disponible para capturar");
      return null;
    }

    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", .86);
    setLastFrame(dataUrl);

    if (download) {
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `brawl-live-${formatLiveTime(elapsed).replace(":", "-")}.jpg`;
      anchor.click();
      setMessage("Fotograma guardado en el dispositivo");
    }
    return dataUrl;
  };

  const finishCapture = () => {
    captureFrame(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStreamHealth("Estática");
    setAutoStatus("paused");
    setStatus("review");
    setMessage("Captura finalizada; revisa los eventos automáticos antes de guardar");
  };

  const startCapture = async () => {
    setMessage("");
    setSavedToLearning(false);
    setLastFrame(null);

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMessage("Este navegador no permite compartir pantalla desde la web. Prueba Chrome o Edge en ordenador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const track = stream.getVideoTracks()[0];
      track.addEventListener("ended", () => {
        captureFrame(false);
        streamRef.current = null;
        setStreamHealth("Estática");
        setAutoStatus("paused");
        setStatus("review");
        setMessage("El navegador ha detenido la pantalla compartida");
      });

      startedAtRef.current = Date.now();
      elapsedRef.current = 0;
      detectorStateRef.current = createAutoDetectorState();
      emittedSequenceKeysRef.current = new Set<string>();
      lastMotionAtRef.current = Date.now();
      setStreamHealth("Calibrando");
      setElapsed(0);
      setEvents([]);
      setAutoComments([]);
      setCalibration(0);
      setLastMetrics(null);
      setNote("");
      setAutoStatus(autoAnalysis ? "calibrating" : "paused");
      setStatus("sharing");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setMessage(name === "NotAllowedError"
        ? "No se concedió permiso para compartir la pantalla"
        : "No se pudo iniciar la captura de pantalla");
    }
  };

  const resetSession = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    startedAtRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setAutoStatus("idle");
    setElapsed(0);
    elapsedRef.current = 0;
    detectorStateRef.current = createAutoDetectorState();
    emittedSequenceKeysRef.current = new Set<string>();
    setStreamHealth("Calibrando");
    setEvents([]);
    setAutoComments([]);
    setCalibration(0);
    setLastMetrics(null);
    setNote("");
    setCustomEvent("");
    setLastFrame(null);
    setSavedToLearning(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setMessage("");
  };

  const addEvent = (template: EventTemplate) => {
    setEvents((current) => [...current, {
      id: crypto.randomUUID(),
      second: elapsed,
      label: template.label,
      category: template.category,
      tone: template.tone,
      source: "Manual",
    }]);
  };

  const addCustomEvent = () => {
    const value = customEvent.trim();
    if (!value) return;
    setEvents((current) => [...current, {
      id: crypto.randomUUID(),
      second: elapsed,
      label: value,
      category: "Nota",
      tone: "neutral",
      source: "Manual",
    }]);
    setCustomEvent("");
  };

  const removeEvent = (id: string) => {
    const target = events.find((event) => event.id === id);
    setEvents((current) => current.filter((event) => event.id !== id));
    if (target?.source === "Auto") {
      setAutoComments((current) => current.filter(
        (comment) => !(comment.second === target.second && comment.eventLabel === target.label),
      ));
    }
  };

  const reviewAutoComment = (
    comment: AutoLiveComment,
    verdict: AutoFeedbackVerdict,
  ) => {
    if (comment.feedback) return;
    const key = comment.autoKey || comment.eventLabel || "unknown";
    const nextProfile = registerAutoFeedback(feedbackProfileRef.current, key, verdict);
    feedbackProfileRef.current = nextProfile;
    setFeedbackProfile(nextProfile);
    saveAutoFeedback(nextProfile);

    setAutoComments((current) => current.map((item) =>
      item.id === comment.id ? { ...item, feedback: verdict } : item
    ));

    setEvents((current) => current.flatMap((event) => {
      const associated =
        event.source === "Auto" &&
        event.second === comment.second &&
        event.label === comment.eventLabel;
      if (!associated) return [event];
      if (verdict === "rejected") return [];
      return [{ ...event, feedback: verdict }];
    }));

    setMessage(verdict === "accepted"
      ? "Detección confirmada; se tendrá en cuenta en futuras sesiones"
      : "Falso positivo registrado y eliminado del resumen");
  };

  const currentSession = (): LiveReviewSession | null => {
    if (!selectedMap || !selectedBrawler) return null;
    const sessionAccepted = autoComments.filter((comment) => comment.feedback === "accepted").length;
    const sessionRejected = autoComments.filter((comment) => comment.feedback === "rejected").length;
    return {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      mapSlug: selectedMap.slug,
      mapName: selectedMap.name,
      mode: selectedMap.mode,
      brawler: selectedBrawler.name,
      brawlerSlug: selectedBrawler.slug,
      result,
      duration: elapsed,
      events,
      comments: autoComments,
      autoAnalysis: {
        enabled: autoAnalysis,
        sensitivity: autoSensitivity,
        detections: events.filter((event) => event.source === "Auto").length,
        accepted: sessionAccepted,
        rejected: sessionRejected,
        sequenceInsights: events.filter((event) => Boolean(event.sequenceKey)).length,
      },
      note,
      summary,
    };
  };

  const saveSession = () => {
    const session = currentSession();
    if (!session) return;
    const next = [session, ...sessions].slice(0, 50);
    setSessions(next);
    saveLiveReviews(next);
    setMessage("Live Review guardado localmente");
  };

  const saveToLearning = () => {
    const session = currentSession();
    if (!session || !selectedMap || !selectedBrawler) return;
    const matches = readMatchHistory(maps, brawlers);
    const reviewNote = [
      summary.headline,
      summary.recommendations[0],
      note.trim(),
    ].filter(Boolean).join(" · ");

    const match: PersonalMatch = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      mapSlug: selectedMap.slug,
      mapName: selectedMap.name,
      mode: selectedMap.mode,
      brawler: selectedBrawler.name,
      brawlerSlug: selectedBrawler.slug,
      role: selectedBrawler.role,
      result,
      draftPosition: "Pick intermedio",
      allies: [],
      enemies: [],
      note: reviewNote,
      source: "Live Review",
    };
    saveMatchHistory([match, ...matches].slice(0, 300));
    setSavedToLearning(true);
    setMessage("Resultado añadido al aprendizaje personal");
  };

  const exportCurrent = () => {
    const session = currentSession();
    if (!session) return;
    downloadJson("brawl-live-review.json", session);
    setMessage("Live Review exportado");
  };

  const removeSession = (id: string) => {
    const next = sessions.filter((session) => session.id !== id);
    setSessions(next);
    saveLiveReviews(next);
  };

  const autoEventCount = events.filter((event) => event.source === "Auto").length;
  const sequenceInsightCount = events.filter((event) => Boolean(event.sequenceKey)).length;
  const learnedFeedback = feedbackSummary(feedbackProfile);
  const unreviewedComments = autoComments.filter((comment) => !comment.feedback);
  const latestAutoComment = unreviewedComments[0] || autoComments[0];
  const historyComments = autoComments
    .filter((comment) => comment.id !== latestAutoComment?.id)
    .slice(0, 8);
  const autoStatusText =
    autoStatus === "calibrating" ? `Calibrando ${calibration}%` :
    autoStatus === "active" ? "Analizando fotogramas" :
    autoStatus === "paused" ? "Análisis pausado" :
    "Preparado";
  const motionLevel = lastMetrics ? Math.round(lastMetrics.motion * 100) : 0;

  return <div className="live-review-v8 live-review-v9 live-review-v10">
    <canvas ref={analysisCanvasRef} className="auto-analysis-canvas" aria-hidden="true" />
    {message && <div className="draft-toast">{message}</div>}

    <section className="panel live-setup-v8">
      <div className="section-title">
        <div><span className="eyebrow">Auto Review Beta v0.10</span><h2>Preparar sesión</h2></div>
        <span className={`live-privacy-chip ${status}`}>{status === "sharing" ? `● ${autoStatusText}` : "Procesamiento local"}</span>
      </div>

      <div className="live-setup-grid">
        <label>Mapa<select value={mapSlug} disabled={status === "sharing"} onChange={(event) => setMapSlug(event.target.value)}>
          {maps.map((map) => <option value={map.slug} key={map.slug}>{map.mode} · {map.name}</option>)}
        </select></label>
        <label>Tu brawler<select value={brawlerName} disabled={status === "sharing"} onChange={(event) => setBrawlerName(event.target.value)}>
          {brawlers.map((brawler) => <option value={brawler.name} key={brawler.slug}>{brawler.name} · {brawler.role}</option>)}
        </select></label>
        <label>Resultado<select value={result} onChange={(event) => setResult(event.target.value as MatchResult)}>
          <option>Victoria</option><option>Derrota</option>
        </select></label>
      </div>

      <div className="auto-review-controls-v9">
        <label className="auto-review-toggle">
          <input type="checkbox" checked={autoAnalysis} onChange={(event) => setAutoAnalysis(event.target.checked)} />
          <span><b>Detección automática</b><small>Analiza fotogramas localmente cada 650 ms</small></span>
        </label>
        <label>Sensibilidad<select value={autoSensitivity} onChange={(event) => setAutoSensitivity(event.target.value as AutoReviewSensitivity)}>
          <option>Baja</option><option>Media</option><option>Alta</option>
        </select></label>
        <label className="auto-review-toggle">
          <input type="checkbox" checked={voiceComments} onChange={(event) => setVoiceComments(event.target.checked)} />
          <span><b>Comentarios por voz</b><small>Solo detecciones con confianza suficiente</small></span>
        </label>
        <div className={`auto-review-status status-${autoStatus}`}>
          <span>{autoStatusText}</span>
          <b>{status === "sharing" ? `Captura ${streamHealth.toLowerCase()}` : "Captura no iniciada"}</b>
          <small>{autoEventCount} eventos · movimiento {motionLevel}%</small>
        </div>
      </div>

      <div className="auto-learning-strip-v10">
        <span><b>{unreviewedComments.length}</b> pendientes</span>
        <span><b>{learnedFeedback.accepted}</b> correctas</span>
        <span><b>{learnedFeedback.rejected}</b> falsas</span>
        <span><b>{learnedFeedback.precision ?? "—"}{learnedFeedback.precision !== undefined ? "%" : ""}</b> precisión revisada</span>
        <span><b>{sequenceInsightCount}</b> secuencias</span>
      </div>

      <div className="live-main-actions">
        {status === "idle" && <button type="button" className="primary-button" onClick={startCapture} disabled={!captureSupported}>Compartir pantalla o ventana</button>}
        {status === "sharing" && <button type="button" className="live-stop-button" onClick={finishCapture}>Detener captura</button>}
        {status === "sharing" && autoAnalysis && <button type="button" className="secondary-button" onClick={recalibrateAutoReview}>Recalibrar</button>}
        {learnedFeedback.reviewed > 0 && <button type="button" className="secondary-button" onClick={resetAutoLearning}>Restaurar aprendizaje visual</button>}
        {status !== "idle" && <button type="button" className="secondary-button" onClick={() => captureFrame(true)}>Guardar fotograma</button>}
        {status !== "idle" && <button type="button" className="secondary-button" onClick={resetSession}>Nueva sesión</button>}
      </div>
      <p className="live-privacy-note">La imagen y el análisis de fotogramas permanecen en tu navegador. La aplicación no graba ni envía automáticamente el vídeo. Las detecciones son heurísticas: revisa y elimina los falsos positivos antes de guardar.</p>
    </section>

    <section className="live-workspace-v8">
      <article className="panel live-video-panel">
        <div className="live-video-head">
          <div><span className="eyebrow">Vista en directo</span><h2>{selectedMap?.name || "Partida"}</h2></div>
          <strong>{formatLiveTime(elapsed)}</strong>
        </div>
        <div className={`live-video-frame ${status}`}>
          <video ref={videoRef} muted playsInline />
          {status !== "sharing" && lastFrame && <img src={lastFrame} alt="Último fotograma de la sesión" />}
          {status === "idle" && <div className="live-video-placeholder">
            <b>Comparte Brawl Stars, un emulador o la ventana donde duplicas el móvil</b>
            <span>El navegador te permitirá elegir una pantalla, ventana o pestaña.</span>
          </div>}
          {status === "review" && !lastFrame && <div className="live-video-placeholder"><b>Captura finalizada</b><span>Revisa la cronología y guarda el resultado.</span></div>}
          {status === "sharing" && <span className="live-recording-dot">LIVE</span>}
          {status === "sharing" && autoAnalysis && <span className={`auto-vision-badge ${autoStatus}`}>{autoStatusText}</span>}
        </div>
      </article>

      <article className="panel live-events-panel">
        <div className="live-events-head">
          <div><span className="eyebrow">Marcadores rápidos</span><h2>{events.length} eventos</h2></div>
          {events.length > 0 && <button type="button" onClick={() => setEvents((current) => current.slice(0, -1))}>Deshacer último</button>}
        </div>
        <div className="live-event-buttons">
          {EVENT_TEMPLATES.map((template) => <button
            type="button"
            className={`tone-${template.tone}`}
            key={template.label}
            onClick={() => addEvent(template)}
            disabled={status === "idle"}
            title={`Atajo: ${template.shortcut}`}
          >
            <b>{template.label}</b><small>{template.shortcut}</small>
          </button>)}
        </div>
        <div className="live-custom-event">
          <input value={customEvent} disabled={status === "idle"} onChange={(event) => setCustomEvent(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter") addCustomEvent();
          }} placeholder="Añadir una nota rápida…" />
          <button type="button" onClick={addCustomEvent} disabled={!customEvent.trim()}>Añadir</button>
        </div>
      </article>
    </section>

    <section className="panel auto-comments-panel-v9">
      <div className="section-title">
        <div><span className="eyebrow">Coach automático</span><h2>Comentarios generados en directo</h2></div>
        <span>{unreviewedComments.length} pendientes · {autoComments.length} totales</span>
      </div>

      {latestAutoComment ? <div className={`auto-latest-comment tone-${latestAutoComment.tone} feedback-${latestAutoComment.feedback || "pending"}`}>
        <div>
          <span>{formatLiveTime(latestAutoComment.second)} · confianza {latestAutoComment.confidence}% · {latestAutoComment.kind === "sequence" ? "secuencia táctica" : "fotograma"}</span>
          <b>{latestAutoComment.text}</b>
        </div>
        {latestAutoComment.feedback ? <strong className={`feedback-result ${latestAutoComment.feedback}`}>
          {latestAutoComment.feedback === "accepted" ? "✓ Correcto" : "× Falso positivo"}
        </strong> : <div className="auto-feedback-actions">
          <button type="button" className="accept" onClick={() => reviewAutoComment(latestAutoComment, "accepted")}>Correcto</button>
          <button type="button" className="reject" onClick={() => reviewAutoComment(latestAutoComment, "rejected")}>Falso</button>
        </div>}
      </div> : <div className="auto-comment-empty">
        <b>{autoStatus === "calibrating" ? `Calibrando la imagen: ${calibration}%` : autoAnalysis ? "Esperando un cambio relevante" : "Detección automática desactivada"}</b>
        <span>El sistema analiza fotogramas y combina eventos cercanos para detectar muertes con coste, supers sin conversión y reentradas demasiado rápidas.</span>
      </div>}

      {historyComments.length > 0 && <div className="auto-comment-history">
        {historyComments.map((comment) => <article className={`tone-${comment.tone} feedback-${comment.feedback || "pending"}`} key={comment.id}>
          <time>{formatLiveTime(comment.second)}</time>
          <div><b>{comment.text}</b><small>{comment.eventLabel || "Comentario"} · {comment.confidence}% · {comment.kind === "sequence" ? "Secuencia" : "Frame"}</small></div>
          {comment.feedback ? <span className={`feedback-mini ${comment.feedback}`}>{comment.feedback === "accepted" ? "✓" : "×"}</span> : <div className="auto-feedback-mini-actions">
            <button type="button" onClick={() => reviewAutoComment(comment, "accepted")} aria-label="Marcar detección correcta">✓</button>
            <button type="button" onClick={() => reviewAutoComment(comment, "rejected")} aria-label="Marcar falso positivo">×</button>
          </div>}
        </article>)}
      </div>}
    </section>

    <section className="panel live-timeline-panel">
      <div className="section-title"><div><span className="eyebrow">Cronología</span><h2>Momentos de la partida</h2></div><span>{formatLiveTime(elapsed)}</span></div>
      <div className="live-timeline-list">
        {events.length ? [...events].reverse().map((event) => <article className={`tone-${event.tone}`} key={event.id}>
          <time>{formatLiveTime(event.second)}</time>
          <div><b>{event.label}</b><small>{event.category}{event.source === "Auto" ? ` · Auto ${event.confidence || 0}%${event.sequenceKey ? " · Secuencia" : ""}${event.feedback === "accepted" ? " · Confirmado" : ""}` : " · Manual"}</small></div>
          <button type="button" onClick={() => removeEvent(event.id)} aria-label={`Eliminar ${event.label}`}>×</button>
        </article>) : <div className="empty-state">Los marcadores aparecerán aquí con el segundo exacto de la sesión.</div>}
      </div>
    </section>

    <section className="live-review-grid-v8">
      <article className="panel live-summary-panel">
        <span className="eyebrow">Resumen automático</span>
        <h2>{summary.headline}</h2>
        <div className="live-summary-columns">
          <div><b>Fortalezas</b>{summary.strengths.length ? summary.strengths.map((item) => <span className="good" key={item}>+ {item}</span>) : <small>Sin fortalezas suficientes registradas.</small>}</div>
          <div><b>Errores</b>{summary.mistakes.length ? summary.mistakes.map((item) => <span className="bad" key={item}>− {item}</span>) : <small>Sin errores específicos registrados.</small>}</div>
          <div><b>Próximo foco</b>{summary.recommendations.map((item) => <span key={item}>→ {item}</span>)}</div>
        </div>
      </article>

      <article className="panel live-save-panel">
        <span className="eyebrow">Cerrar revisión</span>
        <h2>Guardar y aprender</h2>
        <label>Nota final<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Qué ocurrió en la primera muerte, por qué cambiaste de línea, qué debes repetir…" /></label>
        <div className="live-save-actions">
          <button type="button" className="primary-button" onClick={saveSession}>Guardar Live Review</button>
          <button type="button" className="secondary-button" onClick={saveToLearning} disabled={savedToLearning}>{savedToLearning ? "Añadido al aprendizaje" : "Enviar a Aprendizaje"}</button>
          <button type="button" className="secondary-button" onClick={exportCurrent}>Exportar JSON</button>
        </div>
      </article>
    </section>

    <section className="panel live-history-panel">
      <div className="section-title"><div><span className="eyebrow">Historial local</span><h2>Últimas revisiones</h2></div><span>{sessions.length}/50</span></div>
      <div className="live-session-list">
        {sessions.slice(0, 10).map((session) => <article key={session.id}>
          <BrawlerPortrait name={session.brawler} className="live-history-avatar" />
          <div><b>{session.brawler} · {session.mapName}</b><small>{session.result || "Sin resultado"} · {formatLiveTime(session.duration)} · {session.events.length} eventos{session.autoAnalysis?.detections ? ` · ${session.autoAnalysis.detections} auto` : ""}{session.autoAnalysis?.sequenceInsights ? ` · ${session.autoAnalysis.sequenceInsights} secuencias` : ""}</small><p>{session.summary.headline}</p></div>
          <button type="button" onClick={() => removeSession(session.id)} aria-label={`Eliminar revisión de ${session.brawler}`}>×</button>
        </article>)}
        {!sessions.length && <div className="empty-state">Las revisiones guardadas aparecerán aquí y permanecerán en este dispositivo.</div>}
      </div>
    </section>
  </div>;
}
