import Link from "next/link";
import { notFound } from "next/navigation";
import type { LeanGroup } from "@/lib/types";
import { readNewsIndex, readNewsStory } from "@/news/store";
import { ChevronLeft } from "../../../_ui/icons";
import SplitBar from "../../_components/SplitBar";
import StoryActions from "../../_components/StoryActions";
import { clock, longDate, sectionLabel } from "../../_components/sections";

export const dynamic = "force-dynamic";

const SIDE_NAME: Record<LeanGroup, string> = { left: "Left", center: "Center", right: "Right" };
const SIDES: LeanGroup[] = ["left", "center", "right"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const story = await readNewsStory((await params).id);
  return { title: story ? `${story.title} · PRISM` : "Story · PRISM", description: story?.analysis?.summary };
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [story, index] = await Promise.all([readNewsStory(id), readNewsIndex()]);
  if (!story) notFound();
  const latest = index.days[0]?.date;
  const back = `/news/${story.category}${story.date === latest ? "" : `?date=${story.date}`}`;
  const a = story.analysis;
  const sidesWithFraming = a ? SIDES.filter((s) => a.framing[s]) : [];

  return (
    <main className="storypage">
      <div className="story-in">
        <Link href={back} className="crumb"><ChevronLeft size={16} /> {sectionLabel(story.category)} · {longDate(story.date)}</Link>

        <h1 className="story-title">{story.title}</h1>
        {a?.summary && <p className="dek">{a.summary}</p>}

        <div className="story-meta">
          <p className="meta">
            <span>{story.outletCount} outlets</span>
            {story.durationSec ? <span>{clock(story.durationSec)} listen</span> : null}
          </p>
          <SplitBar lean={story.lean} size="lg" />
        </div>

        {story.track ? (
          <StoryActions track={story.track} variant="page" />
        ) : !story.hasScript ? (
          <p className="note">This story hasn't been written up yet. Here's who covered it.</p>
        ) : null}

        {story.script?.length ? (
          <article className="script">
            {story.script.map((para, i) => <p key={i}>{para}</p>)}
          </article>
        ) : null}

        {a && (a.agreedFacts.length > 0 || a.disputed.length > 0 || sidesWithFraming.length > 0) && (
          <details className="fold">
            <summary><span>How the coverage compares</span></summary>
            <div className="fold-body">
              {a.agreedFacts.length > 0 && (
                <section className="cmp">
                  <h3>What every side reports</h3>
                  <ul className="facts">{a.agreedFacts.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </section>
              )}
              {a.disputed.length > 0 && (
                <section className="cmp">
                  <h3>Where accounts differ</h3>
                  {a.disputed.map((d, i) => (
                    <div key={i} className="dispute">
                      <p className="dispute-claim">{d.claim}</p>
                      <ul>
                        {d.positions.map((p, j) => (
                          <li key={j}>
                            <span className="dots" aria-hidden>{p.sides.map((s) => <i key={s} className={`sw sw-${s}`} />)}</span>
                            <span><b>{p.outlets.join(", ")}</b>{p.sides.length ? <span className="sides"> ({p.sides.map((s) => SIDE_NAME[s].toLowerCase()).join(", ")})</span> : null}: {p.position}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              )}
              {sidesWithFraming.length > 0 && (
                <section className="cmp">
                  <h3>How each side framed it</h3>
                  <div className="frames">
                    {sidesWithFraming.map((s) => (
                      <div key={s} className={`frame frame-${s}`}>
                        <p className="frame-head"><span>{SIDE_NAME[s]}</span><span className="meta">{story.lean[s]} {story.lean[s] === 1 ? "outlet" : "outlets"}</span></p>
                        <p>{a.framing[s]}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </details>
        )}

        <details className="fold" open={!story.hasScript}>
          <summary><span>Who covered it</span><span className="meta">{story.outlets.length}</span></summary>
          <ul className="outlets">
            {story.outlets.map((o) => (
              <li key={o.sourceId}>
                <a href={o.url} target="_blank" rel="noopener noreferrer">
                  <span className="outlet-name"><i className={`sw sw-${o.side}`} aria-hidden />{o.name}<span className="outlet-side">{SIDE_NAME[o.side]}</span></span>
                  <span className="outlet-headline">{o.headline}</span>
                </a>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </main>
  );
}
