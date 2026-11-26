import { audioFrames, durationSec } from "@/audio/mp3";
import { nextVersion, readVersions } from "./versions";
import { config } from "@/lib/config";
import { sha } from "@/lib/hash";
import { getBytes, getJson, paths, putBytes, putJson, sizeOf } from "@/lib/storage";
import type { Episode, EpisodeChapter, EpisodePlan, EpisodeScript, Segment } from "@/lib/types";
import { impls, type Methods } from "@/stages/registry";
import { stageUsage } from "./phase1";
import { readSpoken } from "./speak";
import { appendUsage, readStatus, updateStatus } from "./status";

/**
 * Phase 3 audio, on a run with a script:
 *   (speak: the spoken text, src/pipeline/speak.ts) → planVoiceUnits → runVoiceUnit × segment (voice once per audioKey; cached in audio/{audioKey}.mp3; runs/{id}/voice/{segmentId}.json)
 *   → mergeVoice (runs/{id}/voice.json; fails the stage when too little could be voiced)
 *   → assembleEpisode (join in script order with pauses → episodes/{id}.mp3 + manifest; runs/{id}/assemble.json).
 */

export class AudioPolicyError extends Error {}

export interface VoicePlan {
  provider: string;
  voice: string;
  format: string;
  segmentIds: string[];
}

export interface VoiceUnit {
  segmentId: string;
  kind: Segment["kind"];
  storyId?: string;
  title: string;
  audioKey: string;
  bytes?: number;
  durationSec?: number;
  cached?: boolean;
  error?: string;
  ms: number;
}

export interface VoiceOut {
  provider: string;
  voice: string;
  format: string;
  units: VoiceUnit[];
  voiced: number;
  cached: number;
  failed: number;
  durationSec: number;
}

export interface AssembleOut {
  episodeId: string;
  durationSec: number;
  bytes: number;
  missing: Episode["missing"];
}

/** Same text + voice + provider + format → same audio; never voiced twice. */
export function audioKey(text: string, voice: string, provider: string, format: string): string {
  return sha(`${provider}|${format}|${voice}|${text}`, 24);
}

/** One episode per audio version of a run, so re-making audio (or a second run on the same day) never overwrites an earlier episode. */
export function episodeIdFor(runId: string, audioVersion: number): string {
  return `${runId}-a${audioVersion}`;
}

const TEMPLATE_TITLES: Record<string, string> = { welcome: "Welcome", rundown: "Today's rundown", outro: "Sign-off" };

async function need<T>(path: string, what: string): Promise<T> {
  const v = await getJson<T>(path);
  if (!v) throw new Error(`missing ${what} (${path})`);
  return v;
}

async function methodsOf(runId: string): Promise<Methods> {
  const s = await readStatus(runId);
  // Runs created before Phase 3 have no tts/assemble methods saved; config fills them in.
  return { ...config.methods, ...(s?.methods ?? {}) } as Methods;
}

async function titlesFor(runId: string): Promise<Map<string, string>> {
  const plan = await getJson<EpisodePlan>(paths.stage(runId, "plan"));
  return new Map((plan?.stories ?? []).map((s) => [s.storyId, s.title]));
}

function titleOf(seg: Segment, titles: Map<string, string>): string {
  return seg.kind === "story" ? titles.get(seg.storyId ?? "") ?? seg.storyId ?? seg.id : TEMPLATE_TITLES[seg.kind] ?? seg.kind;
}

/** The text the voice reads: the spoken version when the speak stage made one for this exact segment text, else the display text. */
async function spokenText(runId: string, seg: Segment): Promise<string> {
  const spoken = (await readSpoken(runId))?.segments.find((x) => x.segmentId === seg.id);
  return spoken && spoken.text === seg.text && spoken.spoken.trim() ? spoken.spoken : seg.text;
}

export async function planVoiceUnits(runId: string): Promise<string[]> {
  const script = await need<EpisodeScript>(paths.stage(runId, "script"), "script; write the script first");
  if (!script.segments.length) throw new AudioPolicyError("the script has no segments (no story passed the checker), so there is nothing to voice");
  const tts = impls.tts(await methodsOf(runId));
  const plan: VoicePlan = { provider: tts.id, voice: config.audio.voice, format: tts.format, segmentIds: script.segments.map((s) => s.id) };
  await putJson(paths.voicePlan(runId), plan);
  await updateStatus(runId, (s) => {
    s.state = "running";
    s.stages.voice = { state: "running", startedAt: new Date().toISOString(), summary: { segments: plan.segmentIds.length, voice: plan.voice } };
  });
  return plan.segmentIds;
}

export async function runVoiceUnit(runId: string, segmentId: string): Promise<void> {
  const t0 = Date.now();
  const [script, plan, titles, m] = await Promise.all([
    need<EpisodeScript>(paths.stage(runId, "script"), "script"),
    need<VoicePlan>(paths.voicePlan(runId), "voice plan"),
    titlesFor(runId),
    methodsOf(runId),
  ]);
  const seg = script.segments.find((s) => s.id === segmentId);
  if (!seg) throw new Error(`segment ${segmentId} is not in the script of run ${runId}`);
  const text = await spokenText(runId, seg);
  const key = audioKey(text, plan.voice, plan.provider, plan.format);
  const unit: VoiceUnit = { segmentId, kind: seg.kind, storyId: seg.storyId, title: titleOf(seg, titles), audioKey: key, ms: 0 };
  try {
    const path = paths.audio(key);
    const existing = await sizeOf(path);
    let mp3: Uint8Array | null = null;
    if (existing) {
      mp3 = await getBytes(path);
      unit.cached = true;
    }
    if (!mp3) {
      mp3 = await impls.tts(m).synthesize(text, plan.voice);
      await putBytes(path, mp3, "audio/mpeg");
      unit.cached = false;
    }
    const frames = audioFrames(mp3);
    if (!frames.length) throw new Error("the voiced audio has no MP3 frames");
    unit.bytes = mp3.length;
    unit.durationSec = +durationSec(frames).toFixed(2);
  } catch (e) {
    unit.error = e instanceof Error ? e.message : String(e);
  }
  unit.ms = Date.now() - t0;
  await putJson(paths.unit(runId, "voice", segmentId), unit);
}

/** Why the voiced segments can't make an episode, or null if they can. */
export function voicePolicy(units: VoiceUnit[], maxStoryFailShare: number): string | null {
  const templateFail = units.find((u) => u.kind !== "story" && u.error);
  if (templateFail) return `the ${u(templateFail.kind)} couldn't be voiced: ${templateFail.error}`;
  const stories = units.filter((x) => x.kind === "story");
  const failed = stories.filter((x) => x.error);
  if (!stories.length || failed.length === stories.length) return `no story could be voiced${failed[0] ? `: ${failed[0].error}` : ""}`;
  if (failed.length / stories.length > maxStoryFailShare) return `${failed.length} of ${stories.length} stories couldn't be voiced (first error: ${failed[0].error})`;
  return null;
  function u(kind: string) {
    return TEMPLATE_TITLES[kind]?.toLowerCase() ?? kind;
  }
}

export async function mergeVoice(runId: string): Promise<void> {
  const plan = await need<VoicePlan>(paths.voicePlan(runId), "voice plan");
  const loaded = await Promise.all(plan.segmentIds.map((id) => getJson<VoiceUnit>(paths.unit(runId, "voice", id))));
  const units = plan.segmentIds.map(
    (id, i): VoiceUnit => loaded[i] ?? { segmentId: id, kind: "story", title: id, audioKey: "", error: "no output (step didn't run)", ms: 0 },
  );
  const ok = units.filter((x) => !x.error);
  const out: VoiceOut = {
    provider: plan.provider,
    voice: plan.voice,
    format: plan.format,
    units,
    voiced: ok.filter((x) => !x.cached).length,
    cached: ok.filter((x) => x.cached).length,
    failed: units.length - ok.length,
    durationSec: +ok.reduce((a, x) => a + (x.durationSec ?? 0), 0).toFixed(1),
  };
  await putJson(paths.stage(runId, "voice"), out);
  await appendUsage(runId, stageUsage("voice", units));
  const problem = voicePolicy(units, config.audio.maxStoryFailShare);
  if (problem) throw new AudioPolicyError(problem);
  await updateStatus(runId, (s) => {
    s.stages.voice = {
      ...s.stages.voice,
      state: "done",
      finishedAt: new Date().toISOString(),
      summary: { segments: units.length, voiced: out.voiced, cached: out.cached, failed: out.failed, minutes: +(out.durationSec / 60).toFixed(1), voice: out.voice },
    };
  });
}

/** Join the voiced segments in script order into the episode; runs as the "assemble" stage. */
export async function assembleEpisode(runId: string, m: Methods): Promise<{ summary: Record<string, unknown> }> {
  const [script, voice] = await Promise.all([
    need<EpisodeScript>(paths.stage(runId, "script"), "script"),
    need<VoiceOut>(paths.stage(runId, "voice"), "voiced segments; run the voice stage first"),
  ]);
  const methods = { ...config.methods, ...m } as Methods;
  const byId = new Map(voice.units.map((x) => [x.segmentId, x]));
  const usable = script.segments.filter((s) => {
    const x = byId.get(s.id);
    return x && !x.error && x.audioKey;
  });
  const missing = script.segments
    .filter((s) => !usable.includes(s))
    .map((s) => ({ segmentId: s.id, title: byId.get(s.id)?.title ?? s.id, reason: byId.get(s.id)?.error ?? "not voiced" }));
  const parts = await Promise.all(
    usable.map(async (s) => {
      const key = byId.get(s.id)!.audioKey;
      const mp3 = await getBytes(paths.audio(key));
      if (!mp3) throw new Error(`audio for segment ${s.id} is missing from the cache (${paths.audio(key)}); re-run "Make audio"`);
      return { segmentId: s.id, mp3 };
    }),
  );
  const joined = impls.assemble(methods).assemble({ parts, pauseSec: config.audio.pauseSec });

  // This audio becomes the run's next audio version once the stage finishes (src/pipeline/versions.ts).
  const versions = await readVersions(runId);
  const audioVersion = nextVersion(versions, "audio");
  const id = episodeIdFor(runId, audioVersion);
  const chapters: EpisodeChapter[] = joined.parts.map((p) => {
    const seg = usable.find((s) => s.id === p.segmentId)!;
    return {
      segmentId: p.segmentId,
      kind: seg.kind,
      storyId: seg.storyId,
      title: byId.get(p.segmentId)!.title,
      startSec: +p.startSec.toFixed(2),
      durationSec: +p.durationSec.toFixed(2),
    };
  });
  const episode: Episode = {
    id,
    date: script.date,
    runId,
    version: { audio: audioVersion, ...(versions.active.script ? { script: versions.active.script } : {}), ...(versions.active.analysis ? { analysis: versions.active.analysis } : {}) },
    params: script.params,
    createdAt: new Date().toISOString(),
    segmentIds: usable.map((s) => s.id),
    chapters,
    audioPath: paths.episodeAudio(id),
    bytes: joined.mp3.length,
    durationSec: +joined.durationSec.toFixed(1),
    voice: voice.voice,
    provider: voice.provider,
    format: joined.format,
    missing,
  };
  await putBytes(paths.episodeAudio(id), joined.mp3, "audio/mpeg");
  await putJson(paths.episode(id), episode);
  await putJson(paths.stage(runId, "assemble"), { episodeId: id, durationSec: episode.durationSec, bytes: episode.bytes, missing } satisfies AssembleOut);
  return { summary: { episode: id, minutes: +(episode.durationSec / 60).toFixed(1), mb: +(episode.bytes / 1e6).toFixed(1), missing: missing.length } };
}
