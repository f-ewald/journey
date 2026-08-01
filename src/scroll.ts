export interface ScrollState {
  /** Stop currently under the vertical middle of the viewport. */
  activeIndex: number;
  /** Index of the stop the journey line is currently drawing away from. */
  segmentIndex: number;
  /** Progress along that segment, 0 at `segmentIndex`, 1 at the next stop. */
  segmentProgress: number;
}

export type ScrollListener = (state: ScrollState) => void;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Publishes the single active-stop and line-progress signal every other module
 * consumes. `activeIndex` comes from an IntersectionObserver keyed to the
 * viewport midpoint, so it is unambiguous and flips exactly once per stop;
 * `segmentIndex`/`segmentProgress` are measured from section offsets, so they
 * stay continuous while scrolling and reverse cleanly.
 *
 * Emits immediately with the current state, then on every change. Callers that
 * start away from the first stop pass `initialIndex` so the first emit does not
 * momentarily report stop zero. Returns a teardown function.
 */
export function observeScroll(
  sections: HTMLElement[],
  onChange: ScrollListener,
  initialIndex = 0,
): () => void {
  let activeIndex = initialIndex;
  let last: ScrollState | null = null;
  let frame = 0;

  const emit = () => {
    const { segmentIndex, segmentProgress } = measureSegment(sections);
    const next: ScrollState = { activeIndex, segmentIndex, segmentProgress };
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

  const observer = new IntersectionObserver(
    (entries) => {
      const hit = entries.find((entry) => entry.isIntersecting);
      if (!hit) return;
      const index = sections.indexOf(hit.target as HTMLElement);
      if (index === -1 || index === activeIndex) return;
      activeIndex = index;
      scheduleEmit();
    },
    { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
  );
  sections.forEach((section) => observer.observe(section));

  window.addEventListener("scroll", scheduleEmit, { passive: true });
  window.addEventListener("resize", scheduleEmit, { passive: true });
  emit();

  return () => {
    if (frame !== 0) cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("scroll", scheduleEmit);
    window.removeEventListener("resize", scheduleEmit);
  };
}

/**
 * Locates the scroll position between two section tops and returns the lower
 * section's index plus the fraction travelled toward the next one.
 */
function measureSegment(sections: HTMLElement[]): Pick<ScrollState, "segmentIndex" | "segmentProgress"> {
  const scrollY = window.scrollY;
  const lastSegment = Math.max(0, sections.length - 2);

  let segmentIndex = 0;
  for (let index = 0; index <= lastSegment; index += 1) {
    if (scrollY >= sections[index].offsetTop) segmentIndex = index;
  }

  const next = sections[segmentIndex + 1];
  if (!next) return { segmentIndex, segmentProgress: 0 };

  const top = sections[segmentIndex].offsetTop;
  const span = next.offsetTop - top;
  const segmentProgress = span > 0 ? clamp((scrollY - top) / span, 0, 1) : 0;
  return { segmentIndex, segmentProgress };
}
