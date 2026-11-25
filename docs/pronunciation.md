# Pronunciation (spoken script)

Agreed with the user on 2026-11-25. Status: listening test built (`/debug/voices`, `src/audio/pronunciation-test.ts`); spoken script planned.

## Goal

The voice must say every word the way a careful human newsreader would, with no manual pronunciation list, no approvals and no rewording. Each story keeps two texts:

- **display text**: what the site shows (the checked script, unchanged);
- **spoken text**: what the voice reads. Same words and order; only respellings, written-out numbers and symbols, and punctuation change.

A Claude pass after the checker writes the spoken text for the whole episode at once (so a name is respelled the same way everywhere). Audio is keyed on the spoken text. Fixed lines (intro, rundown, outro) carry our intended reading, because intent can't be inferred (the intro's "we read across the spectrum" should be "red", which present tense would also allow). This is a safety net that stays useful if we move to a better paid voice later.

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

## Open questions (answered by the listening test)

- Which respelling style Edge reads best ("per-FECT" vs "perFECT" vs "pur-fekt"), and whether "U.S." flows better than "US".
- Whether the free Edge endpoint accepts SSML `<phoneme>` / `<sub>` (exact pronunciations) or ignores them.

Plan: a one-time "Pronunciation test" card on `/debug/voices` voices a sheet covering every category above, with competing styles side by side; the user ticks what sounded right and sends it through "Send to Claude" (`feedback:pronunciation`). The prompt then uses what works.
