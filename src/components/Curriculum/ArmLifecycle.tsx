import { useEffect, useMemo, useState } from "react";
import { area, line, curveMonotoneX } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { ARMS, ARM_BY_P, ITERS, PULL_ITERS, armColor, loadRationales, pct, rankOf } from "./data";
import { useElementWidth } from "./hooks";
import { requestSeek } from "./store";
import type { ArmScore, Iter, Rationales } from "./types";
import { Icon, SvgGlyph } from "./icons";

const PULLS: Iter[] = ITERS.filter((d) => d.action === "pull");
/** Heatmap columns: the 34 arm-selection (pull) iterations, as in the paper's heatmap. */
const COLUMNS: Iter[] = PULLS;
/** score of arm p at column c (undefined before the arm entered the pool) */
const CELL: Map<number, (ArmScore & { rank: number })[]> = (() => {
  const m = new Map<number, (ArmScore & { rank: number })[]>();
  COLUMNS.forEach((d, c) => {
    d.scores?.forEach((s) => {
      if (!m.has(s.p)) m.set(s.p, []);
      m.get(s.p)![c] = { ...s, rank: rankOf(d.scores!, s.p) };
    });
  });
  return m;
})();
const Q_MAX = 0.6;
const heat = (q: number) => {
  const t = Math.sqrt(Math.min(1, q / Q_MAX));
  return `color-mix(in oklab, var(--heat-lo), var(--heat-hi) ${(t * 100).toFixed(1)}%)`;
};

const STATUS_TONE: Record<string, "good" | "neutral" | "warn"> = {
  "resolved by own patch": "good",
};

/** The paper's two case studies: a weakness that resolves, and one that recurs. */
const PRESETS = [
  { p: 3, note: "resolved weakness" },
  { p: 8, note: "recurring weakness" },
];

type Hover = { p: number; c: number } | null;

export default function ArmLifecycle() {
  // fallback ≈ the text column, so the server-rendered layout matches desktop
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(760);
  const [selected, setSelected] = useState(8);
  const [hover, setHover] = useState<Hover>(null);
  const [rationales, setRationales] = useState<Rationales | null>(null);
  useEffect(() => {
    loadRationales().then(setRationales, () => setRationales({}));
  }, []);

  const side = width >= 1000;
  const heatW = side ? Math.floor(width * 0.56) : width;
  const labelW = 38;
  const headerH = 22;
  const cw = Math.max(14, Math.floor((heatW - labelW) / COLUMNS.length));
  const ch = 14;
  const gridW = labelW + cw * COLUMNS.length;
  const gridH = headerH + ch * ARMS.length;

  const hovered = hover ? CELL.get(hover.p)?.[hover.c] : undefined;

  return (
    <div
      ref={wrapRef}
      className="cl-root not-prose overflow-hidden rounded-2xl border p-3 sm:p-5"
      style={{ background: "var(--cl-surface)", borderColor: "var(--cl-border)", boxShadow: "var(--cl-shadow)" }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[0.95rem] font-semibold">Arm Lifecycle Explorer</div>
          <div className="text-[0.75rem]" style={{ color: "var(--cl-muted)" }}>
            All {ARMS.length} failure-pattern arms × {COLUMNS.length} arm-selection iterations · click a row
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((pr) => (
            <button
              key={pr.p}
              type="button"
              onClick={() => setSelected(pr.p)}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.75rem] font-medium"
              style={{
                borderColor: selected === pr.p ? "var(--cl-accent)" : "var(--cl-border)",
                background: selected === pr.p ? "var(--cl-accent-soft)" : "var(--cl-surface)",
                color: selected === pr.p ? "var(--cl-accent)" : "var(--cl-ink-2)",
              }}
            >
              <span className="inline-block size-2 rounded-full" style={{ background: armColor(pr.p) }} />
              P{pr.p} · {pr.note}
            </button>
          ))}
        </div>
      </div>

      <div className={side ? "flex items-start gap-5" : "flex flex-col gap-5"}>
        <div className="relative max-w-full shrink-0 overflow-x-auto" style={{ width: side ? heatW : "100%" }}>
          <svg className="cl-scroll-x" width={gridW} height={gridH + 34} role="img" aria-label="Heatmap of pull probability for every arm at every arm-selection iteration">
            {COLUMNS.map((d, c) =>
              c === 0 || d.it % 5 === 0 ? (
                <text key={d.it} x={labelW + c * cw + cw / 2} y={14} fontSize={10} textAnchor="middle" fill="var(--cl-muted)">
                  {d.it}
                </text>
              ) : null,
            )}
            {ARMS.map((a, r) => {
              const row = CELL.get(a.p) ?? [];
              const y = headerH + r * ch;
              const isSel = a.p === selected;
              return (
                <g key={a.p} onClick={() => setSelected(a.p)} style={{ cursor: "pointer" }}>
                  <text
                    x={labelW - 6}
                    y={y + ch / 2 + 3.5}
                    fontSize={10}
                    textAnchor="end"
                    fontWeight={isSel ? 700 : 400}
                    fill={isSel ? "var(--cl-ink)" : "var(--cl-muted)"}
                  >
                    P{a.p}
                  </text>
                  <rect x={2} y={y + 4} width={4} height={ch - 8} rx={1} fill={armColor(a.p)} />
                  {COLUMNS.map((d, c) => {
                    const s = row[c];
                    const x = labelW + c * cw;
                    const pulled = d.chosen === a.p;
                    return (
                      <g key={d.it} onMouseEnter={() => setHover({ p: a.p, c })} onMouseLeave={() => setHover(null)}>
                        <rect
                          x={x + 0.5}
                          y={y + 0.5}
                          width={cw - 1}
                          height={ch - 1}
                          rx={1.5}
                          fill={s ? heat(s.q) : "var(--cl-surface-2)"}
                          opacity={s ? 1 : 0.8}
                        />
                        {pulled && (
                          <circle cx={x + cw / 2} cy={y + ch / 2} r={3.2} fill="var(--cl-accent)" stroke="var(--cl-surface)" strokeWidth={1.5} />
                        )}
                      </g>
                    );
                  })}
                  {isSel && (
                    <rect x={labelW - 1} y={y} width={cw * COLUMNS.length + 2} height={ch} fill="none" stroke="var(--cl-accent)" strokeWidth={1.5} rx={3} pointerEvents="none" />
                  )}
                </g>
              );
            })}
            {hover && (
              <rect
                x={labelW + hover.c * cw}
                y={headerH + ARMS.findIndex((a) => a.p === hover.p) * ch}
                width={cw}
                height={ch}
                fill="none"
                stroke="var(--cl-ink)"
                strokeWidth={1.5}
                pointerEvents="none"
              />
            )}
            {/* legend */}
            <g transform={`translate(${labelW}, ${gridH + 12})`}>
              <defs>
                <linearGradient id="cl-heat-legend">
                  {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                    <stop key={t} offset={t} stopColor={heat(t * t * Q_MAX)} />
                  ))}
                </linearGradient>
              </defs>
              <text x={0} y={9} fontSize={10} fill="var(--cl-muted)">
                pull probability
              </text>
              <rect x={82} y={1} width={90} height={10} rx={2} fill="url(#cl-heat-legend)" />
              <text x={178} y={9} fontSize={10} fill="var(--cl-muted)">
                0 → 60%
              </text>
              <circle cx={236} cy={6} r={3.2} fill="var(--cl-accent)" />
              <text x={244} y={9} fontSize={10} fill="var(--cl-muted)">
                sampled arm
              </text>
              <rect x={312} y={1} width={12} height={10} rx={1.5} fill="var(--cl-surface-2)" stroke="var(--cl-border)" />
              <text x={329} y={9} fontSize={10} fill="var(--cl-muted)">
                not yet in pool
              </text>
            </g>
          </svg>
          {hover && hovered && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border px-2.5 py-1.5 text-[0.75rem] whitespace-nowrap"
              style={{
                left: Math.min(labelW + hover.c * cw + cw / 2, gridW - 100),
                top: headerH + ARMS.findIndex((a) => a.p === hover.p) * ch - 6,
                transform: "translate(-50%, -100%)",
                background: "var(--cl-surface)",
                borderColor: "var(--cl-border)",
                boxShadow: "var(--cl-shadow)",
                color: "var(--cl-ink-2)",
              }}
            >
              <b style={{ color: "var(--cl-ink)" }}>P{hover.p}</b> · iteration {COLUMNS[hover.c].it} · pull probability {pct(hovered.q)} · rank{" "}
              {hovered.rank}/{COLUMNS[hover.c].scores!.length}
              {COLUMNS[hover.c].chosen === hover.p && <b style={{ color: "var(--cl-accent)" }}> · sampled</b>}
            </div>
          )}
        </div>

        <ArmDetail p={selected} rationales={rationales} width={side ? width - heatW - 20 : width} />
      </div>
    </div>
  );
}

function ArmDetail({ p, rationales, width }: { p: number; rationales: Rationales | null; width: number }) {
  const arm = ARM_BY_P.get(p)!;
  const row = CELL.get(p) ?? [];
  const [hoverIt, setHoverIt] = useState<number | null>(null);
  useEffect(() => setHoverIt(null), [p]);

  const pts = useMemo(
    () => COLUMNS.map((d, c) => ({ it: d.it, s: row[c], d })).filter((x) => x.s),
    [row],
  );
  const pulls = PULLS.filter((d) => d.chosen === p);
  const lastN = pts.length ? pts[pts.length - 1].s!.n : 0;
  const tone = STATUS_TONE[arm.status] ?? "neutral";
  // "resolved by own patch": name the (last) iteration whose patch was accepted,
  // so a recurring arm like P8 doesn't read as resolved all along
  const accepted = pulls.filter((d) => d.outcome?.accepted).map((d) => d.it);
  const resolvedAt = arm.status === "resolved by own patch" && accepted.length ? accepted[accepted.length - 1] : null;

  const W = Math.max(260, width);
  const M = { l: 36, r: 10 };
  const x = scaleLinear().domain([PULL_ITERS[0], PULL_ITERS[PULL_ITERS.length - 1]]).range([M.l, W - M.r]);
  const qH = 170;
  const yq = scaleLinear().domain([0, Q_MAX]).range([qH - 4, 22]);
  const color = armColor(p);
  const qLine = line<(typeof pts)[number]>().x((d) => x(d.it)).y((d) => yq(d.s!.q)).curve(curveMonotoneX)(pts) ?? "";
  const qArea =
    area<(typeof pts)[number]>().x((d) => x(d.it)).y0(yq(0)).y1((d) => yq(d.s!.q)).curve(curveMonotoneX)(pts) ?? "";

  // new supporting scenarios, as in the paper's P8 case study (cross markers)
  const x0 = PULL_ITERS[0];
  const joins = arm.joins.filter(([it]) => it >= x0);
  const earlyJoins = arm.joins.length - joins.length;

  const hp = hoverIt != null ? pts.find((d) => d.it === hoverIt) : undefined;
  const hj = hoverIt != null ? joins.filter(([it]) => it === hoverIt) : [];
  const noteIt = hp?.it ?? (pulls.length ? pulls[pulls.length - 1].it : pts[pts.length - 1]?.it);
  const note = noteIt != null ? rationales?.[String(noteIt)]?.arms?.[String(p)] : undefined;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (!pts.length) return;
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const it = x.invert(e.clientX - rect.left);
    // snap to the nearest scored iteration or scenario join
    const targets = [...pts.map((d) => d.it), ...joins.map(([j]) => j)];
    setHoverIt(targets.reduce((b, t) => (Math.abs(t - it) < Math.abs(b - it) ? t : b), targets[0]));
  };

  return (
    <div key={p} className="cl-pop flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-block size-3 rounded-full" style={{ background: color }} />
        <span className="text-[1.1rem] font-bold">P{p}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[0.72rem] font-semibold"
          style={
            tone === "good"
              ? { background: "var(--cl-good-soft)", color: "var(--cl-good)" }
              : { background: "var(--cl-surface-3)", color: "var(--cl-ink-2)" }
          }
        >
          {tone === "good" && <Icon name="check" size={11} className="mr-1 -mt-0.5" />}
          {arm.status}
          {resolvedAt != null && ` at iteration ${resolvedAt}`}
        </span>
      </div>
      <p className="m-0 text-[0.88rem] leading-snug" style={{ color: "var(--cl-ink)" }}>
        {arm.label}
      </p>
      <svg width={W} height={qH + 20} role="img" aria-label={`Pull probability of P${p} over iterations`}>
        <text x={M.l} y={12} fontSize={11} fontWeight={600} fill="var(--cl-muted)">
          Pull probability
        </text>
        {[0, 0.2, 0.4, 0.6].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={yq(v)} y2={yq(v)} stroke="var(--cl-grid)" />
            <text x={M.l - 6} y={yq(v) + 3.5} fontSize={9.5} textAnchor="end" fill="var(--cl-muted)">
              {v * 100}%
            </text>
          </g>
        ))}
        <path d={qArea} fill={color} opacity={0.12} />
        <path d={qLine} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="cl-draw-in" />
        {pulls.map((d) => {
          const s = row[COLUMNS.indexOf(d)]!;
          const o = d.outcome!;
          return (
            <g key={d.it}>
              <circle cx={x(d.it)} cy={yq(s.q)} r={4.5} fill="var(--cl-accent)" stroke="var(--cl-surface)" strokeWidth={2} />
              <SvgGlyph
                name={o.allPass ? "ring" : o.accepted ? "check" : "x"}
                x={x(d.it)}
                y={yq(s.q) - 12}
                size={11}
                color={o.accepted ? "var(--cl-good)" : o.allPass ? "var(--cl-muted)" : "var(--cl-bad)"}
              />
            </g>
          );
        })}

        {ITERS.filter((d) => (d.it >= PULL_ITERS[0] && d.it % 10 === 0) || d.it === PULL_ITERS[0]).map(({ it: k }) => (
          <text key={k} x={x(k)} y={qH + 14} fontSize={10} textAnchor="middle" fill="var(--cl-muted)">
            {k}
          </text>
        ))}
        {joins.map(([it, sid]) => (
          <g key={`j${it}${sid}`} pointerEvents="none">
            <line x1={x(it)} x2={x(it)} y1={22} y2={qH - 4} stroke="var(--cl-ink-2)" strokeWidth={1} opacity={0.35} />
            <circle cx={x(it)} cy={qH - 13} r={6.5} fill="var(--cl-surface)" stroke="var(--cl-ink-2)" strokeWidth={1.25} />
            <SvgGlyph name="plus" x={x(it)} y={qH - 13} size={9} color="var(--cl-ink)" />
          </g>
        ))}
        {hoverIt != null && (
          <g pointerEvents="none">
            <line x1={x(hoverIt)} x2={x(hoverIt)} y1={18} y2={qH - 4} stroke="var(--cl-muted)" strokeWidth={1} />
            {hp && <circle cx={x(hp.it)} cy={yq(hp.s!.q)} r={4} fill={color} stroke="var(--cl-surface)" strokeWidth={2} />}
          </g>
        )}
        <rect x={M.l} y={0} width={Math.max(0, W - M.l - M.r)} height={qH + 20} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHoverIt(null)} />
      </svg>

      <div className="text-[0.78rem]" style={{ color: "var(--cl-ink-2)" }}>
        {hj.length > 0 && !hp ? (
          <span>
            <b>Iteration {hoverIt}</b> · new supporting scenario{hj.length > 1 ? "s" : ""}{" "}
            {hj.map(([, sid]) => sid).join(", ")} joined P{p}
          </span>
        ) : hp ? (
          <span>
            <b>Iteration {hp.it}</b> · pull probability {pct(hp.s!.q)} · rank {hp.s!.rank} of {hp.d.scores!.length} ·{" "}
            {hp.s!.n} supporting scenario{hp.s!.n === 1 ? "" : "s"}
            {hp.d.chosen === p && <b style={{ color: "var(--cl-accent)" }}> · sampled</b>}
            {hj.length > 0 && <> · new scenario {hj.map(([, sid]) => sid).join(", ")} joined</>}
          </span>
        ) : (
          <span style={{ color: "var(--cl-muted)" }}>
            Hover the chart for per-iteration values · {lastN} supporting scenario{lastN === 1 ? "" : "s"} at the end of the run ·
            <Icon name="check" size={10} className="mx-0.5" /> patch accepted,
            <Icon name="x" size={10} className="mx-0.5" /> rejected,
            <Icon name="ring" size={10} className="mx-0.5" /> batch already passing
            {joins.length > 0 && (
              <>
                , <Icon name="plus" size={10} className="mx-0.5" /> new supporting scenario joined
              </>
            )}
            {earlyJoins > 0 && <> ({earlyJoins} more joined before iteration {x0})</>}
          </span>
        )}
      </div>

      {note && (
        <div className="rounded-lg px-3 py-2 text-[0.8rem] leading-relaxed" style={{ background: "var(--cl-surface-2)", color: "var(--cl-ink-2)" }}>
          <div className="mb-0.5 text-[0.7rem] font-semibold tracking-wide uppercase" style={{ color: "var(--cl-muted)" }}>
            Arm Prioritizer note · iteration {noteIt}
          </div>
          “{note}”
        </div>
      )}

      {pulls.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[0.75rem]">
          <span style={{ color: "var(--cl-muted)" }}>Replay its pulls:</span>
          {pulls.map((d) => (
            <button
              key={d.it}
              type="button"
              onClick={() => requestSeek(d.it)}
              className="rounded-full px-2 py-0.5 font-medium"
              style={{ background: "var(--cl-accent-soft)", color: "var(--cl-accent)" }}
            >
              <Icon name="play" size={9} className="mr-1 -mt-px" />
              iteration {d.it}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
