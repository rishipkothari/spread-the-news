# PRISM News: UI sketch

The brief for the site's visual design. It's written to be pasted into Google Stitch to generate a full design project. Claude then reads that project over MCP and builds from it. It covers what the app is, the design philosophy, and every screen in detail. Mood, palette details, type pairing and imagery are open for Stitch to propose within the brand notes below.

---

## 1. What PRISM is

PRISM News is a daily news site and podcast player. Every day it reads about 27 news outlets spread from left to right. It groups their articles into stories, ranks the stories by how widely they're covered across the political divide, and for each top story writes a short, fact-checked script that sets the agreed facts beside how each side framed them. Each script is voiced as an audio clip of 1 to 3 minutes.

The site offers two things:

1. **The content: one story, every lens.** Each story shows what all sides agree on, where accounts differ, and how coverage splits across outlets. No partisan cues, no sensationalism.
2. **Effortless listening, like a music web player.** Stories are the "songs". You browse sections, press **Play** or **Add to queue**, and they play back to back. There are premade "playlists" (all news, each section, the daily episode) and you can build your own queue. The player persists at the bottom of every page and keeps playing as you browse.

It's a personal app for now: one user, password-protected, used mostly on a phone and sometimes on a laptop.

## 2. Brand

- **Name:** PRISM (or PRISM News).
- **Hero headline:** One story. Every lens.
- **Hero subheadline:** The news, fully framed. Bringing stories into focus.
- **Metaphor:** an optical eyeglass lens with prism refraction. Lenses sit in frames, like media framing. A corrective prism lens merges double vision into one clear image.
- **Logo mark:** a minimal, architectural eyeglass or optical lens. A single neutral beam bends at the first glass surface and refracts again on exit into a smooth gradient, never hard rainbow bands.
- **Palette:** mature, muted, non-partisan. Muted cobalt, slate gray and warm terracotta, on deep charcoal/slate backgrounds, with clean off-white cards.
- **Type:** a high-contrast editorial serif for the masthead and headlines, signalling journalistic authority. A clean geometric sans-serif for body text and UI labels.

## 3. Design philosophy

- **Neutral by construction.** Never use party red and blue, donkey/elephant imagery, or words like "spectrum", "bias" or "partisan" in the UI. Where coverage by side must be shown (the split bar), use the brand's muted cobalt, slate and terracotta, labelled in words ("Left · Center · Right") wherever space allows. Color is never the only cue.
- **Calm, not breaking.** No red "BREAKING" banners, countdowns, autoplay video or urgency language. It should feel like a well-edited weekly magazine that updates daily.
- **Listening first.** Every story you can play is one tap from playing. The player is always reachable and never interrupts.
- **Facts, then frames.** On a story, the script comes first, with the analysis (agreements, disagreements, framing by side) one tap below.
- **Quiet chrome, strong headlines.** Serif headlines carry the page. UI controls are understated until hovered or focused.
- **Phone first.** Every screen is designed at phone width first (16 px side margins, thumb-reachable controls, tap targets at least 44 px), then widened for desktop.
- **Light and dark themes.** Both are required. Dark (charcoal/slate) is the signature look. Light uses off-white.

## 4. Site map

Public area (behind one password for now):

| Screen | Path | Purpose |
| :- | :- | :- |
| Landing | `/` | Showy brand page; one call to action into the news |
| News home ("All news") | `/news` | Daily episode spot, all of the day's stories, links to sections |
| Section | `/news/[section]` | One category's stories: US, World, Business, Science, Sports, Other |
| Story | `/story/[id]` | Headline, play controls, script, analysis accordion |
| Player drawer | every public screen | Persistent mini player that pulls up into the full player and queue |

Admin console (for the developer, reached from a small link in the landing page header):

| Screen | Path | Purpose |
| :- | :- | :- |
| Overview | `/debug` | Start runs, latest run status, latest episode, quick links |
| Runs | `/debug/runs` | Table of pipeline runs |
| Run detail | `/debug/runs/[id]` + tabs | Pipeline steps, ranking review, analysis, script, play |
| Feeds | `/debug/feeds` | News sources and their RSS feeds |
| Voices | `/debug/voices` | Try text-to-speech voices |
| Episodes | `/player` | Every generated daily episode (developer view) |

## 5. Global elements

### 5.1 Site header (public screens)

- Left: the PRISM wordmark in serif, with the small lens mark. It links to the news home.
- Center or right: section links (All news, US, World, Business, Science, Sports, Other). On a phone they become a horizontally scrollable row of chips under the header.
- Far right: a small, quiet "Admin" link (text or a gear icon) that goes to the admin console.
- The header can shrink on scroll.

### 5.2 Date selector

Used on the news home and section pages, near the top.

- `‹  Tuesday, November 25  ›`, with arrow buttons on either side of the date.
- Default is today. The right arrow is disabled on today.
- Tapping the date opens a small calendar. There's no lower limit on dates for now; limits come later.
- Changing the date reloads the story list for that day. The player keeps playing.

### 5.3 Player drawer (persistent, every public screen)

It sits in the app frame, not inside the page, so audio never stops when you navigate.

**Collapsed (mini player):** a bar docked to the bottom edge, about 64–72 px tall.

- Left: the current story's title (one line, truncated), with its section and position beneath ("World · 2 of 7").
- Right: play/pause, and next on a phone; previous, play/pause and next on desktop.
- A thin progress line along the bar's top edge.
- A grab handle or chevron, and tapping the bar, pulls it up.
- When the queue is empty, show a muted "Nothing playing. Press play on any story." line, or hide the bar entirely (Stitch to suggest).

**Expanded (full player):** a sheet sliding up from the bottom, covering most of the screen on a phone, or a tall panel on desktop.

- Now playing: the large serif story title, the section, and a link "Read the story →" to its story page.
- A track slider (scrubber) with elapsed and remaining time.
- Transport: previous, a large play/pause, next. Playback speed (1×, 1.25×, 1.5×, 2×) as a small control.
- **Queue** below: the full queue as a list with the current item highlighted. Played items above it are dimmed, upcoming items below. Each row shows the title, section and duration. Rows can be removed (× or swipe) and reordered (drag handle). Tapping a row plays it. A "Clear queue" action sits at the end.
- Swiping down or pressing the chevron collapses it.

**Behavior**

- **Play** on a story makes it play now. It goes into the queue right after the current item and starts, and the rest of the queue stays.
- **Add to queue** appends to the end. A brief confirmation appears ("Added to queue").
- **Play this section** replaces the queue with that section's top stories, filling the chosen length (see 6.2).
- Stories play back to back with a short pause between them.
- The queue and position survive a page reload. Lock-screen controls on a phone work.

### 5.4 Story row (the core list item)

A thick row, about 72–88 px tall on a phone, with generous padding and full width. The whole row is tappable and opens the story page.

- **Left/main:** the story headline (serif, 2 lines max). Under it, a meta line: the section label · "12 outlets" · the audio duration ("2:14").
- **Coverage split bar:** a slim horizontal bar showing how many covering outlets lean left, center and right, in the brand's muted tones, with a text label available on tap or hover ("5 left · 4 center · 3 right"). It sits under the meta line or beside it on desktop. This is the visible sign of the product's angle on every row.
- **Right-aligned actions:** two icon buttons, **Play** (▶) and **Add to queue** (+ or a queue icon). The one currently playing shows an animated "playing" indicator instead of ▶.
- **No audio yet:** some stories have a headline and coverage data but no script or audio yet. They still appear with the headline, meta and split bar, but without the two buttons. Instead there's a muted "Not voiced yet" label or simply empty space. These rows can still be opened (the story page shows the headline and coverage only).
- The rank number is optional, as a small numeral to the left of the headline on the All news list.

### 5.5 Buttons and controls

- Primary: a solid filled pill (for example "Play this section", "Play today's episode").
- Secondary: an outlined pill or a quiet icon button (Add to queue).
- Icon buttons: at least 44 × 44 px tap target, with a visible focus ring.

## 6. Screens

### 6.1 Landing (`/`)

A showy brand moment, but restrained and editorial, not a startup cliché.

- **Header:** the PRISM wordmark on the left. A small "Admin console" link on the far right.
- **Hero:** the large serif headline "One story. Every lens." with the subheadline "The news, fully framed. Bringing stories into focus." A hero visual (the lens/refraction artwork) beside or behind the text, with the beam's gradient echoing cobalt → slate → terracotta.
- **Primary call to action:** "Open today's news →" (to `/news`). A secondary "▶ Play today's episode" when one exists.
- **Two value blocks** below the hero, side by side on desktop and stacked on a phone:
  1. **Every lens.** "Each story is read across outlets from left to right. You get the facts they share and how each side framed the rest."
  2. **Press play.** "Every story is a short audio clip. Play one, queue a few, or play a whole section. It keeps playing while you browse."
- Optionally a third, quieter strip: "How it works" in three steps (Read widely → Find the shared facts → Show every frame).
- **Footer:** the date and a small Admin link. (No masthead sub-line: "Refracting the headlines" was dropped from the pitch.)
- The player drawer appears here too, once something is queued.

### 6.2 News home: "All news" (`/news`)

The main page. It works like the home tab of a music player.

1. **Header and date selector** (5.1, 5.2).
2. **Today's episode (featured spot):** a wide card at the top. "Today's episode · Tuesday, November 25 · 14 min · 5 stories", with the first three story titles in small type and a big "▶ Play episode" button. The episode is the day's top five stories with a short spoken intro and outro. Pressing play replaces the queue with the episode's stories. If no episode exists for the date, the card says "No episode for this day yet" in a muted state.
3. **"Play this section" control:** a repeatable component used on every list page. It's a primary button "▶ Play All news" with a length picker beside it: a segmented control **5 · 10 · 15 min** (default 10). It queues the top stories that fit the chosen length.
4. **Section shortcuts:** a row of cards or chips, one per section (US, World, Business, Science, Sports, Other). Each shows the section name, the story count for the day, and optionally section cover art. Tapping one opens the section page.
5. **The story list:** every story of the day in rank order, as story rows (5.4). Voiced stories come first by rank, followed by unvoiced ones. There's an "All news" heading with a count ("23 stories · 7 voiced").
6. **Infinite scroll:** after the chosen day's list ends, the previous day's stories load below under a date divider ("Monday, November 24"), and so on backwards without limit. The date selector updates to match the day in view.
7. **Empty state:** "No stories for this day yet."

### 6.3 Section page (`/news/[section]`)

The same template as All news, filtered to one category.

- The header, the date selector, then a section title in large serif ("World") with a one-line description ("Stories centered outside the US"). Optionally section cover art as a banner.
- The "Play this section" control (▶ Play World · 5 / 10 / 15 min).
- The story list for that section and date, with the same infinite scroll back through days.
- Section descriptions:
  - **US:** "Domestic news, politics, courts, policy."
  - **World:** "Stories centered outside the US."
  - **Business:** "Markets, companies, the economy."
  - **Science:** "Science, health, technology, environment."
  - **Sports:** "Games, leagues, athletes."
  - **Other:** "Culture, entertainment and everything else."

### 6.4 Story page (`/story/[id]`)

Simple and readable, with the feel of a long-read article.

1. **Breadcrumb:** "‹ World · Tuesday, November 25", which goes back to that section and date.
2. **Headline:** large serif, up to 3 lines.
3. **Meta line:** "12 outlets · 5 left · 4 center · 3 right · 2:14 listen", with the coverage split bar, slightly larger than on rows.
4. **Actions:** **▶ Play** (primary) and **+ Add to queue** (secondary), side by side. They're hidden or replaced by "Not voiced yet" for unvoiced stories.
5. **The script:** the text exactly as it's read aloud, in comfortable reading type (sans or a text serif, 17–19 px on a phone, about 65 characters per line on desktop). While this story plays, the current paragraph can be subtly highlighted (a nice-to-have).
6. **Analysis accordion** at the bottom, collapsed by default, titled "How the coverage compares". It's a placeholder for now. When opened it shows three sub-sections:
   - **Agreed facts:** a bulleted list.
   - **Where accounts differ:** each disagreement with who says what.
   - **Framing by side:** three short paragraphs or cards (Left / Center / Right).
7. **Sources:** an optional collapsed list of the outlets that covered the story, each with its lean label and headline.
8. **Unvoiced story:** show the headline, meta, split bar and sources, plus a muted note "This story hasn't been written up yet."

### 6.5 Full player (expanded drawer)

See 5.3. Stitch should design it as its own screen at phone and desktop width:

- the phone, with a sheet covering about 90% of the screen
- the desktop, with a right-side or bottom panel about 420 px wide or tall

It should show:

- the now-playing block
- the scrubber
- the transport controls
- the speed control
- a queue of about 8 items, with the third highlighted as current and the first two dimmed as played

## 7. Admin console

A developer tool. It should be fast to reach and organized, and denser than the public site, but recognizably the same brand: the same type and palette, used more quietly. It replaces today's thin row of small text links across the top of the page.

### 7.1 Admin frame

- **Desktop:** a left sidebar (about 220 px) with the PRISM mark and the label "Admin". Large, clear nav items with icons: Overview, Runs, Feeds, Voices, Episodes. The active item is highlighted. At the bottom: "← Back to site".
- **Phone:** a top bar with the PRISM mark, "Admin" and a menu button. Or a horizontally scrollable tab bar of the same items, large enough to tap easily.
- The content area is up to about 1100 px wide.

### 7.2 Overview (`/debug`)

A dashboard of action cards:

- **Start a run:** two buttons: "Check feeds (free)" and "Start full run (~$0.10–0.30)".
- **Latest run:** its id, state badge, step progress (fetch → cluster → rank → analysis → script → audio, each with ✓ / running / failed), its top story, and links: Open run, Review ranking.
- **Latest episode:** the date, duration, story count, and "▶ Play".
- **Quick links:** large tiles for Runs, Feeds, Voices and Episodes, each with a one-line description.
- **Warnings:** a yellow notice when environment variables are missing.

### 7.3 Runs (`/debug/runs`)

- Action buttons at the top (the same two as the overview).
- A data table: run id (monospace), state badge, one column per pipeline step (✓, –, running, failed, colored), top story, and actions (Review, Re-cluster). Rows link to the run detail page.

### 7.4 Run detail (`/debug/runs/[id]`)

- A sticky sub-header with "← All runs" and tabs: **Run**, **Ranking review**, **Analysis**, **Script**, **Play episode**. Tabs for steps that haven't run are shown dashed and disabled. Tabs can show a version count ("Script · 3 versions").
- **Run tab:** a pipeline table (step, state, time, cost, result summary, action buttons such as Run analysis, Write script, Make audio), a versions table, and a "Copy time and cost for Claude" button.
- **Ranking review:** the ranked story list with expandable rows (signals, articles by outlet), verdict chips, notes, and a copyable report.
- **Analysis:** extraction per source, and per-story syntheses with quotes.
- **Script:** the script per story with 👍/👎, notes, and dropped stories with reasons.

### 7.5 Feeds (`/debug/feeds`)

- An overview table of sources (left to right), followed by one collapsible card per source with its feed table (URL, type, section, status, actions), discovery results and batch-add buttons.

### 7.6 Voices (`/debug/voices`) and Episodes (`/player`)

- **Voices:** a text box, a voice picker and a "Try voice" button with an audio preview.
- **Episodes:** a list of episode cards (date, duration, story count, version note, first titles), each opening a player.

## 8. Data available per story

Design only with fields that exist:

- `title`: a neutral headline written by the pipeline
- `category`: us / world / business / science / sports / other
- `rank`: the position in the day's ranking
- `date`: the run date
- Covering outlets: the count, plus the left / center / right counts, which drive the split bar
- `outlets[]`: name, lean label, and that outlet's own headline
- `hasAudio`, `durationSec`: only the day's top 5 stories have audio today
- `script`: plain text paragraphs, for voiced stories only
- `analysis`: agreed facts (bullets), disagreements (claim plus who says it), framing by side (3 short texts). It exists only for the top ~8 stories.
- Daily `episode`: date, duration, the chapter list (intro, stories, outro)

There are no story photos. Outlet images aren't licensed for reuse, so don't design rows or story pages around article thumbnails. Use typography, the split bar, and optional section cover art instead.

## 9. Images to propose

Stitch should list the images it wants. Expected:

- The logo mark (lens with refraction) and wordmark lockup
- An app icon / favicon
- Landing hero artwork
- One cover image per section (6), used on section shortcut cards and section banners, in an abstract, consistent series
- Optionally a subtle background texture or gradient for the dark theme

## 10. States to cover

- Loading: skeleton rows, and a skeleton episode card
- Empty: no stories for the date, no episode for the date, an empty queue
- Unvoiced story rows and the unvoiced story page
- Currently playing: the row, the mini player and the queue highlight
- Errors: audio failed to load ("Couldn't play this story. Skip to next?")
- Focus and hover for every interactive element, plus a reduced-motion variant (no drawer spring animation)

## 11. Out of scope for this design

User accounts and sign-up, public sharing, comments, a public podcast feed, a political-lean slider, and push notifications.
