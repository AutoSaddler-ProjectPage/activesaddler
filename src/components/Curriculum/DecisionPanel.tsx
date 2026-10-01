import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Iter, Rationales } from "./types";
import { ARM_BY_P, armColor, iterAt, pct, rankOf } from "./data";
import { Icon } from "./icons";

// Fixed card heights (px): content changes inside, the layout never reflows.
// Long text is clamped; only an explicit "Show full reasoning" click grows a card.
const CARD_H = { controller: 242, prioritizer: 393, outcome: 151 };

type Props = {
  iter: Iter;
  /** 0 decide · 1 score · 2 sample · 3 outcome */
  phase: number;
  focusArm: number | null;
  rationales: Rationales | null;
};

function Card({
  step,
  title,
  active,
  minHeight,
  children,
}: {
  step: string;
  title: string;
  active: boolean;
  minHeight: number;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-xl border p-3.5"
      style={{
        minHeight,
        borderColor: active ? "var(--cl-accent)" : "var(--cl-border)",
        background: "var(--cl-surface)",
        boxShadow: active ? "0 0 0 3px var(--cl-accent-soft)" : "none",
        transition: "border-color 300ms, box-shadow 300ms",
      }}
    >
      <header className="mb-2 flex items-center gap-2">
        <span
          className="flex size-5 items-center justify-center rounded-full text-[0.7rem] font-bold"
          style={{
            background: active ? "var(--cl-accent)" : "var(--cl-surface-3)",
            color: active ? "var(--cl-surface)" : "var(--cl-muted)",
            transition: "background 300ms",
          }}
        >
          {step}
        </span>
        <h4 className="m-0 text-[0.8rem] font-semibold tracking-wide uppercase" style={{ color: "var(--cl-ink-2)" }}>
          {title}
        </h4>
      </header>
      {children}
    </section>
  );
}

function Clamp({ text, lines = 4 }: { text: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => setOpen(false), [text]);
  // Always clamp to `lines`; offer the toggle only when the text really overflows.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, open, lines]);
  return (
    <div>
      <p
        ref={ref}
        className="m-0 text-[0.82rem] leading-relaxed"
        style={{
          color: "var(--cl-ink-2)",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: open ? "unset" : lines,
          overflow: open ? "visible" : "hidden",
        }}
      >
        “{text}”
      </p>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1 text-[0.75rem] font-medium"
          style={{ color: "var(--cl-accent)" }}
        >
          {open ? "Show less" : "Show full reasoning"}
        </button>
      )}
    </div>
  );
}

function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "draw" | "pull" }) {
  const styles = {
    neutral: { background: "var(--cl-surface-3)", color: "var(--cl-ink-2)" },
    draw: { background: "var(--cl-draw-soft)", color: "var(--cl-draw)" },
    pull: { background: "var(--cl-accent-soft)", color: "var(--cl-accent)" },
  }[tone];
  return (
    <span className="cl-pop inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[0.72rem]" style={styles}>
      {children}
    </span>
  );
}

function AxisBar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex items-center gap-2 text-[0.75rem]">
      <span className="w-[6.8rem] shrink-0" style={{ color: "var(--cl-muted)" }} title={hint}>
        {label}
      </span>
      <span className="relative h-1.5 flex-1 rounded-full" style={{ background: "var(--cl-surface-3)" }}>
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${value * 100}%`,
            background: "var(--cl-ink-2)",
            transition: "width 500ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      </span>
      <span className="w-9 text-right font-medium" style={{ color: "var(--cl-ink)" }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-1.5" aria-hidden>
      {[92, 100, 76].map((w) => (
        <div key={w} className="h-2.5 animate-pulse rounded" style={{ width: `${w}%`, background: "var(--cl-surface-3)" }} />
      ))}
    </div>
  );
}

export default function DecisionPanel({ iter, phase, focusArm, rationales }: Props) {
  const isPull = iter.action === "pull";
  const rat = rationales?.[String(iter.it)];
  const forced = iter.numArms === 0;
  const prev = iter.it > 1 ? iterAt(iter.it - 1) : null;

  // Prioritizer shows the hovered arm if any, else the sampled one.
  const shownP = isPull ? (focusArm ?? iter.chosen!) : null;
  const scores = isPull ? iter.scores! : null;
  const score = scores?.find((s) => s.p === shownP) ?? null;
  const rank = score ? rankOf(scores!, score.p) : 0;
  const arm = shownP != null ? ARM_BY_P.get(shownP) : undefined;
  const armRationale = shownP != null ? rat?.arms?.[String(shownP)] : undefined;

  const out = iter.outcome;
  const k = iter.batch.length;
  const newBest = prev ? iter.bestDev > prev.bestDev + 1e-9 : false;

  return (
    <div className="flex flex-col gap-3">
      <Card step="1" title="Exploration Controller" active={phase === 0} minHeight={CARD_H.controller}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.78rem] font-bold tracking-wide"
            style={
              isPull
                ? { background: "var(--cl-accent-soft)", color: "var(--cl-accent)" }
                : { background: "var(--cl-draw-soft)", color: "var(--cl-draw)" }
            }
          >
            <Icon name={isPull ? "dot" : "diamond"} size={11} />
            {isPull ? "PULL a known arm" : "DRAW unseen scenarios"}
          </span>
          <span className="text-[0.75rem]" style={{ color: "var(--cl-muted)" }}>
            {iter.numArms} known arms · {iter.unseen} unseen scenarios
          </span>
        </div>
        {forced ? (
          <p className="m-0 text-[0.82rem]" style={{ color: "var(--cl-ink-2)" }}>
            Forced draw: the arm pool is still empty, so there is nothing to pull yet.
          </p>
        ) : rationales == null ? (
          <Skeleton />
        ) : rat?.decision ? (
          <Clamp text={rat.decision} />
        ) : null}
      </Card>

      <Card step="2" title="Arm Prioritizer" active={isPull && (phase === 1 || phase === 2)} minHeight={CARD_H.prioritizer}>
        {!isPull ? (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[0.82rem]" style={{ color: "var(--cl-muted)" }}>
              Not invoked on a draw. The batch is sampled from the unseen pool without replacement:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {phase >= 1 && iter.batch.map((s) => <Chip key={s} tone="draw">{s}</Chip>)}
            </div>
          </div>
        ) : score && arm ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <span className="mt-1 inline-block size-2.5 shrink-0 rounded-full" style={{ background: armColor(arm.p) }} />
              <p
                className="m-0 text-[0.84rem] leading-snug font-medium"
                title={arm.label}
                style={{ color: "var(--cl-ink)", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}
              >
                <span className="font-bold">P{arm.p}</span> · {arm.label}
                {focusArm != null && focusArm !== iter.chosen && (
                  <span className="ml-1.5 text-[0.7rem] font-normal" style={{ color: "var(--cl-muted)" }}>
                    (hovered)
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <AxisBar label="Severity" value={score.sev} />
              <AxisBar label="Fixability" value={score.fix} />
              <AxisBar label="Breadth" value={score.br} />
              <AxisBar label="1 − Side-effect" value={1 - score.se} hint="side-effect risk is inverted" />
            </div>
            <div
              className="rounded-lg px-2.5 py-2 text-[0.8rem] leading-relaxed"
              style={{ background: "var(--cl-surface-2)", color: "var(--cl-ink-2)" }}
            >
              <div>
                Pull probability <b style={{ color: "var(--cl-accent)" }}>{pct(score.q)}</b>
              </div>
              <div style={{ color: "var(--cl-muted)" }}>
                Rank {rank} of {scores!.length} · {score.n} supporting scenario{score.n === 1 ? "" : "s"}
              </div>
            </div>
            {rationales == null ? <Skeleton /> : armRationale ? <Clamp text={armRationale} lines={3} /> : null}
          </div>
        ) : (
          <p className="m-0 text-[0.82rem]" style={{ color: "var(--cl-muted)" }}>
            Hover an arm to inspect its scores.
          </p>
        )}
      </Card>

      <Card step="3" title="Harness optimizer outcome" active={phase === 3} minHeight={CARD_H.outcome}>
        {phase < 3 ? (
          <p className="m-0 text-[0.82rem]" style={{ color: "var(--cl-muted)" }}>
            Running the batch under the current harness…
          </p>
        ) : (
          <div className="cl-pop flex flex-col gap-2 text-[0.82rem]" style={{ color: "var(--cl-ink-2)" }}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span style={{ color: "var(--cl-muted)" }}>Batch</span>
              {iter.batch.map((s) => (
                <Chip key={s} tone={isPull ? "pull" : "draw"}>
                  {s}
                </Chip>
              ))}
            </div>
            {out && (
              <div className="flex flex-wrap items-center gap-2">
                {out.allPass ? (
                  <Status tone="good" icon="ring">
                    Batch already passes: the arm looks fixed, so no patch is needed
                  </Status>
                ) : out.accepted ? (
                  <Status tone="good" icon="check">
                    Patch accepted · train pass {Math.round((out.before ?? 0) * k)}/{k} → {Math.round((out.after ?? 0) * k)}/{k}
                  </Status>
                ) : (
                  <Status tone="bad" icon="x">
                    Patch rejected · no gain on the batch
                  </Status>
                )}
              </div>
            )}
            {iter.devEval != null && (
              <div>
                Dev evaluation: <b style={{ color: "var(--cl-ink)" }}>{pct(iter.devEval)}</b>
                {newBest && (
                  <span className="ml-2 rounded px-1.5 py-0.5 text-[0.72rem] font-bold" style={{ background: "var(--cl-good-soft)", color: "var(--cl-good)" }}>
                    ▲ NEW BEST {pct(iter.bestDev)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function Status({ tone, icon, children }: { tone: "good" | "bad"; icon: "check" | "x" | "ring"; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.78rem] font-medium"
      style={
        tone === "good"
          ? { background: "var(--cl-good-soft)", color: "var(--cl-good)" }
          : { background: "var(--cl-bad-soft)", color: "var(--cl-bad)" }
      }
    >
      <Icon name={icon} size={12} />
      {children}
    </span>
  );
}
