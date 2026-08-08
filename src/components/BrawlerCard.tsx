import Link from "next/link";
import type { Brawler } from "@/lib/types";
import FavoriteButton from "./FavoriteButton";
import { BrawlerPortrait } from "./GameArtwork";
import PatchBadge from "./PatchBadge";

export default function BrawlerCard({ brawler }: { brawler: Brawler }) {
  const tierClass = brawler.tier.replace("+", "p").replace(" ", "-").toLowerCase();
  return <article className="card brawler-card">
    <FavoriteButton type="brawler" id={brawler.slug} />
    <Link href={`/brawlers/${brawler.slug}`}>
      <BrawlerPortrait name={brawler.name} className="card-portrait" />
      <div className="brawler-card-copy">
        <div className="card-kicker">{brawler.rarity}</div>
        <h3>{brawler.name}</h3>
        <p>{brawler.role} · {brawler.range}</p>
        <PatchBadge name={brawler.name} />
      </div>
      <span className={`tier tier-${tierClass}`}>{brawler.tier}</span>
    </Link>
  </article>;
}
