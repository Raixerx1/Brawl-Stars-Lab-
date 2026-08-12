"use client";

import { useEffect, useMemo, useState } from "react";
import type { Brawler } from "@/lib/types";
import { rankCountersAgainst, rankTargetsFor } from "@/lib/counter-engine";
import { auditRoster } from "@/lib/roster-audit";
import { BrawlerPortrait } from "./GameArtwork";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

export default function CounterExplorer({ brawlers }: { brawlers: Brawler[] }) {
  const ordered = useMemo(
    () => [...brawlers].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [brawlers],
  );
  const roles = useMemo(
    () => [...new Set(ordered.map((brawler) => brawler.role))].sort((a, b) => a.localeCompare(b, "es")),
    [ordered],
  );
  const audit = useMemo(() => auditRoster(ordered), [ordered]);

  const [selectedSlug, setSelectedSlug] = useState(ordered[0]?.slug || "");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("Todos");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("brawler");
    if (!requested) return;
    const found = ordered.find(
      (brawler) => brawler.slug === requested || normalize(brawler.name) === normalize(requested),
    );
    if (found) setSelectedSlug(found.slug);
  }, [ordered]);

  const source = useMemo(
    () => ordered.find((brawler) => brawler.slug === selectedSlug) || ordered[0],
    [ordered, selectedSlug],
  );

  const favorableRank = useMemo(
    () => source ? rankTargetsFor(source, ordered, 6) : [],
    [source, ordered],
  );

  const threatRank = useMemo(
    () => source ? rankCountersAgainst(source, ordered, 6) : [],
    [source, ordered],
  );

  const visible = useMemo(() => {
    const search = normalize(query);
    return ordered.filter((brawler) => {
      const matchesSearch = !search || normalize(`${brawler.name} ${brawler.role}`).includes(search);
      const matchesRole = role === "Todos" || brawler.role === role;
      return matchesSearch && matchesRole;
    });
  }, [ordered, query, role]);

  const selectBrawler = (brawler: Brawler) => {
    setSelectedSlug(brawler.slug);
    const url = new URL(window.location.href);
    url.searchParams.set("brawler", brawler.slug);
    window.history.replaceState({}, "", url);
  };

  if (!source) return null;

  const sourceBroken = audit.brokenReferences.filter((item) => item.source === source.name);

  return (
    <div className="counter-explorer counter-explorer-v81">
      <section className="panel counter-roster-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">Roster completo · motor v0.18</span>
            <h2>Busca cualquier brawler</h2>
            <p>
              El ranking ya no usa una plantilla fija por rol. Se evalúa cada pareja de brawlers por relaciones explícitas,
              movilidad, antidive, control, alcance, wallbreak y dependencia de cobertura.
            </p>
          </div>
          <span className="counter-roster-count">{visible.length}/{audit.total}</span>
        </div>

        <div className="counter-audit-strip">
          <span><b>{audit.total}</b> brawlers</span>
          <span><b>{audit.withCounters}</b> con relaciones explícitas</span>
          <span><b>6</b> mejores counters por objetivo</span>
          <span className={audit.brokenReferences.length ? "warning" : "ok"}>
            <b>{audit.brokenReferences.length}</b> referencias rotas
          </span>
        </div>

        <div className="counter-search-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar Bolt, Kenji, Piper…"
            aria-label="Buscar brawler"
          />
          <select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Filtrar por rol">
            <option>Todos</option>
            {roles.map((item) => <option key={item}>{item}</option>)}
          </select>
          {(query || role !== "Todos") && <button type="button" onClick={() => { setQuery(""); setRole("Todos"); }}>Limpiar</button>}
        </div>

        <div className="counter-roster-grid">
          {visible.map((brawler) => <button
            type="button"
            className={brawler.slug === source.slug ? "active" : ""}
            key={brawler.slug}
            onClick={() => selectBrawler(brawler)}
          >
            <BrawlerPortrait name={brawler.name} className="counter-roster-avatar" />
            <span>
              <b>{brawler.name}</b>
              <small>{brawler.role} · {brawler.profileComplete ? `Tier ${brawler.tier}` : "Perfil base"}</small>
            </span>
            <em>{brawler.counters.length}/{brawler.counteredBy.length}</em>
          </button>)}
          {!visible.length && <div className="counter-empty-state">
            <b>No hay coincidencias</b>
            <span>Prueba con otro nombre o elimina el filtro de rol.</span>
          </div>}
        </div>
      </section>

      <section className="counter-focus counter-focus-v81">
        <BrawlerPortrait name={source.name} className="counter-focus-art" priority />
        <div>
          <span className="card-kicker">{source.role} · Tier {source.tier}</span>
          <h1>{source.name}</h1>
          <p>{source.build}</p>
          <div className="counter-source-status">
            <span>Top 6 favorable calculado</span>
            <span>Top 6 counters calculado</span>
            <span>Ranking individual 1 vs 1</span>
            {source.matchupReviewedAt && <span className="counter-reviewed-chip">Revisión específica: {source.matchupReviewedAt}</span>}
          </div>
        </div>
      </section>

      {sourceBroken.length > 0 && <section className="panel counter-integrity-warning">
        <b>Hay referencias de matchup que no existen en el roster:</b>
        {sourceBroken.map((item) => <span key={`${item.field}-${item.target}`}>{item.field}: {item.target}</span>)}
      </section>}

      <div className="two-column-matchups">
        <section className="panel">
          <span className="eyebrow">A quién castiga mejor</span>
          <h2>Mejores enfrentamientos de {source.name}</h2>
          <div className="matchup-grid">
            {favorableRank.map((matchup, index) => {
              const target = matchup.target;
              return <article className="matchup-card favorable" key={target.slug}>
                <BrawlerPortrait name={target.name} className="matchup-avatar" />
                <div>
                  <h3>{index + 1}. {target.name}</h3>
                  <p>{matchup.reason}</p>
                  <small>
                    {matchup.score}/100 · confianza {matchup.confidence}
                    {matchup.explicit ? " · relación explícita" : " · interacción calculada"}
                  </small>
                </div>
              </article>;
            })}
          </div>
        </section>

        <section className="panel">
          <span className="eyebrow danger-text">Counters específicos</span>
          <h2>Quién frena mejor a {source.name}</h2>
          <div className="matchup-grid">
            {threatRank.map((matchup, index) => {
              const threat = matchup.candidate;
              return <article className="matchup-card threat" key={threat.slug}>
                <BrawlerPortrait name={threat.name} className="matchup-avatar" />
                <div>
                  <h3>{index + 1}. {threat.name}</h3>
                  <p>{matchup.reason}</p>
                  <small>
                    {matchup.score}/100 · confianza {matchup.confidence}
                    {matchup.explicit ? " · relación explícita" : " · interacción calculada"}
                  </small>
                </div>
              </article>;
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
