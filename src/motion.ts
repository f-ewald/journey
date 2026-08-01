const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

/** Whether the user has asked the OS to minimise non-essential animation. */
export function prefersReducedMotion(): boolean {
  return reduceMotionQuery.matches;
}
