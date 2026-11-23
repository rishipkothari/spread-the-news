import { readDiscovery, type FeedProbe } from "@/admin/discover";
import { CATEGORIES, type Feed, type Prominence, type Source } from "@/lib/types";
import { loadSources, missingFromRepo, readChangelog } from "@/sources/store";
import {
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
const leanColor = (v: number) => (v < 0 ? "var(--left)" : v > 0 ? "var(--right)" : "var(--center)");

function FeedTypeFields({ prominence, section }: { prominence: Prominence; section?: string }) {
  return (
    <>
      <select name="prominence" defaultValue={prominence} title="feed type">
        {PROMINENCES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select name="section" defaultValue={section ?? ""} title="category hint">
        <option value="">no section</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </>
  );
}

function guessType(url: string): { prominence: Prominence; section?: string } {
  const u = url.toLowerCase();
  if (/top|front|home|headline/.test(u)) return { prominence: "top" };
  if (/latest|all|\/feed\/?$|\/rss\/?$|rss\.xml$/.test(u)) return { prominence: "latest" };
  const section = /world|international/.test(u) ? "world" : /politic|us\b|us\.xml|national|congress/.test(u) ? "us" : /business|econom|money|market/.test(u)
    ? "business" : /science|health|tech|environment|climate/.test(u) ? "science" : /sport/.test(u) ? "sports" : /entertain|culture|lifestyle|arts/.test(u) ? "other" : undefined;
  return { prominence: "section", section };
}

function ConfiguredFeed({ source, feed, probe }: { source: Source; feed: Feed; probe?: FeedProbe }) {
  return (
    <tr>
      <td className="mono" style={{ wordBreak: "break-all" }}>
        {feed.url}
        {probe && <div className={probe.ok ? "muted" : "bad"}>{probe.ok ? `${probe.inWindow} in last 24h · ${probe.items} items` : probe.error}</div>}
        {feed.verified === false && !probe && <div className="warn">never tested — run Discover</div>}
      </td>
      <td>
        <form action={updateFeedAction} className="row" style={{ gap: 6 }}>
          <input type="hidden" name="sourceId" value={source.id} />
          <input type="hidden" name="url" value={feed.url} />
          <FeedTypeFields prominence={feed.prominence} section={feed.section} />
          <button type="submit">Save</button>
        </form>
      </td>
      <td>
        <form action={removeFeedAction}>
          <input type="hidden" name="sourceId" value={source.id} />
          <input type="hidden" name="url" value={feed.url} />
          <button type="submit">Remove</button>
        </form>
      </td>
    </tr>
  );
}

async function SourceCard({ source }: { source: Source }) {
  const disc = await readDiscovery(source.id);
  const configured = new Set(source.feeds.map((f) => f.url));
  const probeFor = new Map(disc?.probes.map((p) => [p.url, p]) ?? []);
  const candidates = disc?.probes.filter((p) => !configured.has(p.url)) ?? [];
  const working = candidates.filter((p) => p.ok);
  const broken = candidates.filter((p) => !p.ok);
  return (
    <div className="story" style={{ opacity: source.enabled ? 1 : 0.6 }}>
      <div className="row">
        <span className="dot" style={{ background: leanColor(source.leanValue) }} />
        <b>{source.name}</b>
        <span className="muted">{source.lean} · {source.homepage}</span>
        <span style={{ flex: 1 }} />
        <form action={discoverAction}>
          <input type="hidden" name="sourceId" value={source.id} />
          <button type="submit">Discover feeds</button>
        </form>
        <form action={toggleSourceAction}>
          <input type="hidden" name="sourceId" value={source.id} />
          <button type="submit">{source.enabled ? "Disable source" : "Enable source"}</button>
        </form>
      </div>
      {disc && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          last discovery {new Date(disc.at).toLocaleString()} · homepage {disc.homepage.ok ? `ok, ${disc.homepage.articleLinks} article links` : `failed: ${disc.homepage.error}`}
        </div>
      )}

      <h3 style={{ fontSize: 13, margin: "12px 0 4px" }}>Configured feeds</h3>
      <div className="scroll">
        <table>
          <tbody>{source.feeds.map((f) => <ConfiguredFeed key={f.url} source={source} feed={f} probe={probeFor.get(f.url)} />)}</tbody>
        </table>
      </div>

      {working.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, margin: "12px 0 4px" }}>Discovered working feeds ({working.length})</h3>
          <div className="scroll">
            <table>
              <tbody>
                {working.map((p) => {
                  const g = guessType(p.url);
                  return (
                    <tr key={p.url}>
                      <td className="mono" style={{ wordBreak: "break-all" }}>
                        {p.url}
                        <div className="muted">{p.title ? `${p.title} · ` : ""}{p.inWindow} in last 24h · {p.items} items · via {p.foundVia}</div>
                        <div className="muted" style={{ fontFamily: "inherit" }}>{p.samples.join(" · ")}</div>
                      </td>
                      <td>
                        <form action={addFeedAction} className="row" style={{ gap: 6 }}>
                          <input type="hidden" name="sourceId" value={source.id} />
                          <input type="hidden" name="url" value={p.url} />
                          <FeedTypeFields prominence={g.prominence} section={g.section} />
                          <button type="submit">Add</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {broken.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary className="muted" style={{ cursor: "pointer" }}>{broken.length} candidates that didn&apos;t work</summary>
          <ul className="mono muted">{broken.map((p) => <li key={p.url}>{p.url} — {p.error} ({p.foundVia})</li>)}</ul>
        </details>
      )}

      <form action={testUrlAction} className="row" style={{ marginTop: 10, gap: 6 }}>
        <input type="hidden" name="sourceId" value={source.id} />
        <input name="url" placeholder="Test a feed URL (or an RSS index page) by hand" style={{ flex: "1 1 320px" }} />
        <button type="submit">Test</button>
      </form>
    </div>
  );
}

export default async function FeedsPage() {
  const [{ sources, origin, updatedAt }, log] = await Promise.all([loadSources(), readChangelog()]);
  const missing = origin === "blob" ? missingFromRepo(sources) : [];
  return (
    <main>
      <h1>Feeds</h1>
      <p className="muted">
        Find, test and manage each outlet&apos;s feeds. Changes apply from the next run. Feed types: <b>top</b> = the outlet&apos;s editorial front page,{" "}
        <b>latest</b> = everything it publishes, <b>section</b> = one topic (the section sets a category hint). &quot;Discover&quot; reads the outlet&apos;s
        homepage for advertised feeds, follows RSS index pages one level, and tests every candidate.
      </p>
      <div className="row" style={{ margin: "12px 0" }}>
        <form action={discoverAction}>
          <input type="hidden" name="sourceId" value="all" />
          <button type="submit" className="primary">Discover feeds for all sources (~2 min)</button>
        </form>
        <a href="/debug/feeds/sources.json" className="big" style={{ margin: 0, padding: "6px 12px" }}>Download sources.json</a>
        <span className="muted">
          Live list: {origin === "blob" ? `edited here (${updatedAt ? new Date(updatedAt).toLocaleString() : ""})` : "repo default (config/sources.json)"}
        </span>
        {origin === "blob" && (
          <form action={resetSourcesAction}>
            <button type="submit">Reset to repo version</button>
          </form>
        )}
      </div>
      {missing.length > 0 && (
        <div className="story" style={{ borderColor: "var(--warn, #c90)" }}>
          <b>{missing.length} new sources in the repo aren&apos;t in your live list yet:</b> {missing.map((s) => s.name).join(", ")}.
          <form action={addMissingSourcesAction} style={{ marginTop: 8 }}>
            <button type="submit" className="primary">Add them (keeps your edits)</button>
          </form>
        </div>
      )}
      {sources.map((s) => <SourceCard key={s.id} source={s} />)}
      {log.length > 0 && (
        <>
          <h2>Change log</h2>
          <ul className="mono muted">{log.slice(-30).reverse().map((l, i) => <li key={i}>{l.at.slice(0, 16).replace("T", " ")} {l.change}</li>)}</ul>
        </>
      )}
    </main>
  );
}
