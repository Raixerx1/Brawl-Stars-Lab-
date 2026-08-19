import type { Brawler } from "./types";

type AliasMap = Record<string, string[]>;

type AliasEntry = {
  name: string;
  alias: string;
  tokens: number;
};

const MANUAL_ALIASES: AliasMap = {
  "8 bit": ["ocho bit", "ocho bits", "eight bit", "eibit", "ait bit", "abit", "a bit", "abid", "eightbit", "8bit"],
  "r t": ["erre te", "rt", "arte", "rte"],
  "mr p": ["mister p", "mr p", "señor p", "senor p"],
  "larry y lawrie": ["larry y lawrie", "larry lawrie", "lari y lori", "lari lori", "larry and lawrie"],
  "stu": ["estu", "stew"],
  "crow": ["crou", "crowe"],
  "surge": ["serge", "surg", "surch", "serch"],
  "gale": ["gail", "geil"],
  "bo": ["bow"],
  "maisie": ["maisy", "meisi", "macy"],
  "meeple": ["mipel", "meeple"],
  "jae yong": ["jae yong", "jayong", "jaeyong", "ye yong"],
  "ollie": ["oli", "olly"],
  "berry": ["beri", "barry"],
  "shade": ["sheid", "shaid"],
  "moe": ["mou", "mo"],
  "clancy": ["clansi", "clancy"],
  "lily": ["lili"],
  "kaze": ["kase", "case"],
  "pierce": ["pirs", "piers"],
  "starr nova": ["star nova", "starnova"],
  "glowy": ["gloui", "glowi"],
  "ziggy": ["zigi", "zigui"],
  "najia": ["naya", "najia"],
  "damian": ["damián", "damien"],
};

const COMMAND_WORDS = new Set([
  "ban", "bans", "banea", "banear", "baneamos", "banead", "quita", "bloquea", "bloquear",
  "pick", "picks", "pickea", "piquea", "pique", "elige", "selecciona",
  "mete", "meter", "pon", "poner", "añade", "anade", "rival", "enemigo", "enemiga",
  "aliado", "aliada", "brawler", "brawlers", "browler", "browlers", "ahora", "siguiente",
  "primero", "segundo", "tercero", "cuarto", "quinto", "sexto",
]);

const CONNECTOR_WORDS = new Set([
  "y", "e", "luego", "despues", "después", "tambien", "también", "otro", "otra",
]);

export function normalizeVoice(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasesFor(brawler: Brawler) {
  const canonical = normalizeVoice(brawler.name);
  const slug = normalizeVoice(brawler.slug.replace(/-/g, " "));
  return [...new Set([
    canonical,
    slug,
    ...(MANUAL_ALIASES[canonical] || []),
  ].map(normalizeVoice).filter(Boolean))];
}

function aliasEntries(roster: Brawler[]) {
  return roster.flatMap((brawler): AliasEntry[] => aliasesFor(brawler).map((alias) => ({
    name: brawler.name,
    alias,
    tokens: alias.split(" ").length,
  })));
}

function levenshtein(left: string, right: string) {
  const rows = right.length + 1;
  const columns = left.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
  for (let column = 0; column < columns; column += 1) matrix[0][column] = column;
  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      matrix[row][column] = right[row - 1] === left[column - 1]
        ? matrix[row - 1][column - 1]
        : Math.min(
          matrix[row - 1][column - 1] + 1,
          matrix[row][column - 1] + 1,
          matrix[row - 1][column] + 1,
        );
    }
  }
  return matrix[rows - 1][columns - 1];
}

function fuzzySimilarity(left: string, right: string) {
  const leftCompact = left.replace(/\s/g, "");
  const rightCompact = right.replace(/\s/g, "");
  const longest = Math.max(leftCompact.length, rightCompact.length);
  return longest ? 1 - levenshtein(leftCompact, rightCompact) / longest : 1;
}

function fuzzyThreshold(value: string) {
  const length = value.replace(/\s/g, "").length;
  if (length <= 2) return .96;
  if (length <= 4) return .78;
  if (length <= 6) return .73;
  if (length <= 9) return .69;
  return .67;
}

function bestWindowMatch(phrase: string, tokenCount: number, entries: AliasEntry[]) {
  let best: { name: string; score: number; exact: boolean } | undefined;

  for (const entry of entries) {
    const tokenGap = Math.abs(entry.tokens - tokenCount);
    if (tokenGap > 1) continue;
    const exact = phrase === entry.alias;
    let score = exact ? 1 : fuzzySimilarity(phrase, entry.alias);
    if (!exact && tokenGap) score -= .06 * tokenGap;
    if (!exact && score < fuzzyThreshold(phrase)) continue;
    if (!best || Number(exact) > Number(best.exact) || (exact === best.exact && score > best.score)) {
      best = { name: entry.name, score, exact };
    }
  }

  return best;
}

/**
 * Reconoce una secuencia completa de brawlers en el orden en que se dicen.
 * Está pensado para frases rápidas como:
 * "Surge, Abit, Amber, Gale, Edgar y Damián".
 */
export function matchBrawlersInSpeech(transcript: string, roster: Brawler[]) {
  const normalized = normalizeVoice(transcript);
  if (!normalized) return [];

  const tokens = normalized.split(" ").filter(Boolean);
  const entries = aliasEntries(roster);
  const longestAlias = Math.max(1, ...entries.map((entry) => entry.tokens));
  const names: string[] = [];

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];

    if (COMMAND_WORDS.has(token)) {
      index += 1;
      continue;
    }

    let selected: { name: string; length: number; score: number; exact: boolean } | undefined;
    const maxWindow = Math.min(longestAlias + 1, 4, tokens.length - index);

    // Primero intenta ventanas largas: protege nombres como "Larry y Lawrie" o "R T".
    for (let length = maxWindow; length >= 1; length -= 1) {
      const phrase = tokens.slice(index, index + length).join(" ");
      const match = bestWindowMatch(phrase, length, entries);
      if (!match) continue;
      const candidate = { ...match, length };
      if (
        !selected ||
        Number(candidate.exact) > Number(selected.exact) ||
        (candidate.exact === selected.exact && candidate.score > selected.score + .015) ||
        (candidate.exact === selected.exact && Math.abs(candidate.score - selected.score) <= .015 && candidate.length > selected.length)
      ) {
        selected = candidate;
      }
    }

    if (selected) {
      if (!names.includes(selected.name)) names.push(selected.name);
      index += selected.length;
      continue;
    }

    // "y", "luego", etc. solo se saltan después de haber intentado formar un nombre compuesto.
    if (CONNECTOR_WORDS.has(token)) {
      index += 1;
      continue;
    }

    index += 1;
  }

  return names;
}
