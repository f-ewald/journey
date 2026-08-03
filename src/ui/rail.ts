import type { Sequence, SequenceEntry } from "../journey/sequence.ts";

export interface Rail {
  setActive(position: number): void;
}

/**
 * Vertical navigator in the reserved right gutter, with one dot per card in the
 * whole sequence. The active card renders as an elongated rounded bar rather
 * than a dot, which is the only cue the audience needs to read position at a
 * glance.
 */
export function renderRail(
  host: HTMLElement,
  sequence: Sequence,
  onSelect: (position: number) => void,
): Rail {
  const nav = document.createElement("nav");
  nav.className = "rail";
  nav.setAttribute("aria-label", "Journey cards");

  const dots = sequence.entries.map((entry, position) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className =
      entry.kind === "stop" ? "rail__dot" : "rail__dot rail__dot--card";
    dot.setAttribute("aria-label", labelFor(entry));
    dot.addEventListener("click", () => onSelect(position));
    return dot;
  });

  nav.append(...dots);
  host.replaceChildren(nav);

  return {
    setActive(position: number) {
      dots.forEach((dot, dotPosition) => {
        const isActive = dotPosition === position;
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

function labelFor(entry: SequenceEntry): string {
  if (entry.kind === "stop")
    return `Stop ${entry.ordinal + 1}: ${entry.card.title}`;
  return entry.card.title;
}
