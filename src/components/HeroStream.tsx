import { useState } from "react";
import { area, curveMonotoneX } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { ARMS, ARM_BY_P, ITERS, STACK_ORDER, STREAM, armColor, pct, type StreamCol } from "./Curriculum/data";
import { useElementWidth, useReducedMotion } from "./Curriculum/hooks";

const PULLS = ITERS.filter((d) => d.action === "pull");
/** Legend: the paper's top-10 arms by name; the other arms as one swatch row. */
const NAMED = ARMS.filter((a) => a.slot != null).sort((a, b) => a.slot! - b.slot!);
const REST = ARMS.filter((a) => a.slot == null);
type Col = StreamCol;
const BANDS = STACK_ORDER;
const COLS = STREAM;

/** Hero figure: how the curriculum's pull-probability mass moves across arms over the run. */
export default function HeroStream() {
  const [ref, width] = useElementWidth<HTMLDivElement>(900);
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const [hoverArm, setHoverArm] = useState<number | null>(null);
  const H = width < 560 ? 170 : 220;
  const M = { l: 8, r: 8, t: 6, b: 22 };
  const x = scaleLinear().domain([COLS[0].it, COLS[COLS.length - 1].it]).range([M.l, width - M.r]);
  const y = scaleLinear().domain([0, 1]).range([H - M.b, M.t]);

  const col = hover != null ? COLS[hover] : null;
  const pull = hover != null ? PULLS[hover] : null;
  const arm = hoverArm != null ? ARM_BY_P.get(hoverArm) : undefined;
  const armQ = pull && hoverArm != null ? pull.scores!.find((s) => s.p === hoverArm)?.q : undefined;

  return (
    <div ref={ref} className="cl-root not-prose relative w-full select-none">
      <svg width={width} height={H} role="img" aria-label="Stacked pull-probability mass of all 35 failure-pattern arms over 34 arm-selection iterations">
        <defs>
          <clipPath id="hero-reveal">
            <rect x={0} y={0} width={width} height={H} className={reduced ? undefined : "hero-reveal"} />
          </clipPath>
        </defs>
        <g clipPath="url(#hero-reveal)">
          {BANDS.map((p, i) => (
            <path
              key={p}
              d={
                area<Col>()
                  .x((c) => x(c.it))
                  .y0((c) => y(c.y0[i]))
                  .y1((c) => y(c.y1[i]))
                  .curve(curveMonotoneX)(COLS) ?? ""
              }
              fill={armColor(p)}
              // no separators: each band is edged in its own colour, which only
              // closes the anti-aliasing seams between neighbouring areas
              stroke={armColor(p)}
              strokeWidth={0.75}
              opacity={hoverArm == null ? 1 : p === hoverArm ? 1 : 0.4}
              style={{ transition: "opacity 200ms" }}
            />
          ))}
        </g>
        {COLS.filter(
          (c, i) =>
            i === 0 ||
            i === COLS.length - 1 ||
            // interior ticks every 10 iterations, dropped if they would crowd an end label
            (c.it % 10 === 0 && x(c.it) - x(COLS[0].it) > 60 && x(COLS[COLS.length - 1].it) - x(c.it) > 60),
        ).map((c, i, shown) => (
          <text
            key={c.it}
            x={x(c.it)}
            y={H - 6}
            fontSize={10.5}
            textAnchor={i === 0 ? "start" : i === shown.length - 1 ? "end" : "middle"}
            fill="var(--cl-muted)"
          >
            iter {c.it}
          </text>
        ))}
        {col && <line x1={x(col.it)} x2={x(col.it)} y1={M.t} y2={H - M.b} stroke="var(--cl-ink)" strokeWidth={1.5} />}
        <rect
          x={M.l}
          y={0}
          width={Math.max(0, width - M.l - M.r)}
          height={H}
          fill="transparent"
          onPointerMove={(e) => {
            const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
            const it = x.invert(e.clientX - r.left);
            let best = 0;
            COLS.forEach((c, i) => {
              if (Math.abs(c.it - it) < Math.abs(COLS[best].it - it)) best = i;
            });
            // the band under the pointer in that column
            const v = y.invert(e.clientY - r.top);
            const k = COLS[best].y0.findIndex((y0, j) => v >= y0 && v <= COLS[best].y1[j]);
            setHover(best);
            setHoverArm(k >= 0 ? BANDS[k] : null);
          }}
          onPointerLeave={() => {
            setHover(null);
            setHoverArm(null);
          }}
        />
      </svg>
      {col && pull && arm && armQ != null && (
        <div
          className="pointer-events-none absolute z-10 max-w-[18rem] rounded-lg border px-2.5 py-1.5 text-left text-[0.75rem]"
          style={{
            left: Math.min(Math.max(x(col.it), 110), width - 110),
            top: 0,
            transform: "translate(-50%, -105%)",
            background: "var(--cl-surface)",
            borderColor: "var(--cl-border)",
            boxShadow: "var(--cl-shadow)",
            color: "var(--cl-ink-2)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: armColor(arm.p) }} />
            <b style={{ color: "var(--cl-ink)" }}>P{arm.p}</b> · {pct(armQ)} pull probability at iteration {col.it}
            {pull.chosen === arm.p && <b style={{ color: "var(--cl-accent)" }}> · sampled</b>}
          </div>
          <div className="mt-0.5 leading-snug">{arm.label}</div>
        </div>
      )}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.72rem]" style={{ color: "var(--cl-muted)" }}>
        {NAMED.map((a) => (
          <span key={a.p} className="inline-flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: armColor(a.p) }} />P{a.p}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex overflow-hidden rounded-sm">
            {REST.map((a) => (
              <span key={a.p} className="inline-block h-2.5 w-[3px]" style={{ background: armColor(a.p) }} />
            ))}
          </span>
          +{REST.length} more weaknesses
        </span>
      </div>
    </div>
  );
}
