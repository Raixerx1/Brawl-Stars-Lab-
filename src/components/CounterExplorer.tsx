"use client";

import { useEffect, useMemo, useState } from "react";
import type { Brawler } from "@/lib/types";
import { favorableReason, threatReason } from "@/lib/matchups";
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

  const lookup = (name: string) => ordered.find((brawler) => brawler.name === name);

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
            <span className="eyebrow">Roster completo</span>
            <h2>Busca cualquier brawler</h2>
            <p>Todos los brawlers registrados aparecen en este listado, aunque su perfil táctico todavía esté pendiente de validación.</p>
          </div>
          <span className="counter-roster-count">{visible.length}/{audit.total}</span>
        </div>

        <div className="counter-audit-strip">
          <span><b>{audit.total}</b> brawlers</span>
          <span><b>{audit.withCounters}</b> con counters</span>
          <span><b>{audit.withThreats}</b> con amenazas</span>
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
            <span>{source.counters.length} buenos matchups</span>
            <span>{source.counteredBy.length} amenazas</span>
            <span>{source.profileComplete ? "Perfil táctico completo" : "Perfil base pendiente de validación"}</span>
          </div>
        </div>
      </section>

      {sourceBroken.length > 0 && <section className="panel counter-integrity-warning">
        <b>Hay referencias de matchup que no existen en el roster:</b>
        {sourceBroken.map((item) => <span key={`${item.field}-${item.target}`}>{item.field}: {item.target}</span>)}
      </section>}

      <div className="two-column-matchups">
        <section className="panel">
          <span className="eyebrow">Lo suele castigar</span>
          <h2>Buenos enfrentamientos</h2>
          <div className="matchup-grid">
            {source.counters.map((name) => {
              const target = lookup(name);
              if (!target) return null;
              return <article className="matchup-card favorable" key={name}>
                <BrawlerPortrait name={target.name} className="matchup-avatar" />
                <div><h3>{target.name}</h3><p>{favorableReason(source, target)}</p></div>
              </article>;
            })}
            {!source.counters.length && <div className="empty-state">Todavía no se han definido counters para {source.name}.</div>}
          </div>
        </section>

        <section className="panel">
          <span className="eyebrow danger-text">Amenazas</span>
          <h2>Quién lo frena</h2>
          <div className="matchup-grid">
            {source.counteredBy.map((name) => {
              const threat = lookup(name);
              if (!threat) return null;
              return <article className="matchup-card threat" key={name}>
                <BrawlerPortrait name={threat.name} className="matchup-avatar" />
                <div><h3>{threat.name}</h3><p>{threatReason(source, threat)}</p></div>
              </article>;
            })}
            {!source.counteredBy.length && <div className="empty-state">Todavía no se han definido amenazas para {source.name}.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
