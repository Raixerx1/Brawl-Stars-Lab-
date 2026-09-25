import type { Metadata } from "next";
import CounterExplorer from "@/components/CounterExplorer";
import { brawlers } from "@/lib/data";

export const metadata: Metadata = { title: "Counters" };

export default function CountersPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Matchup Lab v0.17 · recalculado 25/09</span>
      <h1>Counters y amenazas</h1>
      <p>Los enfrentamientos están sincronizados con el roster v0.34.0: balance oficial del 16/09, revisión de viabilidad del 25/09 y cálculo recíproco por movilidad, antidive, control, alcance y wallbreak. El mismo motor alimenta Draft Assist, por lo que los cambios de Wendy, Pam, Nori, Rico, Belle, Brock y Trunk se propagan a ambos módulos.</p>
    </div>
    <CounterExplorer brawlers={brawlers} />
  </div>;
}
