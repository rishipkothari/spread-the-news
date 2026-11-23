# Phase 3 plan: audio and delivery

Status: planned 2026-11-23, not built. Scope: Phase 3 only (no backlog items). Exit (PRD): a vanilla episode can be triggered and played on a phone end to end.

## What gets built

```
script.json ──► voice (one step per segment) ──► assemble ──► episode + player
                 audio/{audioKey}.mp3            episodes/{date}-{paramsHash}.json + .mp3
```

1. **`TTSProvider` interface** (`src/stages/tts/`), chosen by id in `config/pipeline.json → methods.tts`.
   - `synthesize(text, voice) → { mp3: Uint8Array, bitrate, sampleRate }`; `voices()` for the test page.
   - `edge-tts` (default): wraps the `msedge-tts` npm package (maintained, handles Microsoft's current request token), pinned, behind our own interface so it can be swapped.
   - `stub`: returns silent MP3 frames, for tests and dry runs.
   - Long text is split at sentence boundaries (`audio.maxChunkChars`, ~2500) and the chunks joined; 3 retries with backoff per chunk.
2. **Audio cache.** `audioKey = sha(text + voice + provider + format)` → `audio/{audioKey}.mp3`. Voicing skips any segment whose key already exists, so a re-run after one rewritten story re-voices only that story.
3. **`voice` stage** (fan-out, like `script`): one workflow step per segment of `script.json`; writes `runs/{id}/voice/{segmentId}.json` (audioKey, bytes, seconds, cached or not, ms).
   - Failure: a story segment that can't be voiced is left out and listed; if the welcome/outro or more than half the stories fail, the stage fails (almost certainly edge-tts blocked) with a clear message.
4. **`assemble` stage** (`EpisodeAssembler`, `mp3-concat`): strips ID3/Xing headers, joins segments in script order with a short pause between them (`audio.pauseMs`, built from silent frames in the same format), computes duration from frame count, writes the episode MP3 and manifest `{ id, date, params, runId, segments[{ id, kind, title, startSec, durationSec }], durationSec, voice, provider }`.
5. **Run page.** Pipeline table gets Voice and Assemble rows and a **Make audio** button (enabled once the script is done), the same opt-in pattern as "Run analysis" and "Write script". Summary shows minutes, segments voiced vs cached, and the player link.
6. **Voice test page** `/debug/voices`: pick a voice from the edge list, edit a sample sentence (defaults to a real story segment from the latest script), play it. This is the first live check that edge-tts works from Vercel. Changing the default voice stays a config edit.
7. **Player** `/player` (episode list, newest first) and `/player/[episodeId]`:
   - HTML audio element; chapter list from the manifest (tap a story to jump); 1×/1.25×/1.5× speed; resume position remembered on the device.
   - Media Session API: title, date and chapter on the lock screen; skip forward/back 15 s.
   - Behind the existing password gate; linked from `/` and each run page.
8. **Audio route** `/audio/[...key]` (password-gated page route, not `/api`): reads the private Blob and answers HTTP Range requests with 206 responses. Responses are capped at ~2 MB per request so they stay under Vercel's response size limit; iPhone Safari needs Range support to play and seek at all.

## Config (`config/pipeline.json → audio`)

`voice` (default `en-US-AndrewNeural`; you choose on the test page), `format` (24 kHz 48 kbps mono MP3: ~4.7 MB for 13 min), `pauseMs` (~600), `maxChunkChars`, `concurrency` (2–3 parallel segments), `retries`.

## Storage additions

```
audio/{audioKey}.mp3                voiced segment (cache)
runs/{runId}/voice/{segmentId}.json per-segment voicing result
runs/{runId}/voice.json, assemble.json  stage outputs
episodes/{date}-{paramsHash}.json   episode manifest
episodes/{date}-{paramsHash}.mp3    episode audio
```

## Tests (fixtures, no network)

Sentence chunker; audioKey; MP3 frame parsing, ID3/Xing stripping, duration; concat with pauses (frame-exact length); voice/assemble runners with in-memory Blob and the stub provider (cache hit skips synthesis; failure rules); Range parsing and the 206 cap. Then `npm run typecheck`, `npm test`, `npx next build`.

## Risks and how the plan handles them

| Risk | Handling |
| :- | :- |
| edge-tts blocked from Vercel or changes its protocol | Behind the interface; the voice test page finds out in one tap; Google Chirp 3 HD adapter is the backlog fallback (needs your API key) |
| Basic-auth credentials not sent by the phone's audio player | Test on the phone first thing; fallback is a short-lived signed token in the audio URL |
| Vercel response size limit on a ~5 MB file | Range responses capped at ~2 MB |
| Step time limit (~300 s) | One step per segment; each segment is a few seconds of synthesis |
| SSML not accepted by the endpoint | Plain text only; pauses come from silent frames, not SSML |

## Your steps once it's built (browser)

1. Open `/debug/voices`, press Play. If you hear speech, edge-tts works from Vercel. Try a few voices and tell me which one.
2. Open the run you last scripted, press **Make audio**, wait for Voice and Assemble to turn done.
3. On your phone, open the player link, log in, play, lock the screen, skip a chapter.
4. Tell me what to change in the intro/outro wording (or keep it). Then I open a pull request.

## Not in Phase 3

Google Chirp 3 HD adapter (backlog, needs your key), automatic chaining and a daily timer, 30-day audio cleanup, podcast-app RSS feed, non-vanilla on-demand audio (Phase 4).
