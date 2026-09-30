"""Generate per-arm colour tokens (--arm-p1 .. --arm-p35) for the demos.

The ten most-probable arms keep the paper's series colours (``slot``), so the
page matches the PDF figures.  The other arms get a harmonious companion set:

* hierarchy: softer and a touch lighter than the anchors, so the top-10 still
  lead the eye;
* harmony: one chroma and two lightness tiers, hues spread evenly through the
  gaps between the anchor hues on the OKLCH wheel (no muddy olives/browns);
* separation: arms that touch in the stacking order (paper top-10 first, then
  the rest by creation, as in the hero figure and the sampling strip) get
  hues far apart.

Writes src/styles/arm-colors.css.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPLAY = ROOT / "src" / "components" / "Curriculum" / "data" / "replay.json"
OUT = ROOT / "src" / "styles" / "arm-colors.css"

SERIES_LIGHT = ["#2a78d6", "#e67e22", "#16a085", "#eda100", "#e87ba4",
                "#008300", "#4a3aa7", "#e74c3c", "#00b4c8", "#a16207"]
SERIES_DARK = ["#2a78d6", "#d87106", "#16a085", "#cc8200", "#d56a93",
               "#008300", "#6358c7", "#e74c3c", "#00a6ba", "#a16207"]

# companion tones: (lightness tiers, chroma) per surface
TONE = {"light": ((0.68, 0.76), 0.115), "dark": ((0.57, 0.64), 0.112)}
L_CAP = {"light": 0.77, "dark": 0.665}
MIN_GAP_TO_ANCHOR = 9.0  # degrees of hue kept clear around each anchor


def lin(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def delin(c: float) -> float:
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_to_oklch(h: str) -> tuple[float, float, float]:
    r, g, b = (lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360


def oklch_to_hex(L: float, C: float, H: float) -> str:
    """OKLCH → sRGB hex, reducing chroma until the colour is in gamut."""
    while True:
        a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
        l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
        m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
        s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
        rgb = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
               -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
               -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
        if all(-1e-4 <= c <= 1 + 1e-4 for c in rgb) or C < 0.02:
            return "#" + "".join(f"{round(delin(min(1, max(0, c))) * 255):02x}" for c in rgb)
        C -= 0.004


def companion_hues(anchors: list[str], n: int) -> list[float]:
    """n hues spread through the gaps between anchor hues, proportional to gap size."""
    hs = sorted(hex_to_oklch(h)[2] for h in anchors)
    gaps = [((hs[(i + 1) % len(hs)] - hs[i]) % 360 or 360, hs[i]) for i in range(len(hs))]
    usable = [(g - 2 * MIN_GAP_TO_ANCHOR, start) for g, start in gaps]
    total = sum(max(0.0, g) for g, _ in usable)
    # largest-remainder allocation of n slots across gaps
    raw = [max(0.0, g) / total * n for g, _ in usable]
    count = [int(r) for r in raw]
    for i in sorted(range(len(raw)), key=lambda i: raw[i] - count[i], reverse=True)[: n - sum(count)]:
        count[i] += 1
    out = []
    for (g, start), k in zip(usable, count):
        for j in range(k):
            out.append((start + MIN_GAP_TO_ANCHOR + g * (j + 0.5) / k) % 360)
    return sorted(out)


def palette(anchors: list[str], n: int, mode: str) -> list[str]:
    (l_lo, l_hi), chroma = TONE[mode]
    hues = companion_hues(anchors, n)
    cols = []
    for i, h in enumerate(hues):
        L = l_hi if i % 2 else l_lo
        # yellows/greens need more light to stay clean; blues/violets less
        if 70 <= h <= 130:
            L = min(L + 0.03, L_CAP[mode])
        elif 250 <= h <= 310:
            L -= 0.03
        cols.append(oklch_to_hex(L, chroma, h))
    return cols


def oklab(h: str) -> tuple[float, float, float]:
    L, C, H = hex_to_oklch(h)
    return L, C * math.cos(math.radians(H)), C * math.sin(math.radians(H))


def stack_order(arms: list[dict]) -> list[int]:
    """Top-10 in paper order, then the rest by creation (STACK_ORDER in data.ts)."""
    named = sorted((a for a in arms if a["slot"] is not None), key=lambda a: a["slot"])
    return [a["p"] for a in named] + [a["p"] for a in arms if a["slot"] is None]


def assign(arms: list[dict], series: list[str], pool: list[str]) -> dict[int, str]:
    """Give the free arms the pool colours so that arms touching in the stacking
    order differ as much as possible, anchors included.
    Swap-based hill climbing on the worst neighbouring pair, seeded."""
    order = stack_order(arms)
    fixed = {a["p"]: series[a["slot"]] for a in arms if a["slot"] is not None}
    free = [p for p in order if p not in fixed]
    lab = {c: oklab(c) for c in list(fixed.values()) + pool}

    def score(perm: list[str]) -> tuple[float, float]:
        col = {**fixed, **dict(zip(free, perm))}
        seq = [lab[col[p]] for p in order]
        d1 = [math.dist(seq[i], seq[i + 1]) for i in range(len(seq) - 1)]
        d2 = [math.dist(seq[i], seq[i + 2]) for i in range(len(seq) - 2)]
        return (min(min(d1), 1.4 * min(d2)), sum(sorted(d1)[:5]))

    rng = random.Random(7)
    best = list(pool)
    best_s = score(best)
    for _ in range(40):  # restarts
        cur = list(pool)
        rng.shuffle(cur)
        cur_s = score(cur)
        for _ in range(4000):
            i, j = rng.randrange(len(cur)), rng.randrange(len(cur))
            cur[i], cur[j] = cur[j], cur[i]
            s = score(cur)
            if s >= cur_s:
                cur_s = s
            else:
                cur[i], cur[j] = cur[j], cur[i]
        if cur_s > best_s:
            best, best_s = list(cur), cur_s
    return {**fixed, **dict(zip(free, best))}


def main() -> None:
    arms = json.loads(REPLAY.read_text())["arms"]
    others = [a["p"] for a in arms if a["slot"] is None]
    extra = {
        mode: assign(arms, series, palette(series, len(others), mode))
        for mode, series in (("light", SERIES_LIGHT), ("dark", SERIES_DARK))
    }

    def block(mode: str, indent: str = "  ") -> str:
        lines = []
        own = extra[mode]
        for a in arms:
            value = f"var(--arm-{a['slot']})" if a["slot"] is not None else own[a["p"]]
            lines.append(f"{indent}--arm-p{a['p']}: {value};")
        return "\n".join(lines)

    OUT.write_text(f"""/* Generated by scripts/gen_arm_colors.py; do not edit by hand.
   Top-10 arms use the paper's series (--arm-0..9); the rest get companion tones. */

.cl-root {{
{block("light")}
}}
[data-theme="dark"] .cl-root {{
{block("dark")}
}}
@media (prefers-color-scheme: dark) {{
  [data-theme="device"] .cl-root {{
{block("dark", "    ")}
  }}
}}

""")
    for mode in ("light", "dark"):
        own = extra[mode]
        series = SERIES_LIGHT if mode == "light" else SERIES_DARK
        order = [series[a["slot"]] if a["slot"] is not None else own[a["p"]] for a in arms]
        print(f"{mode}: {','.join(order)}")


if __name__ == "__main__":
    main()
