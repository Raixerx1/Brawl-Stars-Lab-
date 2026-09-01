"use client";

import { useMemo, useState } from "react";
import type { Brawler } from "@/lib/types";
import { BrawlerPortrait } from "./GameArtwork";

type TierSnapshot = Record<string, string[]>;

type TierListData = {
  updated: string;
  source: string;
  sourceUrl: string;
  method: string;
  snapshots: Record<string, TierSnapshot>;
};

const tierOrder = ["S+", "S", "A+", "A", "B+", "B", "C", "D", "F", "Sin datos"];
const PATCH_DAY_LABEL = "Prior U69 · 01/09";

export default function MetaTierList({
  data,
  brawlers,
}: {
  data: TierListData;
  brawlers: Brawler[];
}) {
  const patchDaySnapshot = useMemo(() => {
    const grouped: TierSnapshot = {};
    for (const brawler of brawlers) {
      const tier = brawler.tier || "Sin datos";
      (grouped[tier] ||= []).push(brawler.name);
    }
    return grouped;
  }, [brawlers]);

  const snapshots = useMemo<Record<string, TierSnapshot>>(() => ({
    [PATCH_DAY_LABEL]: patchDaySnapshot,
    ...data.snapshots,
  }), [data.snapshots, patchDaySnapshot]);

  const snapshotNames = Object.keys(snapshots);
  const [snapshot, setSnapshot] = useState(PATCH_DAY_LABEL);
  const selected = snapshots[snapshot] || patchDaySnapshot;
  const isPatchDay = snapshot === PATCH_DAY_LABEL;
  const lookup = useMemo(
    () => new Map(brawlers.map((brawler) => [brawler.name, brawler])),
    [brawlers],
  );

  return <section className="panel meta-tierlist-v11">
    <div className="section-title">
      <div>
        <span className="eyebrow">Tier list competitiva</span>
        <h2>Update 69: prior de día 1 + snapshots observados</h2>
        <p>{isPatchDay
          ? "Modelo provisional tras 69.230. Parte del snapshot observado del 30/08 y aplica de forma conservadora la dirección del balance final; todavía no es una tier basada en win rate post-parche."
          : "Snapshot estadístico anterior al parche. Sirve como baseline de contraste mientras entra muestra suficiente de Update 69."}</p>
      </div>
      <div className="meta-tier-tabs" role="tablist" aria-label="Periodo de la tier list">
        {snapshotNames.map((name) => <button
          type="button"
          role="tab"
          aria-selected={snapshot === name}
          className={snapshot === name ? "active" : ""}
          key={name}
          onClick={() => setSnapshot(name)}
        >{name}</button>)}
      </div>
    </div>

    <div className="meta-tier-source">
      <span><b>Actualización</b>{isPatchDay ? "01/09/2026 · Update 69" : data.updated.split("-").reverse().join("/")}</span>
      <span><b>{isPatchDay ? "Base del modelo" : "Fuente estadística"}</b>{isPatchDay ? "Meta 24 h 30/08 + balance final U69" : data.source}{!isPatchDay && <a href={data.sourceUrl} target="_blank" rel="noreferrer">Abrir fuente ↗</a>}</span>
      <span><b>Criterio</b>{isPatchDay
        ? "Prior conservador; mapa, modo, geometría, orden y matchup prevalecen. Recalibrar con datos 24–72 h post-parche."
        : "Snapshot observado pre-Update 69. Se conserva como control histórico para medir cuánto del cambio posterior procede del parche y cuánto del ruido de muestra."}</span>
    </div>

    <div className="meta-tier-rows">
      {tierOrder.map((tier) => {
        const names = selected[tier] || [];
        if (!names.length) return null;
        return <article className={`meta-tier-row tier-${tier.toLowerCase().replace(/\+/g, "plus").replace(/\s+/g, "-")}`} key={tier}>
          <div className="meta-tier-label">
            <strong>{tier}</strong>
            <span>{names.length}</span>
          </div>
          <div className="meta-tier-brawlers">
            {names.map((name) => {
              const brawler = lookup.get(name);
              return <div className="meta-tier-brawler" key={name} title={`${name}${brawler ? ` · ${brawler.role}` : ""}`}>
                <BrawlerPortrait name={name} className="meta-tier-avatar" />
                <span>{name}</span>
              </div>;
            })}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
