"use client";

import { useEffect, useState } from "react";
import type { Brawler, MapProfile } from "@/lib/types";
import { buildContextLearningProfile } from "@/lib/context-learning";
import { readLiveReviews } from "@/lib/live-review";
import { readMatchHistory } from "@/lib/performance";

export default function LearningDashboard({ maps, brawlers }: { maps: MapProfile[]; brawlers: Brawler[] }) {
  const [, setRevision] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setRevision((value) => value + 1), 2500);
    return () => window.clearInterval(interval);
  }, []);

  const profile = buildContextLearningProfile(
    readMatchHistory(maps, brawlers),
    readLiveReviews(),
  );

  return <section className="panel contextual-learning-v18">
    <div className="section-title">
      <div><span className="eyebrow">Aprendizaje contextual v0.18</span><h2>Qué estás repitiendo de verdad</h2></div>
      <button type="button" className="secondary-button compact-button" onClick={() => setRevision((value) => value + 1)}>Actualizar</button>
    </div>

    <div className="learning-kpis-v18">
      <span><b>{profile.matches}</b><small>partidas aprendidas</small></span>
      <span><b>{profile.winRate}%</b><small>win rate global</small></span>
      <span><b>{profile.recentWinRate ?? "—"}{profile.recentWinRate !== undefined ? "%" : ""}</b><small>últimas {profile.recentGames}</small></span>
      <span className={profile.trend !== undefined && profile.trend < 0 ? "negative" : profile.trend !== undefined && profile.trend > 0 ? "positive" : ""}><b>{profile.trend === undefined ? "—" : `${profile.trend > 0 ? "+" : ""}${profile.trend} pp`}</b><small>tendencia vs previas</small></span>
      <span><b>{profile.reviews}</b><small>revisiones válidas</small></span>
      <span><b>{profile.averageExecution ?? "—"}</b><small>ejecución media</small></span>
    </div>

    <div className="learning-focus-v18">
      <span className="eyebrow">Foco de entrenamiento</span>
      {profile.focus.map((item, index) => <article key={item}><b>{index + 1}</b><span>{item}</span></article>)}
    </div>

    <div className="learning-pattern-grid-v18">
      <article>
        <div className="learning-column-title-v18"><span>Errores recurrentes</span><small>Se ponderan menos los eventos automáticos no confirmados</small></div>
        {profile.topMistakes.map((pattern) => <div className="learning-pattern-v18 bad" key={pattern.label}>
          <span><b>{pattern.label}</b><small>{pattern.sessions} revisiones · {pattern.count} señales</small></span>
          <em>{pattern.contexts.join(" · ")}</em>
        </div>)}
        {!profile.topMistakes.length && <div className="empty-state">Aún no hay un patrón negativo repetido con suficiente evidencia.</div>}
      </article>

      <article>
        <div className="learning-column-title-v18"><span>Patrones que funcionan</span><small>Úsalos para consolidar tu estilo antes de ampliar el pool</small></div>
        {profile.topStrengths.map((pattern) => <div className="learning-pattern-v18 good" key={pattern.label}>
          <span><b>{pattern.label}</b><small>{pattern.sessions} revisiones · {pattern.count} señales</small></span>
          <em>{pattern.contexts.join(" · ")}</em>
        </div>)}
        {!profile.topStrengths.length && <div className="empty-state">Confirma buenas rotaciones, objetivos o supers para detectar patrones positivos.</div>}
      </article>
    </div>

    <div className="learning-context-grid-v18">
      <article>
        <span className="eyebrow">Brawler + mapa</span>
        <b>Contextos con peor muestra</b>
        {profile.weakBrawlerMaps.map((item) => <div key={item.key}><span>{item.label}</span><strong>{item.winRate}%</strong><small>{item.wins}-{item.losses} · {item.games} partidas</small></div>)}
        {!profile.weakBrawlerMaps.length && <small>No hay combinaciones con ≥3 partidas y menos de 50% de victorias.</small>}
      </article>

      <article>
        <span className="eyebrow">Por brawler</span>
        <b>Pool que necesita revisión</b>
        {profile.weakBrawlers.map((item) => <div key={item.key}><span>{item.label}</span><strong>{item.winRate}%</strong><small>{item.wins}-{item.losses} · {item.games} partidas</small></div>)}
        {!profile.weakBrawlers.length && <small>No hay brawlers con ≥4 partidas y menos de 50% de victorias.</small>}
      </article>

      <article>
        <span className="eyebrow">Por mapa</span>
        <b>Mapas a trabajar</b>
        {profile.weakMaps.map((item) => <div key={item.key}><span>{item.label}</span><strong>{item.winRate}%</strong><small>{item.wins}-{item.losses} · {item.games} partidas</small></div>)}
        {!profile.weakMaps.length && <small>No hay mapas con ≥4 partidas y menos de 50% de victorias.</small>}
      </article>
    </div>

    <p className="live-privacy-note">Este perfil combina resultados guardados y revisiones locales. Una detección automática sin confirmar pesa menos que una corrección manual o confirmada, para evitar que un falso positivo entrene el sistema en la dirección equivocada.</p>
  </section>;
}
