import type { ReactNode } from "react";

type Props = {
  playing: boolean;
  atEnd: boolean;
  speed: number;
  onToggle: () => void;
  onStep: (delta: number) => void;
  onRestart: () => void;
  onSpeed: (s: number) => void;
};

export const SPEEDS = [1, 2, 4];

function IconButton({
  label,
  onClick,
  children,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full transition-colors"
      style={
        primary
          ? { background: "var(--cl-ink)", color: "var(--cl-surface)", width: 38, height: 38 }
          : { background: "var(--cl-surface-3)", color: "var(--cl-ink-2)" }
      }
    >
      {children}
    </button>
  );
}

const svg = (d: string, fill = true) => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
    <path
      d={d}
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Controls({ playing, atEnd, speed, onToggle, onStep, onRestart, onSpeed }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <IconButton label="Restart" onClick={onRestart}>
        {svg("M3 3v4h4M3.5 7A5 5 0 1 1 3 9.5", false)}
      </IconButton>
      <IconButton label="Previous iteration (←)" onClick={() => onStep(-1)}>
        {svg("M10 3 5 8l5 5", false)}
      </IconButton>
      <IconButton label={playing ? "Pause (space)" : atEnd ? "Replay from start" : "Play (space)"} onClick={onToggle} primary>
        {playing ? svg("M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z") : svg("M5 3l8 5-8 5z")}
      </IconButton>
      <IconButton label="Next iteration (→)" onClick={() => onStep(1)}>
        {svg("M6 3l5 5-5 5", false)}
      </IconButton>
      <div
        className="ml-1 flex rounded-full p-0.5 text-[0.72rem] font-semibold"
        style={{ background: "var(--cl-surface-3)" }}
        role="radiogroup"
        aria-label="Playback speed"
      >
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={speed === s}
            onClick={() => onSpeed(s)}
            className="rounded-full px-2 py-1"
            style={
              speed === s
                ? { background: "var(--cl-surface)", color: "var(--cl-ink)", boxShadow: "var(--cl-shadow)" }
                : { color: "var(--cl-muted)" }
            }
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
