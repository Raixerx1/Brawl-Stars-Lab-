import Link from "next/link";
import { brawlers, maps, meta } from "@/lib/data";
import MapCard from "@/components/MapCard";
import BrawlerCard from "@/components/BrawlerCard";
import { BrawlerPortrait } from "@/components/GameArtwork";

export default function Home() {
  const profiled = brawlers.filter((brawler) => brawler.profileComplete);
  return <div className="page">
    <section className="hero hero-v2">
      <div>
        <span className="hero-badge">PARCHE 04/08/2026 · RANKED LAB</span>
        <h1>Gana el draft<br /><em>antes de empezar.</em></h1>
        <p>Draft vivo, counters, simulación del rival, Auto Review local y recomendaciones personalizadas según tu historial.</p>
        <div className="hero-actions">
          <Link href="/draft" className="primary-button">Abrir Draft Assistant</Link>
          <Link href="/live" className="secondary-button">Abrir Auto Review</Link>
        </div>
      </div>
      <div className="hero-roster" aria-hidden="true">
        <BrawlerPortrait name="Nori" className="hero-portrait hero-portrait-one" priority />
        <BrawlerPortrait name="Gene" className="hero-portrait hero-portrait-two" priority />
        <BrawlerPortrait name="Angelo" className="hero-portrait hero-portrait-three" priority />
        <div className="hero-radar"><span>04/08</span><b>META</b></div>
      </div>
    </section>

    <section className="patch-alert">
      <div><span className="eyebrow">Última revisión oficial</span><h2>{meta.officialPatch}</h2></div>
      <Link href="/meta" className="secondary-button">Ver impacto completo</Link>
    </section>

    <section className="stats-grid">
      <div className="stat-card"><b>{maps.length}</b><span>mapas preparados</span></div>
      <div className="stat-card"><b>{brawlers.length}</b><span>brawlers registrados</span></div>
      <div className="stat-card"><b>{profiled.length}</b><span>perfiles tácticos</span></div>
      <div className="stat-card"><b>{brawlers.reduce((sum, brawler) => sum + brawler.counters.length + brawler.counteredBy.length, 0)}</b><span>relaciones de matchup</span></div>
    </section>

    <div className="section-title spaced"><div><span className="eyebrow">Rotación prioritaria</span><h2>Mapas destacados</h2></div><Link href="/maps">Ver todos →</Link></div>
    <div className="card-grid">{maps.filter((map) => map.featuredOfficialJune2026).map((map) => <MapCard map={map} key={map.slug} />)}</div>

    <div className="section-title spaced"><div><span className="eyebrow">Impacto del parche</span><h2>Brawlers que debes reevaluar</h2></div><Link href="/meta">Cambios del 4 de agosto →</Link></div>
    <div className="card-grid brawler-grid">{["Starr Nova", "Damian", "Max", "Bolt", "Surge", "Crow"].map((name) => <BrawlerCard key={name} brawler={brawlers.find((brawler) => brawler.name === name)!} />)}</div>

    <section className="cta-panel">
      <div><span className="eyebrow">Matchup Lab</span><h2>Selecciona un brawler y consulta sus cinco mejores objetivos y sus cinco amenazas.</h2><p>Los resultados son editoriales y se ajustan al arquetipo, el parche y las interacciones principales.</p></div>
      <Link href="/counters" className="primary-button">Abrir counters</Link>
    </section>

    <div className="section-title spaced"><div><span className="eyebrow">Nuevas herramientas</span><h2>Decide mejor antes y durante el draft</h2></div></div>
    <div className="feature-grid feature-grid-v8">
      <Link href="/draft" className="panel feature-card"><b>◎</b><h3>Draft Coach</h3><p>Build, líneas, bans, simulación del siguiente pick y modo ultrarrápido.</p></Link>
      <Link href="/live" className="panel feature-card"><b>▶</b><h3>Auto Review</h3><p>Analiza fotogramas localmente, detecta cambios relevantes y genera comentarios durante la partida.</p></Link>
      <Link href="/pool" className="panel feature-card"><b>◉</b><h3>Mi pool</h3><p>Prioriza fuerza 11, hipercargas y los brawlers que realmente dominas.</p></Link>
      <Link href="/tracker" className="panel feature-card"><b>▥</b><h3>Aprendizaje</h3><p>Convierte resultados y Live Reviews en ajustes personales moderados del Draft Coach.</p></Link>
    </div>
  </div>;
}
