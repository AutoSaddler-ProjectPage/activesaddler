import { useCallback, useEffect, useRef, useState } from "react";
import ArmRace from "./ArmRace";
import Controls from "./Controls";
import DecisionPanel from "./DecisionPanel";
import SamplingStrip from "./SamplingStrip";
import StatStrip from "./StatStrip";
import Timeline from "./Timeline";
import { ARMS, ITERS, LAST_IT, REPLAY, armColor, iterAt, loadRationales, pct, rankOf, scoresAt } from "./data";
import { useElementHeight, useElementWidth, useReducedMotion, useVisibility } from "./hooks";
import { onSeek } from "./store";
import type { Rationales } from "./types";
import { Icon } from "./icons";

// Phase schedule within one iteration at 1× (ms from the iteration's start).
// 0 decide → 1 re-score arms → 2 needle glides → 3 outcome, then dwell and advance.
const PULL = { score: 350, sample: 800, spin: 650, dwell: 1500 };
const DRAW = { score: 350, outcome: 1000, dwell: 1000 };

/** Fixed bar-race scale across the whole run, so bar lengths compare between iterations. */
const X_MAX = (() => {
  let m = 0;
  for (const d of ITERS) {
    if (!d.scores) continue;
    const q = [...d.scores].sort((a, b) => b.q - a.q);
    m = Math.max(m, q[0].q, q.slice(10).reduce((s, x) => s + x.q, 0));
  }
  return Math.ceil(m * 10) / 10;
})();

export default function CurriculumReplay() {
  const reduced = useReducedMotion();
  const [rootRef, width] = useElementWidth<HTMLDivElement>(1100);
  const [it, setIt] = useState(1);
  // Each phase is tagged with its iteration, so the first render after a seek
  // is already phase 0 (never a stale "landed" that would teleport the needle).
  const [phaseOf, setPhaseOf] = useState({ it: 1, phase: 3 });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [focusArm, setFocusArm] = useState<number | null>(null);
  const [rationales, setRationales] = useState<Rationales | null>(null);
  const autoplayed = useRef(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const iter = iterAt(it);
  const isPull = iter.action === "pull";
  const twoCol = width >= 700;
  const [leftRef, leftWidth] = useElementWidth<HTMLDivElement>(420);
  // Rows put the label above the bar when the race column is narrow.
  const stackedRows = leftWidth < 520;
  // Fixed stage geometry, so nothing reflows while the replay plays:
  // - two columns: the fixed-height decision cards set the stage height, and the
  //   bar race stretches to fill it (more arms, rows spaced to fit);
  // - one column: the race reserves topN + 1 rows of the natural row height.
  const topN = twoCol ? 14 : width < 600 ? 6 : 10;
  const baseRowH = stackedRows ? 44 : 34;
  const stageH = 36 + 12 + 20 + 12 + (topN + 1) * baseRowH;
  const [raceRef, raceH] = useElementHeight<HTMLDivElement>((topN + 1) * baseRowH);
  const rowH = twoCol ? Math.max(baseRowH, Math.floor(raceH / (topN + 1))) : baseRowH;
  const animate = !reduced;
  const phase = !animate ? 3 : phaseOf.it === it ? phaseOf.phase : 0;

  useEffect(() => {
    loadRationales().then(setRationales, () => setRationales({}));
  }, []);

  // Run the phase sequence whenever the iteration changes.
  useEffect(() => {
    if (!animate) return;
    const k = 1 / speedRef.current;
    const timers: number[] = [];
    const at = (ms: number, p: number) =>
      timers.push(window.setTimeout(() => setPhaseOf({ it, phase: p }), ms * k));
    if (isPull) {
      at(PULL.score, 1);
      at(PULL.sample, 2);
      at(PULL.sample + PULL.spin, 3);
    } else {
      at(DRAW.score, 1);
      at(DRAW.outcome, 3);
    }
    return () => timers.forEach(clearTimeout);
  }, [it, isPull, animate]);

  // Advance after the outcome has had its dwell time.
  useEffect(() => {
    if (!playing || phase !== 3) return;
    if (it >= LAST_IT) {
      setPlaying(false);
      return;
    }
    const dwell = (isPull ? PULL.dwell : DRAW.dwell) / speed;
    const t = window.setTimeout(() => setIt((v) => Math.min(LAST_IT, v + 1)), dwell);
    return () => clearTimeout(t);
  }, [playing, phase, it, isPull, speed]);

  const seek = useCallback((k: number) => {
    setFocusArm(null);
    setIt(Math.max(1, Math.min(LAST_IT, k)));
  }, []);

  // Cross-island seeks from the Arm Lifecycle Explorer.
  useEffect(
    () =>
      onSeek((k) => {
        setPlaying(false);
        seek(k);
        rootRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }),
    [seek, reduced, rootRef],
  );

  // Autoplay the first time the demo is on screen; pause when it scrolls away.
  useVisibility(rootRef, (visible) => {
    if (visible && !autoplayed.current && !reduced) {
      autoplayed.current = true;
      setPlaying(true);
    } else if (!visible) {
      setPlaying(false);
    }
  });

  const toggle = () => {
    if (playing) return setPlaying(false);
    if (it >= LAST_IT) seek(1);
    setPlaying(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setPlaying(false);
      seek(it + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPlaying(false);
      seek(it - 1);
    } else if (e.key === " " && e.target === e.currentTarget) {
      e.preventDefault();
      toggle();
    }
  };

  const shown = phase >= 1 ? scoresAt(it) : scoresAt(it - 1);
  const chosenArm = isPull ? ARMS.find((a) => a.p === iter.chosen) : undefined;
  const chosenScore = isPull ? iter.scores!.find((s) => s.p === iter.chosen) : undefined;
  const chosenRank = chosenScore ? rankOf(iter.scores!, chosenScore.p) : 0;
  const pool = ARMS.filter((a) => a.created < it);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Curriculum Replay: interactive replay of ActiveSaddler's curriculum on GAIA2"
      className="cl-root not-prose relative scroll-mt-6 rounded-2xl border p-3 outline-none focus-visible:ring-2 sm:p-5"
      style={{ background: "var(--cl-surface)", borderColor: "var(--cl-border)", boxShadow: "var(--cl-shadow)" }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`inline-block size-2.5 shrink-0 rounded-full ${playing ? "cl-live-dot" : ""}`}
            style={{ background: playing ? "var(--cl-accent)" : "var(--cl-muted)" }}
          />
          <div className="min-w-0">
            <div className="text-[0.95rem] font-semibold" style={{ color: "var(--cl-ink)" }}>
              Curriculum Replay
            </div>
            <div className="text-[0.75rem]" style={{ color: "var(--cl-muted)" }}>
              The real {REPLAY.meta.run} optimization run · {LAST_IT} iterations ·{" "}
              {ITERS[ITERS.length - 1].rollouts.toLocaleString("en-US")} rollouts
            </div>
          </div>
        </div>
        <Controls
          playing={playing}
          atEnd={it >= LAST_IT}
          speed={speed}
          onToggle={toggle}
          onStep={(d) => {
            setPlaying(false);
            seek(it + d);
          }}
          onRestart={() => {
            seek(1);
            setPlaying(true);
          }}
          onSpeed={setSpeed}
        />
      </div>

      {/* models and reasoning effort, so the cost figures can be read in context */}
      <div className="mb-3 text-[0.75rem]" style={{ color: "var(--cl-muted)" }}>
        Task agent: <code className="font-mono">gpt-5.5</code> (reasoning: medium) · Optimizer: <code className="font-mono">gpt-5.5</code>{" "}
        (reasoning: xhigh) · Cost covers both
      </div>

      <StatStrip iter={iter} animate={animate} width={width} />

      {/* Navigation (stats + timeline) sits above the stage, so it never moves. */}
      <div className="mt-4 border-b pb-4" style={{ borderColor: "var(--cl-border)" }}>
        <Timeline
          it={it}
          onSeek={(k) => {
            setPlaying(false);
            seek(k);
          }}
        />
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem]" style={{ color: "var(--cl-muted)" }}>
          <Legend glyph={<circle cx="6" cy="6" r="4" fill="var(--cl-accent)" />}>Pull a failure-pattern arm</Legend>
          <Legend glyph={<rect x="2.5" y="2.5" width="7" height="7" transform="rotate(45 6 6)" fill="none" stroke="var(--cl-draw)" strokeWidth="2" />}>
            Draw unseen scenarios
          </Legend>
          <Legend glyph={<circle cx="6" cy="6" r="4" fill="var(--cl-good)" />}>New best dev accuracy</Legend>
          <Legend
            glyph={
              <>
                <circle cx="6" cy="6" r="4" fill="var(--cl-ink-2)" />
                <path d="M4.2 6.1l1.2 1.2 2.5-2.6" fill="none" stroke="var(--cl-surface)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </>
            }
          >
            Patch accepted
          </Legend>
          <Legend glyph={<circle cx="6" cy="6" r="3" fill="none" stroke="var(--cl-muted)" strokeWidth="1.25" />}>Dev evaluation</Legend>
          <span className="ml-auto hidden sm:inline">Drag the timeline · ← → to step · space to play</span>
        </div>
      </div>

      <div
        className="mt-4 grid items-stretch gap-4"
        style={{ gridTemplateColumns: twoCol ? "minmax(0,1.1fr) minmax(0,1fr)" : "minmax(0,1fr)" }}
      >
        <div ref={leftRef} data-stage className="flex min-w-0 flex-col gap-3">
          {/* title and note on fixed lines, so the heading height never changes */}
          <div className="flex flex-col">
            <h4 className="m-0 text-[0.85rem] font-semibold" style={{ color: "var(--cl-ink)" }}>
              Pull probability across the arm pool
            </h4>
            <span className="truncate text-[0.72rem]" style={{ color: "var(--cl-muted)" }}>
              {shown
                ? shown.from === it
                  ? `scored at iteration ${it}`
                  : `last scored at iteration ${shown.from}`
                : "no arm scored yet"}
            </span>
          </div>

          <div
            className={`flex flex-col gap-3 ${twoCol ? "min-h-0 flex-1" : ""}`}
            style={twoCol ? undefined : { height: stageH }}
          >
          {shown ? (
            <>
              <SamplingStrip
                it={it}
                scores={shown.scores}
                chosen={iter.chosen}
                spinning={phase === 2}
                landed={phase >= 3}
                isDraw={!isPull && phase >= 1}
                durationMs={PULL.spin / speed}
                animate={animate}
              />
              <div className="flex min-h-5 items-center gap-2 text-[0.78rem]" style={{ color: "var(--cl-ink-2)" }}>
                {isPull ? (
                  <>
                    <span style={{ color: "var(--cl-muted)" }}>Sampled arm</span>
                    {phase >= 3 && chosenArm && chosenScore ? (
                      <span className="cl-pop inline-flex items-center gap-1.5 font-semibold">
                        →
                        <span className="inline-block size-2.5 rounded-full" style={{ background: armColor(chosenArm.p) }} />
                        P{chosenArm.p}
                        <span className="font-normal" style={{ color: "var(--cl-muted)" }}>
                          ({pct(chosenScore.q)}, rank {chosenRank} of {iter.scores!.length})
                        </span>
                      </span>
                    ) : phase === 2 ? (
                      <span style={{ color: "var(--cl-muted)" }}>sampling…</span>
                    ) : null}
                  </>
                ) : (
                  <span style={{ color: "var(--cl-draw)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="diamond" size={11} /> Draw: {iter.batch.length} unseen scenarios instead of an arm
                    </span>
                  </span>
                )}
              </div>
              <div ref={raceRef} className="min-h-0 flex-1">
              <ArmRace
                rowH={rowH}
                scores={shown.scores}
                scoredAt={shown.from}
                chosen={isPull && phase >= 1 ? iter.chosen : undefined}
                revealChosen={isPull && phase >= 3}
                dimmed={!isPull && phase >= 1}
                compact={stackedRows}
                top={topN}
                focusArm={focusArm}
                onFocusArm={setFocusArm}
                xMax={X_MAX}
              />
              </div>
            </>
          ) : (
            <div
              className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center"
              style={{ borderColor: "var(--cl-border)" }}
            >
              <p className="m-0 max-w-md text-[0.85rem]" style={{ color: "var(--cl-ink-2)" }}>
                {pool.length === 0
                  ? "The arm pool starts empty. The controller must draw unseen scenarios to discover failure patterns."
                  : `${pool.length} failure-pattern arm${pool.length > 1 ? "s" : ""} discovered, not yet scored. The Arm Prioritizer runs on the first pull.`}
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {pool.map((a) => (
                  <span
                    key={a.p}
                    title={a.label}
                    className="cl-pop inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.72rem] font-semibold"
                    style={{ background: "var(--cl-surface-3)", color: "var(--cl-ink-2)" }}
                  >
                    <span className="inline-block size-2 rounded-full" style={{ background: armColor(a.p) }} />P{a.p}
                  </span>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>

        <DecisionPanel iter={iter} phase={phase} focusArm={focusArm} rationales={rationales} />
      </div>

    </div>
  );
}

function Legend({ glyph, children }: { glyph: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        {glyph}
      </svg>
      {children}
    </span>
  );
}
