"use client";

import { useEffect, useRef, useState } from "react";
import { analyzeFrame, createAutoDetectorState, detectFrameEvents } from "@/lib/auto-vision";
import { buildVideoReviewReport, detectionToVideoEvent, type VideoReviewReport } from "@/lib/video-review";
import type { AutoReviewSensitivity } from "@/lib/types";
import { formatLiveTime } from "@/lib/live-review";

type AnalysisStatus = "idle" | "analyzing" | "done" | "error";

const sleep = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function waitForMetadata(video: HTMLVideoElement, timeout = 5000) {
  if (video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  return new Promise<number>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("metadata-timeout"));
    }, timeout);
    const loaded = () => {
      cleanup();
      if (Number.isFinite(video.duration) && video.duration > 0) resolve(video.duration);
      else reject(new Error("duration-unavailable"));
    };
    const failed = () => {
      cleanup();
      reject(new Error("video-error"));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener("loadedmetadata", loaded);
      video.removeEventListener("error", failed);
    };
    video.addEventListener("loadedmetadata", loaded);
    video.addEventListener("error", failed);
    video.load();
  });
}

async function seekVideo(video: HTMLVideoElement, second: number, timeout = 1600) {
  if (Math.abs(video.currentTime - second) < .025 && video.readyState >= 2) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener("seeked", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeout);
    video.addEventListener("seeked", finish, { once: true });
    try {
      video.currentTime = second;
    } catch {
      finish();
    }
  });
}

export default function VideoMatchAnalyzer({
  src,
  mode,
  durationHint,
  onSeek,
}: {
  src: string | null;
  mode: string;
  durationHint?: number;
  onSeek?: (second: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cancelRef = useRef(false);
  const [sensitivity, setSensitivity] = useState<AutoReviewSensitivity>("Media");
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [sampledFrames, setSampledFrames] = useState(0);
  const [report, setReport] = useState<VideoReviewReport | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    cancelRef.current = true;
    setStatus("idle");
    setProgress(0);
    setSampledFrames(0);
    setReport(null);
    setMessage("");
  }, [src]);

  const cancelAnalysis = () => {
    cancelRef.current = true;
    setStatus("idle");
    setMessage("Análisis detenido");
  };

  const analyzeVideo = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!src || !video || !canvas) return;

    cancelRef.current = false;
    setStatus("analyzing");
    setProgress(0);
    setSampledFrames(0);
    setReport(null);
    setMessage("Preparando el vídeo…");

    try {
      const metadataDuration = await waitForMetadata(video);
      const duration = Number.isFinite(metadataDuration) && metadataDuration > 0
        ? metadataDuration
        : Math.max(1, durationHint || 1);

      // v0.23: ~35-55% más densidad temporal que v0.22 en una partida normal,
      // pero con límite para que siga siendo viable en iPhone.
      const step = Math.max(.30, duration / 560);
      const lastTime = Math.max(.1, duration - .08);
      const sampleTimes: number[] = [];
      for (let second = .08; second <= lastTime && sampleTimes.length < 620; second += step) {
        sampleTimes.push(Math.min(lastTime, second));
      }

      const width = 360;
      const aspect = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoHeight / video.videoWidth : 9 / 16;
      const height = Math.max(160, Math.min(270, Math.round(width * aspect)));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("canvas-unavailable");

      const detector = createAutoDetectorState();
      let previousGray: Uint8Array | undefined;
      const events: Array<ReturnType<typeof detectionToVideoEvent>> = [];
      let detectionIndex = 0;

      setMessage(`Barrido fino · ${sampleTimes.length} fotogramas`);

      for (let index = 0; index < sampleTimes.length; index += 1) {
        if (cancelRef.current) return;
        const second = sampleTimes[index];
        await seekVideo(video, second);
        if (cancelRef.current) return;

        try {
          context.drawImage(video, 0, 0, width, height);
          const image = context.getImageData(0, 0, width, height);
          const frame = analyzeFrame(image, previousGray);
          previousGray = frame.gray;
          detector.previousGray = frame.gray;
          const result = detectFrameEvents(detector, frame.metrics, second, mode, sensitivity);
          for (const detection of result.detections) {
            events.push(detectionToVideoEvent(detection, second, detectionIndex));
            detectionIndex += 1;
          }
        } catch {
          // Un fotograma corrupto/no decodificado no debe abortar el vídeo completo.
        }

        if (index % 6 === 0 || index === sampleTimes.length - 1) {
          setSampledFrames(index + 1);
          setProgress(Math.round(((index + 1) / sampleTimes.length) * 100));
          await sleep(0);
        }
      }

      const finalReport = buildVideoReviewReport(events, duration);
      setReport(finalReport);
      setProgress(100);
      setStatus("done");
      setMessage(`${finalReport.events.length} señales limpias · ${finalReport.sequences.length} secuencias · ${finalReport.moments.length} ventanas · evidencia ${finalReport.signalQuality.toLowerCase()}`);
    } catch {
      setStatus("error");
      setMessage("No se pudo decodificar el vídeo para el análisis local. Prueba con el MP4 original o vuelve a importarlo.");
    }
  };

  if (!src) return null;

  const chronological = report ? [...report.events].sort((a, b) => a.second - b.second) : [];

  return <section className="video-analyzer-v22 video-analyzer-v23">
    <video ref={videoRef} src={src} muted playsInline preload="auto" className="video-analyzer-source-v22" aria-hidden="true" />
    <canvas ref={canvasRef} className="video-analyzer-canvas-v22" aria-hidden="true" />

    <div className="video-analyzer-head-v22">
      <div>
        <span className="eyebrow">Analizador de vídeo v0.23</span>
        <h3>Barrido fino + secuencias tácticas</h3>
        <p>Extrae más fotogramas, elimina señales duplicadas y conecta combate, muerte, super y objetivo en ventanas que se pueden revisar desde antes de la decisión.</p>
      </div>
      <div className="video-analyzer-controls-v22">
        <label>Sensibilidad<select value={sensitivity} disabled={status === "analyzing"} onChange={(event) => setSensitivity(event.target.value as AutoReviewSensitivity)}><option>Baja</option><option>Media</option><option>Alta</option></select></label>
        {status === "analyzing"
          ? <button type="button" className="secondary-button" onClick={cancelAnalysis}>Detener</button>
          : <button type="button" className="primary-button" onClick={() => void analyzeVideo()}>{report ? "Reanalizar vídeo" : "Analizar vídeo completo"}</button>}
      </div>
    </div>

    {(status === "analyzing" || message) && <div className={`video-analysis-progress-v22 state-${status}`}>
      <div><span>{message || "Analizando…"}</span><b>{status === "analyzing" ? `${progress}%` : status === "done" ? "Completado" : ""}</b></div>
      <i><em style={{ width: `${progress}%` }} /></i>
      {status === "analyzing" && <small>{sampledFrames} fotogramas procesados · análisis local, sin subir el vídeo</small>}
    </div>}

    {report && <>
      <div className="video-analysis-summary-v22">
        <article><span>Evidencia</span><strong>{report.signalQuality}</strong><small>Confianza media {report.averageConfidence}%</small></article>
        <article><span>Señales</span><strong>{report.events.length}</strong><small>Tras deduplicación temporal</small></article>
        <article><span>Secuencias</span><strong>{report.sequences.length}</strong><small>Cadenas tácticas detectadas</small></article>
        <article><span>Momentos</span><strong>{report.moments.length}</strong><small>Ventanas para revisar</small></article>
        <article className="wide"><span>Lectura principal</span><b>{report.headline}</b></article>
      </div>

      <div className="video-analysis-phases-v22">
        {report.phases.map((phase) => <article key={phase.label}>
          <div><b>{phase.label}</b><small>{formatLiveTime(Math.round(phase.startSecond))}–{formatLiveTime(Math.round(phase.endSecond))}</small></div>
          <strong>{phase.activity}</strong>
          <span>{phase.events} señales · {phase.dominant}</span>
          <i><em style={{ width: `${phase.activity}%` }} /></i>
        </article>)}
      </div>

      {report.sequences.length > 0 && <div className="video-sequences-v23">
        <div className="video-column-title-v22"><span>Secuencias tácticas</span><small>Empiezan unos segundos antes de la primera señal para revisar la decisión que abrió la cadena.</small></div>
        <div className="video-sequence-grid-v23">
          {report.sequences.slice(0, 6).map((sequence, index) => <button type="button" key={sequence.id} className={`priority-${sequence.priority.toLowerCase().replace("í", "i")}`} onClick={() => onSeek?.(sequence.startSecond)}>
            <time>{formatLiveTime(Math.round(sequence.startSecond))}</time>
            <div><span>#{index + 1} · {sequence.priority} · score {sequence.score} · {sequence.confidence}%</span><b>{sequence.label}</b><small>{sequence.explanation}</small></div>
            <strong>Revisar</strong>
          </button>)}
        </div>
      </div>}

      <div className="video-analysis-grid-v22">
        <div className="video-key-moments-v22">
          <div className="video-column-title-v22"><span>Momentos prioritarios</span><small>Ordenados por impacto y coherencia. El salto comienza antes del evento.</small></div>
          {report.moments.slice(0, 6).map((moment, index) => <button type="button" key={`${moment.startSecond}-${moment.label}`} className={`tone-${moment.tone}`} onClick={() => onSeek?.(moment.startSecond)}>
            <time>{formatLiveTime(Math.round(moment.startSecond))}</time>
            <div><span>#{index + 1} · score {moment.score} · confianza {moment.confidence}%</span><b>{moment.label}</b><small>{moment.reason}</small></div>
            <strong>Ver</strong>
          </button>)}
          {!report.moments.length && <div className="empty-state">No hay una ventana con señal suficiente para priorizar.</div>}
        </div>

        <div className="video-event-timeline-v22">
          <div className="video-column-title-v22"><span>Cronología detectada</span><small>Pulsa una señal para empezar 2 s antes y revisar el contexto.</small></div>
          {chronological.slice(0, 30).map((event) => <button type="button" key={event.id} onClick={() => onSeek?.(Math.max(0, event.second - 2))}>
            <time>{formatLiveTime(Math.round(event.second))}</time>
            <div><b>{event.label}</b><small>{event.category} · {event.confidence}%</small></div>
          </button>)}
          {chronological.length > 30 && <small className="video-more-events-v22">Se muestran las primeras 30 de {chronological.length} señales para mantener la revisión manejable.</small>}
        </div>
      </div>
    </>}

    <p className="video-analysis-disclaimer-v22">El análisis sigue siendo heurístico: detecta patrones visuales y relaciones temporales, pero no identifica de forma fiable qué equipo ejecutó cada super, muerte u objetivo. Las secuencias son ventanas de revisión, no afirmaciones causales definitivas.</p>
  </section>;
}
