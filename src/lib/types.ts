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

export type DraftInput = {
  map: MapProfile;
  position: "First pick" | "Pick intermedio" | "Last pick";
  allies: string[];
  enemies: string[];
  bans: string[];
};

export type DraftRecommendation = {
  brawler: Brawler;
  score: number;
  reasons: string[];
  warning?: string;
};
