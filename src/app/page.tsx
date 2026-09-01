import Link from "next/link";
import { brawlers, maps, meta } from "@/lib/data";
import MapCard from "@/components/MapCard";
import BrawlerCard from "@/components/BrawlerCard";
import { BrawlerPortrait } from "@/components/GameArtwork";

export default function Home() {
  const profiled = brawlers.filter((brawler) => brawler.profileComplete);
  const currentMaps = maps.filter((map) => map.rotationStatus === "Actual").slice(0, 6);
  const patchDayCore = ["8-Bit", "Mortis", "Edgar", "Brock", "Surge", "Melodie"]
    .map((name) => brawlers.find((brawler) => brawler.name === name))
    .filter((brawler): brawler is NonNullable<typeof brawler> => Boolean(brawler));

  return <div className="page home-dashboard-v230">
    <section className="hero hero-v2">
      <div className="hero-copy-v230">
        <span className="hero-badge">UPDATE 69 LIVE · 69.230 · 01/09</span>
        <h1>Gana el draft<br /><em>antes de empezar.</em></h1>
        <p>Un centro competitivo para decidir mapa, bans, first pick, counters y respuesta al draft rival. El motor ya incorpora el prior de día 1 de Update 69 sin confundirlo con datos post-parche todavía inmaduros.</p>
        <div className="hero-actions">
          <Link href="/draft" className="primary-button">Abrir Draft Assistant</Link>
          <Link href="/counters" className="secondary-button">Explorar counters</Link>
        </div>
        <div className="hero-live-strip-v230" aria-label="Estado de la base competitiva">
          <div><strong>{brawlers.length}</strong><span>Brawlers en motor</span></div>
          <div><strong>{maps.filter((map) => map.rotationStatus === "Actual").length}</strong><span>Mapas activos</span></div>
          <div><strong>U69</strong><span>Prior día 1</span></div>
        </div>
      </div>
      <div className="hero-roster" aria-hidden="true">
        <BrawlerPortrait name="8-Bit" className="hero-portrait hero-portrait-one" priority />
        <BrawlerPortrait name="Brock" className="hero-portrait hero-portrait-two" priority />
        <BrawlerPortrait name="Melodie" className="hero-portrait hero-portrait-three" priority />
        <div className="hero-radar"><span>U69</span><b>LIVE</b></div>
      </div>
    </section>

    <section className="patch-alert patch-alert-v230">
      <div>
        <span className="eyebrow">Estado competitivo</span>
        <h2>{meta.officialPatch}</h2>
        <p>{meta.rankedDataThrough}</p>
      </div>
      <div className="patch-alert-actions-v230">
        <span className="live-dot-v230">● LIVE</span>
        <Link href="/meta" className="secondary-button">Abrir Meta Center</Link>
      </div>
    </section>

    <section className="stats-grid home-stats-v230">
      <div className="stat-card"><b>{maps.filter((map) => map.rotationStatus === "Actual").length}</b><span>mapas en rotación competitiva</span></div>
      <div className="stat-card"><b>{brawlers.length}</b><span>brawlers operativos en Draft Engine</span></div>
      <div className="stat-card"><b>{profiled.length}</b><span>perfiles tácticos completos</span></div>
      <div className="stat-card"><b>{brawlers.reduce((sum, brawler) => sum + brawler.counters.length + brawler.counteredBy.length, 0)}</b><span>relaciones explícitas de matchup</span></div>
    </section>

    <div className="section-title spaced"><div><span className="eyebrow">Rotación Update 69</span><h2>Mapas que debes preparar</h2></div><Link href="/maps">Todos los mapas →</Link></div>
    <div className="card-grid home-map-grid-v230">{currentMaps.map((map) => <MapCard map={map} key={map.slug} />)}</div>

    <div className="section-title spaced"><div><span className="eyebrow">Prior competitivo · 01/09</span><h2>Núcleo fuerte provisional de Update 69</h2></div><Link href="/meta">Ver baseline y tier →</Link></div>
    <div className="card-grid brawler-grid">{patchDayCore.map((brawler) => <BrawlerCard key={brawler.name} brawler={brawler} />)}</div>

    <section className="cta-panel">
      <div><span className="eyebrow">Matchup Lab</span><h2>Lee el pick rival y encuentra la respuesta que mejor encaja en ese draft.</h2><p>El motor combina matchup mecánico, respuesta inversa, prior Update 69 y contexto competitivo; el score es heurístico, no un porcentaje de victoria observado.</p></div>
      <Link href="/counters" className="primary-button">Abrir counters</Link>
    </section>

    <div className="section-title spaced"><div><span className="eyebrow">Competitive toolkit</span><h2>Todo el flujo de Ranked, en una sola interfaz</h2></div></div>
    <div className="feature-grid feature-grid-v8">
      <Link href="/draft" className="panel feature-card"><b>◎</b><h3>Draft Coach</h3><p>Mapa, bans, orden de picks, alternativas y lectura del draft rival en tiempo real.</p></Link>
      <Link href="/live" className="panel feature-card"><b>▶</b><h3>Auto Review</h3><p>Analiza secuencias y eventos del vídeo con confirmación manual para ajustar la confianza.</p></Link>
      <Link href="/pool" className="panel feature-card"><b>◉</b><h3>Mi pool</h3><p>Prioriza los brawlers que realmente tienes disponibles y dominas para Ranked.</p></Link>
      <Link href="/tracker" className="panel feature-card"><b>▥</b><h3>Aprendizaje</h3><p>Convierte resultados y revisiones en ajustes personales moderados del Draft Coach.</p></Link>
    </div>
  </div>;
}
