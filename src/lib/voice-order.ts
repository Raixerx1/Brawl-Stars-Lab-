import { normalizeVoice } from "./voice-brawler";

export type OrderedVoicePlanInput = {
  spoken: string[];
  selected: string[];
  active?: string | null;
  maxSlots?: number;
};

export function orderedUniqueVoiceNames(names: string[]) {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = normalizeVoice(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildOrderedPendingVoicePlan({
  spoken,
  selected,
  active,
  maxSlots = 6,
}: OrderedVoicePlanInput) {
  const selectedKeys = new Set(selected.map(normalizeVoice).filter(Boolean));
  const activeKey = active ? normalizeVoice(active) : "";
  const activeConsumesSlot = Boolean(activeKey && !selectedKeys.has(activeKey));
  const capacity = Math.max(0, maxSlots - selectedKeys.size - (activeConsumesSlot ? 1 : 0));

  return orderedUniqueVoiceNames(spoken)
    .filter((name) => {
      const key = normalizeVoice(name);
      return !selectedKeys.has(key) && key !== activeKey;
    })
    .slice(0, capacity);
}
