// Inline glyphs: Noto Sans has no ✓ ✕ ◆ ▶, so draw them.

type IconName = "check" | "x" | "ring" | "diamond" | "dot" | "play" | "plus";

const PATHS: Record<IconName, React.ReactNode> = {
  check: <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  x: <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  ring: <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />,
  diamond: <rect x="4.2" y="4.2" width="7.6" height="7.6" transform="rotate(45 8 8)" fill="none" stroke="currentColor" strokeWidth="2" />,
  dot: <circle cx="8" cy="8" r="4.2" fill="currentColor" />,
  play: <path d="M5 3.5l7.5 4.5L5 12.5z" fill="currentColor" />,
  plus: <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />,
};

export function Icon({ name, size = 12, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className={className} style={{ display: "inline-block", flexShrink: 0 }}>
      {PATHS[name]}
    </svg>
  );
}

/** The same glyph as SVG children, centred at (x, y), for use inside an existing <svg>. */
export function SvgGlyph({ name, x, y, size = 10, color }: { name: IconName; x: number; y: number; size?: number; color: string }) {
  const s = size / 16;
  return (
    <g transform={`translate(${x - size / 2}, ${y - size / 2}) scale(${s})`} style={{ color }}>
      {PATHS[name]}
    </g>
  );
}
