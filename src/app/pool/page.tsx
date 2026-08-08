import type { Metadata } from "next";
import PlayerPool from "@/components/PlayerPool";
import { brawlers } from "@/lib/data";

export const metadata: Metadata = { title: "Mi pool" };

export default function PoolPage() {
  return <div className="page">
    <div className="page-heading">
      <span className="eyebrow">Personalización</span>
      <h1>Mi pool competitivo</h1>
      <p>Marca qué brawlers puedes jugar, cuáles están a fuerza 11, tienen hipercarga y cuánto confías en cada uno. Los datos se guardan únicamente en tu navegador.</p>
    </div>
    <PlayerPool brawlers={brawlers} />
  </div>;
}
