import type { Sequence, SequenceEntry } from "./journey/sequence.ts";

/**
 * Hash for a sequence entry, namespaced by kind — `#intro-1`, `#stop-3`,
 * `#outro-2`. Namespacing keeps existing `#stop-n` links pointing at the same
 * stop no matter how many intro cards are added in front of it.
 */
function hashFor(entry: SequenceEntry): string {
  return `#${entry.kind}-${entry.ordinal + 1}`;
}

/**
 * Sequence position encoded in the current URL hash, or null when the hash is
 * absent, malformed, or names an entry the deck does not have.
 */
export function positionFromHash(sequence: Sequence): number | null {
  const match = /^#(intro|stop|outro)-(\d+)$/.exec(window.location.hash);
  if (!match) return null;

  const kind = match[1] as SequenceEntry["kind"];
  const ordinal = Number(match[2]) - 1;
  if (!Number.isInteger(ordinal) || ordinal < 0) return null;

  const position = sequence.entries.findIndex(
    (entry) => entry.kind === kind && entry.ordinal === ordinal,
  );
  return position === -1 ? null : position;
}

/**
 * Rewrites the hash without pushing a history entry, so the back button still
 * leaves the deck instead of stepping through every card.
 */
export function replaceHash(entry: SequenceEntry): void {
  const next = hashFor(entry);
  if (window.location.hash === next) return;
  window.history.replaceState(null, "", next);
}
