# Stitch import (PRISM News)

Stitch project `projects/6133575386756677562` ("PRISM News"), read over the Stitch MCP on 2026-11-25. Build from these; re-read a screen by id when building it.

## Design system ("Optical Editorial & Spectral Briefing")

- **Default theme light**: canvas `#FAF9F6` (warm paper), cards `#FFFFFF`, ink `#181A1C`, secondary ink `#575D63`, hairline `#E5E2DC`.
- **Dark**: canvas `#121417`, surface `#1A1D21`, text `#F2F0EB`, secondary `#9BA1A6`, hairline `#2A2E35`.
- **Sides** (split bars, framing cards, outlet dots only): left cobalt `#4A6B82` / dark `#6C91AB`; center slate `#7D858C` / `#9AA2A8`; right terracotta `#A65E4E` / `#C97A68`.
- **Status**: success `#3D7A5A`, caution `#B8863B`, urgent `#A64444`.
- **Type**: Newsreader (masthead, headlines; italic only for quoted outlet headlines), Inter (body, UI), JetBrains Mono (metadata, timecodes, counts). No serif inside buttons, tabs or badges.
- **Scale**: masthead 56/60 (mobile 36/40); headline-xl 40/46 (mobile 28/34); lg 30/36; md 22/28; sm 18/24; body-lg 18/28, md 15/24, sm 13/20; label 13/16 medium; meta mono 12/16.
- **Spacing**: 4 px multiples; xs 4, sm 8, md 16, lg 24, xl 40; gutters 24 (mobile 16); page margin 40 (mobile 16).
- **Shape**: public screens use soft corners (4–12 px) and light shadows; the admin screens and the written system say sharp (0 px) with 1 px hairlines. Round only for play buttons, dots and scrubber thumbs.
- **Depth**: no heavy shadows; overlays `0 8px 24px -4px rgba(24,26,28,.08)` (dark `0 12px 32px -4px rgba(0,0,0,.45)`). Highlighted analysis modules have a 2–4 px left edge in the side's color.
- **Buttons**: primary solid ink, white uppercase Inter label (13 px, tracking .05em); secondary 1 px ink outline, inverts on hover; ghost mono links with a trailing arrow ("Open run →").
- **Icons**: Material Symbols Outlined.

## Assets

- `public/prism-mark.svg`: lens mark (screen `a4508d84399540fc81168d7d8b6b85c0`).
- Not imported (the sandbox can't download Stitch images): the glasses logo `PRISM_glasses_logo.jpg` (screen `2939323198349618197`) and the hero refraction banner (screen `612471010fb54336b76ec745f19d0e6c`).

## Screens

| Screen | Id | Device |
| :- | :- | :- |
| Landing Page | `010c932d96fa48ea851e496ea7891755` | mobile |
| Daily Feed (newer) | `246b2013ada34edc85d87e4d2f437d23` | mobile |
| Daily Feed | `bfc2bf8e054a41e6bbea5811b57e32af` | mobile |
| News Page | `7d709bf95b1f4d6fbbd6e9076e176d65` | mobile |
| Story Detail & Framing Analysis | `660067f2d9ce49f9b7a8e1d72418279d` | mobile |
| Story Detail | `7366acdb989a4a1282371cadae4fcd52` | mobile |
| Story Framing Analysis | `ef8bcd2d03d74efeacccbc439d7f96a6` | mobile |
| Simple Audio Drawer & Queue | `f36144aefdb64f309b9c89259884463e` / desktop `4761ca4af43b4cfba25ce3231ebae9af` | both |
| Expanded Audio Drawer | `569c9ed708714e48ab1c8adfefd3805d` | mobile |
| Audio Drawer & Transcript Console | `85a1f66aebd748189df8fb441750ba2f` | desktop |
| UI States & Spec Sheet | `98d4c4e437514f3eb941ca3e8042d899` / mobile `de4f50eae20c47c78e7dc88db73ddc65` / mobile dark `efd26e749a5449c1bf4b8a1709b87bfb` | both |
| Debug Overview | `1aefe83b609947e793dd6c5d86f51151` (also `911bd46cd2a148c488df5bd74a70f054`) / mobile `c805eb39119f41d3a58545568a7447de` | both |
| Debug Runs | `388ce45dd0e6482789300fceb6bc7671` (also `82fe34e3da134645bd0bb4899d1b9573`) / mobile `db3fa74156a44c84a8ceb8a6963f91d4` | both |
| Debug Run Inspector | `8cc9c7204f9040bda2c4aba412848a7a` (also `785de9d0b1ad4e43afcee4a565a36c2c`) / mobile `1fac6bc642c04d9e867597504f2ee7da` | both |
| Debug Feeds | `7a70875de516476197b6475c6f7d1915` (also `7ed837d73e3b462582519f5a2a326ec3`) / mobile `8dfb6bc988164a768c684dacbc18fba5` | both |
| Debug Voices | `844365dbf8614389b2d2b1dbc2f54eb0` / mobile `08a7bd4154474116b5e83f582427e3c0` | both |

## Things in the mockups we don't build (no data or out of scope)

Bookmarks, user avatar, "4h ago" per story, sleep timer, "Add more stories", "LIVE" badges, story summaries on rows (only analyzed stories have one), wording like "bias dissection" (the brief bans "bias" and "spectrum" in the UI).
