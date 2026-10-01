import raw from "./data/replay.json";
import type { Arm, ArmScore, Iter, Rationales, Replay } from "./types";

export const REPLAY = raw as Replay;
export const ITERS: Iter[] = REPLAY.iters;
export const ARMS: Arm[] = REPLAY.arms;
export const ARM_BY_P: Map<number, Arm> = new Map(ARMS.map((a) => [a.p, a]));
export const LAST_IT = ITERS[ITERS.length - 1].it;
export const PULL_ITERS: number[] = ITERS.filter((i) => i.action === "pull").map(
  (i) => i.it,
);

export const iterAt = (it: number): Iter => ITERS[it - 1];

/**
 * Colour token for an arm (src/styles/arm-colors.css): top-10 arms keep the
 * paper's series colour, the rest have companion tones.
 */
export const armColor = (p: number): string => `var(--arm-p${p})`;

/** The most recent scored distribution at or before `it` (draw iterations carry it forward). */
export function scoresAt(it: number): { from: number; scores: ArmScore[] } | null {
  for (let k = it; k >= 1; k--) {
    const s = ITERS[k - 1].scores;
    if (s) return { from: k, scores: s };
  }
  return null;
}

/**
 * Stacking order used by the paper's pull-probability figure: the top-10 arms
 * in paper order at the bottom, then every other arm by creation.
 */
export const STACK_ORDER: number[] = [
  ...ARMS.filter((a) => a.slot != null).sort((a, b) => a.slot! - b.slot!),
  ...ARMS.filter((a) => a.slot == null),
].map((a) => a.p);
const STACK_RANK = new Map(STACK_ORDER.map((p, i) => [p, i]));
export const stackRank = (p: number): number => STACK_RANK.get(p) ?? 0;

/** Cumulative band edges of one arm-selection iteration, bands in STACK_ORDER. */
export type StreamCol = { it: number; y0: number[]; y1: number[] };
/**
 * The pull-probability stream (paper figure rq2_arm_lifecycle_grid_stack):
 * the named top-10 from the bottom in paper order, then the remaining arms.
 * Only the bottom layers of a stack read true, so the top-10 go there.
 * Shared by the hero figure and the Replay timeline's arm-focus lane.
 */
export const STREAM: StreamCol[] = ITERS.filter((d) => d.scores).map((d) => {
  const q = new Map(d.scores!.map((s) => [s.p, s.q]));
  let acc = 0;
  const y0: number[] = [];
  const y1: number[] = [];
  for (const p of STACK_ORDER) {
    y0.push(acc);
    acc += q.get(p) ?? 0;
    y1.push(acc);
  }
  return { it: d.it, y0, y1 };
});

/** First iteration at which each arm received a score. */
export const FIRST_SCORED: Map<number, number> = (() => {
  const m = new Map<number, number>();
  for (const i of ITERS)
    for (const s of i.scores ?? []) if (!m.has(s.p)) m.set(s.p, i.it);
  return m;
})();


let rationalePromise: Promise<Rationales> | null = null;
/** Verbatim LLM rationales are ~220 KB, so they load on demand in their own chunk. */
export function loadRationales(): Promise<Rationales> {
  rationalePromise ??= import("./data/rationales.json").then(
    (m) => (m.default ?? m) as Rationales,
  );
  return rationalePromise;
}

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

export const shortLabel = (label: string, max = 64) =>
  label.length <= max ? label : label.slice(0, max - 1).trimEnd() + "…";

/** Competition rank of arm p (ties share the better rank), as reported in the paper. */
export function rankOf(scores: ArmScore[], p: number): number {
  const q = scores.find((s) => s.p === p)?.q;
  if (q == null) return 0;
  return 1 + scores.filter((s) => s.q > q + 1e-9).length;
}
