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
  { label: "EliminaciÃ³n", category: "Combate", tone: "good", shortcut: "E" },
  { label: "Muerte", category: "Combate", tone: "bad", shortcut: "M" },
  { label: "Buena rotaciÃ³n", category: "Macro", tone: "good", shortcut: "R" },
  { label: "SobreextensiÃ³n", category: "Macro", tone: "bad", shortcut: "X" },
  { label: "Cambio de lÃ­nea", category: "LÃ­neas", tone: "neutral", shortcut: "L" },
  { label: "Matchup favorable", category: "LÃ­neas", tone: "good", shortcut: "F" },
  { label: "Matchup desfavorable", category: "LÃ­neas", tone: "bad", shortcut: "D" },
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
  const lastMotionAtRef = useRef(0);

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
      // Mantener la configuraciÃ³n por defecto.
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
      // El anÃ¡lisis sigue funcionando aunque no se guarden las preferencias.
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
      setStreamHealth("EstÃ¡tica");
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
        Date.now() - lastMotionAtRef.current > 10000 ? "EstÃ¡tica" :
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
    setMessage("CalibraciÃ³n reiniciada con la imagen actual");
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
      setMessage("TodavÃ­a no hay una imagen disponible para capturar");
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
    setLastFrame(dataUrl);Ûo6¶‰ËkºwµçQ èA•ÉÍ½¹…±5…Ñ €ôì(€€€€€¥èÉåÁÑ¼¹É…¹‘½µUU% ¤°(€€€€€‘…Ñ”è¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤°(€€€€€µ…ÁM±ÕœèÍ•±•Ñ•‘5…À¹Í±Õœ°(€€€€€µ…Á9…µ”èÍ•±•Ñ•‘5…À¹¹…µ”°(€€€€€µ½‘”èÍ•±•Ñ•‘5…À¹µ½‘”°(€€€€€‰É…İ±•ÈèÍ•±•Ñ•‘	É…İ±•È¹¹…µ”°(€€€€€‰É…İ±•ÉM±ÕœèÍ•±•Ñ•‘	É…İ±•È¹Í±Õœ°(€€€€€É½±”èÍ•±•Ñ•‘	É…İ±•È¹É½±”°(€€€€€É•ÍÕ±Ğ°(€€€€€‘É…™ÑA½Í¥Ñ¥½¸è€‰A¥¬¥¹Ñ•Éµ•‘¥¼ˆ°(€€€€€…±±¥•Ìèmt°(€€€€€•¹•µ¥•Ìèmt°(€€€€€¹½Ñ”èÉ•Ù¥•İ9½Ñ”°(€€€€€Í½ÕÉ”è€‰1¥Ù”I•Ù¥•Üˆ°(€€€ôì(€€€Í…Ù•5…Ñ¡!¥ÍÑ½Éä¡mµ…Ñ °€¸¸¹µ…Ñ¡•Ít¹Í±¥” À°€ÌÀÀ¤¤ì(€€€Í•ÑM…Ù•‘Q½1•…É¹¥¹œ¡ÑÉÕ”¤ì(€€€Í•Ñ5•ÍÍ…” ‰I•ÍÕ±Ñ…‘¼‡Å…‘¥‘¼…°…ÁÉ•¹‘¥é…©”Á•ÉÍ½¹…°ˆ¤ì(€ôì((€½¹ÍĞ•áÁ½ÉÑÕÉÉ•¹Ğ€ô€ ¤€ôøì(€€€½¹ÍĞÍ•ÍÍ¥½¸€ôÕÉÉ•¹ÑM•ÍÍ¥½¸ ¤ì(€€€¥˜€ …Í•ÍÍ¥½¸¤É•ÑÕÉ¸ì(€€€‘½İ¹±½…‘)Í½¸ ‰‰É…İ°µ±¥Ù”µÉ•Ù¥•Ü¹©Í½¸ˆ°Í•ÍÍ¥½¸¤ì(€€€Í•Ñ5•ÍÍ…” ‰1¥Ù”I•Ù¥•Ü•áÁ½ÉÑ…‘¼ˆ¤ì(€ôì((€½¹ÍĞÉ•µ½Ù•M•ÍÍ¥½¸€ô€¡¥èÍÑÉ¥¹œ¤€ôøì(€€€½¹ÍĞ¹•áĞ€ôÍ•ÍÍ¥½¹Ì¹™¥±Ñ•È ¡Í•ÍÍ¥½¸¤€ôøÍ•ÍÍ¥½¸¹¥€„ôô¥¤ì(€€€Í•ÑM•ÍÍ¥½¹Ì¡¹•áĞ¤ì(€€€Í…Ù•1¥Ù•I•Ù¥•İÌ¡¹•áĞ¤ì(€ôì((€½¹ÍĞ…ÕÑ½Ù•¹Ñ½Õ¹Ğ€ô•Ù•¹ÑÌ¹™¥±Ñ•È ¡•Ù•¹Ğ¤€ôø•Ù•¹Ğ¹Í½ÕÉ”€ôôô€‰ÕÑ¼ˆ¤¹±•¹Ñ ì(€½¹ÍĞÍ•ÅÕ•¹•%¹Í¥¡Ñ½Õ¹Ğ€ô•Ù•¹ÑÌ¹™¥±Ñ•È ¡•Ù•¹Ğ¤€ôø	½½±•…¸¡•Ù•¹Ğ¹Í•ÅÕ•¹•-•ä¤¤¹±•¹Ñ ì(€½¹ÍĞ±•…É¹•‘••‘‰…¬€ô™••‘‰…­MÕµµ…Éä¡™••‘‰…­AÉ½™¥±”¤ì(€½¹ÍĞÕ¹É•Ù¥•İ•‘½µµ•¹ÑÌ€ô…ÕÑ½½µµ•¹ÑÌ¹™¥±Ñ•È ¡½µµ•¹Ğ¤€ôø€…½µµ•¹Ğ¹™••‘‰…¬¤ì(€½¹ÍĞ±…Ñ•ÍÑÕÑ½½µµ•¹Ğ€ôÕ¹É•Ù¥•İ•‘½µµ•¹ÑÍlÁtñğ…ÕÑ½½µµ•¹ÑÍlÁtì(€½¹ÍĞ¡¥ÍÑ½Éå½µµ•¹ÑÌ€ô…ÕÑ½½µµ•¹ÑÌ(€€€€¹™¥±Ñ•È ¡½µµ•¹Ğ¤€ôø½µµ•¹Ğ¹¥€„ôô±…Ñ•ÍÑÕÑ½½µµ•¹Ğü¹¥¤(€€€€¹Í±¥” À°€à¤ì(€½¹ÍĞ…ÕÑ½MÑ…ÑÕÍQ•áĞ€ô(€€€…ÕÑ½MÑ…ÑÕÌ€ôôô€‰…±¥‰É…Ñ¥¹œˆ€ü…±¥‰É…¹‘¼€‘í…±¥‰É…Ñ¥½¹ô•€€è(€€€…ÕÑ½MÑ…ÑÕÌ€ôôô€‰…Ñ¥Ù”ˆ€ü€‰¹…±¥é…¹‘¼™½Ñ½É…µ…Ìˆ€è(€€€…ÕÑ½MÑ…ÑÕÌ€ôôô€‰Á…ÕÍ•ˆ€ü€‰»…±¥Í¥ÌÁ…ÕÍ…‘¼ˆ€è(€€€€‰AÉ•Á…É…‘¼ˆì(€½¹ÍĞµ½Ñ¥½¹1•Ù•°€ô±…ÍÑ5•ÑÉ¥Ì€ü5…Ñ ¹É½Õ¹¡±…ÍÑ5•ÑÉ¥Ì¹µ½Ñ¥½¸€¨€ÄÀÀ¤€è€Àì((€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µÉ•Ù¥•ÜµØà±¥Ù”µÉ•Ù¥•ÜµØä±¥Ù”µÉ•Ù¥•ÜµØÄÀˆø(€€€€ñ…¹Ù…ÌÉ•˜õí…¹…±åÍ¥Í…¹Ù…ÍI•™ô±…ÍÍ9…µ”ô‰…ÕÑ¼µ…¹…±åÍ¥Ìµ…¹Ù…Ìˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆ€¼ø(€€€íµ•ÍÍ…”€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘É…™ĞµÑ½…ÍĞˆùíµ•ÍÍ…•ôğ½‘¥Øùô((€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°±¥Ù”µÍ•ÑÕÀµØàˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µÑ¥Ñ±”ˆø(€€€€€€€€ñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùÕÑ¼I•Ù¥•Ü	•Ñ„ØÀ¸ÄĞğ½ÍÁ…¸øñ ÈùAÉ•Á…É…ÈÍ•Í§Í¸ğ½ Èøğ½‘¥Øø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õí±¥Ù”µÁÉ¥Ù…äµ¡¥À€‘íÍÑ…ÑÕÍõôùíÍÑ…ÑÕÌ€ôôô€‰Í¡…É¥¹œˆ€üƒŠ^<€‘í…ÕÑ½MÑ…ÑÕÍQ•áÑõ€€è€‰AÉ½•Í…µ¥•¹Ñ¼±½…°‰ôğ½ÍÁ…¸ø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µÍ•ÑÕÀµÉ¥ˆø(€€€€€€€€ñ±…‰•°ù5…Á„ñÍ•±•ĞÙ…±Õ”õíµ…ÁM±Õô‘¥Í…‰±•õíÍÑ…ÑÕÌ€ôôô€‰Í¡…É¥¹œ‰ô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•Ñ5…ÁM±Õœ¡•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”¥ôø(€€€€€€€€€íµ…ÁÌ¹µ…À ¡µ…À¤€ôø€ñ½ÁÑ¥½¸Ù…±Õ”õíµ…À¹Í±Õô­•äõíµ…À¹Í±Õôùíµ…À¹µ½‘•ôƒ
Üíµ…À¹¹…µ•ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€ğ½Í•±•Ğøğ½±…‰•°ø(€€€€€€€€ñ±…‰•°ùQÔ‰É…İ±•ÈñÍ•±•ĞÙ…±Õ”õí‰É…İ±•É9…µ•ô‘¥Í…‰±•õíÍÑ…ÑÕÌ€ôôô€‰Í¡…É¥¹œ‰ô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•Ñ	É…İ±•É9…µ”¡•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”¥ôø(€€€€€€€€€í‰É…İ±•ÉÌ¹µ…À ¡‰É…İ±•È¤€ôø€ñ½ÁÑ¥½¸Ù…±Õ”õí‰É…İ±•È¹¹…µ•ô­•äõí‰É…İ±•È¹Í±Õôùí‰É…İ±•È¹¹…µ•ôƒ
Üí‰É…İ±•È¹É½±•ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€ğ½Í•±•Ğøğ½±…‰•°ø(€€€€€€€€ñ±…‰•°ùI•ÍÕ±Ñ…‘¼ñÍ•±•ĞÙ…±Õ”õíÉ•ÍÕ±Ñô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•ÑI•ÍÕ±Ğ¡•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”…Ì5…Ñ¡I•ÍÕ±Ğ¥ôø(€€€€€€€€€€ñ½ÁÑ¥½¸ùY¥Ñ½É¥„ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ù•ÉÉ½Ñ„ğ½½ÁÑ¥½¸ø(€€€€€€€€ğ½Í•±•Ğøğ½±…‰•°ø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…ÕÑ¼µÉ•Ù¥•Üµ½¹ÑÉ½±ÌµØäˆø(€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰…ÕÑ¼µÉ•Ù¥•ÜµÑ½±”ˆø(€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õí…ÕÑ½¹…±åÍ¥Íô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•ÑÕÑ½¹…±åÍ¥Ì¡•Ù•¹Ğ¹Ñ…É•Ğ¹¡•­•¥ô€¼ø(€€€€€€€€€€ñÍÁ…¸øñˆù•Ñ•§Í¸…ÕÑ½·…Ñ¥„ğ½ˆøñÍµ…±°ù¹…±¥é„™½Ñ½É…µ…Ì±½…±µ•¹Ñ”…‘„€ØÔÀµÌğ½Íµ…±°øğ½ÍÁ…¸ø(€€€€€€€€ğ½±…‰•°ø(€€€€€€€€ñ±…‰•°ùM•¹Í¥‰¥±¥‘…ñÍ•±•ĞÙ…±Õ”õí…ÕÑ½M•¹Í¥Ñ¥Ù¥Ñåô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•ÑÕÑ½M•¹Í¥Ñ¥Ù¥Ñä¡•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”…ÌÕÑ½I•Ù¥•İM•¹Í¥Ñ¥Ù¥Ñä¥ôø(€€€€€€€€€€ñ½ÁÑ¥½¸ù	…©„ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ù5•‘¥„ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ù±Ñ„ğ½½ÁÑ¥½¸ø(€€€€€€€€ğ½Í•±•Ğøğ½±…‰•°ø(€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰…ÕÑ¼µÉ•Ù¥•ÜµÑ½±”ˆø(€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õíÙ½¥•½µµ•¹ÑÍô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•ÑY½¥•½µµ•¹ÑÌ¡•Ù•¹Ğ¹Ñ…É•Ğ¹¡•­•¥ô€¼ø(€€€€€€€€€€ñÍÁ…¸øñˆù½µ•¹Ñ…É¥½ÌÁ½ÈÙ½èğ½ˆøñÍµ…±°ùM½±¼‘•Ñ•¥½¹•Ì½¸½¹™¥…¹é„ÍÕ™¥¥•¹Ñ”ğ½Íµ…±°øğ½ÍÁ…¸ø(€€€€€€€€ğ½±…‰•°ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí…ÕÑ¼µÉ•Ù¥•ÜµÍÑ…ÑÕÌÍÑ…ÑÕÌ´‘í…ÕÑ½MÑ…ÑÕÍõôø(€€€€€€€€€€ñÍÁ…¸ùí…ÕÑ½MÑ…ÑÕÍQ•áÑôğ½ÍÁ…¸ø(€€€€€€€€€€ñˆùíÍÑ…ÑÕÌ€ôôô€‰Í¡…É¥¹œˆ€ü…ÁÑÕÉ„€‘íÍÑÉ•…µ!•…±Ñ ¹Ñ½1½İ•É…Í” ¥õ€€è€‰…ÁÑÕÉ„¹¼¥¹¥¥…‘„‰ôğ½ˆø(€€€€€€€€€€ñÍµ…±°ùí…ÕÑ½Ù•¹Ñ½Õ¹Ñô•Ù•¹Ñ½Ìƒ
Üµ½Ù¥µ¥•¹Ñ¼íµ½Ñ¥½¹1•Ù•±ô”ğ½Íµ…±°ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…ÕÑ¼µ±•…É¹¥¹œµÍÑÉ¥ÀµØÄÀˆø(€€€€€€€€ñÍÁ…¸øñˆùíÕ¹É•Ù¥•İ•‘½µµ•¹ÑÌ¹±•¹Ñ¡ôğ½ˆøÁ•¹‘¥•¹Ñ•Ìğ½ÍÁ…¸ø(€€€€€€€€ñÍÁ…¸øñˆùí±•…É¹•‘••‘‰…¬¹…•ÁÑ•‘ôğ½ˆø½ÉÉ•Ñ…Ìğ½ÍÁ…¸ø(€€€€€€€€ñÍÁ…¸øñˆùí±•…É¹•‘••‘‰…¬¹É•©•Ñ•‘ôğ½ˆø™…±Í…Ìğ½ÍÁ…¸ø(€€€€€€€€ñÍÁ…¸øñˆùí±•…É¹•‘••‘‰…¬¹ÁÉ•¥Í¥½¸€üü€‹ŠP‰õí±•…É¹•‘••‘‰…¬¹ÁÉ•¥Í¥½¸€„ôôÕ¹‘•™¥¹•€ü€ˆ”ˆ€è€ˆ‰ôğ½ˆøÁÉ•¥Í§Í¸É•Ù¥Í…‘„ğ½ÍÁ…¸ø(€€€€€€€€ñÍÁ…¸øñˆùíÍ•ÅÕ•¹•%¹Í¥¡Ñ½Õ¹Ñôğ½ˆøÍ•Õ•¹¥…Ìğ½ÍÁ…¸ø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µµ…¥¸µ…Ñ¥½¹Ìˆø(€€€€€€€íÍÑ…ÑÕÌ€ôôô€‰¥‘±”ˆ€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õíÍÑ…ÉÑ…ÁÑÕÉ•ô‘¥Í…‰±•õì……ÁÑÕÉ•MÕÁÁ½ÉÑ•‘ôù½µÁ…ÉÑ¥ÈÁ…¹Ñ…±±„¼Ù•¹Ñ…¹„ğ½‰ÕÑÑ½¸ùô(€€€€€€€íÍÑ…ÑÕÌ€ôôô€‰Í¡…É¥¹œˆ€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰±¥Ù”µÍÑ½Àµ‰ÕÑÑ½¸ˆ½¹±¥¬õí™¥¹¥Í¡…ÁÑÕÉ•ôù•Ñ•¹•È…ÁÑÕÉ„ğ½‰ÕÑÑ½¸ùô(€€€€€€€íÍÑ…ÑÕÌ€ôôô€‰Í¡…É¥¹œˆ€˜˜…ÕÑ½¹…±åÍ¥Ì€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õíÉ•…±¥‰É…Ñ•ÕÑ½I•Ù¥•İôùI•…±¥‰É…Èğ½‰ÕÑÑ½¸ùô(€€€€€€€í±•…É¹•‘••‘‰…¬¹É•Ù¥•İ•€ø€À€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õíÉ•Í•ÑÕÑ½1•…É¹¥¹ôùI•ÍÑ…ÕÉ…È…ÁÉ•¹‘¥é…©”Ù¥ÍÕ…°ğ½‰ÕÑÑ½¸ùô(€€€€€€€íÍÑ…ÑÕÌ€„ôô€‰¥‘±”ˆ€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôø…ÁÑÕÉ•É…µ”¡ÑÉÕ”¥ôùÕ…É‘…È™½Ñ½É…µ„ğ½‰ÕÑÑ½¸ùô(€€€€€€€íÍÑ…ÑÕÌ€„ôô€‰¥‘±”ˆ€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õíÉ•Í•ÑM•ÍÍ¥½¹ôù9Õ•Ù„Í•Í§Í¸ğ½‰ÕÑÑ½¸ùô(€€€€€€ğ½‘¥Øø(€€€€€€ñÀ±…ÍÍ9…µ”ô‰±¥Ù”µÁÉ¥Ù…äµ¹½Ñ”ˆù1„¥µ…•¸ä•°…»…±¥Í¥Ì‘”™½Ñ½É…µ…ÌÁ•Éµ…¹••¸•¸ÑÔ¹…Ù•…‘½È¸1„…Á±¥…§Í¸¹¼É…‰„¹¤•¹Ûµ„…ÕÑ½·…Ñ¥…µ•¹Ñ”•°Ûµ‘•¼¸1…Ì‘•Ñ•¥½¹•ÌÍ½¸¡•ÕËµÍÑ¥…ÌèÉ•Ù¥Í„ä•±¥µ¥¹„±½Ì™…±Í½ÌÁ½Í¥Ñ¥Ù½Ì…¹Ñ•Ì‘”Õ…É‘…È¸ğ½Àø(€€€€ğ½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰±¥Ù”µİ½É­ÍÁ…”µØàˆø(€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Á…¹•°±¥Ù”µÙ¥‘•¼µÁ…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µÙ¥‘•¼µ¡•…ˆø(€€€€€€€€€€ñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùY¥ÍÑ„•¸‘¥É•Ñ¼ğ½ÍÁ…¸øñ ÈùíÍ•±•Ñ•‘5…Àü¹¹…µ”ñğ€‰A…ÉÑ¥‘„‰ôğ½ Èøğ½‘¥Øø(€€€€€€€€€€ñÍÑÉ½¹œùí™½Éµ…Ñ1¥Ù•Q¥µ”¡•±…ÁÍ•¥ôğ½ÍÑÉ½¹œø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí±¥Ù”µÙ¥‘•¼µ™É…µ”€‘íÍÑ…ÑÕÍõôø(€€€€€€€€€€ñÙ¥‘•¼É•˜õíÙ¥‘•½I•™ôµÕÑ•Á±…åÍ%¹±¥¹”€¼ø(€€€€€€€€€íÍÑ…ÑÕÌ€„ôô€‰Í¡…É¥¹œˆ€˜˜±…ÍÑÉ…µ”€˜˜€ñ¥µœÍÉŒõí±…ÍÑÉ…µ•ô…±Ğô‹i±Ñ¥µ¼™½Ñ½É…µ„‘”±„Í•Í§Í¸ˆ€¼ùô(€€€€€€€€€íÍÑ…ÑÕÌ€ôôô€‰¥‘±”ˆ€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µÙ¥‘•¼µÁ±…•¡½±‘•Èˆø(€€€€€€€€€€€€ñˆù½µÁ…ÉÑ”	É…İ°MÑ…ÉÌ°Õ¸•µÕ±…‘½È¼±„Ù•¹Ñ…¹„‘½¹‘”‘ÕÁ±¥…Ì•°·ÍÙ¥°ğ½ˆø(€€€€€€€€€€€€ñÍÁ…¸ù°¹…Ù•…‘½ÈÑ”Á•Éµ¥Ñ¥Ë„•±•¥ÈÕ¹„Á…¹Ñ…±±„°Ù•¹Ñ…¹„¼Á•ÍÑ‡Å„¸ğ½ÍÁ…¸ø(€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€íÍÑ…ÑÕÌ€ôôô€‰É•Ù¥•Üˆ€˜˜€…±…ÍÑÉ…µ”€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µÙ¥‘•¼µÁ±…•¡½±‘•Èˆøñˆù…ÁÑÕÉ„™¥¹…±¥é…‘„ğ½ˆøñÍÁ…¸ùI•Ù¥Í„±„É½¹½±½Ÿµ„äÕ…É‘„•°É•ÍÕ±Ñ…‘¼¸ğ½ÍÁ…¸øğ½‘¥Øùô(€€€€€€€€€íÍÑ…ÑÕÌ€ôôô€‰Í¡…É¥¹œˆ€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰±¥Ù”µÉ•½É‘¥¹œµ‘½Ğˆù1%Yğ½ÍÁ…¸ùô(€€€€€€€€€íÍÑ…ÑÕÌ€ôôô€‰Í¡…É¥¹œˆ€˜˜…ÕÑ½¹…±åÍ¥Ì€˜˜€ñÍÁ…¸±…ÍÍ9…µ”õí…ÕÑ¼µÙ¥Í¥½¸µ‰…‘”€‘í…ÕÑ½MÑ…ÑÕÍõôùí…ÕÑ½MÑ…ÑÕÍQ•áÑôğ½ÍÁ…¸ùô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½…ÉÑ¥±”ø((€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Á…¹•°±¥Ù”µ•Ù•¹ÑÌµÁ…¹•°ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µ•Ù•¹ÑÌµ¡•…ˆø(€€€€€€€€€€ñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆù5…É…‘½É•ÌË…Á¥‘½Ìğ½ÍÁ…¸øñ Èùí•Ù•¹ÑÌ¹±•¹Ñ¡ô•Ù•¹Ñ½Ìğ½ Èøğ½‘¥Øø(€€€€€€€€€í•Ù•¹ÑÌ¹±•¹Ñ €ø€À€˜˜€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑÙ•¹ÑÌ ¡ÕÉÉ•¹Ğ¤€ôøÕÉÉ•¹Ğ¹Í±¥” À°€´Ä¤¥ôù•Í¡…•Èƒé±Ñ¥µ¼ğ½‰ÕÑÑ½¸ùô(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µ•Ù•¹Ğµ‰ÕÑÑ½¹Ìˆø(€€€€€€€€€íY9Q}Q5A1QL¹µ…À ¡Ñ•µÁ±…Ñ”¤€ôø€ñ‰ÕÑÑ½¸(€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€±…ÍÍ9…µ”õíÑ½¹”´‘íÑ•µÁ±…Ñ”¹Ñ½¹•õô(€€€€€€€€€€€­•äõíÑ•µÁ±…Ñ”¹±…‰•±ô(€€€€€€€€€€€½¹±¥¬õì ¤€ôø…‘‘Ù•¹Ğ¡Ñ•µÁ±…Ñ”¥ô(€€€€€€€€€€€‘¥Í…‰±•õíÍÑ…ÑÕÌ€ôôô€‰¥‘±”‰ô(€€€€€€€€€€€Ñ¥Ñ±”õíÑ…©¼è€‘íÑ•µÁ±…Ñ”¹Í¡½ÉÑÕÑõô(€€€€€€€€€€ø(€€€€€€€€€€€€ñˆùíÑ•µÁ±…Ñ”¹±…‰•±ôğ½ˆøñÍµ…±°ùíÑ•µÁ±…Ñ”¹Í¡½ÉÑÕÑôğ½Íµ…±°ø(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µÕÍÑ½´µ•Ù•¹Ğˆø(€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õíÕÍÑ½µÙ•¹Ñô‘¥Í…‰±•õíÍÑ…ÑÕÌ€ôôô€‰¥‘±”‰ô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•ÑÕÍÑ½µÙ•¹Ğ¡•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”¥ô½¹-•å½İ¸õì¡•Ù•¹Ğ¤€ôøì(€€€€€€€€€€€¥˜€¡•Ù•¹Ğ¹­•ä€ôôô€‰¹Ñ•Èˆ¤…‘‘ÕÍÑ½µÙ•¹Ğ ¤ì(€€€€€€€€€õôÁ±…•¡½±‘•Èô‰Å…‘¥ÈÕ¹„¹½Ñ„Ë…Á¥‘‡Š˜ˆ€¼ø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õí…‘‘ÕÍÑ½µÙ•¹Ñô‘¥Í…‰±•õì…ÕÍÑ½µÙ•¹Ğ¹ÑÉ¥´ ¥ôùÅ…‘¥Èğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½…ÉÑ¥±”ø(€€€€ğ½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°…ÕÑ¼µ½µµ•¹ÑÌµÁ…¹•°µØäˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µÑ¥Ñ±”ˆø(€€€€€€€€ñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆù½… …ÕÑ½·…Ñ¥¼ğ½ÍÁ…¸øñ Èù½µ•¹Ñ…É¥½Ì•¹•É…‘½Ì•¸‘¥É•Ñ¼ğ½ Èøğ½‘¥Øø(€€€€€€€€ñÍÁ…¸ùíÕ¹É•Ù¥•İ•‘½µµ•¹ÑÌ¹±•¹Ñ¡ôÁ•¹‘¥•¹Ñ•Ìƒ
Üí…ÕÑ½½µµ•¹ÑÌ¹±•¹Ñ¡ôÑ½Ñ…±•Ìğ½ÍÁ…¸ø(€€€€€€ğ½‘¥Øø((€€€€€í±…Ñ•ÍÑÕÑ½½µµ•¹Ğ€ü€ñ‘¥Ø±…ÍÍ9…µ”õí…ÕÑ¼µ±…Ñ•ÍĞµ½µµ•¹ĞÑ½¹”´‘í±…Ñ•ÍÑÕÑ½½µµ•¹Ğ¹Ñ½¹•ô™••‘‰…¬´‘í±…Ñ•ÍÑÕÑ½½µµ•¹Ğ¹™••‘‰…¬ñğ€‰Á•¹‘¥¹œ‰õôø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñÍÁ…¸ùí™½Éµ…Ñ1¥Ù•Q¥µ”¡±…Ñ•ÍÑÕÑ½½µµ•¹Ğ¹Í•½¹¥ôƒ
Ü½¹™¥…¹é„í±…Ñ•ÍÑÕÑ½½µµ•¹Ğ¹½¹™¥‘•¹•ô”ƒ
Üí±…Ñ•ÍÑÕÑ½½µµ•¹Ğ¹­¥¹€ôôô€‰Í•ÅÕ•¹”ˆ€ü€‰Í•Õ•¹¥„Ó…Ñ¥„ˆ€è€‰™½Ñ½É…µ„‰ôğ½ÍÁ…¸ø(€€€€€€€€€€ñˆùí±…Ñ•ÍÑÕÑ½½µµ•¹Ğ¹Ñ•áÑôğ½ˆø(€€€€€€€€ğ½‘¥Øø(€€€€€€€í±…Ñ•ÍÑÕÑ½½µµ•¹Ğ¹™••‘‰…¬€ü€ñÍÑÉ½¹œ±…ÍÍ9…µ”õí™••‘‰…¬µÉ•ÍÕ±Ğ€‘í±…Ñ•ÍÑÕÑ½½µµ•¹Ğ¹™••‘‰…­õôø(€€€€€€€€€í±…Ñ•ÍÑÕÑ½½µµ•¹Ğ¹™••‘‰…¬€ôôô€‰…•ÁÑ•ˆ€ü€‹ŠrL½ÉÉ•Ñ¼ˆ€è€‹\…±Í¼Á½Í¥Ñ¥Ù¼‰ô(€€€€€€€€ğ½ÍÑÉ½¹œø€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰…ÕÑ¼µ™••‘‰…¬µ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰…•ÁĞˆ½¹±¥¬õì ¤€ôøÉ•Ù¥•İÕÑ½½µµ•¹Ğ¡±…Ñ•ÍÑÕÑ½½µµ•¹Ğ°€‰…•ÁÑ•ˆ¥ôù½ÉÉ•Ñ¼ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰É•©•Ğˆ½¹±¥¬õì ¤€ôøÉ•Ù¥•İÕÑ½½µµ•¹Ğ¡±…Ñ•ÍÑÕÑ½½µµ•¹Ğ°€‰É•©•Ñ•ˆ¥ôù…±Í¼ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øùô(€€€€€€ğ½‘¥Øø€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰…ÕÑ¼µ½µµ•¹Ğµ•µÁÑäˆø(€€€€€€€€ñˆùí…ÕÑ½MÑ…ÑÕÌ€ôôô€‰…±¥‰É…Ñ¥¹œˆ€ü…±¥‰É…¹‘¼±„¥µ…•¸è€‘í…±¥‰É…Ñ¥½¹ô•€€è…ÕÑ½¹…±åÍ¥Ì€ü€‰ÍÁ•É…¹‘¼Õ¸…µ‰¥¼É•±•Ù…¹Ñ”ˆ€è€‰•Ñ•§Í¸…ÕÑ½·…Ñ¥„‘•Í…Ñ¥Ù…‘„‰ôğ½ˆø(€€€€€€€€ñÍÁ…¸ù°Í¥ÍÑ•µ„…¹…±¥é„™½Ñ½É…µ…Ìä½µ‰¥¹„•Ù•¹Ñ½Ì•É…¹½ÌÁ…É„‘•Ñ•Ñ…ÈµÕ•ÉÑ•Ì½¸½ÍÑ”°ÍÕÁ•ÉÌÍ¥¸½¹Ù•ÉÍ§Í¸äÉ••¹ÑÉ…‘…Ì‘•µ…Í¥…‘¼Ë…Á¥‘…Ì¸ğ½ÍÁ…¸ø(€€€€€€ğ½‘¥Øùô((€€€€€í¡¥ÍÑ½Éå½µµ•¹ÑÌ¹±•¹Ñ €ø€À€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰…ÕÑ¼µ½µµ•¹Ğµ¡¥ÍÑ½Éäˆø(€€€€€€€í¡¥ÍÑ½Éå½µµ•¹ÑÌ¹µ…À ¡½µµ•¹Ğ¤€ôø€ñ…ÉÑ¥±”±…ÍÍ9…µ”õíÑ½¹”´‘í½µµ•¹Ğ¹Ñ½¹•ô™••‘‰…¬´‘í½µµ•¹Ğ¹™••‘‰…¬ñğ€‰Á•¹‘¥¹œ‰õô­•äõí½µµ•¹Ğ¹¥‘ôø(€€€€€€€€€€ñÑ¥µ”ùí™½Éµ…Ñ1¥Ù•Q¥µ”¡½µµ•¹Ğ¹Í•½¹¥ôğ½Ñ¥µ”ø(€€€€€€€€€€ñ‘¥Øøñˆùí½µµ•¹Ğ¹Ñ•áÑôğ½ˆøñÍµ…±°ùí½µµ•¹Ğ¹•Ù•¹Ñ1…‰•°ñğ€‰½µ•¹Ñ…É¥¼‰ôƒ
Üí½µµ•¹Ğ¹½¹™¥‘•¹•ô”ƒ
Üí½µµ•¹Ğ¹­¥¹€ôôô€‰Í•ÅÕ•¹”ˆ€ü€‰M•Õ•¹¥„ˆ€è€‰É…µ”‰ôğ½Íµ…±°øğ½‘¥Øø(€€€€€€€€€í½µµ•¹Ğ¹™••‘‰…¬€ü€ñÍÁ…¸±…ÍÍ9…µ”õí™••‘‰…¬µµ¥¹¤€‘í½µµ•¹Ğ¹™••‘‰…­õôùí½µµ•¹Ğ¹™••‘‰…¬€ôôô€‰…•ÁÑ•ˆ€ü€‹ŠrLˆ€è€‹\‰ôğ½ÍÁ…¸ø€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰…ÕÑ¼µ™••‘‰…¬µµ¥¹¤µ…Ñ¥½¹Ìˆø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÉ•Ù¥•İÕÑ½½µµ•¹Ğ¡½µµ•¹Ğ°€‰…•ÁÑ•ˆ¥ô…É¥„µ±…‰•°ô‰5…É…È‘•Ñ•§Í¸½ÉÉ•Ñ„ˆûŠrLğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÉ•Ù¥•İÕÑ½½µµ•¹Ğ¡½µµ•¹Ğ°€‰É•©•Ñ•ˆ¥ô…É¥„µ±…‰•°ô‰5…É…È™…±Í¼Á½Í¥Ñ¥Ù¼ˆû\ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€ğ½…ÉÑ¥±”ø¥ô(€€€€€€ğ½‘¥Øùô(€€€€ğ½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°±¥Ù”µÑ¥µ•±¥¹”µÁ…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µÑ¥Ñ±”ˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùÉ½¹½±½Ÿµ„ğ½ÍÁ…¸øñ Èù5½µ•¹Ñ½Ì‘”±„Á…ÉÑ¥‘„ğ½ Èøğ½‘¥ØøñÍÁ…¸ùí™½Éµ…Ñ1¥Ù•Q¥µ”¡•±…ÁÍ•¥ôğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µÑ¥µ•±¥¹”µ±¥ÍĞˆø(€€€€€€€í•Ù•¹ÑÌ¹±•¹Ñ €ül¸¸¹•Ù•¹ÑÍt¹É•Ù•ÉÍ” ¤¹µ…À ¡•Ù•¹Ğ¤€ôø€ñ…ÉÑ¥±”±…ÍÍ9…µ”õíÑ½¹”´‘í•Ù•¹Ğ¹Ñ½¹•õô­•äõí•Ù•¹Ğ¹¥‘ôø(€€€€€€€€€€ñÑ¥µ”ùí™½Éµ…Ñ1¥Ù•Q¥µ”¡•Ù•¹Ğ¹Í•½¹¥ôğ½Ñ¥µ”ø(€€€€€€€€€€ñ‘¥Øøñˆùí•Ù•¹Ğ¹±…‰•±ôğ½ˆøñÍµ…±°ùí•Ù•¹Ğ¹…Ñ•½Éåõí•Ù•¹Ğ¹Í½ÕÉ”€ôôô€‰ÕÑ¼ˆ€ü€ƒ
ÜÕÑ¼€‘í•Ù•¹Ğ¹½¹™¥‘•¹”ñğ€Áô”‘í•Ù•¹Ğ¹Í•ÅÕ•¹•-•ä€ü€ˆƒ
ÜM•Õ•¹¥„ˆ€è€ˆ‰ô‘í•Ù•¹Ğ¹™••‘‰…¬€ôôô€‰…•ÁÑ•ˆ€ü€ˆƒ
Ü½¹™¥Éµ…‘¼ˆ€è€ˆ‰õ€€è€ˆƒ
Ü5…¹Õ…°‰ôğ½Íµ…±°øğ½‘¥Øø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÉ•µ½Ù•Ù•¹Ğ¡•Ù•¹Ğ¹¥¥ô…É¥„µ±…‰•°õí±¥µ¥¹…È€‘í•Ù•¹Ğ¹±…‰•±õôû\ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½…ÉÑ¥±”ø¤€è€ñ‘¥Ø±…ÍÍ9…µ”ô‰•µÁÑäµÍÑ…Ñ”ˆù1½Ìµ…É…‘½É•Ì…Á…É••Ë…¸…Å×´½¸•°Í•Õ¹‘¼•á…Ñ¼‘”±„Í•Í§Í¸¸ğ½‘¥Øùô(€€€€€€ğ½‘¥Øø(€€€€ğ½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰±¥Ù”µÉ•Ù¥•ÜµÉ¥µØàˆø(€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Á…¹•°±¥Ù”µÍÕµµ…ÉäµÁ…¹•°ˆø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½ÜˆùI•ÍÕµ•¸…ÕÑ½·…Ñ¥¼ğ½ÍÁ…¸ø(€€€€€€€€ñ ÈùíÍÕµµ…Éä¹¡•…‘±¥¹•ôğ½ Èø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µÍÕµµ…Éäµ½±Õµ¹Ìˆø(€€€€€€€€€€ñ‘¥Øøñˆù½ÉÑ…±•é…Ìğ½ˆùíÍÕµµ…Éä¹ÍÑÉ•¹Ñ¡Ì¹±•¹Ñ €üÍÕµµ…Éä¹ÍÑÉ•¹Ñ¡Ì¹µ…À ¡¥Ñ•´¤€ôø€ñÍÁ…¸±…ÍÍ9…µ”ô‰½½ˆ­•äõí¥Ñ•µôø¬í¥Ñ•µôğ½ÍÁ…¸ø¤€è€ñÍµ…±°ùM¥¸™½ÉÑ…±•é…ÌÍÕ™¥¥•¹Ñ•ÌÉ•¥ÍÑÉ…‘…Ì¸ğ½Íµ…±°ùôğ½‘¥Øø(€€€€€€€€€€ñ‘¥ØøñˆùÉÉ½É•Ìğ½ˆùíÍÕµµ…Éä¹µ¥ÍÑ…­•Ì¹±•¹Ñ €üÍÕµµ…Éä¹µ¥ÍÑ…­•Ì¹µ…À ¡¥Ñ•´¤€ôø€ñÍÁ…¸±…ÍÍ9…µ”ô‰‰…ˆ­•äõí¥Ñ•µôûŠ"Hí¥Ñ•µôğ½ÍÁ…¸ø¤€è€ñÍµ…±°ùM¥¸•ÉÉ½É•Ì•ÍÁ•µ™¥½ÌÉ•¥ÍÑÉ…‘½Ì¸ğ½Íµ…±°ùôğ½‘¥Øø(€€€€€€€€€€ñ‘¥ØøñˆùAËÍá¥µ¼™½¼ğ½ˆùíÍÕµµ…Éä¹É•½µµ•¹‘…Ñ¥½¹Ì¹µ…À ¡¥Ñ•´¤€ôø€ñÍÁ…¸­•äõí¥Ñ•µôûŠHí¥Ñ•µôğ½ÍÁ…¸ø¥ôğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½…ÉÑ¥±”ø((€€€€€€ñ…ÉÑ¥±”±…ÍÍ9…µ”ô‰Á…¹•°±¥Ù”µÍ…Ù”µÁ…¹•°ˆø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆù•ÉÉ…ÈÉ•Ù¥Í§Í¸ğ½ÍÁ…¸ø(€€€€€€€€ñ ÈùÕ…É‘…Èä…ÁÉ•¹‘•Èğ½ Èø(€€€€€€€€ñ±…‰•°ù9½Ñ„™¥¹…°ñÑ•áÑ…É•„Ù…±Õ”õí¹½Ñ•ô½¹¡…¹”õì¡•Ù•¹Ğ¤€ôøÍ•Ñ9½Ñ”¡•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‰E×¤½ÕÉÉ§Ì•¸±„ÁÉ¥µ•É„µÕ•ÉÑ”°Á½ÈÅ×¤…µ‰¥…ÍÑ”‘”³µ¹•„°Å×¤‘•‰•ÌÉ•Á•Ñ¥ËŠ˜ˆ€¼øğ½±…‰•°ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µÍ…Ù”µ…Ñ¥½¹Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õíÍ…Ù•M•ÍÍ¥½¹ôùÕ…É‘…È1¥Ù”I•Ù¥•Üğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õíÍ…Ù•Q½1•…É¹¥¹ô‘¥Í…‰±•õíÍ…Ù•‘Q½1•…É¹¥¹ôùíÍ…Ù•‘Q½1•…É¹¥¹œ€ü€‰Å…‘¥‘¼…°…ÁÉ•¹‘¥é…©”ˆ€è€‰¹Ù¥…È„ÁÉ•¹‘¥é…©”‰ôğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰ÕÑÑ½¸ˆ½¹±¥¬õí•áÁ½ÉÑÕÉÉ•¹ÑôùáÁ½ÉÑ…È)M=8ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½…ÉÑ¥±”ø(€€€€ğ½Í•Ñ¥½¸ø((€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°±¥Ù”µ¡¥ÍÑ½ÉäµÁ…¹•°ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µÑ¥Ñ±”ˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆù!¥ÍÑ½É¥…°±½…°ğ½ÍÁ…¸øñ Èûi±Ñ¥µ…ÌÉ•Ù¥Í¥½¹•Ìğ½ Èøğ½‘¥ØøñÍÁ…¸ùíÍ•ÍÍ¥½¹Ì¹±•¹Ñ¡ô¼ÔÀğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±¥Ù”µÍ•ÍÍ¥½¸µ±¥ÍĞˆø(€€€€€€€íÍ•ÍÍ¥½¹Ì¹Í±¥” À°€ÄÀ¤¹µ…À ¡Í•ÍÍ¥½¸¤€ôø€ñ…ÉÑ¥±”­•äõíÍ•ÍÍ¥½¸¹¥‘ôø(€€€€€€€€€€ñ	É…İ±•ÉA½ÉÑÉ…¥Ğ¹…µ”õíÍ•ÍÍ¥½¸¹‰É…İ±•Éô±…ÍÍ9…µ”ô‰±¥Ù”µ¡¥ÍÑ½Éäµ…Ù…Ñ…Èˆ€¼ø(€€€€€€€€€€ñ‘¥ØøñˆùíÍ•ÍÍ¥½¸¹‰É…İ±•Éôƒ
ÜíÍ•ÍÍ¥½¸¹µ…Á9…µ•ôğ½ˆøñÍµ…±°ùíÍ•ÍÍ¥½¸¹É•ÍÕ±Ğñğ€‰M¥¸É•ÍÕ±Ñ…‘¼‰ôƒ
Üí™½Éµ…Ñ1¥Ù•Q¥µ”¡Í•ÍÍ¥½¸¹‘ÕÉ…Ñ¥½¸¥ôƒ
ÜíÍ•ÍÍ¥½¸¹•Ù•¹ÑÌ¹±•¹Ñ¡ô•Ù•¹Ñ½ÍíÍ•ÍÍ¥½¸¹…ÕÑ½¹…±åÍ¥Ìü¹‘•Ñ•Ñ¥½¹Ì€ü€ƒ
Ü€‘íÍ•ÍÍ¥½¸¹…ÕÑ½¹…±åÍ¥Ì¹‘•Ñ•Ñ¥½¹Íô…ÕÑ½€€è€ˆ‰õíÍ•ÍÍ¥½¸¹…ÕÑ½¹…±åÍ¥Ìü¹Í•ÅÕ•¹•%¹Í¥¡ÑÌ€ü€ƒ
Ü€‘íÍ•ÍÍ¥½¸¹…ÕÑ½¹…±åÍ¥Ì¹Í•ÅÕ•¹•%¹Í¥¡ÑÍôÍ•Õ•¹¥…Í€€è€ˆ‰ôğ½Íµ…±°øñÀùíÍ•ÍÍ¥½¸¹ÍÕµµ…Éä¹¡•…‘±¥¹•ôğ½Àøğ½‘¥Øø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÉ•µ½Ù•M•ÍÍ¥½¸¡Í•ÍÍ¥½¸¹¥¥ô…É¥„µ±…‰•°õí±¥µ¥¹…ÈÉ•Ù¥Í§Í¸‘”€‘íÍ•ÍÍ¥½¸¹‰É…İ±•Éõôû\ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½…ÉÑ¥±”ø¥ô(€€€€€€€ì…Í•ÍÍ¥½¹Ì¹±•¹Ñ €˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰•µÁÑäµÍÑ…Ñ”ˆù1…ÌÉ•Ù¥Í¥½¹•ÌÕ…É‘…‘…Ì…Á…É••Ë…¸…Å×´äÁ•Éµ…¹••Ë…¸•¸•ÍÑ”‘¥ÍÁ½Í¥Ñ¥Ù¼¸ğ½‘¥Øùô(€€€€€€ğ½‘¥Øø(€€€€ğ½Í•Ñ¥½¸ø(€€ğ½‘¥Øøì)ô