/**
 * One-time listening test (docs/pronunciation.md): which spellings and markup Edge reads correctly. Each item is a
 * short news-style line in several versions; the user marks each version ✓ / ✗ on /debug/voices and sends the
 * result to Claude (feedback:pronunciation). The answers decide the spoken-script prompt's respelling style and
 * whether to use SSML.
 *
 * `markup: true` versions are SSML fragments sent as is (must stay XML-safe apart from the tags); the rest are plain
 * text, escaped like episode text.
 */

export interface TestVariant {
  id: string;
  label: string;
  text: string;
  markup?: boolean;
}

export interface TestItem {
  id: string;
  /** Category number in docs/pronunciation.md (1–20), or "ssml" for markup-only checks. */
  category: string;
  topic: string;
  /** What a correct reading sounds like. */
  listenFor: string;
  variants: TestVariant[];
}

export const TEST_VERSION = "v1";

const plain = (text: string): TestVariant => ({ id: "plain", label: "As written", text });
const v = (id: string, label: string, text: string): TestVariant => ({ id, label, text });
const ipa = (text: string): TestVariant => ({ id: "ipa", label: "Phoneme tag (IPA)", text, markup: true });
const ph = (word: string, ipaStr: string) => `<phoneme alphabet="ipa" ph="${ipaStr}">${word}</phoneme>`;

export const PRONUNCIATION_TEST: TestItem[] = [
  // 1. Heteronyms
  { id: "read-intro", category: "1", topic: "read (our intro)", listenFor: "“red”", variants: [
    plain("This is Spread the News, where we read across the spectrum so you don't have to."),
    v("respell", "Respelled “red”", "This is Spread the News, where we red across the spectrum so you don't have to."),
    ipa(`This is Spread the News, where we ${ph("read", "ɹɛd")} across the spectrum so you don't have to.`),
  ] },
  { id: "read-past", category: "1", topic: "read (past tense)", listenFor: "“red”", variants: [
    plain("Last night, lawmakers read the full report."),
    v("respell", "Respelled “red”", "Last night, lawmakers red the full report."),
    ipa(`Last night, lawmakers ${ph("read", "ɹɛd")} the full report.`),
  ] },
  { id: "lead-metal", category: "1", topic: "lead (the metal)", listenFor: "“led”", variants: [
    plain("Inspectors found lead in the city's water."),
    v("respell", "Respelled “led”", "Inspectors found led in the city's water."),
    ipa(`Inspectors found ${ph("lead", "lɛd")} in the city's water.`),
  ] },
  // 2. Stress-shift pairs
  { id: "perfect-verb", category: "2", topic: "perfect (verb)", listenFor: "per-FECT, stress on the second syllable", variants: [
    plain("Engineers spent years trying to perfect the design."),
    v("hyphen-caps", "per-FECT", "Engineers spent years trying to per-FECT the design."),
    v("caps", "perFECT", "Engineers spent years trying to perFECT the design."),
    v("phonetic", "pur-fect", "Engineers spent years trying to pur-fect the design."),
    ipa(`Engineers spent years trying to ${ph("perfect", "pɚˈfɛkt")} the design.`),
  ] },
  { id: "record-verb", category: "2", topic: "record (verb)", listenFor: "ri-CORD", variants: [
    plain("Police now record every traffic stop."),
    v("hyphen-caps", "ree-CORD", "Police now ree-CORD every traffic stop."),
    v("caps", "reCORD", "Police now reCORD every traffic stop."),
    ipa(`Police now ${ph("record", "ɹɪˈkɔɹd")} every traffic stop.`),
  ] },
  { id: "present-verb", category: "2", topic: "present (verb)", listenFor: "pri-ZENT", variants: [
    plain("The team will present its plan on Monday."),
    v("hyphen-caps", "pre-ZENT", "The team will pre-ZENT its plan on Monday."),
    v("caps", "preZENT", "The team will preZENT its plan on Monday."),
    ipa(`The team will ${ph("present", "pɹɪˈzɛnt")} its plan on Monday.`),
  ] },
  // 3. Capitalized look-alikes
  { id: "polish", category: "3", topic: "Polish", listenFor: "POH-lish (from Poland)", variants: [
    plain("Polish farmers blocked the border crossing."),
    v("respell", "Poe-lish", "Poe-lish farmers blocked the border crossing."),
    v("hyphen-caps", "POH-lish", "POH-lish farmers blocked the border crossing."),
  ] },
  { id: "who", category: "3", topic: "WHO", listenFor: "W-H-O as letters, not “who”", variants: [
    plain("WHO officials warned of a new outbreak."),
    v("periods", "W.H.O.", "W.H.O. officials warned of a new outbreak."),
    v("spaces", "W H O", "W H O officials warned of a new outbreak."),
    v("hyphens", "W-H-O", "W-H-O officials warned of a new outbreak."),
  ] },
  // 4. Initialisms
  { id: "us-adj", category: "4", topic: "US (before a noun)", listenFor: "a smooth “you-ess”, not two separate letters", variants: [
    plain("The US economy grew faster than expected."),
    v("periods", "U.S.", "The U.S. economy grew faster than expected."),
    v("spaces", "U S", "The U S economy grew faster than expected."),
    v("hyphen", "U-S", "The U-S economy grew faster than expected."),
    v("respell", "you-ess", "The you-ess economy grew faster than expected."),
    { id: "say-as", label: "say-as characters tag", text: `The <say-as interpret-as="characters">US</say-as> economy grew faster than expected.`, markup: true },
  ] },
  { id: "us-noun", category: "4", topic: "US (end of a phrase)", listenFor: "“you-ess”, never “us”", variants: [
    plain("Talks between China and the US stalled again."),
    v("periods", "U.S.", "Talks between China and the U.S. stalled again."),
    v("hyphen", "U-S", "Talks between China and the U-S stalled again."),
  ] },
  // 5. Acronyms and conventional readings
  { id: "naacp", category: "5", topic: "NAACP", listenFor: "“N double-A C P”", variants: [
    plain("The NAACP filed a lawsuit on Tuesday."),
    v("respell", "N double-A C P", "The N double-A C P filed a lawsuit on Tuesday."),
    v("hyphens", "N-double-A-C-P", "The N-double-A-C-P filed a lawsuit on Tuesday."),
  ] },
  { id: "nato", category: "5", topic: "NATO", listenFor: "NAY-toe, as one word", variants: [
    plain("NATO leaders met in Brussels."),
    v("title", "Nato", "Nato leaders met in Brussels."),
    v("respell", "Nay-toe", "Nay-toe leaders met in Brussels."),
  ] },
  // 6. All caps
  { id: "caps", category: "6", topic: "all caps for emphasis", listenFor: "“not” as a word", variants: [
    plain("The ruling does NOT apply to existing contracts."),
    v("lower", "not", "The ruling does not apply to existing contracts."),
  ] },
  // 7. Single letters
  { id: "letters", category: "7", topic: "Plan B, Grade A", listenFor: "“plan bee”, “grade ay”", variants: [
    plain("Officials had no Plan B, and the city lost its Grade A rating."),
    v("respell", "Plan Bee, Grade Ay", "Officials had no Plan Bee, and the city lost its Grade Ay rating."),
  ] },
  // 8. Abbreviations
  { id: "sen", category: "8", topic: "Sen., R-Texas", listenFor: "“Senator … Republican of Texas”, no odd pause", variants: [
    plain("Sen. John Cornyn, R-Texas, voted against the bill."),
    v("expanded", "Written out", "Senator John Cornyn, Republican of Texas, voted against the bill."),
    { id: "sub", label: "sub alias tags", text: `<sub alias="Senator">Sen.</sub> John Cornyn, <sub alias="Republican of Texas">R-Texas</sub>, voted against the bill.`, markup: true },
  ] },
  { id: "st", category: "8", topic: "St. Louis", listenFor: "“Saint Louis”", variants: [
    plain("Flooding hit St. Louis overnight."),
    v("expanded", "Saint Louis", "Flooding hit Saint Louis overnight."),
  ] },
  // 9. People
  { id: "zelenskyy", category: "9", topic: "Zelenskyy", listenFor: "zeh-LEN-skee", variants: [
    plain("Volodymyr Zelenskyy spoke with European leaders."),
    v("hyphen-caps", "Zeh-LEN-skee", "Volodymyr Zeh-LEN-skee spoke with European leaders."),
    v("simple", "Zelensky", "Volodymyr Zelensky spoke with European leaders."),
    ipa(`Volodymyr ${ph("Zelenskyy", "zɛˈlɛnski")} spoke with European leaders.`),
  ] },
  { id: "buttigieg", category: "9", topic: "Buttigieg", listenFor: "BOOT-edge-edge", variants: [
    plain("Pete Buttigieg is weighing a run for governor."),
    v("hyphen-caps", "BOOT-edge-edge", "Pete BOOT-edge-edge is weighing a run for governor."),
    v("hyphen", "Boot-edge-edge", "Pete Boot-edge-edge is weighing a run for governor."),
    ipa(`Pete ${ph("Buttigieg", "ˈbutɪdʒɛdʒ")} is weighing a run for governor.`),
  ] },
  { id: "kamala", category: "9", topic: "Kamala", listenFor: "COMMA-la", variants: [
    plain("Kamala Harris campaigned in Michigan."),
    v("hyphen-caps", "COMMA-la", "COMMA-la Harris campaigned in Michigan."),
    v("respell", "Comma-la", "Comma-la Harris campaigned in Michigan."),
    ipa(`${ph("Kamala", "ˈkɑmələ")} Harris campaigned in Michigan.`),
  ] },
  { id: "sheinbaum", category: "9", topic: "Sheinbaum", listenFor: "SHANE-bowm", variants: [
    plain("Mexican President Claudia Sheinbaum responded on Friday."),
    v("hyphen-caps", "SHANE-bowm", "Mexican President Claudia SHANE-bowm responded on Friday."),
    v("respell", "Shainebaum", "Mexican President Claudia Shainebaum responded on Friday."),
    ipa(`Mexican President Claudia ${ph("Sheinbaum", "ˈʃeɪnbaʊm")} responded on Friday.`),
  ] },
  { id: "erdogan", category: "9", topic: "Erdoğan", listenFor: "AIR-doh-ahn (the ğ is silent)", variants: [
    plain("Turkish President Recep Tayyip Erdoğan met the NATO chief."),
    v("ascii", "Erdogan", "Turkish President Recep Tayyip Erdogan met the NATO chief."),
    v("hyphen-caps", "AIR-doh-ahn", "Turkish President Recep Tayyip AIR-doh-ahn met the NATO chief."),
    ipa(`Turkish President Recep Tayyip ${ph("Erdoğan", "ˈɛɹdoʊɑn")} met the NATO chief.`),
  ] },
  // 10. Places
  { id: "worcester", category: "10", topic: "Worcester", listenFor: "WUSS-ter", variants: [
    plain("Police in Worcester, Massachusetts, made an arrest."),
    v("hyphen-caps", "WUSS-ter", "Police in WUSS-ter, Massachusetts, made an arrest."),
    v("respell", "Wooster", "Police in Wooster, Massachusetts, made an arrest."),
  ] },
  { id: "kyiv", category: "10", topic: "Kyiv", listenFor: "KEE-yiv (or KEEV)", variants: [
    plain("Air raid sirens sounded across Kyiv."),
    v("hyphen-caps", "KEE-yiv", "Air raid sirens sounded across KEE-yiv."),
    v("respell", "Keev", "Air raid sirens sounded across Keev."),
  ] },
  { id: "qatar", category: "10", topic: "Qatar", listenFor: "KAH-tar or kuh-TAR", variants: [
    plain("Qatar is hosting the ceasefire talks."),
    v("hyphen-caps", "KAH-tar", "KAH-tar is hosting the ceasefire talks."),
    v("respell", "Cutter", "Cutter is hosting the ceasefire talks."),
  ] },
  // 11. Brands
  { id: "brands", category: "11", topic: "Nvidia, xAI", listenFor: "en-VID-ee-uh; “ex A I”", variants: [
    plain("Nvidia shares rose after xAI announced a deal."),
    v("letters", "X A I", "Nvidia shares rose after X A I announced a deal."),
    v("hyphen-caps", "En-VID-ia, ex-A-I", "En-VID-ia shares rose after ex-A-I announced a deal."),
  ] },
  // 12–17. Numbers
  { id: "money", category: "12", topic: "$1.2B", listenFor: "“one point two billion dollars”", variants: [
    plain("The bill costs $1.2B over 10 years."),
    v("half", "$1.2 billion", "The bill costs $1.2 billion over 10 years."),
    v("words", "Words", "The bill costs one point two billion dollars over ten years."),
  ] },
  { id: "votes", category: "13", topic: "52-48, 9/11", listenFor: "“fifty-two to forty-eight”, “nine eleven”", variants: [
    plain("The Senate voted 52-48 to extend the 9/11 fund."),
    v("to", "52 to 48, nine eleven", "The Senate voted 52 to 48 to extend the nine eleven fund."),
    v("words", "Words", "The Senate voted fifty-two to forty-eight to extend the nine-eleven fund."),
  ] },
  { id: "decades", category: "13", topic: "the '90s, 1800s", listenFor: "“the nineties”, “the eighteen hundreds”", variants: [
    plain("Prices haven't been this high since the '90s, or by some measures the 1800s."),
    v("words", "Words", "Prices haven't been this high since the nineties, or by some measures the eighteen hundreds."),
  ] },
  { id: "roman", category: "14", topic: "Charles III, World War II, Super Bowl LX", listenFor: "“the Third”, “Two”, “sixty”", variants: [
    plain("King Charles III met World War II veterans before Super Bowl LX."),
    v("words", "Words", "King Charles the Third met World War Two veterans before Super Bowl sixty."),
  ] },
  { id: "units", category: "15", topic: "°F, mph, bps, %", listenFor: "degrees Fahrenheit, miles per hour, basis points, percent", variants: [
    plain("It hit 104°F with 60 mph winds as the Fed cut rates 25 bps to 4.5%."),
    v("words", "Words", "It hit 104 degrees Fahrenheit with 60 mile per hour winds as the Fed cut rates 25 basis points to 4.5 percent."),
  ] },
  { id: "times", category: "16", topic: "8 p.m. ET, Nov. 4", listenFor: "“eight p.m. Eastern”, “November fourth”", variants: [
    plain("Polls close at 8 p.m. ET on Nov. 4."),
    v("half", "Partly written out", "Polls close at 8 p.m. Eastern on November 4th."),
    v("words", "Words", "Polls close at eight p.m. Eastern on November fourth."),
    { id: "say-as", label: "say-as date tag", text: `Polls close at 8 p.m. Eastern on <say-as interpret-as="date" format="md">11/4</say-as>.`, markup: true },
  ] },
  { id: "codes", category: "17", topic: "F-35, H-1B, COVID-19, 401(k)", listenFor: "“F thirty-five”, “H one B”, “COVID nineteen”, “four-oh-one K”", variants: [
    plain("The F-35 program, H-1B visas, COVID-19 aid and 401(k) plans are all in the bill."),
    v("words", "Words", "The F thirty-five program, H one B visas, COVID nineteen aid and four-oh-one K plans are all in the bill."),
  ] },
  { id: "versus", category: "17", topic: "Roe v. Wade", listenFor: "“Roe versus Wade”", variants: [
    plain("The case could revisit Roe v. Wade."),
    v("words", "versus", "The case could revisit Roe versus Wade."),
    v("v", "v without period", "The case could revisit Roe v Wade."),
  ] },
  // 18. Foreign words
  { id: "foreign", category: "18", topic: "São Paulo, coup d'état", listenFor: "sow POW-loh; koo day-TAH", variants: [
    plain("Protesters in São Paulo called it a coup d'état."),
    v("ascii", "No accents", "Protesters in Sao Paulo called it a coup d'etat."),
    v("respell", "Respelled", "Protesters in Sow POW-loh called it a koo day-TAH."),
  ] },
  // 19. Symbols
  { id: "symbols", category: "19", topic: "&, and/or, dash, ellipsis", listenFor: "“A T and T”, “and or”, natural pauses", variants: [
    plain("AT&T raised prices and/or fees — again… for the third time."),
    v("words", "Words and commas", "AT and T raised prices and or fees, again, for the third time."),
  ] },
  // 20. Punctuation
  { id: "garden", category: "20", topic: "comma in a garden-path sentence", listenFor: "a pause after “ate”", variants: [
    plain("While the senator ate the committee voted."),
    v("comma", "With a comma", "While the senator ate, the committee voted."),
  ] },
  // Markup-only checks
  { id: "break", category: "ssml", topic: "break tag (pause)", listenFor: "a clear pause before “First”", variants: [
    plain("Here's what's happening today. First, the economy."),
    { id: "break", label: "break 800 ms", text: `Here's what's happening today. <break time="800ms"/> First, the economy.`, markup: true },
  ] },
  { id: "emphasis", category: "ssml", topic: "emphasis tag", listenFor: "stress on “she”", variants: [
    plain("She voted no, not her colleague."),
    { id: "emphasis", label: "emphasis strong", text: `<emphasis level="strong">She</emphasis> voted no, not her colleague.`, markup: true },
    v("caps", "SHE in capitals", "SHE voted no, not her colleague."),
  ] },
];

export type Mark = "ok" | "bad";
export interface TestAnswers {
  /** `${itemId}/${variantId}` → mark */
  marks: Record<string, Mark>;
  /** itemId → note */
  notes: Record<string, string>;
  /** `${itemId}/${variantId}` → error from voicing (the service refused it) */
  errors: Record<string, string>;
}

export const clipKey = (itemId: string, variantId: string) => `${itemId}/${variantId}`;

/** The report sent to Claude: every item, every version with its mark, failures and notes. */
export function buildTestReport(answers: TestAnswers, voice: string, provider: string): string {
  const all = PRONUNCIATION_TEST.flatMap((i) => i.variants.map((x) => clipKey(i.id, x.id)));
  const marked = all.filter((k) => answers.marks[k]).length;
  const lines = [
    `# Pronunciation test ${TEST_VERSION}`,
    "",
    `Voice ${voice} (${provider}). ${marked} of ${all.length} versions marked; ${Object.keys(answers.errors).length} failed to voice.`,
    "",
  ];
  for (const item of PRONUNCIATION_TEST) {
    lines.push(`## ${item.category === "ssml" ? "SSML" : `#${item.category}`} ${item.topic} (should sound like: ${item.listenFor})`);
    for (const x of item.variants) {
      const k = clipKey(item.id, x.id);
      const mark = answers.errors[k] ? `FAILED (${answers.errors[k]})` : answers.marks[k] === "ok" ? "✓ right" : answers.marks[k] === "bad" ? "✗ wrong" : "– not marked";
      lines.push(`- ${mark} · ${x.label}${x.markup ? " [markup]" : ""}: \`${x.text}\``);
    }
    if (answers.notes[item.id]?.trim()) lines.push(`- Note: ${answers.notes[item.id].trim()}`);
    lines.push("");
  }
  return lines.join("\n");
}
