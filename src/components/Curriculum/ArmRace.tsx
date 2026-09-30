import type { ArmScore } from "./types";
import { ARM_BY_P, FIRST_SCORED, armColor, rankOf, shortLabel } from "./data";

type Props = {
  scores: ArmScore[];
  /** Row pitch in px (set by the replay so the race fills its fixed stage). */
  rowH: number;
  /** Iteration the displayed distribution was scored at. */
  scoredAt: number;
  chosen?: number;
  /** Highlight the chosen row (after the needle lands). */
  revealChosen: boolean;
  dimmed: boolean;
  compact: boolean;
  /** How many arms get their own row before the rest fold into "+N other arms". */
  top: number;
  focusArm: number | null;
  onFocusArm: (p: number | null) => void;
  xMax: number;
};

/** Horizontal bar race of pull probabilities q_t(a); rows slide as ranks change. */
export default function ArmRace({
  scores,
  rowH,
  scoredAt,
  chosen,
  revealChosen,
  dimmed,
  compact,
  top,
  focusArm,
  onFocusArm,
  xMax,
}: Props) {
  const ranked = [...scores].sort((a, b) => b.q - a.q);
  let shown = ranked.slice(0, top);
  if (chosen != null && !shown.some((s) => s.p === chosen)) {
    const c = ranked.find((s) => s.p === chosen);
    if (c) shown = [...shown.slice(0, top - 1), c];
  }
  const rest = ranked.filter((s) => !shown.some((x) => x.p === s.p));
  const restMass = rest.reduce((acc, s) => acc + s.q, 0);

  return (
    <div
      className="relative"
      // height is reserved for top + 1 rows regardless of pool size (no reflow)
      style={{ height: (top + 1) * rowH, opacity: dimmed ? 0.4 : 1, transition: "opacity 400ms" }}
      role="list"
      aria-label="Pull probability per failure-pattern arm"
    >
      {shown.map((s, idx) => {
        const arm = ARM_BY_P.get(s.p)!;
        const isChosen = revealChosen && s.p === chosen;
        const isNew = FIRST_SCORED.get(s.p) === scoredAt;
        const isFocus = focusArm === s.p;
        const rankInPool = rankOf(scores, s.p);
        return (
          <button
            type="button"
            role="listitem"
            key={s.p}
            onMouseEnter={() => onFocusArm(s.p)}
            onMouseLeave={() => onFocusArm(null)}
            onFocus={() => onFocusArm(s.p)}
            onBlur={() => onFocusArm(null)}
            title={`P${s.p} · ${arm.label}\npull probability ${(s.q * 100).toFixed(1)}% · rank ${rankInPool}`}
            className="cl-fade absolute inset-x-0 flex cursor-default items-center gap-3 rounded-md px-2 text-left"
            style={{
              height: rowH - 4,
              transform: `translateY(${idx * rowH}px)`,
              transition:
                "transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 200ms",
              background: isChosen
                ? "var(--cl-accent-soft)"
                : isFocus
                  ? "var(--cl-surface-3)"
                  : "transparent",
              flexDirection: compact ? "column" : "row",
              alignItems: compact ? "stretch" : "center",
              justifyContent: "center",
              gap: compact ? 3 : 12,
            }}
          >
            <span
              className="flex min-w-0 items-center gap-2 text-[0.8rem] leading-tight"
              style={{ flex: compact ? "none" : "0 0 46%" }}
            >
              <span
                aria-hidden
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: armColor(s.p) }}
              />
              <span className="shrink-0 font-semibold" style={{ color: "var(--cl-ink)" }}>
                P{s.p}
              </span>
              <span className="truncate" style={{ color: "var(--cl-ink-2)" }}>
                {shortLabel(arm.label, 90)}
              </span>
              {isNew && (
                <span
                  className="shrink-0 rounded px-1 text-[0.62rem] font-bold tracking-wide"
                  style={{ background: "var(--cl-good-soft)", color: "var(--cl-good)" }}
                >
                  NEW
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="relative h-3.5 flex-1">
                <span
                  className="absolute inset-y-0 left-0 rounded-r"
                  style={{
                    width: `${Math.min(100, (s.q / xMax) * 100)}%`,
                    minWidth: 2,
                    background: armColor(s.p),
                    transition: "width 600ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                  }}
                />
              </span>
              <span
                className="w-12 shrink-0 text-right text-[0.78rem] font-medium"
                style={{ color: isChosen ? "var(--cl-accent)" : "var(--cl-ink-2)" }}
              >
                {(s.q * 100).toFixed(1)}%
              </span>
              <span
                aria-label={isChosen ? "sampled arm" : undefined}
                className="flex w-4 shrink-0 justify-center"
                style={{ color: "var(--cl-accent)" }}
              >
                {isChosen ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                    <path
                      d="M3 8.5l3 3 7-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </span>
            </span>
          </button>
        );
      })}
      {rest.length > 0 && (
        <div
          role="listitem"
          className="absolute inset-x-0 flex items-center gap-3 px-2"
          style={{
            height: rowH - 4,
            transform: `translateY(${shown.length * rowH}px)`,
            transition: "transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            flexDirection: compact ? "column" : "row",
            alignItems: compact ? "stretch" : "center",
            justifyContent: "center",
            gap: compact ? 3 : 12,
          }}
        >
          <span
            className="flex items-center gap-2 text-[0.8rem]"
            style={{ flex: compact ? "none" : "0 0 46%", color: "var(--cl-muted)" }}
          >
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full"
              style={{ background: "var(--arm-other)" }}
            />
            +{rest.length} other arm{rest.length > 1 ? "s" : ""}
          </span>
          <span className="flex flex-1 items-center gap-2">
            <span className="relative h-3.5 flex-1">
              <span
                className="absolute inset-y-0 left-0 rounded-r"
                style={{
                  width: `${Math.min(100, (restMass / xMax) * 100)}%`,
                  minWidth: 2,
                  background: "var(--arm-other)",
                  transition: "width 600ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              />
            </span>
            <span
              className="w-12 shrink-0 text-right text-[0.78rem]"
              style={{ color: "var(--cl-muted)" }}
            >
              {(restMass * 100).toFixed(1)}%
            </span>
            <span className="w-4 shrink-0" />
          </span>
        </div>
      )}
    </div>
  );
}
