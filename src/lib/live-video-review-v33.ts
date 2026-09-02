import {
  analyzeFrame,
  createAutoDetectorState,
  detectFrameEvents,
  type AutoDetectorState,
} from "./auto-vision";
import {
  adjustConfidence,
  isDetectionSuppressed,
} from "./auto-learning";
import {
  dedupeVideoEvents,
  detectionToVideoEvent,
  type VideoReviewEvent,
} from "./video-review";
import {
  finalizeVideoHudSamplesV31,
  sampleVideoHudFrameV31,
} from "./video-review-v31";
import type { VideoHudRawSample, VideoHudSnapshot } from "./video-review-v26";
import type {
  AutoFeedbackProfile,
  AutoReviewSensitivity,
} from "./types";

export type LiveVideoAnalysisRuntime = {
  detector: AutoDetectorState;
  previousGray?: Uint8Array;
  events: VideoReviewEvent[];
  hudSamples: VideoHudRawSample[];
  sampledFrames: number;
  detectionIndex: number;
};

export type LiveVideoPulse = {
  sampledFrames: number;
  signals: number;
  averageConfidence: number;
  currentState: string;
  latestHud?: VideoHudSnapshot;
  recentEvents: VideoReviewEvent[];
};

export type LiveVideoAnalysisSeed = {
  id: string;
  duration: number;
  events: VideoReviewEvent[];
  hudSnapshots: VideoHudSnapshot[];
  sampledFrames: number;
};

const clamp100 = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function createLiveVideoAnalysisRuntime(): LiveVideoAnalysisRuntime {
  return {
    detector: createAutoDetectorState(),
    events: [],
    hudSamples: [],
    sampledFrames: 0,
    detectionIndex: 0,
  };
}

function liveStateLabel(latest: VideoHudSnapshot | undefined, recent: VideoReviewEvent[]) {
  const event = recent[recent.length - 1];
  if (event?.key === "death") return "Muerte propia registrada";
  if (event?.key === "ally-death") return "Baja aliada registrada";
  if (event?.key === "enemy-death") return "Baja rival registrada";
  if (event?.key === "objective") return "Cambio de objetivo registrado";
  if (latest?.hpPercent !== undefined && latest.hpPercent <= 35) return "HP bajo estimado";
  if (latest?.superReady) return "Super lista estimada";
  return "Leyendo combate y HUD";
}

export function buildLiveVideoPulse(
  runtime: LiveVideoAnalysisRuntime,
  second: number,
): LiveVideoPulse {
  const events = dedupeVideoEvents(runtime.events);
  const recentEvents = events
    .filter((event) => event.second >= Math.max(0, second - 18))
    .slice(-5);
  const snapshots = finalizeVideoHudSamplesV31(runtime.hudSamples);
  const latestHud = [...snapshots]
    .reverse()
    .find((snapshot) => snapshot.hudConfidence >= 44);
  const averageConfidence = events.length
    ? clamp100(events.reduce((sum, event) => sum + event.confidence, 0) / events.length)
    : 0;

  return {
    sampledFrames: runtime.sampledFrames,
    signals: events.length,
    averageConfidence,
    currentState: liveStateLabel(latestHud, recentEvents),
    latestHud,
    recentEvents,
  };
}

export function ingestLiveVideoFrame(
  runtime: LiveVideoAnalysisRuntime,
  image: ImageData,
  second: number,
  mode: string,
  sensitivity: AutoReviewSensitivity,
  feedback: AutoFeedbackProfile,
) {
  const frame = analyzeFrame(image, runtime.previousGray);
  runtime.previousGray = frame.gray;
  runtime.detector.previousGray = frame.gray;
  runtime.hudSamples.push(sampleVideoHudFrameV31(image, second, mode));
  runtime.sampledFrames += 1;

  const result = detectFrameEvents(runtime.detector, frame.metrics, second, mode, sensitivity);
  for (const rawDetection of result.detections) {
    const confidence = adjustConfidence(rawDetection.confidence, rawDetection.key, feedback);
    if (isDetectionSuppressed(confidence, rawDetection.key, feedback)) continue;
    runtime.events.push(detectionToVideoEvent(
      { ...rawDetection, confidence },
      second,
      runtime.detectionIndex,
    ));
    runtime.detectionIndex += 1;
  }

  // Una partida normal queda muy por debajo de estos topes. Protegen la PWA
  // ante capturas olvidadas durante horas sin perder la ventana táctica útil.
  if (runtime.events.length > 360) runtime.events.splice(0, runtime.events.length - 360);
  if (runtime.hudSamples.length > 1_800) runtime.hudSamples.splice(0, runtime.hudSamples.length - 1_800);

  return buildLiveVideoPulse(runtime, second);
}

export function finalizeLiveVideoAnalysis(
  runtime: LiveVideoAnalysisRuntime,
  duration: number,
  id: string,
): LiveVideoAnalysisSeed {
  return {
    id,
    duration: Math.max(1, duration),
    events: dedupeVideoEvents(runtime.events),
    hudSnapshots: finalizeVideoHudSamplesV31(runtime.hudSamples),
    sampledFrames: runtime.sampledFrames,
  };
}

export function isAppleMobileDevice(userAgent: string, maxTouchPoints: number) {
  return /iPad|iPhone|iPod/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}
