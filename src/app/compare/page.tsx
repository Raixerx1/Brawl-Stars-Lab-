import type { Metadata } from "next";
import BrawlerCompare from "@/components/BrawlerCompare";
import { brawlers } from "@/lib/data";

export const metadata: Metadata = { title: "Comparador" };

export default function ComparePage() {
  return <div className="page">
    <div className="page-heading"><span className="eyebrow">Estudio de alternativas</span><h1>Comparador de brawlers</h1><p>Compara seguridad de first pick, capacidad de carry, rango, counters compartidos y amenazas comunes.</p></div>
    <BrawlerCompare brawlers={brawlers} />
  </div>;
}
