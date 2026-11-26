# Pronunciation (spoken script)

Agreed with the user on 2026-11-25. Status: listening test taken 2026-11-26 (results below; raw report `docs/reviews/2026-11-26-pronunciation-test-v1.md`); spoken script built 2026-11-26 (`speak` stage, below).

## Goal

The voice must say every word the way a careful human newsreader would, with no manual pronunciation list, no approvals and no rewording. Each story keeps two texts:

- **display text**: what the site shows (the checked script, unchanged);
- **spoken text**: what the voice reads. Same words and order; only respellings, written-out numbers and symbols, and punctuation change.

A pass over the whole episode at once (so a name is respelled the same way everywhere) writes the spoken text. Audio is keyed on the spoken text. Fixed lines (welcome, outro) get code rules only, because intent can't be inferred (the intro's "we read across the spectrum" is meant as "reed", present tense; the voice already reads it that way). This is a safety net that stays useful if we move to a better paid voice later.

## What the pass must catch

Fix tools allowed: respell, write out, change punctuation. Never change word choice.

**Same spelling, different sound**
1. Tense and part-of-speech heteronyms: read, lead, live, wind, tear, wound, close, minute, does, dove, bass, row, sow, desert, use.
2. Stress-shift pairs: perfect (adj PER-fect / verb per-FECT), record, present, object, contract, conduct, project, protest, permit, increase, refuse, content, convict, produce, rebel, subject, conflict, address. *Heard: "perfect" in a story.*
3. Capitalized words that look like common words: Polish/polish, US/us, WHO/who, IT/it, March/march, May/may, Nice (city), Reading (town), Job (book).

**Letters and abbreviations**
4. Initialisms read choppy or wrong: US, FBI, EU, GOP, DOJ. *Heard: "US" as disjointed letters.*
5. Acronyms said as words and conventional readings: NATO, OPEC, FEMA, HUD, NASA (words); NAACP ("N double-A C P"), IEEE ("I triple-E"); "Nato" casing.
6. All-caps for emphasis or headlines ("NOT", "BREAKING") spelled out.
7. Single letters as words: Plan B, Grade A, Vitamin D, Category 4, Type 2, X (the platform); "I" as a numeral; "A" read as "uh".
8. Shortened titles and party labels: St., Dr., Gov., Sen., Rep., Gen., Jr., Mt., Inc., vs., No.; "R-Texas", "D-Calif."; their periods causing false sentence stops.

**Names**
9. People: foreign (Zelenskyy, Xi Jinping, Sheinbaum, Erdoğan), unusual (Buttigieg, Ramaswamy), self-pronounced (Kamala = COMMA-la, DeSantis).
10. Places: irregular US (Worcester, Boise, Spokane, Des Moines, Houston Street NYC), foreign (Kharkiv, Qatar, Rafah, Khartoum, Guangzhou), changed spellings (Kyiv).
11. Brands and organizations with stylized spelling: xAI, eBay, iOS, SpaceX, Nvidia, Huawei, Hyundai, Porsche, Hezbollah, Uyghur.

**Numbers**
12. Large numbers and shorthand: 1.2M, $3B, 2.4K, negatives, decimals.
13. Conventional readings: years (2026, 1990), 9/11, 747, 911, 24/7, 1600 Pennsylvania, scores (3-2), vote tallies (52-48), ranges (2020–2024).
14. Ordinals and Roman numerals: Charles III, World War II, Super Bowl LX, Title IX, Henry VIII, 21st.
15. Money, units, symbols with numbers: $, £, €, %, °F, mph, km, bps, 5'11", $1.2tn.
16. Dates, times, zones, decades: Nov. 25, 11/25, 3 p.m. ET, the '90s, the 1800s, FY2026, Q3.
17. Alphanumeric codes and hyphenation: COVID-19, F-35, H-1B, K-12, 401(k), GLP-1, H5N1, mRNA, 5G, Section 230, H.R. 1234, Prop 50, Roe v. Wade (hyphen read as "minus" or a range).

**Text and rhythm**
18. Foreign words and diacritics: coup d'état, de facto, Knesset, Bundestag, São Paulo, Pérez, Müller; non-Latin script.
19. Symbols and stray characters: &, /, +, @, #, and/or, em dashes, ellipses, curly quotes, HTML entities, emoji, leftover markup.
20. Punctuation that breaks rhythm: long comma-less sentences, comma-less lists, garden paths ("While the senator ate the committee voted"), mid-sentence periods, question intonation on statements.

Out of reach for text fixes: contrastive emphasis ("*she* voted no"). That needs a better voice.

## Listening test v1 results (2026-11-26, Aria on edge-tts)

**The big lesson: the voice reads most news text right as written, and our rewrites break it as often as they fix it.** The spoken pass must change only what is known to go wrong, and leave the rest alone.

**SSML is out.** Every `<phoneme>`, `<sub>`, `<say-as>`, `<break>` and `<emphasis>` clip failed to voice ("stream closed before synthesis completed"), apart from two IPA clips that voiced but sounded wrong. The free Edge endpoint doesn't accept custom markup. Plain-text fixes only.

**Capital letters get spelled out.** "per-FECT", "pre-ZENT", "POH-lish", "Zeh-LEN-skee", "BOOT-edge-edge", "WUSS-ter", "KAH-tar", "KEE-yiv" were all read wrong, mostly by spelling the capitals as letters. Mixed case ("perFECT") stressed the wrong syllable. So: never put stress in capitals. (A few all-caps syllables that are real words, "SHANE-bowm", "COMMA-la", "AIR-doh-ahn", worked, but that's luck, not a rule.) Same for emphasis: "SHE" was spelled out; "NOT" happened to be read as a word.

**What to do, by kind** (✓ = heard right):

| Kind | As written | Fix that worked | Rule for the spoken pass |
|---|---|---|---|
| read (intro) | says "reed" | — | Keep. The user wants "reed" here (present tense), so the intro stays as written. |
| lead (metal) | wrong | "led" ✓ | Respell heteronyms with a real word that sounds right ("led", "red"). |
| perfect (verb) | wrong | "pur-fect" ✓ | Respell with lowercase syllables that are real words, no capitals. |
| record, present (verbs) | right | — | Leave alone; "reCORD", "pre-ZENT" broke them. |
| Polish | right | "Poe-lish" ✓ | Leave alone unless context makes it ambiguous. |
| WHO | wrong ("who") | "W.H.O." ✓ | Initialisms that spell a common word get dots. |
| US, NATO, NAACP, NASA… | right | — | Leave alone. "N-double-A-C-P" broke it. |
| all caps for emphasis | "NOT" ok, "SHE" spelled out | lowercase | Lowercase any all-caps word that isn't an acronym. Emphasis itself is out of reach. |
| Plan B, Grade A | right | — | Leave alone; "Grade Ay" was read "Grade I". |
| Sen., R-Texas | wrong | "Senator", "Republican of Texas" ✓ | Write out titles and party labels. (St. Louis was fine.) |
| Zelenskyy, Buttigieg, Kamala, Worcester, Kyiv, Qatar | right | — | Leave known names alone; respellings broke all of them. |
| Sheinbaum, Erdoğan | wrong | "SHANE-bowm", "AIR-doh-ahn" ✓ | Respell only names likely to fail (non-English spelling, diacritics). |
| Nvidia, xAI, AT&T | right | — | Leave alone; "X A I", "AT and T" broke them. |
| $1.2B | wrong; "$1.2 billion" said "dollar" | — | Write "1.2 billion dollars" (untested; check in v2). |
| 52-48, 9/11, '90s, 1800s, Roman numerals, F-35, H-1B, COVID-19, 401(k), Roe v. Wade | right | — | Leave alone. Never drop the period from "v.". |
| °F, mph, bps, % | wrong (missed "bps") | written out ✓ | Write out units and symbols: degrees Fahrenheit, miles per hour, basis points, percent. |
| 8 p.m. ET, Nov. 4 | "ET" said "Eastern time" | "Eastern", "November 4th" ✓ | Write zones and months out. |
| São Paulo, coup d'état | wrong | no accents ✓ | Strip diacritics; respelling made it worse. |
| garden path | no pause | comma ✓ | Add commas where a listener needs the break. |
| King Charles III met… | words right, cadence off | — | Not solved; maybe a comma after the name in v2. |

Usability: the note box of "Send to Claude" was cut off on a narrow phone (fixed 2026-11-26: on phones it sits at the top of the screen).

## How it's built (2026-11-26)

`speak` is the first stage of "Make audio" (so any older script gets it too). `src/audio/spoken.ts`:
1. **Code rules** on every segment: degrees, mph, km/h, bps, % written out; `$1.2B` / `$3 billion` → "1.2 billion dollars"; time zones after a time → "Eastern"…; Jan./Feb./Aug./Sept./Oct./Nov./Dec. before a day; Sen./Rep./Gov./Gen./Lt./Lt. Gov./Atty. Gen. before a name; party labels ("R-Texas", "D-Calif.") → "Republican of Texas"; WHO → W.H.O.; accents stripped.
2. **One Sonnet call** (`src/stages/speak/sonnet-spoken-v1.ts`, `SPEAK_SYSTEM`) over the story and rundown segments, returning find/replace edits for heteronyms, stress, likely-wrong names, initialisms that look like words, all-caps emphasis and garden-path commas.
3. **Code checks** refuse an edit with markup, capitals inside a respelling, a long or growing replacement, or one that changes a word from the "leave alone" list (`LEAVE_ALONE`: US, NATO, AT&T, xAI, Kyiv, Roe v. Wade…). Refused edits are kept and shown.

Results: `runs/{id}/speak.json`; the script page lists every change ("What the voice reads differently"). `methods.speak` switches it: `sonnet-spoken-v1`, `rules-only`, `none`.

## Next: listening test v2 (short)

Agreed 2026-11-26: not a separate test; check these in the first episode made with the spoken pass. Open cases: "1.2 billion dollars" vs "one point two billion dollars"; lowercase respellings for names that failed with capitals (Sheinbaum "shane-bowm", Erdoğan "air-doh-ahn") so we know whether lowercase is safe; cadence of "King Charles the Third, met"; a few more heteronyms (live, wind, tear, close, minute) and stress pairs (object, contract, protest, increase) as written vs a lowercase respelling.

## Open questions (before the test)

- Which respelling style Edge reads best ("per-FECT" vs "perFECT" vs "pur-fekt"), and whether "U.S." flows better than "US".
- Whether the free Edge endpoint accepts SSML `<phoneme>` / `<sub>` (exact pronunciations) or ignores them.

Answered above: lowercase respellings with real words, no capitals; leave "US" alone; no SSML.

Plan: a one-time "Pronunciation test" card on `/debug/voices` voices a sheet covering every category above, with competing styles side by side; the user ticks what sounded right and sends it through "Send to Claude" (`feedback:pronunciation`). The prompt then uses what works.
