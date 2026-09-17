import type { Metadata } from "next";
import CounterExplorer from "@/components/CounterExplorer";
import { brawlers } from "@/lib/data";

export const metadata: Metadata = { title: "Counters" };

export default function CountersPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Matchup Lab v0.16 · recalculado 17/09</span>
      <h1>Counters y amenazas</h1>
      <p>Los enfrentamientos están sincronizados con el meta post-balance: ajustes oficiales del 16/09, viabilidad actualizada el 17/09 y cálculo recíproco por movilidad, antidive, control, alcance y wallbreak. Este mismo motor alimenta Draft Assist.</p>
    </div>
    <CounterExplorer brawlers={brawlers} />
  </div>;
}