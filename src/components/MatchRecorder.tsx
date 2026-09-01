"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Brawler, MapProfile, MatchResult } from "@/lib/types";
import {
  deleteMatchRecording,
  getMatchRecording,
  listMatchRecordings,
  saveMatchRecording,
  type MatchRecordingMeta,
} from "@/lib/recording-store";
import { formatLiveTime } from "@/lib/live-review";
import { BrawlerPortrait } from "./GameArtwork";
import VideoMatchAnalyzer from "./VideoMatchAnalyzer";

type RecorderStatus = "idle" | "recording" | "ready";

type OptionalDisplayMediaDevices = Partial<MediaDevices> & {
  getDisplayMedia?: (constraints?: DisplayMediaStreamOptions) => Promise<MediaStream>;
};

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=h264,aac",
  "video/mp4",
];

const readableBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

function bestMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function displayMediaDevices(): OptionalDisplayMediaDevices | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.mediaDevices as OptionalDisplayMediaDevices | undefined;
}

export default function MatchRecorder({ maps, brawlers }: { maps: MapProfile[]; brawlers: Brawler[] }) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [mapSlug, setMapSlug] = useState(maps[0]?.slug || "");
  const [brawlerName, setBrawlerName] = useState(brawlers[0]?.name || "");
  const [result, setResult] = useState<MatchResult>("Victoria");
  const [recordAudio, setRecordAudio] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [source, setSource] = useState<"screen" | "import">("screen");
  const [library, setLibrary] = useState<MatchRecordingMeta[]>([]);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(false);

  const selectedMap = useMemo(() => maps.find((map) => map.slug === mapSlug) || maps[0], [maps, mapSlug]);
  const selectedBrawler = useMemo(() => brawlers.find((brawler) => brawler.name === brawlerName) || brawlers[0], [brawlers, brawlerName]);

  const refreshLibrary = async () => {
    try {
      setLibrary((await listMatchRecordings()).slice(0, 20));
    } catch {
      setLibrary([]);
    }
  };

  const setPreview = (blob: Blob | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = blob ? URL.createObjectURL(blob) : null;
    setPreviewUrl(previewUrlRef.current);
    setRecordingBlob(blob);
  };

  useEffect(() => {
    const mediaDevices = displayMediaDevices();
    setSupported(typeof mediaDevices?.getDisplayMedia === "function" && typeof MediaRecorder !== "undefined");
    void refreshLibrary();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (status !== "recording") return;
    const interval = window.setInterval(() => {
      if (!startedAtRef.current) return;
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 250);
    return () => window.clearInterval(interval);
  }, [status]);

  const stopRecorder = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    setMessage("");
    setPreview(null);
    setElapsed(0);
    chunksRef.current = [];

    const mediaDevices = displayMediaDevices();
    const getDisplayMedia = mediaDevices?.getDisplayMedia?.bind(mediaDevices);
    if (!supported || !getDisplayMedia) {
      setMessage("La grabación de pantalla no está disponible en este navegador; puedes importar un vídeo ya grabado.");
      return;
    }

    try {
      const stream = await getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: recordAudio,
      });
      const mimeType = bestMimeType();
      const options: MediaRecorderOptions = {
        videoBitsPerSecond: 5_000_000,
        ...(mimeType ? { mimeType } : {}),
      };
      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const finalType = recorder.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: finalType });
        setPreview(blob);
        recorderRef.current = null;
        setStatus("ready");
        setMessage(blob.size ? "Grabación lista para revisar, guardar o analizar" : "La grabación terminó sin datos de vídeo");
      });

      const videoTrack = stream.getVideoTracks()[0];
      videoTrack?.addEventListener("ended", () => {
        if (recorder.state !== "inactive") recorder.stop();
        streamRef.current = null;
      });

      startedAtRef.current = Date.now();
      setSource("screen");
      setStatus("recording");
      recorder.start(1000);
      setMessage(recordAudio ? "Grabando pantalla; el audio depende del soporte del navegador" : "Grabando pantalla localmente");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setMessage(name === "NotAllowedError" ? "No se concedió permiso para grabar la pantalla" : "No se pudo iniciar la grabación");
    }
  };

  const importVideo = (file?: File) => {
    if (!file) return;
    stopRecorder();
    setPreview(file);
    setSource("import");
    setElapsed(0);
    setStatus("ready");
    setMessage(`Vídeo importado: ${file.name} · listo para análisis completo`);
  };

  const saveToLibrary = async () => {
    if (!recordingBlob || !selectedMap || !selectedBrawler) return;
    const id = crypto.randomUUID();
    try {
      await saveMatchRecording({
        id,
        date: new Date().toISOString(),
        mapSlug: selectedMap.slug,
        mapName: selectedMap.name,
        mode: selectedMap.mode,
        brawler: selectedBrawler.name,
        brawlerSlug: selectedBrawler.slug,
        result,
        duration: elapsed,
        mimeType: recordingBlob.type || "video/webm",
        size: recordingBlob.size,
        source,
        blob: recordingBlob,
      });
      await refreshLibrary();
      setMessage("Vídeo guardado en la biblioteca local de este navegador");
    } catch {
      setMessage("No se pudo guardar el vídeo; el almacenamiento local puede estar lleno o bloqueado");
    }
  };

  const downloadVideo = () => {
    if (!recordingBlob || !selectedMap || !selectedBrawler) return;
    const url = URL.createObjectURL(recordingBlob);
    const anchor = document.createElement("a");
    const extension = recordingBlob.type.includes("mp4") ? "mp4" : "webm";
    anchor.href = url;
    anchor.download = `${selectedMap.slug}-${selectedBrawler.slug}-${new Date().toISOString().slice(0, 10)}.${extension}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Vídeo descargado");
  };

  const openLibraryRecording = async (id: string) => {
    try {
      const recording = await getMatchRecording(id);
      if (!recording) return;
      setMapSlug(recording.mapSlug);
      setBrawlerName(recording.brawler);
      setResult(recording.result);
      setElapsed(recording.duration);
      setSource(recording.source);
      setPreview(recording.blob);
      setStatus("ready");
      setMessage("Grabación abierta desde la biblioteca local · puedes reanalizarla completa");
    } catch {
      setMessage("No se pudo abrir la grabación");
    }
  };

  const removeLibraryRecording = async (id: string) => {
    try {
      await deleteMatchRecording(id);
      await refreshLibrary();
      setMessage("Grabación eliminada de la biblioteca local");
    } catch {
      setMessage("No se pudo eliminar la grabación");
    }
  };

  const seekPreview = (second: number) => {
    const video = previewVideoRef.current;
    if (!video) return;
    video.pause();
    const max = Number.isFinite(video.duration) && video.duration > 0 ? Math.max(0, video.duration - .05) : second;
    video.currentTime = Math.max(0, Math.min(second, max));
    video.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const reset = () => {
    stopRecorder();
    startedAtRef.current = null;
    setPreview(null);
    setElapsed(0);
    setStatus("idle");
    setMessage("");
  };

  return <section className="panel match-recorder-v18 match-recorder-v22">
    <div className="section-title">
      <div><span className="eyebrow">Grabación + análisis local v0.25</span><h2>Grabar, importar y analizar partidas completas</h2></div>
      <span className={`recording-state-v18 state-${status}`}>{status === "recording" ? `● REC ${formatLiveTime(elapsed)}` : status === "ready" ? "Vídeo listo" : "Local"}</span>
    </div>

    {message && <div className="recording-message-v18">{message}</div>}

    <div className="recording-context-v18">
      <label>Mapa<select value={mapSlug} disabled={status === "recording"} onChange={(event) => setMapSlug(event.target.value)}>{maps.map((map) => <option value={map.slug} key={map.slug}>{map.mode} · {map.name}</option>)}</select></label>
      <label>Brawler<select value={brawlerName} disabled={status === "recording"} onChange={(event) => setBrawlerName(event.target.value)}>{brawlers.map((brawler) => <option value={brawler.name} key={brawler.slug}>{brawler.name}</option>)}</select></label>
      <label>Resultado<select value={result} onChange={(event) => setResult(event.target.value as MatchResult)}><option>Victoria</option><option>Derrota</option></select></label>
      <label className="record-audio-toggle-v18"><input type="checkbox" checked={recordAudio} disabled={status === "recording"} onChange={(event) => setRecordAudio(event.target.checked)} /><span><b>Audio del juego</b><small>Solo si el navegador permite capturarlo</small></span></label>
    </div>

    <div className="recording-workspace-v18">
      <div className="recording-preview-v18">
        {previewUrl ? <video ref={previewVideoRef} src={previewUrl} controls playsInline onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration;
          if (Number.isFinite(duration) && duration > 0 && source === "import") setElapsed(Math.round(duration));
        }} /> : <div className="recording-placeholder-v18">
          <BrawlerPortrait name={selectedBrawler?.name || ""} className="recording-brawler-v18" />
          <b>{selectedMap?.name || "Partida"}</b>
          <span>{supported ? "Graba una pantalla/ventana o importa un vídeo ya existente." : "Este dispositivo no ofrece grabación web de pantalla; importa el vídeo grabado desde el sistema."}</span>
        </div>}
      </div>

      <div className="recording-actions-v18">
        {status !== "recording" ? <button type="button" className="primary-button" onClick={startRecording} disabled={!supported}>Iniciar grabación</button> : <button type="button" className="live-stop-button" onClick={stopRecorder}>Detener grabación</button>}
        <label className="recording-import-v18">Importar vídeo<input type="file" accept="video/*" onChange={(event) => importVideo(event.target.files?.[0])} /></label>
        {recordingBlob && <button type="button" className="secondary-button" onClick={saveToLibrary}>Guardar en biblioteca local</button>}
        {recordingBlob && <button type="button" className="secondary-button" onClick={downloadVideo}>Descargar vídeo</button>}
        {(status !== "idle" || recordingBlob) && <button type="button" className="secondary-button" onClick={reset}>Cerrar vídeo</button>}
        {recordingBlob && <small>{formatLiveTime(elapsed)} · {readableBytes(recordingBlob.size)} · {source === "screen" ? "captura de pantalla" : "vídeo importado"}</small>}
      </div>
    </div>

    <VideoMatchAnalyzer
      src={previewUrl}
      mode={selectedMap?.mode || ""}
      mapName={selectedMap?.name}
      brawlerName={selectedBrawler?.name}
      brawlerRole={selectedBrawler?.role}
      result={result}
      durationHint={elapsed}
      onSeek={seekPreview}
    />

    <div className="recording-library-v18">
      <div><span className="eyebrow">Biblioteca local</span><b>{library.length} grabaciones guardadas</b><small>Los vídeos permanecen en IndexedDB del navegador; borrar datos del sitio los elimina.</small></div>
      <div className="recording-library-list-v18">
        {library.slice(0, 8).map((item) => <article key={item.id}>
          <BrawlerPortrait name={item.brawler} className="recording-library-avatar-v18" />
          <div><b>{item.brawler} · {item.mapName}</b><small>{item.result} · {formatLiveTime(item.duration)} · {readableBytes(item.size)}</small></div>
          <button type="button" onClick={() => void openLibraryRecording(item.id)}>Ver</button>
          <button type="button" onClick={() => void removeLibraryRecording(item.id)} aria-label={`Eliminar grabación de ${item.brawler}`}>×</button>
        </article>)}
        {!library.length && <div className="empty-state">Aún no hay vídeos guardados en este dispositivo.</div>}
      </div>
    </div>

    <p className="live-privacy-note">La grabación, el barrido de fotogramas y la biblioteca son locales. Brawl Draft Lab no sube el vídeo a un servidor. Para sesiones largas conviene descargar una copia porque el navegador puede liberar almacenamiento si el dispositivo se queda sin espacio.</p>
  </section>;
}
