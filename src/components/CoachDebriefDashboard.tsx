"use client";

import { useEffect, useMemo, useState } from "react";
import { buildCoachDebrief } from "@/lib/coach-debrief";
import { formatLiveTime, readLiveReviews } from "@/lib/live-review";
import type { LiveReviewSession } from "@/lib/types";

function sessionLabel(session: LiveReviewSession) {
  const date = new Date(session.date);
  const when = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
  return `${when ? `${when} · ` : ""}${session.brawler} · ${session.mapName} · ${session.result || "Sin resultado"}`;
}

export default function CoachDebriefDashboard() {
  const [sessions, setSessions] = useState<LiveReviewSession[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const refresh = () => {
    const next = readLiveReviews();
    setSessions(next);
    setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id || "");
  };

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 2500);
    return () => window.clearInterval(interval);
  }, []);

  const selected = sessions.find((session) => session.id === selectedId) || sessions[0];
  const debrief = useMemo(() => buildCoachDebrief(selected, sessions), [selected, sessions]);

  return <section className="panel coach-debrief-v19 coach-debrief-v20">
    <div className="section-title coach-debrief-head-v19">
      <div>
        <span className="eyebrow">Analizador de partidas v0.20</span>
        <h2>Qué cambió la partida y por qué</h2>
      </div>
      <div className="coach-debrief-actions-v19">
        {sessions.length > 0 && <select value={selected?.id || ""} onChange={(event) => setSelectedId(event.target.value)} aria-label="Seleccionar revisión">
          {sessions.slice(0, 15).map((session) => <option value={session.id} key={session.id}>{sessionLabel(session)}</option>)}
        </select>}
        <button type="button" className="secondary-button compact-button" onClick={refresh}>Actualizar</button>
      </div>
    </div>

    {!selected || !debrief ? <div className="coach-debrief-empty-v19">
      <b>Guarda una Live Review para activar el análisis avanzado.</b>
      <span>El sistema agrupará secuencias cercanas, buscará puntos de inflexión y separará la ejecución por fases.</span>
    </div> : <>
      <div className="coach-debrief-hero-v19">
        <div>
          <span>{selected.brawler} · {selected.mode} · {selected.mapName}</span>
          <h3>{debrief.headline}</h3>
          <p>{debrief.recurringProblem || "Todavía no hay recurrencia histórica fuerte para el principal error de esta partida."}</p>
        </div>
        <div className={`coach-confidence-v19 confidence-${debrief.confidenceLabel.toLowerCase()}`}>
          <b>{debrief.confidence}%</b>
          <span>evidencia {debrief.confidenceLabel.toLowerCase()}</span>
          <small>{formatLiveTime(selected.duration)} analizados</small>
        </div>
      </div>

      <div className="coach-turning-grid-v20">
        <article className="coach-turning-points-v20">
          <div className="coach-column-title-v19">
            <span>Puntos de inflexión</span>
            <small>No cuenta síntomas repetidos como errores independientes; agrupa el contexto de ±10 s.</small>
          </div>
          {debrief.turningPoints.map((item, index) => <div className={`coach-turning-point-v20 impact-${item.impact.toLowerCase()}`} key={`${item.second}-${item.label}`}>
            <time>{formatLiveTime(item.second)}</time>
            <div>
              <span>#{index + 1} · {item.category} · evidencia {item.evidence.toLowerCase()}</span>
              <b>{item.label}</b>
              <p>{item.reason}</p>
            </div>
            <strong>{item.score}</strong>
          </div>)}
          {!debrief.turningPoints.length && <div className="empty-state">No hay todavía un punto de inflexión con señal suficiente.</div>}
        </article>

        <article className="coach-causal-chains-v20">
          <div className="coach-column-title-v19">
            <span>Secuencias causa → consecuencia</span>
            <small>Relaciona eventos próximos para explicar decisiones, no solo enumerarlas.</small>
          </div>
          {debrief.chains.map((chain) => <div className={`coach-chain-v20 impact-${chain.impact.toLowerCase()}`} key={`${chain.startSecond}-${chain.endSecond}-${chain.from}-${chain.to}`}>
            <div><time>{formatLiveTime(chain.startSecond)}</time><span>→</span><time>{formatLiveTime(chain.endSecond)}</time></div>
            <b>{chain.from} → {chain.to}</b>
            <p>{chain.interpretation}</p>
            <small>{chain.confidence}% de confianza</small>
          </div>)}
          {!debrief.chains.length && <div className="empty-state">Faltan eventos próximos entre sí para inferir cadenas tácticas con fiabilidad.</div>}
        </article>
      </div>

      <div className="coach-priority-grid-v19">
        <article className="coach-priorities-v19">
          <div className="coach-column-title-v19">
            <span>Decisiones prioritarias</span>
            <small>Impacto actual + recurrencia histórica + contexto de derrota/objetivo</small>
          </div>
          {debrief.priorities.map((item, index) => <div className={`coach-priority-v19 priority-${item.priority.toLowerCase()}`} key={item.label}>
            <div className="coach-priority-rank-v19">#{index + 1}</div>
            <div className="coach-priority-copy-v19">
              <div><b>{item.label}</b><span>{item.category} · prioridad {item.priority}</span></div>
              <p><strong>Causa probable:</strong> {item.cause}</p>
              <p><strong>Corrección:</strong> {item.correction}</p>
              <small>{item.evidence}</small>
            </div>
            <div className="coach-impact-v19"><b>{item.score}</b><span>impacto</span></div>
          </div>)}
          {!debrief.priorities.length && <div className="empty-state">No hay un error negativo dominante con evidencia suficiente en esta revisión.</div>}
        </article>

        <article className="coach-next-games-v19">
          <div className="coach-column-title-v19">
            <span>Plan para las próximas 3 partidas</span>
            <small>Pocas reglas, medibles y repetibles</small>
          </div>
          {debrief.nextGames.map((item, index) => <div key={item}><b>{index + 1}</b><span>{item}</span></div>)}
          <p>{debrief.sampleNote}</p>
        </article>
      </div>

      <div className="coach-phase-grid-v19 coach-phase-grid-v20">
        {debrief.phases.map((phase) => <article className={phase.verdict === "Fase a revisar" ? "bad" : phase.verdict === "Fase favorable" ? "good" : ""} key={phase.label}>
          <div className="coach-phase-score-v20"><strong>{phase.score}</strong><small>/100</small></div>
          <span>{phase.label}</span>
          <b>{phase.verdict}</b>
          <small>{phase.positive} + · {phase.negative} − · evidencia {phase.evidence.toLowerCase()}</small>
        </article>)}
      </div>

      <div className="coach-strengths-v19">
        <div className="coach-column-title-v19"><span>Qué conservar</span><small>El entrenador también evita que corrijas cosas que ya están funcionando.</small></div>
        <div>
          {debrief.strengths.map((item) => <article key={item.label}>
            <b>{item.label}</b>
            <span>{item.instruction}</span>
            <small>{item.currentSignals} señal{item.currentSignals === 1 ? "" : "es"} ahora · presente en {item.priorSessions} revisiones previas</small>
          </article>)}
          {!debrief.strengths.length && <span className="coach-muted-v19">Todavía no hay suficientes patrones positivos en esta partida.</span>}
        </div>
      </div>
    </>}
  </section>;
}
