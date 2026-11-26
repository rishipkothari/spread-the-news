/**
 * Spoken script (docs/pronunciation.md): what the voice reads, made from the checked script by small edits.
 *
 * The listening test (2026-11-26) showed the free voice reads most news text right as written and that rewrites break it
 * as often as they fix it. So the spoken text changes only known failures:
 *   1. code rules for the predictable ones (units, money shorthand, time zones, titles, party labels, months, WHO, accents);
 *   2. a Claude pass for the ones that need judgment (heteronyms, stress, names, commas), returned as find/replace edits;
 *   3. code checks that refuse any Claude edit that adds markup, puts capitals inside a respelling, touches a word the voice
 *      already reads right, or grows too much.
 * Same words, same order: display text stays on the site; the voice reads the spoken text.
 */

export interface SpokenEdit {
  find: string;
  replace: string;
  /** Category from docs/pronunciation.md, e.g. "heteronym", "unit", "name". */
  kind: string;
  why: string;
  by: "rule" | "claude";
}

export interface RejectedEdit extends SpokenEdit {
  reason: string;
}

export interface SpokenSegment {
  segmentId: string;
  kind: string;
  storyId?: string;
  /** The checked script text (what the site shows). */
  text: string;
  /** What the voice reads. */
  spoken: string;
  edits: SpokenEdit[];
  rejected: RejectedEdit[];
}

// ---------- code rules ----------

const STATES: Record<string, string> = {
  "Ala.": "Alabama", "Ariz.": "Arizona", "Ark.": "Arkansas", "Calif.": "California", "Colo.": "Colorado", "Conn.": "Connecticut",
  "Del.": "Delaware", "Fla.": "Florida", "Ga.": "Georgia", "Ill.": "Illinois", "Ind.": "Indiana", "Kan.": "Kansas", "Ky.": "Kentucky",
  "La.": "Louisiana", "Md.": "Maryland", "Mass.": "Massachusetts", "Mich.": "Michigan", "Minn.": "Minnesota", "Miss.": "Mississippi",
  "Mo.": "Missouri", "Mont.": "Montana", "Neb.": "Nebraska", "Nev.": "Nevada", "N.H.": "New Hampshire", "N.J.": "New Jersey",
  "N.M.": "New Mexico", "N.Y.": "New York", "N.C.": "North Carolina", "N.D.": "North Dakota", "Okla.": "Oklahoma", "Ore.": "Oregon",
  "Pa.": "Pennsylvania", "R.I.": "Rhode Island", "S.C.": "South Carolina", "S.D.": "South Dakota", "Tenn.": "Tennessee", "Vt.": "Vermont",
  "Va.": "Virginia", "Wash.": "Washington", "W.Va.": "West Virginia", "Wis.": "Wisconsin", "Wyo.": "Wyoming",
};
const FULL_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina",
  "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas",
  "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];
const PARTY: Record<string, string> = { R: "Republican", D: "Democrat", I: "independent" };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const STATE_KEYS = [...Object.keys(STATES), ...FULL_STATES].sort((a, b) => b.length - a.length).map(esc).join("|");

const MONTHS: Record<string, string> = { Jan: "January", Feb: "February", Aug: "August", Sep: "September", Sept: "September", Oct: "October", Nov: "November", Dec: "December" };
const ZONES: Record<string, string> = { ET: "Eastern", EST: "Eastern", EDT: "Eastern", CT: "Central", CST: "Central", CDT: "Central", MT: "Mountain", MST: "Mountain", MDT: "Mountain", PT: "Pacific", PST: "Pacific", PDT: "Pacific" };
const SCALE: Record<string, string> = { K: "thousand", M: "million", m: "million", B: "billion", bn: "billion", T: "trillion", tn: "trillion", thousand: "thousand", million: "million", billion: "billion", trillion: "trillion" };
const TITLES: [string, string][] = [
  ["Lt. Gov.", "Lieutenant Governor"], ["Atty. Gen.", "Attorney General"], ["Sens.", "Senators"], ["Reps.", "Representatives"], ["Govs.", "Governors"],
  ["Sen.", "Senator"], ["Rep.", "Representative"], ["Gov.", "Governor"], ["Gen.", "General"], ["Lt.", "Lieutenant"], ["Supt.", "Superintendent"],
];
const SPECIAL_LETTERS: Record<string, string> = { ø: "o", Ø: "O", ł: "l", Ł: "L", ß: "ss", đ: "d", Đ: "D", ı: "i", æ: "ae", Æ: "Ae", œ: "oe", Œ: "Oe" };

interface Rule {
  kind: string;
  why: string;
  re: RegExp;
  to: (m: RegExpExecArray) => string;
}

/** A period that ended an abbreviation also ended the sentence: keep it after the written-out form. */
function keepSentenceEnd(abbr: string, input: string, end: number): string {
  if (!abbr.endsWith(".")) return "";
  const rest = input.slice(end);
  return /^(\s*$|["”’)]?\s+[A-Z])/.test(rest) ? "." : "";
}

const RULES: Rule[] = [
  { kind: "unit", why: "°F is skipped or misread", re: /(\d)\s?°\s?F\b/g, to: (m) => `${m[1]} degrees Fahrenheit` },
  { kind: "unit", why: "°C is skipped or misread", re: /(\d)\s?°\s?C\b/g, to: (m) => `${m[1]} degrees Celsius` },
  { kind: "unit", why: "units are read as letters", re: /(\d)\s?mph\b/g, to: (m) => `${m[1]} miles per hour` },
  { kind: "unit", why: "units are read as letters", re: /(\d)\s?km\/h\b/g, to: (m) => `${m[1]} kilometers per hour` },
  { kind: "unit", why: "the voice skipped \"bps\" in the test", re: /(\d)\s?bps\b/g, to: (m) => `${m[1]} basis points` },
  { kind: "unit", why: "symbols are safer written out", re: /(\d)\s?%/g, to: (m) => `${m[1]} percent` },
  {
    kind: "money",
    why: "\"$1.2B\" is misread and \"$1.2 billion\" comes out as \"dollar\"",
    re: /\$(\d[\d,]*(?:\.\d+)?)\s?(thousand|million|billion|trillion|bn|tn|K|M|m|B|T)\b/g,
    to: (m) => `${m[1]} ${SCALE[m[2]]} dollars`,
  },
  { kind: "time", why: "\"ET\" was read as \"Eastern time\"", re: /(\d|[ap]\.m\.)\s+(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT)\b/g, to: (m) => `${m[1]} ${ZONES[m[2]]}` },
  { kind: "date", why: "month abbreviations are safer written out", re: /\b(Jan|Feb|Aug|Sept|Sep|Oct|Nov|Dec)\.\s(?=\d)/g, to: (m) => `${MONTHS[m[1]]} ` },
  ...TITLES.map(([abbr, full]): Rule => ({ kind: "title", why: "\"Sen.\"-style titles cause odd pauses", re: new RegExp(`\\b${esc(abbr)}\\s(?=[A-Z])`, "g"), to: () => `${full} ` })),
  {
    kind: "party",
    why: "\"R-Texas\" isn't read as \"Republican of Texas\"",
    re: new RegExp(`\\b([RDI])-(${STATE_KEYS})(?![A-Za-z])`, "g"),
    to: (m) => `${PARTY[m[1]]} of ${STATES[m[2]] ?? m[2]}`,
  },
  { kind: "initialism", why: "\"WHO\" is read as the word \"who\"", re: /\bWHO\b/g, to: () => "W.H.O." },
];

/** Strip accents from words with non-English letters: "São Paulo" read right only without them. */
function stripAccents(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[øØłŁßđĐıæÆœŒ]/g, (c) => SPECIAL_LETTERS[c] ?? c);
}

export function applyRules(text: string): { text: string; edits: SpokenEdit[] } {
  const edits: SpokenEdit[] = [];
  const seen = new Set<string>();
  const note = (find: string, replace: string, kind: string, why: string) => {
    if (find === replace || seen.has(`${find}→${replace}`)) return;
    seen.add(`${find}→${replace}`);
    edits.push({ find, replace, kind, why, by: "rule" });
  };
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.re, (...args) => {
      const groups = args.slice(0, -2) as string[];
      const offset = args.at(-2) as number;
      const input = args.at(-1) as string;
      const m = Object.assign([...groups], { index: offset, input }) as unknown as RegExpExecArray;
      const matched = groups[0];
      let to = rule.to(m);
      if (rule.kind === "party") to += keepSentenceEnd(matched, input, offset + matched.length);
      note(matched, to, rule.kind, rule.why);
      return to;
    });
  }
  out = out.replace(/[\p{L}\p{M}]+/gu, (w) => {
    if (!/[^\x00-\x7F]/.test(w)) return w;
    const plain = stripAccents(w);
    if (plain !== w && /^[\x00-\x7F]+$/.test(plain)) {
      note(w, plain, "accent", "accented letters were misread; plain letters worked");
      return plain;
    }
    return w;
  });
  return { text: out, edits };
}

// ---------- checks on Claude's edits ----------

/** Words the voice read right as written in the test, and respellings broke. An edit must keep them. */
export const LEAVE_ALONE = [
  "US", "U.S.", "NATO", "NAACP", "NASA", "FBI", "CIA", "EU", "GOP", "DOJ", "FEMA", "OPEC", "AT&T", "xAI", "Nvidia", "Kyiv", "Qatar",
  "Worcester", "Buttigieg", "Kamala", "Zelenskyy", "Zelensky", "COVID-19", "F-35", "H-1B", "401(k)", "9/11", "Plan B", "Grade A",
  "St. Louis", "v.",
];

function containsWord(text: string, word: string): boolean {
  const before = /^\w/.test(word) ? "(?<![\\w.])" : "";
  const after = /\w$/.test(word) ? "(?![\\w])" : "";
  return new RegExp(`${before}${esc(word)}${after}`).test(text);
}

/** Why an edit can't be used on this text, or null if it can. */
export function editProblem(e: { find: string; replace: string }, text: string): string | null {
  if (!e.find) return "empty find";
  if (!text.includes(e.find)) return "find text isn't in the segment";
  if (e.find === e.replace) return "no change";
  if (/[<>{}\\]|\n/.test(e.replace)) return "markup or line breaks (the voice can't take markup)";
  if (e.find.length > 120) return "find text too long (fix one word or phrase at a time)";
  if (e.replace.length > e.find.length * 3 + 40) return "replacement much longer than the original";
  for (const w of LEAVE_ALONE) {
    if (containsWord(e.find, w) && !containsWord(e.replace, w)) return `"${w}" is read right as written`;
  }
  const original = new Set(e.find.split(/\s+/));
  for (const raw of e.replace.split(/\s+/)) {
    const tok = raw.replace(/^[^\p{L}\d]+|[^\p{L}\d.]+$/gu, "");
    if (!tok || original.has(raw) || original.has(tok)) continue;
    if (/^([A-Z]\.)+$/.test(tok)) continue; // W.H.O.
    if (/[A-Z]/.test(tok.slice(1))) return `capitals inside "${tok}" (the voice spells them out)`;
  }
  return null;
}

/** Apply Claude's edits in order (each replaces every occurrence in the segment), refusing the unsafe ones. */
export function applyClaudeEdits(text: string, edits: Omit<SpokenEdit, "by">[]): { text: string; applied: SpokenEdit[]; rejected: RejectedEdit[] } {
  let out = text;
  const applied: SpokenEdit[] = [];
  const rejected: RejectedEdit[] = [];
  for (const e of edits) {
    const edit = { ...e, by: "claude" as const };
    const problem = editProblem(e, out);
    if (problem) {
      rejected.push({ ...edit, reason: problem });
      continue;
    }
    out = out.split(e.find).join(e.replace);
    applied.push(edit);
  }
  return { text: out, applied, rejected };
}
