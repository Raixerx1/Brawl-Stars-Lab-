"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
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
import { BrawlerPortrait } from "./GameArtwork";

type CaptureStatus = "idle" | "sharing" | "review";

type EventTemplate = {
  label: string;
  category: string;
  tone: LiveEventTone;
  shortcut: string;
};

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
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);

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

  useEffect(() => {
    setSessions(readLiveReviews());
    setCaptureSupported(Boolean(navigator.mediaDevices?.getDisplayMedia));
  }, []);

  useEffect(() => {
    if (status !== "sharing") return;
    const interval = window.setInterval(() => {
      if (!startedAtRef.current) return;
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
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
    setStatus("review");
    setMessage("Captura finalizada; revisa los eventos y guarda la sesión");
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
        setStatus("review");
        setMessage("El navegador ha detenido la pantalla compartida");
      });

      startedAtRef.current = Date.now();
      setElapsed(0);
      setEvents([]);
      setNote("");
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
    setElapsed(0);
    setEvents([]);
    setNote("");
    setCustomEvent("");
    setLastFrame(null);
    setSavedToLearning(false);
    setMessage("");
  };

  const addEvent = (template: EventTemplate) => {
    setEvents((current) => [...current, {
      id: crypto.randomUUID(),
      second: elapsed,
      label: template.label,
      category: template.category,
      tone: template.tone,
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
    }]);
    setCustomEvent("");
  };

  const removeEvent = (id: string) => setEvents((current) => current.filter((event) => event.id !== id));

  const currentSession = (): LiveReviewSession | null => {
    if (!selectedMap || !selectedBrawler) return null;
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

  return <div className="live-review-v8">
    {message && <div className="draft-toast">{message}</div>}

    <section className="panel live-setup-v8">
      <div className="section-title">
        <div><span className="eyebrow">Live Review v0.8</span><h2>Preparar sesión</h2></div>
        <span className={`live-privacy-chip ${status}`}>{status === "sharing" ? "● Captura activa" : "Procesamiento local"}</span>
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

      <div className="live-main-actions">
        {status === "idle" && <button type="button" className="primary-button" onClick={startCapture} disabled={!captureSupported}>Compartir pantalla o ventana</button>}
        {status === "sharing" && <button type="button" className="live-stop-button" onClick={finishCapture}>Detener captura</button>}
        {status !== "idle" && <button type="button" className="secondary-button" onClick={() => captureFrame(true)}>Guardar fotograma</button>}
        {status !== "idle" && <button type="button" className="secondary-button" onClick={resetSession}>Nueva sesión</button>}
      </div>
      <p className="live-privacy-note">La imagen se muestra únicamente en tu navegador. La aplicación no graba ni envía automáticamente el vídeo. Los eventos y resúmenes se guardan solo cuando pulsas guardar.</p>
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

    <section className="panel live-timeline-panel">
      <div className="section-title"><div><span className="eyebrow">Cronología</span><h2>Momentos de la partida</h2></div><span>{formatLiveTime(elapsed)}</span></div>
      <div className="live-timeline-list">
        {events.length ? [...events].reverse().map((event) => <article className={`tone-${event.tone}`} key={event.id}>
          <time>{formatLiveTime(event.second)}</time>
          <div><b>{event.label}</b><small>{event.category}</small></div>
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
          <div><b>{session.brawler} · {session.mapName}</b><small>{session.result || "Sin resultado"} · {formatLiveTime(session.duration)} · {session.events.length} eventos</small><p>{session.summary.headline}</p></div>
          <button type="button" onClick={() => removeSession(session.id)} aria-label={`Eliminar revisión de ${session.brawler}`}>×</button>
        </article>)}
        {!sessions.length && <div className="empty-state">Las revisiones guardadas aparecerán aquí y permanecerán en este dispositivo.</div>}
      </div>
    </section>
  </div>;
}
