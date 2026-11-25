import type { LeanCounts } from "@/news/types";

const SIDES = ["left", "center", "right"] as const;

/** How many covering outlets lean left, center and right: a slim bar plus words (color is never the only cue). */
export default function SplitBar({ lean, size = "sm", showLabel = true }: { lean: LeanCounts; size?: "sm" | "lg"; showLabel?: boolean }) {
  const total = lean.left + lean.center + lean.right;
  const text = `${lean.left} left · ${lean.center} center · ${lean.right} right`;
  return (
    <div className={`split split-${size}`}>
      <div className="split-bar" role="img" aria-label={`Coverage: ${text}`} title={text}>
        {SIDES.map((s) => (lean[s] ? <span key={s} className={`seg seg-${s}`} style={{ flexGrow: lean[s] / (total || 1) }} /> : null))}
      </div>
      {showLabel && (
        <div className="split-label" aria-hidden>
          {SIDES.map((s) => (
            <span key={s}><i className={`sw sw-${s}`} />{lean[s]} {s}</span>
          ))}
        </div>
      )}
    </div>
  );
}
