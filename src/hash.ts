const PREFIX = "stop-";

/** Hash for a zero-based stop index, e.g. `#stop-3` for index 2. */
export function hashFor(index: number): string {
  return `#${PREFIX}${index + 1}`;
}

/**
 * Zero-based stop index encoded in the current URL hash, or null when the hash
 * is absent, malformed, or outside `stopCount`.
 */
export function indexFromHash(stopCount: number): number | null {
  const match = /^#stop-(\d+)$/.exec(window.location.hash);
  if (!match) return null;

  const index = Number(match[1]) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= stopCount) return null;
  return index;
}

/**
 * Rewrites the hash without pushing a history entry, so the back button still
 * leaves the deck instead of stepping through every stop.
 */
export function replaceHash(index: number): void {
  const next = hashFor(index);
  if (window.location.hash === next) return;
  window.history.replaceState(null, "", next);
}
