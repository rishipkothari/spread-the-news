import Link from "next/link";
import type { NewsStoryCard } from "@/news/types";
import SplitBar from "./SplitBar";
import StoryActions from "./StoryActions";
import { clock, sectionLabel } from "./sections";

/** A story in a list: headline, section · outlets · length, the split bar, and Play / Add to queue when voiced. */
export default function StoryRow({ story, showRank, showSection = true }: { story: NewsStoryCard; showRank?: boolean; showSection?: boolean }) {
  return (
    <article className="srow">
      {showRank && <span className="srow-rank" aria-label={`Rank ${story.rank}`}>{story.rank}</span>}
      <div className="srow-body">
        <p className="meta">
          {showSection && <span className="meta-strong">{sectionLabel(story.category)}</span>}
          <span>{story.outletCount} outlets</span>
          {story.hasAudio && story.durationSec ? <span>{clock(story.durationSec)}</span> : null}
        </p>
        <h3 className="srow-title"><Link href={`/story/${story.id}`} className="stretch">{story.title}</Link></h3>
        <SplitBar lean={story.lean} />
      </div>
      {story.track && <StoryActions track={story.track} />}
    </article>
  );
}
