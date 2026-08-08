import { patchImpactFor } from "@/lib/patch";

export default function PatchBadge({ name }: { name: string }) {
  const impact = patchImpactFor(name);
  if (!impact) return null;
  return <span className={`patch-badge patch-${impact.direction}`} title={impact.summary}>{impact.label}</span>;
}
