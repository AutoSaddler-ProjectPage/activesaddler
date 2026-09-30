import { useId, useRef, useState } from "react";
import { line, curveStepAfter } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { ITERS, LAST_IT, pct } from "./data";
import { useElementWidth } from "./hooks";

type Props = {
  it: number;
  onSeek: (it: number) => void;
};

const M = { left: 44, right: 14 };
const LANE1 = { top: 22, h: 72 };
const LANE2 = { top: LANE1.top + LANE1.h + 30, h: 18 };
const AXIS_Y = LANE2.top + LANE2.h + 16;
const H = AXIS_Y + 14;

const newBestIts = ITERS.filter(
  (d, i) => i > 0 && d.bestDev > ITERS[i - 1].bestDev + 1e-9,
).map((d) => d.it);

// Paper convention: iteration 1 is the forced seeding draw (empty pool), so the
// halves are 2..26 and 27..51 (44% → 20% draws on GAIA2).
const half = 1 + Math.ceil((LAST_IT - 1) / 2);
const drawShare = (a: number, b: number) => {
  const span = ITERS.filter((d) => d.it >= a && d.it <= b);
  return span.filter((d) => d.action === "draw").length / span.length;
};
const SHARE_1 = drawShare(2, half);
const SHARE_2 = drawShare(half + 1, LAST_IT);

/** Scrubbable run timeline: best-so-far dev accuracy above, Draw/Pull decisions below. */
export default function Timeline({ it, onSeek }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(900);
  const [hover, setHover] = useState<number | null>(null);
  const dragging = useRef(false);
  const clipId = useId().replace(/:/g, "");

  const x = scaleLinear()
    .domain([1, LAST_IT])
    .range([M.left, Math.max(M.left + 100, width - M.right)]);
  const y = scaleLinear().domain([0.46, 0.66]).range([LANE1.top + LANE1.h, LANE1.top]);
  const stepPath =
    line<(typeof ITERS)[number]>()
      .x((d) => x(d.it))
      .y((d) => y(d.bestDev))
      .curve(curveStepAfter)(ITERS) ?? "";

  const itFromEvent = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    return Math.max(1, Math.min(LAST_IT, Math.round(x.invert(px))));
  };

  const hoverIter = hover != null ? ITERS[hover - 1] : null;
  const compact = width < 560;
  const tickEvery = compact ? 10 : 5;

  return (
    <div ref={wrapRef} className="relative w-full min-w-0 select-none">
      <svg width={width} height={H} role="img" aria-label="Run timeline: best dev accuracy and Draw/Pull decisions per iteration">
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={x(it)} height={H} />
          </clipPath>
        </defs>

        {/* lane titles */}
        <text x={M.left} y={12} fontSize={11} fontWeight={600} fill="var(--cl-muted)">
          Best dev accuracy so far
        </text>
        <text x={M.left} y={LANE2.top - 10} fontSize={11} fontWeight={600} fill="var(--cl-muted)">
          Curriculum decision
        </text>
        {!compact && (
          <text x={width - M.right} y={LANE2.top - 10} fontSize={11} textAnchor="end" fill="var(--cl-muted)">
            Draw share: {pct(SHARE_1, 0)} of iterations 2–{half} → {pct(SHARE_2, 0)} of {half + 1}–{LAST_IT}
          </text>
        )}

        {/* grid + y ticks */}
        {[0.5, 0.55, 0.6, 0.65].map((v) => (
          <g key={v}>
            <line x1={M.left} x2={x(LAST_IT)} y1={y(v)} y2={y(v)} stroke="var(--cl-grid)" strokeWidth={1} />
            <text x={M.left - 8} y={y(v) + 3.5} fontSize={10} textAnchor="end" fill="var(--cl-muted)">
              {Math.round(v * 100)}%
            </text>
          </g>
        ))}

        {/* dev evaluations (hollow) */}
        {ITERS.filter((d) => d.devEval != null).map((d) => (
          <circle
            key={`e${d.it}`}
            cx={x(d.it)}
            cy={y(d.devEval!)}
            r={3}
            fill="var(--cl-surface)"
            stroke="var(--cl-muted)"
            strokeWidth={1.25}
            opacity={d.it <= it ? 0.9 : 0.3}
          />
        ))}

        {/* best-so-far step: faint future, inked past */}
        <path d={stepPath} fill="none" stroke="var(--cl-border)" strokeWidth={2} />
        <path d={stepPath} fill="none" stroke="var(--cl-ink)" strokeWidth={2} clipPath={`url(#${clipId})`} strokeLinejoin="round" />
        {newBestIts.map((k, idx) => {
          const d = ITERS[k - 1];
          const past = k <= it;
          // Skip a value label that would collide with the next one (narrow screens).
          const next = newBestIts[idx + 1];
          const showLabel = next == null || x(next) - x(k) > 40;
          return (
            <g key={`b${k}`} opacity={past ? 1 : 0.35}>
              <circle cx={x(k)} cy={y(d.bestDev)} r={4} fill="var(--cl-good)" stroke="var(--cl-surface)" strokeWidth={2} />
              {showLabel && (
                <text x={x(k)} y={y(d.bestDev) - 8} fontSize={10} fontWeight={600} textAnchor="middle" fill="var(--cl-ink-2)">
                  {pct(d.bestDev)}
                </text>
              )}
            </g>
          );
        })}

        {/* decisions */}
        {ITERS.map((d) => {
          const cx = x(d.it);
          const cy = LANE2.top + LANE2.h / 2;
          const past = d.it <= it;
          const cur = d.it === it;
          const s = cur ? 1.45 : 1;
          return (
            <g key={`d${d.it}`} opacity={past ? 1 : 0.3} style={{ transition: "opacity 300ms" }}>
              {d.action === "pull" ? (
                <circle cx={cx} cy={cy} r={4 * s} fill="var(--cl-accent)" stroke="var(--cl-surface)" strokeWidth={cur ? 2 : 1} />
              ) : (
                <rect
                  x={cx - 3.6 * s}
                  y={cy - 3.6 * s}
                  width={7.2 * s}
                  height={7.2 * s}
                  transform={`rotate(45 ${cx} ${cy})`}
                  fill="var(--cl-surface)"
                  stroke="var(--cl-draw)"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}

        {/* x axis */}
        {ITERS.filter((d) => d.it === 1 || d.it % tickEvery === 0).map((d) => (
          <text key={`t${d.it}`} x={x(d.it)} y={AXIS_Y + 6} fontSize={10} textAnchor="middle" fill="var(--cl-muted)">
            {d.it}
          </text>
        ))}
        <text x={M.left - 8} y={AXIS_Y + 6} fontSize={10} textAnchor="end" fill="var(--cl-muted)">
          iter
        </text>

        {/* playhead */}
        <g style={{ transform: `translateX(${x(it)}px)`, transition: "transform 250ms ease-out" }}>
          <line x1={0} x2={0} y1={LANE1.top - 4} y2={LANE2.top + LANE2.h + 4} stroke="var(--cl-accent)" strokeWidth={1.5} />
          <circle cx={0} cy={y(ITERS[it - 1].bestDev)} r={4.5} fill="var(--cl-accent)" stroke="var(--cl-surface)" strokeWidth={2} />
        </g>
        {hover != null && hover !== it && (
          <line x1={x(hover)} x2={x(hover)} y1={LANE1.top - 4} y2={LANE2.top + LANE2.h + 4} stroke="var(--cl-muted)" strokeWidth={1} opacity={0.5} />
        )}

        {/* hit area */}
        <rect
          x={M.left - 8}
          y={0}
          width={Math.max(0, x(LAST_IT) - M.left + 16)}
          height={H}
          fill="transparent"
          style={{ cursor: "pointer", touchAction: "none" }}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            onSeek(itFromEvent(e));
          }}
          onPointerMove={(e) => {
            const k = itFromEvent(e);
            setHover(k);
            if (dragging.current && k !== it) onSeek(k);
          }}
          onPointerUp={(e) => {
            dragging.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hoverIter && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border px-2.5 py-1.5 text-[0.75rem] whitespace-nowrap"
          style={{
            left: Math.min(Math.max(x(hoverIter.it), 90), width - 90),
            top: -8,
            transform: "translate(-50%, -100%)",
            background: "var(--cl-surface)",
            borderColor: "var(--cl-border)",
            boxShadow: "var(--cl-shadow)",
            color: "var(--cl-ink-2)",
          }}
        >
          <b style={{ color: "var(--cl-ink)" }}>Iteration {hoverIter.it}</b> ·{" "}
          <span style={{ color: hoverIter.action === "pull" ? "var(--cl-accent)" : "var(--cl-draw)" }}>
            {hoverIter.action === "pull" ? `Pull P${hoverIter.chosen}` : "Draw"}
          </span>{" "}
          · best {pct(hoverIter.bestDev)}
          {hoverIter.devEval != null && <> · dev eval {pct(hoverIter.devEval)}</>}
        </div>
      )}
    </div>
  );
}
