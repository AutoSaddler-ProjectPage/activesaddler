import type { Iter } from "./types";
import { LAST_IT, REPLAY } from "./data";
import { useTween } from "./hooks";

function Tile({
  label,
  value,
  sub,
  meter,
}: {
  label: React.ReactNode;
  value: string;
  sub?: React.ReactNode;
  meter?: number;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-0.5 rounded-xl px-3 py-2.5"
      style={{ background: "var(--cl-surface-2)" }}
    >
      <span className="truncate text-[0.72rem] font-medium" style={{ color: "var(--cl-muted)" }}>
        {label}
      </span>
      <span className="text-[1.3rem] leading-tight font-semibold" style={{ color: "var(--cl-ink)" }}>
        {value}
        {sub && (
          <span className="ml-1 text-[0.78rem] font-normal" style={{ color: "var(--cl-muted)" }}>
            {sub}
          </span>
        )}
      </span>
      {meter != null && (
        <span className="mt-1 h-1 w-full rounded-full" style={{ background: "var(--cl-surface-3)" }}>
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.min(1, meter) * 100}%`,
              background: "var(--cl-accent)",
              transition: "width 500ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          />
        </span>
      )}
    </div>
  );
}

export default function StatStrip({ iter, animate, width }: { iter: Iter; animate: boolean; width: number }) {
  const cols = width >= 700 ? 5 : width >= 460 ? 3 : 2;
  const arms = useTween(iter.numArms, 420, animate);
  const unseen = useTween(iter.unseen, 420, animate);
  const rollouts = useTween(iter.rollouts, 600, animate);
  const cost = useTween(iter.cost, 600, animate);
  const best = useTween(iter.bestDev * 100, 600, animate);
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      <Tile label="Iteration" value={String(iter.it)} sub={`/ ${LAST_IT}`} meter={iter.it / LAST_IT} />
      <Tile
        label="Arm pool"
        value={String(Math.round(arms))}
        sub="failure patterns"
      />
      <Tile
        label="Unseen scenarios"
        value={String(Math.round(unseen))}
        sub={`/ ${REPLAY.meta.trainScenarios}`}
      />
      <Tile
        label="Rollouts used"
        value={Math.round(rollouts).toLocaleString("en-US")}
        sub={`· $${Math.round(cost).toLocaleString("en-US")}`}
        meter={iter.rollouts / REPLAY.meta.budget}
      />
      <div style={{ gridColumn: cols === 2 ? "span 2" : undefined }}>
        <Tile label="Best dev accuracy" value={`${best.toFixed(1)}%`} />
      </div>
    </div>
  );
}
