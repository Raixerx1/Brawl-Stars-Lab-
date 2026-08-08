import { notFound } from "next/navigation";
import Link from "next/link";
import { maps, mapBySlug, brawlerByName } from "@/lib/data";
import BrawlerCard from "@/components/BrawlerCard";
import FavoriteButton from "@/components/FavoriteButton";
import { MapArtwork } from "@/components/GameArtwork";
import MapTactics from "@/components/MapTactics";

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
          <div><h3>First picks</h3>{map.firstPicks.map((name: string, index: number) => <p key={name}><b>{index + 1}.</b> {name}</p>)}</div>
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

    <MapTactics map={map} />

    <div className="section-title spaced"><div><span className="eyebrow">Tier S</span><h2>Mejores opciones</h2></div></div>
    <div className="card-grid brawler-grid">{map.tierS.map((name: string) => brawlerByName(name)).filter(Boolean).map((brawler) => <BrawlerCard key={brawler!.slug} brawler={brawler!} />)}</div>
    <div className="section-title spaced"><div><span className="eyebrow">Tier A</span><h2>Alternativas sólidas</h2></div></div>
    <div className="card-grid brawler-grid">{map.tierA.map((name: string) => brawlerByName(name)).filter(Boolean).map((brawler) => <BrawlerCard key={brawler!.slug} brawler={brawler!} />)}</div>
    <div className="notice">Tier revisado tras el balance general del 04/08/2026. No se muestran win rates sin una muestra verificable.</div>
  </div>;
}
