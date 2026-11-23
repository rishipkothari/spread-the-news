import type { StorySynthesis } from "@/lib/types";

/**
 * A per-run "who's who": role phrases found anywhere in today's material ("Transportation Secretary Sean Duffy",
 * "Homeland Security Secretary Mullin"), so a segment can say who someone is even when its own story's facts only give
 * the name. Pure text matching over checked facts and outlets' headlines; no LLM, no outside knowledge.
 */

const TITLES = [
  "Attorney General", "Vice President", "Prime Minister", "Majority Leader", "Minority Leader", "Secretary General",
  "Secretary", "Senator", "Sen\\.", "Representative", "Rep\\.", "President", "Governor", "Gov\\.", "Director",
  "Administrator", "Minister", "Leader", "Speaker", "Mayor", "Judge", "Justice", "Chairman", "Chairwoman", "Chair",
  "CEO", "Ambassador", "Commissioner", "Chancellor", "General", "Admiral", "DNI",
].join("|");

// Up to three capitalized words before the title (department/agency, e.g. "Homeland Security", "FAA"), the title,
// an optional "of …" ("Director of National Intelligence", "Secretary of State"), then 1–3 name words.
const ROLE = new RegExp(`((?:(?:[A-Z][A-Za-z.&-]*|of) ){0,3}(?:${TITLES})(?: of(?: the)?(?: [A-Z][a-z]+){1,3}(?= [A-Z]))?)((?: [A-Z][a-z'’-]+(?: [A-Z]\\.)?){1,3})`, "g");
const LEADING_NOISE = /^(?:The|A|An|Former|Then|Incoming|Outgoing|New|Acting|And|But|As|In|On|At|By|For|From|With|After)\s+/;
// Words that can follow a title but aren't names ("President Trump Says", "Senate Democrats").
const NOT_NAMES = new Set(["Says", "Said", "Has", "Had", "Will", "Would", "Is", "Was", "On", "In", "Of", "And", "To", "For", "The", "After", "Over", "Says,"]);

export interface Role {
  name: string; // the person's name as written ("Sean Duffy", "Mullin")
  surname: string;
  phrase: string; // the full role phrase ("Transportation Secretary Sean Duffy")
}

export function extractRoles(texts: string[]): Role[] {
  const out = new Map<string, Role>();
  for (const text of texts) {
    for (const m of text.matchAll(ROLE)) {
      let title = m[1].trim();
      while (LEADING_NOISE.test(title)) title = title.replace(LEADING_NOISE, "");
      const all = m[2].trim().split(/\s+/);
      const stop = all.findIndex((w) => NOT_NAMES.has(w)); // title-case headlines: "President Trump Says Iran…"
      const words = stop === -1 ? all : all.slice(0, stop);
      if (!words.length) continue;
      const name = words.join(" ");
      const phrase = `${title} ${name}`;
      const surname = words.filter((w) => !/^[A-Z]\.$/.test(w)).at(-1)!;
      // Keep the most informative phrase per surname: the longest.
      const prev = out.get(surname);
      if (!prev || phrase.length > prev.phrase.length) out.set(surname, { name, surname, phrase });
    }
  }
  return [...out.values()];
}

/** All the text in a run that can identify people: every synthesis's facts and positions, plus outlets' headlines. */
export function runTexts(syntheses: StorySynthesis[], headlines: string[]): string[] {
  return [
    ...syntheses.flatMap((s) => [
      ...s.agreedFacts.map((f) => f.fact),
      ...(s.singleSourceFacts ?? []).map((f) => f.fact),
      ...s.disputed.flatMap((d) => d.positions.map((p) => p.position)),
    ]),
    ...headlines,
  ];
}

/**
 * Role phrases for people named in this story's material, from anywhere in today's run.
 * Skips ones the story's material already states in full, so it only adds what's missing.
 */
export function whoIsWhoFor(storyText: string, roles: Role[], max = 8): string[] {
  return roles
    .filter((r) => new RegExp(`(?<![A-Za-z])${r.surname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`).test(storyText))
    .filter((r) => !storyText.includes(r.phrase))
    .slice(0, max)
    .map((r) => r.phrase);
}
