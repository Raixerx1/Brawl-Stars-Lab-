"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeFrame,
  createAutoDetectorState,
  detectFrameEvents,
  type AutoDetection,
} from "@/lib/auto-vision";
import {
  buildVideoReviewReport,
  dedupeVideoEvents,
  detectionToVideoEvent,
  type VideoReviewEvent,
} from "@/lib/video-review";
import {
  applyVideoEventOverrides,
  buildVideoRefineWindows,
  buildVideoTacticalReadout,
  frameReviewAttention,
  type VideoEventOverride,
} from "@/lib/video-review-v25";
import {
  buildVideoStateReadout,
  finalizeVideoHudSamples,
  sampleVideoHudFrame,
  type VideoHudRawSample,
  type VideoHudSnapshot,
} from "@/lib/video-review-v26";
import {
  adjustConfidence,
  isDetectionSuppressed,
  readAutoFeedback,
  registerAutoFeedback,
  saveAutoFeedback,
} from "@/lib/auto-learning";
import type {
  AutoFeedbackProfile,
  AutoReviewSensitivity,
  MatchResult,
} from "@/lib/types";
import { formatLiveTime } from "@/lib/live-review";

type AnalysisStatus = "idle" | "analyzing" | "done" | "error";
type ScanStats = { coarse: number; refined: number; windows: number };

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
  if (Math.abs(video.currentTime - second) < .018 && video.readyState >= 2) {
    await sleep(8);
    return;
  }
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
  // Algunos WebKit entregan `seeked` antes de que drawImage vea el frame nuevo.
  await sleep(8);
}

function adjustedDetection(
  detection: AutoDetection,
  feedback: AutoFeedbackProfile,
): AutoDetection | null {
  const confidence = adjustConfidence(detection.confidence, detection.key, feedback);
  if (isDetectionSuppressed(confidence, detection.key, feedback)) return null;
  return { ...detection, confidence };
}

const deathKeys = new Set(["death", "ally-death", "enemy-death"]);

export default function VideoMatchAnalyzer({
  src,
  mode,
  mapName,
  brawlerName,
  brawlerRole,
  result,
  durationHint,
  onSeek,
}: {
  src: string | null;
  mode: string;
  mapName?: string;
  brawlerName?: string;
  brawlerRole?: string;
  result?: MatchResult;
  durationHint?: number;
  onSeek?: (second: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cancelRef = useRef(false);
  const feedbackRecordedRef = useRef(new Set<string>());
  const [sensitivity, setSensitivity] = useState<AutoReviewSensitivity>("Media");
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [sampledFrames, setSampledFrames] = useState(0);
  const [analysisDuration, setAnalysisDuration] = useState(0);
  const [baseEvents, setBaseEvents] = useState<VideoReviewEvent[]>([]);
  const [hudSnapshots, setHudSnapshots] = useState<VideoHudSnapshot[]>([]);
  const [overrides, setOverrides] = useState<Record<string, VideoEventOverride | undefined>>({});
  const [scanStats, setScanStats] = useState<ScanStats>({ coarse: 0, refined: 0, windows: 0 });
  const [feedbackProfile, setFeedbackProfile] = useState<AutoFeedbackProfile>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = readAutoFeedback();
    setFeedbackProfile(stored);
  }, []);

  useEffect(() => {
    cancelRef.current = true;
    feedbackRecordedRef.current.clear();
    setStatus("idle");
    setProgress(0);
    setSampledFrames(0);
    setAnalysisDuration(0);
    setBaseEvents([]);
    setHudSnapshots([]);
    setOverrides({});
    setScanStats({ coarse: 0, refined: 0, windows: 0 });
    setMessage("");
  }, [src]);

  const effectiveEvents = useMemo(
    () => applyVideoEventOverrides(baseEvents, overrides),
    [baseEvents, overrides],
  );

  const report = useMemo(
    () => status === "done" && analysisDuration > 0
      ? buildVideoReviewReport(effectiveEvents, analysisDuration)
      : null,
    [status, analysisDuration, effectiveEvents],
  );

  const tactical = useMemo(
    () => report ? buildVideoTacticalReadout(report, {
      mode,
      mapName,
      brawlerName,
      brawlerRole,
      result,
    }) : null,
    [report, mode, mapName, brawlerName, brawlerRole, result],
  );

  const stateModel = useMemo(
    () => report && analysisDuration > 0
      ? buildVideoStateReadout(hudSnapshots, effectiveEvents, mode, analysisDuration)
      : null,
    [report, hudSnapshots, effectiveEvents, mode, analysisDuration],
  );

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
    setBaseEvents([]);
    setHudSnapshots([]);
    setOverrides({});
    setScanStats({ coarse: 0, refined: 0, windows: 0 });
    setMessage("Preparando el vídeo…");

    try {
      const metadataDuration = await waitForMetadata(video);
      const duration = Number.isFinite(metadataDuration) && metadataDuration > 0
        ? metadataDuration
        : Math.max(1, durationHint || 1);
      setAnalysisDuration(duration);

      // v0.31 mantiene el doble barrido y añade lectura de primeras bajas,
      // trades, reagrupación y pérdidas de ventaja sobre el estado estabilizado.
      // jugador por centro de cámara, calibración por contraste, mediana temporal
      // e histéresis para reducir falsos positivos de recursos.
      const coarseStep = Math.max(.36, duration / 360);
      const lastTime = Math.max(.1, duration - .06);
      const coarseTimes: number[] = [];
      for (let second = .06; second <= lastTime && coarseTimes.length < 390; second += coarseStep) {
        coarseTimes.push(Math.min(lastTime, second));
      }

      const width = 480;
      const aspect = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoHeight / video.videoWidth : 9 / 16;
      const height = Math.max(190, Math.min(340, Math.round(width * aspect)));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("canvas-unavailable");

      const feedback = readAutoFeedback();
      setFeedbackProfile(feedback);
      const detector = createAutoDetectorState();
      let previousGray: Uint8Array | undefined;
      const events: VideoReviewEvent[] = [];
      const hudSamples: VideoHudRawSample[] = [];
      const refineCandidates: Array<{ second: number; score: number }> = [];
      let detectionIndex = 0;

      setMessage(`Barrido global + HUD estabilizado · ${coarseTimes.length} fotogramas`);

      for (let index = 0; index < coarseTimes.length; index += 1) {
        if (cancelRef.current) return;
        const second = coarseTimes[index];
        await seekVideo(video, second);
        if (cancelRef.current) return;

        try {
          context.drawImage(video, 0, 0, width, height);
          const image = context.getImageData(0, 0, width, height);
          const frame = analyzeFrame(image, previousGray);
          previousGray = frame.gray;
          detector.previousGray = frame.gray;
          hudSamples.push(sampleVideoHudFrame(image, second, mode));
          const attention = frameReviewAttention(frame.metrics);
          if (attention >= .105) refineCandidates.push({ second, score: attention });

          const detectionResult = detectFrameEvents(detector, frame.metrics, second, mode, sensitivity);
          for (const rawDetection of detectionResult.detections) {
            const detection = adjustedDetection(rawDetection, feedback);
            if (!detection) continue;
            events.push(detectionToVideoEvent(detection, second, detectionIndex));
            detectionIndex += 1;
            refineCandidates.push({ second, score: Math.min(1, Math.max(.72, attention + detection.confidence * .42)) });
          }
        } catch {
          // Un fotograma corrupto/no decodificado no debe abortar el vídeo completo.
        }

        if (index % 5 === 0 || index === coarseTimes.length - 1) {
          setSampledFrames(index + 1);
          setProgress(Math.round(((index + 1) / Math.max(1, coarseTimes.length)) * 68));
          await sleep(0);
        }
      }

      const windows = buildVideoRefineWindows(refineCandidates, duration, 16);
      const totalSpan = windows.reduce((sum, window) => sum + Math.max(.1, window.endSecond - window.startSecond), 0);
      const refineStep = Math.max(.12, totalSpan / 420);
      const refinePlans = windows.map((window) => {
        const times: number[] = [];
        for (let second = window.startSecond; second <= window.endSecond && times.length < 48; second += refineStep) {
          times.push(Math.min(window.endSecond, second));
        }
        return { window, times };
      });
      const totalRefineFrames = refinePlans.reduce((sum, plan) => sum + plan.times.length, 0);
      let refinedFrames = 0;

      if (windows.length) setMessage(`Refinado adaptativo + recursos estabilizados · ${windows.length} ventanas`);

      for (const plan of refinePlans) {
        if (cancelRef.current) return;
        const windowDetector = createAutoDetectorState();
        windowDetector.samples = 11;
        if (detector.baseline) {
          windowDetector.baseline = detector.baseline;
          windowDetector.previous = detector.baseline;
        }
        let windowPreviousGray: Uint8Array | undefined;

        for (const second of plan.times) {
          if (cancelRef.current) return;
          await seekVideo(video, second);
          if (cancelRef.current) return;

          try {
            context.drawImage(video, 0, 0, width, height);
            const image = context.getImageData(0, 0, width, height);
            const frame = analyzeFrame(image, windowPreviousGray);
            windowPreviousGray = frame.gray;
            windowDetector.previousGray = frame.gray;
            if (refinedFrames % 2 === 0) hudSamples.push(sampleVideoHudFrame(image, second, mode));
            const detectionResult = detectFrameEvents(windowDetector, frame.metrics, second, mode, sensitivity);
            for (const rawDetection of detectionResult.detections) {
              const detection = adjustedDetection(rawDetection, feedback);
              if (!detection) continue;
              events.push(detectionToVideoEvent(detection, second, detectionIndex));
              detectionIndex += 1;
            }
          } catch {
            // Mantener el resto de la ventana aunque falle un seek puntual.
          }

          refinedFrames += 1;
          if (refinedFrames % 5 === 0 || refinedFrames === totalRefineFrames) {
            setSampledFrames(coarseTimes.length + refinedFrames);
            const refineProgress = totalRefineFrames
              ? refinedFrames / totalRefineFrames
              : 1;
            setProgress(Math.round(68 + refineProgress * 30));
            await sleep(0);
          }
        }
      }

      const cleaned = dedupeVideoEvents(events);
      const finalizedHud = finalizeVideoHudSamples(hudSamples);
      const finalReport = buildVideoReviewReport(cleaned, duration);
      setBaseEvents(cleaned);
      setHudSnapshots(finalizedHud);
      setScanStats({ coarse: coarseTimes.length, refined: refinedFrames, windows: windows.length });
      setProgress(100);
      setStatus("done");
      setMessage(`${finalReport.events.length} señales · ${finalReport.teamBalance.classifiedDeaths} bajas · ${finalizedHud.length} estados HUD estabilizados · ${windows.length} ventanas refinadas · evidencia ${finalReport.signalQuality.toLowerCase()}`);
    } catch {
      setStatus("error");
      setMessage("No se pudo decodificar el vídeo para el análisis local. Prueba con el MP4 original o vuelve a importarlo.");
    }
  };

  const updateOverride = (item: VideoReviewEvent, override?: VideoEventOverride) => {
    setOverrides((current) => {
      const next = { ...current };
      if (!override || override === item.key) delete next[item.id];
      else next[item.id] = override;
      return next;
    });

    if (!override || override === item.key) return;
    const feedbackKey = `${item.id}:${override}`;
    if (feedbackRecordedRef.current.has(feedbackKey)) return;
    feedbackRecordedRef.current.add(feedbackKey);

    let nextProfile = feedbackProfile;
    if (override === "drop") {
      nextProfile = registerAutoFeedback(nextProfile, item.key, "rejected");
    } else {
      nextProfile = registerAutoFeedback(nextProfile, item.key, "rejected");
      nextProfile = registerAutoFeedback(nextProfile, override, "accepted");
    }
    setFeedbackProfile(nextProfile);
    saveAutoFeedback(nextProfile);
  };

  if (!src) return null;

  const chronological = [...baseEvents].sort((a, b) => a.second - b.second);
  const corrections = Object.keys(overrides).length;

  return <section className="video-analyzer-v22 video-analyzer-v23 video-analyzer-v24 video-analyzer-v25 video-analyzer-v26 video-analyzer-v27 video-analyzer-v30 video-analyzer-v31">
    <video ref={videoRef} src={src} muted playsInline preload="auto" className="video-analyzer-source-v22" aria-hidden="true" />
    <canvas ref={canvasRef} className="video-analyzer-canvas-v22" aria-hidden="true" />

    <div className="video-analyzer-head-v22">
      <div>
        <span className="eyebrow">Analizador de partidas v0.31</span>
        <h3>Primeras bajas + trades + control de momentum</h3>
        <p>Reconstruye cada pelea desde 3v3, comprueba si conservas la primera ventaja, mide la respuesta de trade y detecta reagrupaciones o persecuciones que devuelven el momentum.</p>
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
      {status === "analyzing" && <small>{sampledFrames} fotogramas procesados · visión y análisis íntegramente locales</small>}
      {status === "done" && <small>{scanStats.coarse} globales + {scanStats.refined} refinados · {hudSnapshots.length} estados HUD · {scanStats.windows} ventanas · {corrections} correcciones manuales</small>}
    </div>}

    {report && tactical && stateModel && <>
      <div className="video-analysis-summary-v22">
        <article><span>Evidencia</span><strong>{report.signalQuality}</strong><small>Confianza media {report.averageConfidence}%</small></article>
        <article><span>Tu muerte</span><strong>{report.teamBalance.ownDeaths}</strong><small>Transición central + respawn</small></article>
        <article><span>Aliados caídos</span><strong>{report.teamBalance.allyDeaths}</strong><small>HUD rojo · editable</small></article>
        <article><span>Rivales eliminados</span><strong>{report.teamBalance.enemyDeaths}</strong><small>HUD azul · editable</small></article>
        <article><span>Tracking estable</span><strong>{stateModel.stableTrackingShare}%</strong><small>Jugador seguido por cámara</small></article>
        <article><span>HP legible</span><strong>{stateModel.hpReadableShare}%</strong><small>Proxy visual de barra</small></article>
        <article><span>Ventaja numérica</span><strong>{stateModel.advantageSeconds}s</strong><small>3v2/3v1 aproximado</small></article>
        <article><span>Inferioridad</span><strong>{stateModel.disadvantageSeconds}s</strong><small>2v3/1v3 aproximado</small></article>
        <article><span>Secuencias</span><strong>{report.sequences.length}</strong><small>Cadenas tácticas</small></article>
        <article><span>Momentos</span><strong>{report.moments.length}</strong><small>Ventanas prioritarias</small></article>
        <article><span>Alta confianza</span><strong>{tactical.highConfidenceShare}%</strong><small>Señales ≥70%</small></article>
        <article><span>Calidad HUD</span><strong>{stateModel.hudQualityScore}/100</strong><small>{stateModel.hudQuality} · estabilizada</small></article>
        <article className="wide"><span>Lectura principal</span><b>{report.headline}</b></article>
      </div>

      <section className="video-state-v26">
        <div className="video-state-head-v26">
          <div>
            <span className="eyebrow">Modelo de estado v0.31</span>
            <h4>{brawlerName || "Brawler seleccionado"} · identidad anclada al contexto</h4>
            <small>Tracking por centro de cámara + suavizado temporal. Los recursos solo se consideran legibles cuando existe señal y contraste suficientes dentro del propio vídeo.</small>
          </div>
          <span>{stateModel.hudQuality} · {stateModel.hudQualityScore}/100</span>
        </div>

        <section className="video-momentum-v31">
          <div className="video-momentum-head-v31">
            <div>
              <span className="eyebrow">Control de momentum v0.31</span>
              <h4>Qué ocurre después de la primera baja</h4>
              <small>Solo cuenta peleas que parten de 3v3 y bajas con confianza suficiente. Los momentos son clicables y se recalculan con tus correcciones.</small>
            </div>
            <span>{stateModel.lateGameSwings} swing{stateModel.lateGameSwings === 1 ? "" : "s"} final{stateModel.lateGameSwings === 1 ? "" : "es"}</span>
          </div>
          <div className="video-momentum-metrics-v31">
            <article><span>Primera baja</span><b>{stateModel.fightOpenersFor}–{stateModel.fightOpenersAgainst}</b><small>a favor · en contra</small></article>
            <article><span>Ventaja conservada</span><b>{stateModel.fightOpenersFor ? `${stateModel.openerRetentionRate}%` : "—"}</b><small>{stateModel.retainedOpenersFor}/{stateModel.fightOpenersFor} primeras bajas</small></article>
            <article><span>Trade defensivo</span><b>{stateModel.fightOpenersAgainst ? `${stateModel.tradeResponseRate}%` : "—"}</b><small>{stateModel.tradeResponses}/{stateModel.fightOpenersAgainst} respuestas ≤5,5 s</small></article>
            <article><span>Reagrupación limpia</span><b>{stateModel.disadvantageRecoveries ? `${stateModel.cleanRegroupRate}%` : "—"}</b><small>{stateModel.cleanRegroups}/{stateModel.disadvantageRecoveries} vueltas a igualdad</small></article>
            <article><span>Recuperación activa</span><b>{stateModel.activeRecoveries}</b><small>{stateModel.disadvantageRecoveries}/{stateModel.disadvantageEpisodes} inferioridades recuperadas</small></article>
            <article><span>Tiempo de recuperación</span><b>{stateModel.medianRecoverySeconds === undefined ? "—" : `${stateModel.medianRecoverySeconds}s`}</b><small>mediana hasta igualdad</small></article>
            <article><span>Ventajas devueltas</span><b>{stateModel.advantageReversals}</b><small>muerte antes de convertir</small></article>
            <article><span>Sobrepersecuciones</span><b>{stateModel.overchaseDeaths}</b><small>muerte post-wipe sin objetivo</small></article>
          </div>
          {stateModel.momentumMoments.length > 0 ? <div className="video-momentum-list-v31">
            {stateModel.momentumMoments.map((moment) => <button type="button" key={`${moment.kind}-${moment.second}-${moment.label}`} className={`kind-${moment.kind} ${moment.lateGame ? "is-late" : ""}`} onClick={() => onSeek?.(moment.second)}>
              <time>{formatLiveTime(Math.round(moment.second))}</time>
              <div><b>{moment.label}</b><small>{moment.detail}</small></div>
              <strong>Revisar</strong>
            </button>)}
          </div> : <p className="video-momentum-empty-v31">Todavía no hay una pelea 3v3 con señal suficiente para reconstruir su primera baja y respuesta.</p>}
        </section>

        <div className="video-state-metrics-v26">
          <article><span>Poca vida</span><b>{stateModel.lowHpShare}%</b><small>HP proxy ≤35%</small></article>
          <article><span>Poca munición</span><b>{stateModel.lowAmmoShare}%</b><small>0–1/3 estimada</small></article>
          <article><span>Super lista</span><b>{stateModel.superReadyShare}%</b><small>{stateModel.superHoldSeconds}s sostenida</small></article>
          <article><span>Hipercarga lista</span><b>{stateModel.hyperReadyShare}%</b><small>{stateModel.hyperHoldSeconds}s sostenida</small></article>
          {(mode === "Balón Brawl" || mode === "Atrapagemas") && <article><span>{mode === "Balón Brawl" ? "Balón probable" : "Portador probable"}</span><b>{stateModel.possessionShare}%</b><small>señal estabilizada cercana</small></article>}
          <article><span>Muertes críticas</span><b>{stateModel.criticalDeaths}</b><small>≥3 factores de riesgo</small></article>
          <article><span>Wipes rápidos</span><b>{stateModel.fastWipeConversions}</b><small>{stateModel.meanWipeConversionSeconds === undefined ? "sin conversión medible" : `media ${stateModel.meanWipeConversionSeconds} s`}</small></article>
          <article><span>Stagger</span><b>{stateModel.staggerRate}%</b><small>{stateModel.staggerDeaths}/{stateModel.staggerOpportunities} recuperaciones</small></article>
          <article><span>Resets válidos</span><b>{stateModel.acceptedSceneResets}</b><small>{stateModel.ignoredSceneResets} transición(es) ignorada(s)</small></article>
        </div>

        <div className="video-teamstate-v26">
          <div className="video-column-title-v22"><span>Estado numérico reconstruido</span><small>Las bajas corregidas recalculan inmediatamente estas ventanas. En modos con respawn se usa una ventana temporal aproximada; en Noqueo dura hasta cambio de ronda.</small></div>
          <div className="video-teamstate-track-v26">
            {stateModel.teamWindows.map((window, index) => <button
              type="button"
              key={`${window.startSecond}-${window.label}-${index}`}
              className={window.friendlyAlive > window.enemyAlive ? "is-up" : window.friendlyAlive < window.enemyAlive ? "is-down" : "is-even"}
              onClick={() => onSeek?.(Math.max(0, window.startSecond - 1.5))}
            >
              <b>{window.label}</b>
              <span>{formatLiveTime(Math.round(window.startSecond))}–{formatLiveTime(Math.round(window.endSecond))}</span>
              <small>{Math.round(window.endSecond - window.startSecond)} s · {window.confidence}%</small>
            </button>)}
          </div>
        </div>

        <div className="video-state-columns-v26">
          <div><b>Lectura de recursos</b>{stateModel.strengths.length ? stateModel.strengths.map((text) => <p key={text}>+ {text}</p>) : <p>Sin patrón positivo de recursos suficientemente estable.</p>}</div>
          <div><b>Riesgos de estado</b>{stateModel.risks.length ? stateModel.risks.map((text) => <p key={text}>− {text}</p>) : <p>No aparece un riesgo de HP/munición/super dominante.</p>}</div>
          <div><b>Qué revisar</b>{stateModel.actions.map((text) => <p key={text}>→ {text}</p>)}</div>
        </div>

        {stateModel.moments.length > 0 && <div className="video-state-moments-v26">
          <div className="video-column-title-v22"><span>Momentos de estado prioritarios</span><small>Incluye estado previo a muertes de alto riesgo y tramos donde Super/Hipercarga permanecen listas el tiempo suficiente para revisar el timing.</small></div>
          {stateModel.moments.map((moment) => <button type="button" key={`${moment.second}-${moment.detail}`} className={`priority-${moment.priority.toLowerCase()}`} onClick={() => onSeek?.(moment.second)}>
            <time>{formatLiveTime(Math.round(moment.second))}</time>
            <div><b>{moment.label}</b><small>{moment.detail}</small></div>
            <strong>Ver</strong>
          </button>)}
        </div>}
      </section>

      <section className="video-tactical-v25">
        <div className="video-tactical-head-v25">
          <div><span className="eyebrow">Lectura táctica contextual</span><h4>{tactical.focus}</h4><small>{brawlerName || "Brawler"}{brawlerRole ? ` · ${brawlerRole}` : ""}{mapName ? ` · ${mapName}` : ""}{mode ? ` · ${mode}` : ""}</small></div>
          <span className={`video-signal-v25 signal-${report.signalQuality.toLowerCase()}`}>{report.signalQuality}</span>
        </div>
        <div className="video-tactical-metrics-v25">
          <article><span>Ventaja → objetivo</span><b>{tactical.pressureConverted}/{tactical.pressureWindows}</b><small>{tactical.pressureConversionRate}% en ≤7,5 s</small></article>
          <article><span>Baja propia/aliada → objetivo</span><b>{tactical.deathsWithObjectiveCost}/{tactical.friendlyDeaths}</b><small>{tactical.deathCostRate}% con coste temporal</small></article>
          <article><span>Trade recuperado</span><b>{tactical.tradesRecovered}/{tactical.friendlyDeaths}</b><small>{tactical.tradeRecoveryRate}% en ≤5,5 s</small></article>
          <article><span>Super → follow-up</span><b>{tactical.superWithFollowup}/{tactical.superUses}</b><small>{tactical.superFollowupRate}% en ≤7 s</small></article>
        </div>
        <div className="video-tactical-columns-v25">
          <div><b>Fortalezas detectadas</b>{tactical.strengths.length ? tactical.strengths.map((text) => <p key={text}>+ {text}</p>) : <p>Sin patrón positivo suficientemente repetido.</p>}</div>
          <div><b>Riesgos prioritarios</b>{tactical.risks.length ? tactical.risks.map((text) => <p key={text}>− {text}</p>) : <p>No aparece un riesgo dominante con la señal actual.</p>}</div>
          <div><b>Siguiente revisión</b>{tactical.actions.map((text) => <p key={text}>→ {text}</p>)}</div>
        </div>
        <small className="video-tactical-note-v25">Las tasas son asociaciones temporales del vídeo, no causalidad ni win rate. Una corrección manual de las bajas recalcula inmediatamente todo el informe.</small>
      </section>

      <div className="video-analysis-phases-v22">
        {report.phases.map((phase) => <article key={phase.label}>
          <div><b>{phase.label}</b><small>{formatLiveTime(Math.round(phase.startSecond))}–{formatLiveTime(Math.round(phase.endSecond))}</small></div>
          <strong>{phase.activity}</strong>
          <span>{phase.events} señales · {phase.dominant}</span>
          <i><em style={{ width: `${phase.activity}%` }} /></i>
        </article>)}
      </div>

      {report.sequences.length > 0 && <div className="video-sequences-v23">
        <div className="video-column-title-v22"><span>Secuencias tácticas</span><small>Se recalculan al corregir una baja. Empiezan antes del evento para buscar la primera decisión que abrió la ventana.</small></div>
        <div className="video-sequence-grid-v23">
          {report.sequences.slice(0, 8).map((sequence, index) => <button type="button" key={sequence.id} className={`priority-${sequence.priority.toLowerCase().replace("í", "i")}`} onClick={() => onSeek?.(sequence.startSecond)}>
            <time>{formatLiveTime(Math.round(sequence.startSecond))}</time>
            <div><span>#{index + 1} · {sequence.priority} · score {sequence.score} · {sequence.confidence}%</span><b>{sequence.label}</b><small>{sequence.explanation}</small></div>
            <strong>Revisar</strong>
          </button>)}
        </div>
      </div>}

      <div className="video-analysis-grid-v22">
        <div className="video-key-moments-v22">
          <div className="video-column-title-v22"><span>Momentos prioritarios</span><small>Ordenados por impacto, coherencia temporal y confianza.</small></div>
          {report.moments.slice(0, 8).map((moment, index) => <button type="button" key={`${moment.startSecond}-${moment.label}`} className={`tone-${moment.tone}`} onClick={() => onSeek?.(moment.startSecond)}>
            <time>{formatLiveTime(Math.round(moment.startSecond))}</time>
            <div><span>#{index + 1} · score {moment.score} · confianza {moment.confidence}%</span><b>{moment.label}</b><small>{moment.reason}</small></div>
            <strong>Ver</strong>
          </button>)}
          {!report.moments.length && <div className="empty-state">No hay una ventana con señal suficiente para priorizar.</div>}
        </div>

        <div className="video-event-timeline-v22 video-event-timeline-v25">
          <div className="video-column-title-v22"><span>Cronología + corrección</span><small>Clasifica YO / ALIADO / RIVAL o descarta falsos positivos. El aprendizaje queda guardado localmente.</small></div>
          {chronological.slice(0, 40).map((item) => {
            const override = overrides[item.id];
            const dropped = override === "drop";
            const deathLike = deathKeys.has(item.key);
            return <div className={`video-event-row-v25 ${dropped ? "is-dropped" : ""}`} key={item.id}>
              <button type="button" onClick={() => onSeek?.(Math.max(0, item.second - 2))}>
                <time>{formatLiveTime(Math.round(item.second))}</time>
                <div><b>{item.label}</b><small>{item.category} · {item.confidence}%</small></div>
              </button>
              {deathLike ? <select aria-label={`Corregir ${item.label}`} value={override || item.key} onChange={(event) => updateOverride(item, event.target.value as VideoEventOverride)}>
                <option value="death">YO</option>
                <option value="ally-death">ALIADO</option>
                <option value="enemy-death">RIVAL</option>
                <option value="drop">DESCARTAR</option>
              </select> : <button type="button" className="video-event-drop-v25" onClick={() => updateOverride(item, dropped ? undefined : "drop")} aria-label={dropped ? `Restaurar ${item.label}` : `Descartar ${item.label}`}>{dropped ? "↺" : "×"}</button>}
            </div>;
          })}
          {chronological.length > 40 && <small className="video-more-events-v22">Se muestran las primeras 40 de {chronological.length} señales.</small>}
        </div>
      </div>
    </>}

    <p className="video-analysis-disclaimer-v22">Análisis heurístico y local. v0.31 relaciona primeras bajas, trades y cambios numéricos por proximidad temporal; HP, munición, super, hipercarga, posesión, posición y objetivo siguen siendo proxies visuales. Sirve para priorizar el replay, no sustituye una lectura oficial del HUD.</p>
  </section>;
}
