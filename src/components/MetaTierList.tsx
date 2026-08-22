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

const tierOrder = ["S+", "S", "A", "B", "C", "D", "F", "Sin datos"];

export default function MetaTierList({
  data,
  brawlers,
}: {
  data: TierListData;
  brawlers: Brawler[];
}) {
  const snapshotNames = Object.keys(data.snapshots);
  const [snapshot, setSnapshot] = useState(snapshotNames[0] || "");
  const selected = data.snapshots[snapshot] || {};
  const lookup = useMemo(
    () => new Map(brawlers.map((brawler) => [brawler.name, brawler])),
    [brawlers],
  );

  return <section className="panel meta-tierlist-v11">
    <div className="section-title">
      <div>
        <span className="eyebrow">Tier list actual</span>
        <h2>Meta competitivo Windstock</h2>
        <p>Orden global orientativo. Para el draft real prevalecen el mapa, el modo, los bans y el matchup uno a uno.</p>
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
      <span><b>Actualización</b>{data.updated.split("-").reverse().join("/")}</span>
      <span><b>Fuente estadística</b>{data.source}<a href={data.sourceUrl} target="_blank" rel="noreferrer">Abrir fuente ↗</a></span>
      <span><b>Criterio</b>{data.method}</span>
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
