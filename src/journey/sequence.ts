import type {
  Journey,
  JourneyCard,
  JourneyStop,
  PlacelessCard,
} from "./schema.ts";

export type SequenceKind = "intro" | "stop" | "outro";

export interface SequenceEntry {
  kind: SequenceKind;
  card: JourneyCard;
  /** Position within its own kind, zero-based; drives the hash and alternation. */
  ordinal: number;
  /** Index into `journey.stops`, or null for a place-less card. */
  stopIndex: number | null;
}

export interface Sequence {
  entries: SequenceEntry[];
  /** Sequence position of the first stop; equals the number of intro cards. */
  firstStop: number;
  /** Sequence position of the last stop. */
  lastStop: number;
  stopCount: number;
}

/** Flattens intro cards, map stops and outro cards into one scroll order. */
export function buildSequence(
  journey: Journey,
  intro: PlacelessCard[],
  outro: PlacelessCard[],
): Sequence {
  const entries: SequenceEntry[] = [
    ...intro.map((card, ordinal) => placeless("intro", card, ordinal)),
    ...journey.stops.map((stop, ordinal) => ({
      kind: "stop" as const,
      card: stop as JourneyStop,
      ordinal,
      stopIndex: ordinal,
    })),
    ...outro.map((card, ordinal) => placeless("outro", card, ordinal)),
  ];

  return {
    entries,
    firstStop: intro.length,
    lastStop: intro.length + journey.stops.length - 1,
    stopCount: journey.stops.length,
  };
}

function placeless(
  kind: "intro" | "outro",
  card: PlacelessCard,
  ordinal: number,
): SequenceEntry {
  return { kind, card, ordinal, stopIndex: null };
}

/**
 * Stop the camera should sit on at a given sequence position. Place-less cards
 * park on the nearest stop — the first for intro cards, the last for outro
 * cards — so entering and leaving the journey needs no extra flight.
 */
export function cameraStopFor(sequence: Sequence, position: number): number {
  if (position <= sequence.firstStop) return 0;
  if (position >= sequence.lastStop) return sequence.stopCount - 1;
  return position - sequence.firstStop;
}

/**
 * Translates a sequence-space line segment into stop space. Place-less sections
 * must not advance the journey line, so anything before the first stop reads as
 * zero progress and anything at or after the last stop reads as fully drawn.
 */
export function lineSegmentFor(
  sequence: Sequence,
  segmentIndex: number,
  segmentProgress: number,
): { segmentIndex: number; segmentProgress: number } {
  if (segmentIndex < sequence.firstStop)
    return { segmentIndex: 0, segmentProgress: 0 };
  if (segmentIndex >= sequence.lastStop) {
    return { segmentIndex: sequence.stopCount - 1, segmentProgress: 0 };
  }
  return { segmentIndex: segmentIndex - sequence.firstStop, segmentProgress };
}
