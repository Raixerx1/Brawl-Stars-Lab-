import type { Brawler } from "./types";
import { evaluateSpecificMatchup } from "./counter-engine";

export function favorableReason(source: Brawler, target: Brawler) {
  const reviewed = source.matchupNotes?.favorable?.[target.name];
  if (reviewed) return reviewed;
  return evaluateSpecificMatchup(source, target).reason;
}

export function threatReason(source: Brawler, threat: Brawler) {
  const reviewed = source.matchupNotes?.threats?.[threat.name];
  if (reviewed) return reviewed;
  return evaluateSpecificMatchup(threat, source).reason;
}
