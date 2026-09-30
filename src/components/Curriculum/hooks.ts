import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Width of an element, kept current with a ResizeObserver. */
export function useElementWidth<T extends HTMLElement>(
  fallback = 800,
): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Content-box width, matching what ResizeObserver reports below.
    const cs = getComputedStyle(el);
    setWidth(Math.round(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    const ro = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Height of an element, kept current with a ResizeObserver. */
export function useElementHeight<T extends HTMLElement>(
  fallback = 400,
): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setHeight(Math.round(el.clientHeight));
    const ro = new ResizeObserver(([entry]) => setHeight(Math.round(entry.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, height];
}

/** Calls back whenever the element's visibility crosses `threshold`. */
export function useVisibility(
  ref: RefObject<HTMLElement | null>,
  onChange: (visible: boolean) => void,
  threshold = 0.35,
): void {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => cb.current(entry.intersectionRatio >= threshold),
      { threshold: [0, threshold] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
}

/** Eases a displayed number toward `target` (for counters). */
export function useTween(target: number, duration = 420, enabled = true): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (!enabled) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const v0 = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const v = v0 + (target - v0) * e;
      from.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return value;
}
