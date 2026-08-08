export type Brawler = {
  slug: string;
  name: string;
  rarity: string;
  role: string;
  tier: string;
  range: string;
  difficulty: number;
  tags: string[];
  modes: Partial<Record<string, number>>;
  counters: string[];
  counteredBy: string[];
  build: string;
  profileComplete: boolean;
};

export type MapProfile = {
  slug: string;
  name: string;
  mode: string;
  layout: string;
  traits: string[];
  tierS: string[];
  tierA: string[];
  firstPicks: string[];
  lastPicks: string[];
  bans: string[];
  plan: string;
  featuredOfficialJune2026: boolean;
  status: string;
};

export type DraftPosition = "First pick" | "Pick intermedio" | "Last pick";

export type DraftInput = {
  map: MapProfile;
  position: DraftPosition;
  allies: string[];
  enemies: string[];
  bans: string[];
};

export type DraftMetrics = {
  mapFit: number;
  counter: number;
  synergy: number;
  safety: number;
  composition: number;
  risk: number;
};

export type DraftRecommendation = {
  brawler: Brawler;
  score: number;
  reasons: string[];
  warning?: string;
  metrics: DraftMetrics;
  countersHit: string[];
  exposedTo: string[];
  suggestedLine: string;
  plan: string;
};

export type DraftAnalysis = {
  recommendations: DraftRecommendation[];
  needs: string[];
  threats: string[];
  strengths: string[];
  draftStage: string;
  availableCount: number;
};
