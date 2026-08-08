import Link from "next/link";
import type { Brawler } from "@/lib/types";
import { brawlerByName } from "@/lib/data";
import { favorableReason, threatReason } from "@/lib/matchups";
import { BrawlerPortrait } from "./GameArtwork";

export default function MatchupGrid({
  source,
  names,
  kind,
}: {
  source: Brawler;
  names: string[];
  kind: "favorable" | "threat";
}) {
  const targets = names.map(brawlerByName).filter(Boolean) as Brawler[];
  if (!targets.length) return <div className="empty-state">Pendiente de evaluación.</div>;
  return (
    <div className="matchup-grid">
      {targets.map((target) => (
        <Link href={`/brawlers/${target.slug}`} className={`matchup-card ${kind}`} key={target.slug}>
          <BrawlerPortrait name={target.name} className="matchup-avatar" />
          <div>
            <h3>{target.name}</h3>
            <p>{kind === "favorable" ? favorableReason(source, target) : threatReason(source, target)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
