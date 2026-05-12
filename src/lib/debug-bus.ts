// Tiny event bus for visible auth debugging.
// Logs go to console AND to an in-page overlay (<DebugOverlay />)
// so we can diagnose freezes when devtools are unreachable.

export type DebugEntry = {
  id: number;
  ts: number;
  tag: string;
  message: string;
  data?: unknown;
};

const listeners = new Set<(entries: DebugEntry[]) => void>();
const entries: DebugEntry[] = [];
let nextId = 1;
const MAX = 200;

// Counters keyed by tag — useful to detect render/event loops.
const counters = new Map<string, number>();

export function dlog(tag: string, message: string, data?: unknown) {
  const count = (counters.get(tag) ?? 0) + 1;
  counters.set(tag, count);

  const entry: DebugEntry = {
    id: nextId++,
    ts: Date.now(),
    tag: `${tag}#${count}`,
    message,
    data,
  };
  entries.push(entry);
  if (entries.length > MAX) entries.splice(0, entries.length - MAX);

  // eslint-disable-next-line no-console
  console.log(`[${entry.tag}] ${message}`, data ?? "");

  // Loud warning if any tag fires too often (likely loop).
  if (count === 50 || count === 200 || count === 1000) {
    // eslint-disable-next-line no-console
    console.error(
      `[debug-bus] ⚠️ tag "${tag}" has fired ${count} times — possible loop`,
    );
  }

  for (const fn of listeners) fn(entries.slice());
}

export function subscribeDebug(fn: (entries: DebugEntry[]) => void) {
  listeners.add(fn);
  fn(entries.slice());
  return () => {
    listeners.delete(fn);
  };
}

export function clearDebug() {
  entries.length = 0;
  counters.clear();
  for (const fn of listeners) fn([]);
}

export function getCounters() {
  return Object.fromEntries(counters);
}
