import { readDiscovery, type FeedProbe, type SourceDiscovery } from "@/admin/discover";
import { feedKey, foundFeeds, guessType } from "@/admin/feed-plan";
import { CATEGORIES, type Feed, type Prominence, type Source } from "@/lib/types";
import { loadSources, missingFromRepo, readChangelog } from "@/sources/store";
import {
  addAllFoundAction,
  addFeedAction,
  addMissingSourcesAction,
  discoverAction,
  removeFeedAction,
  resetSourcesAction,
  testUrlAction,
  toggleSourceAction,
  updateFeedAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // discovering all sources probes ~250 URLs

const PROMINENCES: Prominence[] = ["top", "latest", "section"];
const LEAN_LABEL: Record<string, string> = { left: "Left", lean_left: "Lean left", center: "Center", lean_right: "Lean right", right: "Right" };
/** Lean outlets get a lighter dot than the outer ones. */
const leanColor = (v: number) => (v < 0 ? "var(--left)" : v > 0 ? "var(--right)" : "var(--center)");
const leanOpacity = (v: number) => (Math.abs(v) === 1 ? 0.45 : 1);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

interface SourceView {
  source: Source;
  disc: SourceDiscovery | null;
  probeFor: Map<string, FeedProbe>;
  found: ReturnType<typeof foundFeeds>;
  failing: number;
  working: number;
  last24h: number;
}

function view(source: Source, disc: SourceDiscovery | null): SourceView {
  const probeFor = new Map((disc?.probes ?? []).map((p) => [feedKey(p.url), p]));
  const probes = source.feeds.map((f) => probeFor.get(feedKey(f.url)));
  return {
    source,
    disc,
    probeFor,
    found: foundFeeds(source, disc),
    failing: probes.filter((p) => p && !p.ok).length,
    working: probes.filter((p) => p?.ok).length,
    last24h: probes.reduce((a, p) => a + (p?.ok ? p.inWindow : 0), 0),
  };
}

function Hidden({ fields }: { fields: Record<string, string> }) {
  return <>{Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>;
}

function TypeFields({ prominence, section }: { prominence: Prominence; section?: string }) {
  return (
    <>
      <select name="prominence" defaultValue={prominence} aria-label="feed type">
        {PROMINENCES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select name="section" defaultValue={section ?? ""} aria-label="section">
        <option value="">no section</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </>
  );
}

function Status({ probe, feed }: { probe?: FeedProbe; feed?: Feed }) {
  if (probe?.ok) return <span className="ok">{probe.inWindow} in 24 h</span>;
  if (probe) return <span className="bad" title={probe.error}>failing</span>;
  if (feed?.verified === false) return <span className="warn">untested</span>;
  return <span className="muted">–</span>;
}

function FeedUrl({ url, probe }: { url: string; probe?: FeedProbe }) {
  return (
    <>
      <div className="url">{url}</div>
      {probe && !probe.ok && probe.error && <div className="sub bad">{probe.error}</div>}
      {probe?.ok && probe.title && <div className="sub">{probe.title}</div>}
    </>
  );
}

function ConfiguredTable({ v }: { v: SourceView }) {
  const { source } = v;
  return (
    <table className="ftable">
      <colgroup><col /><col className="c-status" /><col className="c-edit" /><col className="c-act" /></colgroup>
      <thead><tr><th>Configured feed</th><th>Status</th><th>Type and section</th><th /></tr></thead>
      <tbody>
        {source.feeds.map((f) => {
          const probe = v.probeFor.get(feedKey(f.url));
          return (
            <tr key={f.url}>
              <td><FeedUrl url={f.url} probe={probe} /></td>
              <td><Status probe={probe} feed={f} /></td>
              <td>
                <form action={updateFeedAction} className="inline">
                  <Hidden fields={{ sourceId: source.id, url: f.url }} />
                  <TypeFields prominence={f.prominence} section={f.section} />
                  <button type="submit" className="small">Save</button>
                </form>
              </td>
              <td className="right">
                <form action={removeFeedAction}>
                  <Hidden fields={{ sourceId: source.id, url: f.url }} />
                  <button type="submit" className="small danger">Remove</button>
                </form>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FoundTable({ v, probes, title }: { v: SourceView; probes: FeedProbe[]; title: string }) {
  if (!probes.length) return null;
  return (
    <table className="ftable">
      <colgroup><col /><col className="c-status" /><col className="c-edit" /><col className="c-act" /></colgroup>
      <thead><tr><th>{title}</th><th>Last 24 h</th><th>Type and section</th><th /></tr></thead>
      <tbody>
        {probes.map((p) => {
          const g = guessType(p.url);
          const formId = `add-${v.source.id}-${feedKey(p.url)}`;
          return (
            <tr key={p.url}>
              <td>
                <div className="url">{p.url}</div>
                <div className="sub">{p.samples.slice(0, 2).join(" · ")}</div>
              </td>
              <td>{p.inWindow} of {p.items}</td>
              <td>
                <div className="inline">
                  <form id={formId} action={addFeedAction}><Hidden fields={{ sourceId: v.source.id, url: p.url }} /></form>
                  <select name="prominence" form={formId} defaultValue={g.prominence} aria-label="feed type">
                    {PROMINENCES.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                  <select name="section" form={formId} defaultValue={g.section ?? ""} aria-label="section">
                    <option value="">no section</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </td>
              <td className="right"><button type="submit" form={formId} className="small">Add</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SourceCard({ v }: { v: SourceView }) {
  const { source, disc, found } = v;
  const open = v.failing > 0 || found.active.length > 0 || source.feeds.some((f) => f.verified === false && !v.probeFor.get(feedKey(f.url)));
  return (
    <details className="src" id={source.id} open={open}>
      <summary>
        <span className="dot" style={{ background: leanColor(source.leanValue), opacity: leanOpacity(source.leanValue) }} />
        <b>{source.name}</b>
        <span className="muted">{LEAN_LABEL[source.lean] ?? source.lean}</span>
        <span className="spacer" />
        {!source.enabled && <span className="pill">disabled</span>}
        <span className="pill">{plural(source.feeds.length, "feed")}</span>
        {v.failing > 0 && <span className="pill bad">{v.failing} failing</span>}
        {found.active.length > 0 && <span className="pill warn">{found.active.length} new found</span>}
      </summary>

      <div className="src-body">
        <div className="toolbar">
          <form action={discoverAction}>
            <Hidden fields={{ sourceId: source.id }} />
            <button type="submit">Discover feeds</button>
          </form>
          {found.active.length > 0 && (
            <form action={addAllFoundAction}>
              <Hidden fields={{ sourceId: source.id }} />
              <button type="submit" className="primary">{found.active.length === 1 ? "Add the active found feed" : `Add all ${found.active.length} active found feeds`}</button>
            </form>
          )}
          <form action={toggleSourceAction}>
            <Hidden fields={{ sourceId: source.id }} />
            <button type="submit">{source.enabled ? "Disable source" : "Enable source"}</button>
          </form>
          <span className="spacer" />
          <span className="muted small">
            <a href={source.homepage} target="_blank" rel="noreferrer">{source.homepage.replace(/^https?:\/\//, "")}</a>
            {disc ? ` · discovered ${when(disc.at)} · homepage ${disc.homepage.ok ? `${disc.homepage.articleLinks} links` : "failed"}` : " · never discovered"}
          </span>
        </div>

        <ConfiguredTable v={v} />
        <FoundTable v={v} probes={found.active} title="Found: active in the last 24 h" />
        {found.quiet.length > 0 && (
          <details className="more">
            <summary>{plural(found.quiet.length, "more found feed")}: quiet in the last 24 h, or likely not news (comments, authors, podcasts)</summary>
            <FoundTable v={v} probes={found.quiet} title="Found: quiet or likely not news" />
          </details>
        )}
        {found.broken.length > 0 && (
          <details className="more">
            <summary>{plural(found.broken.length, "candidate")} that didn&apos;t work</summary>
            <ul className="url-list">{found.broken.map((p) => <li key={p.url}><span className="url">{p.url}</span> <span className="muted">{p.error}</span></li>)}</ul>
          </details>
        )}

        <form action={testUrlAction} className="inline test">
          <Hidden fields={{ sourceId: source.id }} />
          <input name="url" placeholder="Test a feed URL by hand (or an RSS index page)" />
          <button type="submit">Test</button>
        </form>
      </div>
    </details>
  );
}

export default async function FeedsPage() {
  const [{ sources, origin, updatedAt }, log] = await Promise.all([loadSources(), readChangelog()]);
  const missing = origin === "blob" ? missingFromRepo(sources) : [];
  // Left to right, then by name, so the list reads like the spectrum.
  const ordered = [...sources].sort((a, b) => a.leanValue - b.leanValue || a.name.localeCompare(b.name));
  const views = await Promise.all(ordered.map(async (s) => view(s, await readDiscovery(s.id))));
  const totalActive = views.reduce((a, v) => a + v.found.active.length, 0);
  const withActive = views.filter((v) => v.found.active.length > 0).length;
  const failing = views.reduce((a, v) => a + v.failing, 0);

  return (
    <main className="feeds">
      <h1>Feeds</h1>
      <p className="muted lead">
        Each outlet&apos;s feeds. Changes apply from the next run. <b>top</b> = the outlet&apos;s front page, <b>latest</b> = everything it publishes,{" "}
        <b>section</b> = one topic (the section is a category hint).
      </p>

      <div className="panel toolbar">
        <form action={discoverAction}>
          <Hidden fields={{ sourceId: "all" }} />
          <button type="submit" className="primary">Discover feeds for all sources (~2 min)</button>
        </form>
        <form action={addAllFoundAction}>
          <Hidden fields={{ sourceId: "all" }} />
          <button type="submit" disabled={totalActive === 0} title="Adds every working, not-yet-added feed that had articles in the last 24 hours, with a guessed type">
            Add all active found feeds ({totalActive} across {plural(withActive, "source")})
          </button>
        </form>
        <a href="/debug/feeds/sources.json" className="btnlink">Download sources.json</a>
        <span className="spacer" />
        <span className="muted small">
          {sources.length} sources · {sources.reduce((a, s) => a + s.feeds.length, 0)} feeds{failing ? <span className="bad"> · {failing} failing</span> : null} · live list:{" "}
          {origin === "blob" ? `edited here${updatedAt ? ` ${when(updatedAt)}` : ""}` : "repo default"}
        </span>
        {origin === "blob" && (
          <form action={resetSourcesAction}>
            <button type="submit" className="small danger" title="Throws away every edit made on this page">Reset to repo version</button>
          </form>
        )}
      </div>

      {missing.length > 0 && (
        <div className="panel notice">
          <div><b>{missing.length} new sources in the repo aren&apos;t in your live list:</b> {missing.map((s) => s.name).join(", ")}.</div>
          <form action={addMissingSourcesAction}>
            <button type="submit" className="primary">Add them (keeps your edits)</button>
          </form>
        </div>
      )}

      <h2>Overview</h2>
      <div className="scroll">
        <table className="overview">
          <thead><tr><th>Source</th><th>Lean</th><th className="num">Feeds</th><th className="num">Working</th><th className="num">Articles, 24 h</th><th className="num">New found</th></tr></thead>
          <tbody>
            {views.map((v) => (
              <tr key={v.source.id} className={v.source.enabled ? "" : "off"}>
                <td><span className="dot" style={{ background: leanColor(v.source.leanValue), opacity: leanOpacity(v.source.leanValue) }} /><a href={`#${v.source.id}`}>{v.source.name}</a></td>
                <td className="muted">{LEAN_LABEL[v.source.lean] ?? v.source.lean}</td>
                <td className="num">{v.source.feeds.length}</td>
                <td className="num">{v.disc ? <span className={v.failing ? "bad" : "ok"}>{v.working}/{v.source.feeds.length}</span> : <span className="muted">–</span>}</td>
                <td className="num">{v.disc ? v.last24h : <span className="muted">–</span>}</td>
                <td className="num">{v.found.active.length ? <span className="warn">{v.found.active.length}</span> : <span className="muted">0</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Working and article counts come from the last Discover for each source.</p>

      <h2>Sources</h2>
      {views.map((v) => <SourceCard key={v.source.id} v={v} />)}

      {log.length > 0 && (
        <details className="more">
          <summary>Change log ({log.length})</summary>
          <ul className="url-list">{log.slice(-50).reverse().map((l, i) => <li key={i}><span className="muted">{when(l.at)}</span> {l.change.length > 300 ? `${l.change.slice(0, 300)}…` : l.change}</li>)}</ul>
        </details>
      )}
    </main>
  );
}
