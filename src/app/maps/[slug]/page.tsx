import { notFound } from "next/navigation";
import Link from "next/link";
import { maps, mapBySlug, brawlerByName } from "@/lib/data";
import BrawlerCard from "@/components/BrawlerCard";
import FavoriteButton from "@/components/FavoriteButton";
import { MapArtwork } from "@/components/GameArtwork";
import MapTactics from "@/components/MapTactics";
import { evaluateFirstPick } from "@/lib/first-pick-model";

export function generateStaticParams() {
  return maps.map((map) => ({ slug: map.slug }));
}

export default async function MapDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const map = mapBySlug(slug);
  if (!map) notFound();

  return <div className="page">
    <Link href="/maps" className="back-link">← Todos los mapas</Link>
    <section className="detail-hero map-detail-hero visual-detail-hero">
      <MapArtwork name={map.name} className="detail-map-art" />
      <div className="detail-copy">
        <div className="card-kicker">{map.mode}</div>
        <span className="status-pill">{map.rotationStatus === "Actual" ? "Ranked actual" : "Histórico"}</span>
        <h1>{map.name}</h1>
        <p>{map.status}</p>
        <div className="tag-row">{map.traits.map((trait: string) => <span key={trait}>{trait}</span>)}</div>
      </div>
      <FavoriteButton type="map" id={map.slug} />
    </section>

    <div className="detail-grid">
      <section className="panel">
        <span className="eyebrow">Draft</span>
        <h2>Prioridades</h2>
        <div className="draft-columns">
          <div className="map-first-picks-v12"><h3>First picks</h3>{map.firstPicks.map((name: string, index: number) => {
            const candidate = map.firstPickCandidates?.find((item) => item.name === name);
            const profile = brawlerByName(name);
            const evaluation = profile ? evaluateFirstPick(profile, map) : undefined;
            return <article key={name}>
              <b>{index + 1}.</b>
              <span><strong>{name}</strong><small>{evaluation?.strengths[0] || candidate?.reasons[0] || "Pick ciego auditado"}</small></span>
              {evaluation && <em>{evaluation.score}</em>}
            </article>;
          })}</div>
          <div><h3>Last picks</h3>{map.lastPicks.map((name: string, index: number) => <p key={name}><b>{index + 1}.</b> {name}</p>)}</div>
          <div><h3>Bans</h3>{map.bans.map((name: string, index: number) => <p key={name}><b>{index + 1}.</b> {name}</p>)}</div>
        </div>
      </section>
      <section className="panel plan-panel">
        <span className="eyebrow">Condición de victoria</span>
        <h2>Plan de partida</h2>
        <p>{map.plan}</p>
        <Link href={`/draft?map=${map.slug}`} className="secondary-button">Analizar un draft</Link>
      </section>
    </div>

    {map.firstPickCandidates && <section className="panel map-first-pick-model-v12">
      <div className="section-title">
        <div><span className="eyebrow">Motor v0.15 · perfil {map.firstPickModelVersion || "estructural"}</span><h2>Por qué estos first picks</h2></div>
        <span className="status-pill">Confianza {map.firstPickConfidence || "Media"}</span>
      </div>
      <p>{map.firstPickNotes}</p>
      <div className="map-first-pick-candidates-v12">
        {map.firstPickCandidates.slice(0, 6).map((candidate, index) => {
          const profile = brawlerByName(candidate.name);
          const evaluation = profile ? evaluateFirstPick(profile, map) : undefined;
          return <article className={index < 3 ? "primary" : "alternative"} key={candidate.name}>
            <div><b>{index < 3 ? `Top ${index + 1}` : "Alternativa"}</b><strong>{candidate.name}</strong></div>
            <em>{evaluation?.score ?? candidate.score}/100</em>
            <p>{evaluation?.strengths.join(" · ") || candidate.reasons.join(" · ") || "Encaje global con la estructura del mapa."}</p>
            {(evaluation?.risks.length ?? candidate.risks.length) > 0 && <small>Riesgo: {(evaluation?.risks || candidate.risks).join(" · ")}</small>}
          </article>;
        })}
      </div>
    </section>}

    <MapTactics map={map} />

    <div className="section-title spaced"><div><span className="eyebrow">Tier S</span><h2>Mejores opciones</h2></div></div>
    <div className="card-grid brawler-grid">{map.tierS.map((name: string) => brawlerByName(name)).filter(Boolean).map((brawler) => <BrawlerCard key={brawler!.slug} brawler={brawler!} />)}</div>
    <div className="section-title spaced"><div><span className="eyebrow">Tier A</span><h2>Alternativas sólidas</h2></div></div>
    <div className="card-grid brawler-grid">{map.tierA.map((name: string) => brawlerByName(name)).filter(Boolean).map((brawler) => <BrawlerCard key={brawler!.slug} brawler={brawler!} />)}</div>
    <div className="notice">Pool comprobado el {map.poolCheckedAt}. La puntuación de first pick es estructural y editorial: no representa un win rate observado.</div>
  </div>;
}
