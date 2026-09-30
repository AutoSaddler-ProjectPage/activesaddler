import { useEffect, useMemo, useRef, useState } from "react";
import type { ArmScore } from "./types";
import { armColor, stackRank } from "./data";

type Props = {
  it: number;
  scores: ArmScore[] | null;
  chosen?: number;
  /** True while the needle glides toward the chosen arm. */
  spinning: boolean;
  /** True once the needle has landed (or immediately, when not animating). */
  landed: boolean;
  isDraw: boolean;
  durationMs: number;
  animate: boolean;
};

/** Deterministic landing offset inside the chosen segment, so replays are repeatable. */
const landingJitter = (it: number) => {
  const x = Math.sin(it * 12.9898) * 43758.5453;
  return 0.25 + 0.5 * (x - Math.floor(x));
};

/**
 * The pool's probability mass as one 100% strip (arms in the paper's stacking
 * order, like the hero figure). On a pull, a needle glides to the sampled arm:
 * a_t ~ Categorical(q_t).
 */
export default function SamplingStrip({
  it,
  scores,
  chosen,
  spinning,
  landed,
  isDraw,
  durationMs,
  animate,
}: Props) {
  const segments = useMemo(
    () => (scores ? [...scores].sort((a, b) => stackRank(a.p) - stackRank(b.p)) : []),
    [scores],
  );
  const bounds = useMemo(() => {
    let acc = 0;
    return segments.map((s) => {
      const b = { p: s.p, x0: acc, x1: acc + s.q };
      acc += s.q;
      return b;
    });
  }, [segments]);
  const target = useMemo(() => {
    const b = bounds.find((b) => b.p === chosen);
    return b ? b.x0 + (b.x1 - b.x0) * landingJitter(it) : null;
  }, [bounds, chosen, it]);

  const [needle, setNeedle] = useState<number | null>(null);
  const needleRef = useRef<number>(0);

  useEffect(() => {
    if (target == null || isDraw) return;
    if (!spinning || !animate) {
      if (landed || !animate) {
        needleRef.current = target;
        setNeedle(target);
      }
      return;
    }
    // One calm glide from the previous position straight to the sampled arm.
    const x0 = needleRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const x = x0 + (target - x0) * eased;
      needleRef.current = t < 1 ? x : target;
      setNeedle(needleRef.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning, landed, target, isDraw, durationMs, animate]);

  const showNeedle = !isDraw && needle != null && scores != null;

  return (
    <div className="relative select-none" aria-hidden>
      <div
        className="relative flex h-9 w-full overflow-hidden rounded-md"
        style={{
          background: "var(--cl-surface-3)",
          opacity: isDraw ? 0.35 : 1,
          transition: "opacity 400ms",
        }}
      >
        {segments.map((s) => {
          const picked = landed && s.p === chosen && !isDraw;
          return (
            <div
              key={s.p}
              style={{
                flex: `0 0 ${s.q * 100}%`,
                background: armColor(s.p),
                borderRight: "1px solid var(--cl-surface)",
                boxSizing: "border-box",
                transition: "flex-basis 600ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 120ms",
                filter: picked ? "brightness(1.18) saturate(1.1)" : "none",
                boxShadow: picked ? "inset 0 0 0 2px var(--cl-surface)" : "none",
              }}
            />
          );
        })}
      </div>
      {showNeedle && (
        <div
          className="pointer-events-none absolute -top-2 -bottom-2"
          style={{ left: `calc(${needle! * 100}% - 1px)` }}
        >
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "8px solid var(--cl-ink)",
            }}
          />
          <div className="h-full w-[2px]" style={{ background: "var(--cl-ink)" }} />
        </div>
      )}
      {isDraw && (
        <div
          className="absolute inset-0 flex items-center justify-center text-[0.78rem] font-semibold"
          style={{ color: "var(--cl-draw)" }}
        >
          <span className="rounded-full px-3 py-1" style={{ background: "var(--cl-surface)", boxShadow: "var(--cl-shadow)" }}>
            Arm Prioritizer skipped · drawing from the unseen pool
          </span>
        </div>
      )}
    </div>
  );
}
