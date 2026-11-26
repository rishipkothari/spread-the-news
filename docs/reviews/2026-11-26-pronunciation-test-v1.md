**Area:** pronunciation · **Page:** `/debug/voices` · **Sent:** 2026-11-26T00:34:17.844Z

### Note

This box was clipped in the portrait mobile version, I had to unfold my zfold ultra lol

### Report

# Pronunciation test v1

Voice en-US-AriaNeural (edge-tts). 115 of 118 versions marked; 14 failed to voice.

## #1 read (our intro) (should sound like: “red”)
- ✗ wrong · As written: `This is Spread the News, where we read across the spectrum so you don't have to.`
- ✓ right · Respelled “red”: `This is Spread the News, where we red across the spectrum so you don't have to.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · Phoneme tag (IPA) [markup]: `This is Spread the News, where we <phoneme alphabet="ipa" ph="ɹɛd">read</phoneme> across the spectrum so you don't have to.`
- Note: Should be reed, not red. Phoneme error. Couldn't voice: Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.

## #1 read (past tense) (should sound like: “red”)
- ✓ right · As written: `Last night, lawmakers read the full report.`
- ✓ right · Respelled “red”: `Last night, lawmakers red the full report.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · Phoneme tag (IPA) [markup]: `Last night, lawmakers <phoneme alphabet="ipa" ph="ɹɛd">read</phoneme> the full report.`
- Note: Slight difference in intonation surprisingly

## #1 lead (the metal) (should sound like: “led”)
- ✗ wrong · As written: `Inspectors found lead in the city's water.`
- ✓ right · Respelled “led”: `Inspectors found led in the city's water.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · Phoneme tag (IPA) [markup]: `Inspectors found <phoneme alphabet="ipa" ph="lɛd">lead</phoneme> in the city's water.`

## #2 perfect (verb) (should sound like: per-FECT, stress on the second syllable)
- ✗ wrong · As written: `Engineers spent years trying to perfect the design.`
- ✗ wrong · per-FECT: `Engineers spent years trying to per-FECT the design.`
- ✗ wrong · perFECT: `Engineers spent years trying to perFECT the design.`
- ✓ right · pur-fect: `Engineers spent years trying to pur-fect the design.`
- ✗ wrong · Phoneme tag (IPA) [markup]: `Engineers spent years trying to <phoneme alphabet="ipa" ph="pɚˈfɛkt">perfect</phoneme> the design.`
- Note: Per-FECT resulted in spelling out FECT. perFECT emphasized PER

## #2 record (verb) (should sound like: ri-CORD)
- ✓ right · As written: `Police now record every traffic stop.`
- ✓ right · ree-CORD: `Police now ree-CORD every traffic stop.`
- ✗ wrong · reCORD: `Police now reCORD every traffic stop.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · Phoneme tag (IPA) [markup]: `Police now <phoneme alphabet="ipa" ph="ɹɪˈkɔɹd">record</phoneme> every traffic stop.`

## #2 present (verb) (should sound like: pri-ZENT)
- ✓ right · As written: `The team will present its plan on Monday.`
- ✗ wrong · pre-ZENT: `The team will pre-ZENT its plan on Monday.`
- ✗ wrong · preZENT: `The team will preZENT its plan on Monday.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · Phoneme tag (IPA) [markup]: `The team will <phoneme alphabet="ipa" ph="pɹɪˈzɛnt">present</phoneme> its plan on Monday.`
- Note: same as per-FECT ISSUE.

## #3 Polish (should sound like: POH-lish (from Poland))
- ✓ right · As written: `Polish farmers blocked the border crossing.`
- ✓ right · Poe-lish: `Poe-lish farmers blocked the border crossing.`
- ✗ wrong · POH-lish: `POH-lish farmers blocked the border crossing.`
- Note: Capitals tend to be spelled out

## #3 WHO (should sound like: W-H-O as letters, not “who”)
- ✗ wrong · As written: `WHO officials warned of a new outbreak.`
- ✓ right · W.H.O.: `W.H.O. officials warned of a new outbreak.`
- ✓ right · W H O: `W H O officials warned of a new outbreak.`
- ✓ right · W-H-O: `W-H-O officials warned of a new outbreak.`
- Note: Apparently all caps at the beginning of the sentence aren't spelled out? Or when it's a known actual word it prefers the word?

## #4 US (before a noun) (should sound like: a smooth “you-ess”, not two separate letters)
- ✓ right · As written: `The US economy grew faster than expected.`
- ✓ right · U.S.: `The U.S. economy grew faster than expected.`
- ✓ right · U S: `The U S economy grew faster than expected.`
- ✓ right · U-S: `The U-S economy grew faster than expected.`
- ✓ right · you-ess: `The you-ess economy grew faster than expected.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · say-as characters tag [markup]: `The <say-as interpret-as="characters">US</say-as> economy grew faster than expected.`

## #4 US (end of a phrase) (should sound like: “you-ess”, never “us”)
- ✓ right · As written: `Talks between China and the US stalled again.`
- ✓ right · U.S.: `Talks between China and the U.S. stalled again.`
- ✓ right · U-S: `Talks between China and the U-S stalled again.`

## #5 NAACP (should sound like: “N double-A C P”)
- ✓ right · As written: `The NAACP filed a lawsuit on Tuesday.`
- ✓ right · N double-A C P: `The N double-A C P filed a lawsuit on Tuesday.`
- ✗ wrong · N-double-A-C-P: `The N-double-A-C-P filed a lawsuit on Tuesday.`

## #5 NATO (should sound like: NAY-toe, as one word)
- ✓ right · As written: `NATO leaders met in Brussels.`
- ✓ right · Nato: `Nato leaders met in Brussels.`
- ✓ right · Nay-toe: `Nay-toe leaders met in Brussels.`

## #6 all caps for emphasis (should sound like: “not” as a word)
- ✓ right · As written: `The ruling does NOT apply to existing contracts.`
- ✓ right · not: `The ruling does not apply to existing contracts.`
- Note: Not was not emphasized in particular either time

## #7 Plan B, Grade A (should sound like: “plan bee”, “grade ay”)
- ✓ right · As written: `Officials had no Plan B, and the city lost its Grade A rating.`
- ✗ wrong · Plan Bee, Grade Ay: `Officials had no Plan Bee, and the city lost its Grade Ay rating.`
- Note: Ay as I

## #8 Sen., R-Texas (should sound like: “Senator … Republican of Texas”, no odd pause)
- ✗ wrong · As written: `Sen. John Cornyn, R-Texas, voted against the bill.`
- ✓ right · Written out: `Senator John Cornyn, Republican of Texas, voted against the bill.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · sub alias tags [markup]: `<sub alias="Senator">Sen.</sub> John Cornyn, <sub alias="Republican of Texas">R-Texas</sub>, voted against the bill.`

## #8 St. Louis (should sound like: “Saint Louis”)
- ✓ right · As written: `Flooding hit St. Louis overnight.`
- ✓ right · Saint Louis: `Flooding hit Saint Louis overnight.`

## #9 Zelenskyy (should sound like: zeh-LEN-skee)
- ✓ right · As written: `Volodymyr Zelenskyy spoke with European leaders.`
- ✗ wrong · Zeh-LEN-skee: `Volodymyr Zeh-LEN-skee spoke with European leaders.`
- ✓ right · Zelensky: `Volodymyr Zelensky spoke with European leaders.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · Phoneme tag (IPA) [markup]: `Volodymyr <phoneme alphabet="ipa" ph="zɛˈlɛnski">Zelenskyy</phoneme> spoke with European leaders.`

## #9 Buttigieg (should sound like: BOOT-edge-edge)
- ✓ right · As written: `Pete Buttigieg is weighing a run for governor.`
- ✗ wrong · BOOT-edge-edge: `Pete BOOT-edge-edge is weighing a run for governor.`
- ✗ wrong · Boot-edge-edge: `Pete Boot-edge-edge is weighing a run for governor.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · Phoneme tag (IPA) [markup]: `Pete <phoneme alphabet="ipa" ph="ˈbutɪdʒɛdʒ">Buttigieg</phoneme> is weighing a run for governor.`

## #9 Kamala (should sound like: COMMA-la)
- ✓ right · As written: `Kamala Harris campaigned in Michigan.`
- ✓ right · COMMA-la: `COMMA-la Harris campaigned in Michigan.`
- ✓ right · Comma-la: `Comma-la Harris campaigned in Michigan.`
- ✗ wrong · Phoneme tag (IPA) [markup]: `<phoneme alphabet="ipa" ph="ˈkɑmələ">Kamala</phoneme> Harris campaigned in Michigan.`

## #9 Sheinbaum (should sound like: SHANE-bowm)
- ✗ wrong · As written: `Mexican President Claudia Sheinbaum responded on Friday.`
- ✓ right · SHANE-bowm: `Mexican President Claudia SHANE-bowm responded on Friday.`
- ✗ wrong · Shainebaum: `Mexican President Claudia Shainebaum responded on Friday.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · Phoneme tag (IPA) [markup]: `Mexican President Claudia <phoneme alphabet="ipa" ph="ˈʃeɪnbaʊm">Sheinbaum</phoneme> responded on Friday.`

## #9 Erdoğan (should sound like: AIR-doh-ahn (the ğ is silent))
- ✗ wrong · As written: `Turkish President Recep Tayyip Erdoğan met the NATO chief.`
- ✗ wrong · Erdogan: `Turkish President Recep Tayyip Erdogan met the NATO chief.`
- ✓ right · AIR-doh-ahn: `Turkish President Recep Tayyip AIR-doh-ahn met the NATO chief.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · Phoneme tag (IPA) [markup]: `Turkish President Recep Tayyip <phoneme alphabet="ipa" ph="ˈɛɹdoʊɑn">Erdoğan</phoneme> met the NATO chief.`
- Note: 1 and 2 were "ur" like "further"

## #10 Worcester (should sound like: WUSS-ter)
- ✓ right · As written: `Police in Worcester, Massachusetts, made an arrest.`
- ✗ wrong · WUSS-ter: `Police in WUSS-ter, Massachusetts, made an arrest.`
- ✓ right · Wooster: `Police in Wooster, Massachusetts, made an arrest.`

## #10 Kyiv (should sound like: KEE-yiv (or KEEV))
- ✓ right · As written: `Air raid sirens sounded across Kyiv.`
- ✗ wrong · KEE-yiv: `Air raid sirens sounded across KEE-yiv.`
- ✗ wrong · Keev: `Air raid sirens sounded across Keev.`

## #10 Qatar (should sound like: KAH-tar or kuh-TAR)
- ✓ right · As written: `Qatar is hosting the ceasefire talks.`
- ✗ wrong · KAH-tar: `KAH-tar is hosting the ceasefire talks.`
- ✓ right · Cutter: `Cutter is hosting the ceasefire talks.`

## #11 Nvidia, xAI (should sound like: en-VID-ee-uh; “ex A I”)
- ✓ right · As written: `Nvidia shares rose after xAI announced a deal.`
- ✗ wrong · X A I: `Nvidia shares rose after X A I announced a deal.`
- – not marked · En-VID-ia, ex-A-I: `En-VID-ia shares rose after ex-A-I announced a deal.`
- Note: 2 x a I was off

## #12 $1.2B (should sound like: “one point two billion dollars”)
- ✗ wrong · As written: `The bill costs $1.2B over 10 years.`
- ✗ wrong · $1.2 billion: `The bill costs $1.2 billion over 10 years.`
- – not marked · Words: `The bill costs one point two billion dollars over ten years.`
- Note: 1.2 resulted in 1.2 billion DOLLAR singular

## #13 52-48, 9/11 (should sound like: “fifty-two to forty-eight”, “nine eleven”)
- ✓ right · As written: `The Senate voted 52-48 to extend the 9/11 fund.`
- ✓ right · 52 to 48, nine eleven: `The Senate voted 52 to 48 to extend the nine eleven fund.`
- ✓ right · Words: `The Senate voted fifty-two to forty-eight to extend the nine-eleven fund.`

## #13 the '90s, 1800s (should sound like: “the nineties”, “the eighteen hundreds”)
- ✓ right · As written: `Prices haven't been this high since the '90s, or by some measures the 1800s.`
- ✓ right · Words: `Prices haven't been this high since the nineties, or by some measures the eighteen hundreds.`

## #14 Charles III, World War II, Super Bowl LX (should sound like: “the Third”, “Two”, “sixty”)
- ✓ right · As written: `King Charles III met World War II veterans before Super Bowl LX.`
- ✓ right · Words: `King Charles the Third met World War Two veterans before Super Bowl sixty.`
- Note: Pronounced well, but the flow almost sounded like "third met" was joined, not "king Charles the third". Cadence was off in both

## #15 °F, mph, bps, % (should sound like: degrees Fahrenheit, miles per hour, basis points, percent)
- ✗ wrong · As written: `It hit 104°F with 60 mph winds as the Fed cut rates 25 bps to 4.5%.`
- ✓ right · Words: `It hit 104 degrees Fahrenheit with 60 mile per hour winds as the Fed cut rates 25 basis points to 4.5 percent.`
- Note: missed bps

## #16 8 p.m. ET, Nov. 4 (should sound like: “eight p.m. Eastern”, “November fourth”)
- ✗ wrong · As written: `Polls close at 8 p.m. ET on Nov. 4.`
- ✓ right · Partly written out: `Polls close at 8 p.m. Eastern on November 4th.`
- ✓ right · Words: `Polls close at eight p.m. Eastern on November fourth.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · say-as date tag [markup]: `Polls close at 8 p.m. Eastern on <say-as interpret-as="date" format="md">11/4</say-as>.`
- Note: ET said Eastern time.

## #17 F-35, H-1B, COVID-19, 401(k) (should sound like: “F thirty-five”, “H one B”, “COVID nineteen”, “four-oh-one K”)
- ✓ right · As written: `The F-35 program, H-1B visas, COVID-19 aid and 401(k) plans are all in the bill.`
- ✓ right · Words: `The F thirty-five program, H one B visas, COVID nineteen aid and four-oh-one K plans are all in the bill.`

## #17 Roe v. Wade (should sound like: “Roe versus Wade”)
- ✓ right · As written: `The case could revisit Roe v. Wade.`
- ✓ right · versus: `The case could revisit Roe versus Wade.`
- ✗ wrong · v without period: `The case could revisit Roe v Wade.`

## #18 São Paulo, coup d'état (should sound like: sow POW-loh; koo day-TAH)
- ✗ wrong · As written: `Protesters in São Paulo called it a coup d'état.`
- ✓ right · No accents: `Protesters in Sao Paulo called it a coup d'etat.`
- ✗ wrong · Respelled: `Protesters in Sow POW-loh called it a koo day-TAH.`

## #19 &, and/or, dash, ellipsis (should sound like: “A T and T”, “and or”, natural pauses)
- ✓ right · As written: `AT&T raised prices and/or fees — again… for the third time.`
- ✗ wrong · Words and commas: `AT and T raised prices and or fees, again, for the third time.`
- Note: Both had great natural pauses

## #20 comma in a garden-path sentence (should sound like: a pause after “ate”)
- ✗ wrong · As written: `While the senator ate the committee voted.`
- ✓ right · With a comma: `While the senator ate, the committee voted.`
- Note: Better natural pause in second

## SSML break tag (pause) (should sound like: a clear pause before “First”)
- ✓ right · As written: `Here's what's happening today. First, the economy.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · break 800 ms [markup]: `Here's what's happening today. <break time="800ms"/> First, the economy.`

## SSML emphasis tag (should sound like: stress on “she”)
- ✗ wrong · As written: `She voted no, not her colleague.`
- FAILED (Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated.) · emphasis strong [markup]: `<emphasis level="strong">She</emphasis> voted no, not her colleague.`
- ✗ wrong · SHE in capitals: `SHE voted no, not her colleague.`
- Note: SHE spelled it out. Neither had emphasis on she

<details><summary>Data</summary>

```json
{
  "test": "v1",
  "voice": "en-US-AriaNeural",
  "provider": "edge-tts",
  "marked": 115,
  "total": 118
}
```

</details>

---
_Sent from the PRISM News site._
