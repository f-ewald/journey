export interface ScrollState {
  /** Sequence position currently occupying the viewport. */
  activeIndex: number;
  /** Sequence position the line is currently drawing away from. */
  segmentIndex: number;
  /** Progress along that segment, 0 at `segmentIndex`, 1 at the next section. */
  segmentProgress: number;
}

type ScrollListener = (state: ScrollState) => void;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Publishes the single active-card and line-progress signal every other module
 * consumes. Both are in sequence space — intro cards, stops and outro cards
 * share one index — and both are derived from section offsets, so they stay
 * continuous while scrolling and reverse cleanly.
 *
 * Emits immediately with the current state, then on every change.
 */
export function observeScroll(
  sections: HTMLElement[],
  onChange: ScrollListener,
): void {
  let last: ScrollState | null = null;
  let frame = 0;

  const emit = () => {
    const next = measure(sections);
    if (
      last &&
      last.activeIndex === next.activeIndex &&
      last.segmentIndex === next.segmentIndex &&
      last.segmentProgress === next.segmentProgress
    ) {
      return;
    }
    last = next;
    onChange(next);
  };

  const scheduleEmit = () => {
    if (frame !== 0) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      emit();
    });
  };

  window.addEventListener("scroll", scheduleEmit, { passive: true });
  window.addEventListener("resize", scheduleEmit, { passive: true });
  emit();
}

/**
 * Locates the scroll position among the section tops.
 *
 * Every section snaps to its own top, so the active card is the one whose top
 * the page has most recently passed, with the handover placed halfway through
 * the travel from the previous section. Halving that travel rather than the
 * viewport height is what keeps sections shorter than the viewport — timeline
 * entries — from being skipped: a fixed half-viewport threshold would report
 * the second card as active while the page still sits at the very top.
 */
function measure(sections: HTMLElement[]): ScrollState {
  const scrollY = window.scrollY;

  let activeIndex = 0;
  let segmentIndex = 0;
  const lastSegment = Math.max(0, sections.length - 2);

  for (let index = 1; index < sections.length; index += 1) {
    const top = sections[index].offsetTop;
    const travel = top - sections[index - 1].offsetTop;
    if (scrollY >= top - Math.min(travel, window.innerHeight) / 2)
      activeIndex = index;
    if (scrollY >= top && index <= lastSegment) segmentIndex = index;
  }

  const next = sections[segmentIndex + 1];
  if (!next) return { activeIndex, segmentIndex, segmentProgress: 0 };

  const top = sections[segmentIndex].offsetTop;
  const span = next.offsetTop - top;
  const segmentProgress = span > 0 ? clamp((scrollY - top) / span, 0, 1) : 0;
  return { activeIndex, segmentIndex, segmentProgress };
}
