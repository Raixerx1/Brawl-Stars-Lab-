import { notFound } from "next/navigation";
import Link from "next/link";
import { brawlers, brawlerBySlug, maps } from "@/lib/data";
import MapCard from "@/components/MapCard";
import FavoriteButton from "@/components/FavoriteButton";
import { BrawlerPortrait } from "@/components/GameArtwork";
import MatchupGrid from "@/components/MatchupGrid";
import PatchBadge from "@/components/PatchBadge";

export function generateStaticParams() {
  return brawlers.map((brawler) => ({ slug: brawler.slug }));
}

export default async function BrawlerDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brawler = brawlerBySlug(slug);
  if (!brawler) notFound();
  const bestMaps = maps
    .filter((map) => map.tierS.includes(brawler.name) || map.tierA.includes(brawler.name))
    .slice(0, 6);

  return <div className="page">
    <Link href="/brawlers" className="back-link">← Roster completo</Link>
    <section className="detail-hero brawler-detail visual-detail-hero">
      <BrawlerPortrait name={brawler.name} className="detail-portrait" priority />
      <div className="detail-copy">
        <div className="card-kicker">{brawler.rarity} · {brawler.role}</div>
        <h1>{brawler.name}</h1>
        <p>{brawler.range} · dificultad {brawler.difficulty}/5</p>
        <div className="tag-row">{brawler.tags.map((tag: string) => <span key={tag}>{tag}</span>)}</div>
        <PatchBadge name={brawler.name} />
      </div>
      <FavoriteButton type="brawler" id={brawler.slug} />
    </section>

    <div className="detail-grid">
      <section className="panel">
        <span className="eyebrow">Evaluación</span>
        <h2>Tier {brawler.tier}</h2>
        <p className="large-copy">{brawler.build}</p>
        {!brawler.profileComplete && <div className="notice">La build continúa pendiente de validación completa, pero los matchups ya están estructurados.</div>}
      </section>
      <section className="panel matchup-summary-panel">
        <span className="eyebrow">Resumen de matchup</span>
        <h2>{brawler.counters.length + brawler.counteredBy.length} cruces registrados</h2>
        <p>Los counters son una lectura de draft, no una garantía: cobertura, muros, líneas y supers disponibles modifican cada enfrentamiento.</p>
        <Link className="secondary-button" href="/counters">Abrir explorador de counters</Link>
      </section>
    </div>

    <div className="two-column-matchups spaced">
      <section className="panel">
        <span className="eyebrow">Ventaja</span>
        <h2>Funciona bien contra</h2>
        <MatchupGrid source={brawler} names={brawler.counters} kind="favorable" />
      </section>
      <section className="panel">
        <span className="eyebrow danger-text">Riesgo</span>
        <h2>Lo frena</h2>
        <MatchupGrid source={brawler} names={brawler.counteredBy} kind="threat" />
      </section>
    </div>

    <div className="section-title spaced">
      <div><span className="eyebrow">Mapa y modo</span><h2>Mejores entornos registrados</h2></div>
    </div>
    {bestMaps.length
      ? <div className="card-grid">{bestMaps.map((map) => <MapCard map={map} key={map.slug} />)}</div>
      : <div className="empty-state">Este brawler aún no tiene mapas priorizados en la base editorial.</div>}
  </div>;
}
