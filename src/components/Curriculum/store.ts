// A tiny cross-island channel: the Arm Lifecycle Explorer asks the Curriculum
// Replay (a separate Astro island) to jump to an iteration.

const bus = new EventTarget();
const SEEK = "cl-seek";

export function requestSeek(it: number): void {
  bus.dispatchEvent(new CustomEvent<number>(SEEK, { detail: it }));
}

export function onSeek(handler: (it: number) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<number>).detail);
  bus.addEventListener(SEEK, listener);
  return () => bus.removeEventListener(SEEK, listener);
}
