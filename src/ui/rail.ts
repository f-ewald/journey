import type { Journey } from "../journey/schema.ts";

export interface Rail {
  setActive(index: number): void;
}

/**
 * Vertical stop navigator in the reserved right gutter. The active stop renders
 * as an elongated rounded bar rather than a dot, which is the only cue the
 * audience needs to read position at a glance.
 */
export function renderRail(
  host: HTMLElement,
  journey: Journey,
  onSelect: (index: number) => void,
): Rail {
  const nav = document.createElement("nav");
  nav.className = "rail";
  nav.setAttribute("aria-label", "Journey stops");

  const dots = journey.stops.map((stop, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "rail__dot";
    dot.setAttribute("aria-label", `Stop ${index + 1}: ${stop.title}`);
    dot.addEventListener("click", () => onSelect(index));
    return dot;
  });

  nav.append(...dots);
  host.replaceChildren(nav);

  return {
    setActive(index: number) {
      dots.forEach((dot, dotIndex) => {
        const isActive = dotIndex === index;
        dot.classList.toggle("rail__dot--active", isActive);
        if (isActive) {
          dot.setAttribute("aria-current", "true");
          return;
        }
        dot.removeAttribute("aria-current");
      });
    },
  };
}
