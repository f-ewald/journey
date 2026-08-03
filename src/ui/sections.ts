import "@f-ewald/components/markdown-view.js";
import "@f-ewald/components/timeline-container.js";
import "@f-ewald/components/timeline-entry.js";
import "@f-ewald/components/photo-gallery.js";
import "@f-ewald/components/gallery-item.js";
import type { Journey, JourneyCard, JourneyImage } from "../journey/schema.ts";
import type { Sequence, SequenceEntry } from "../journey/sequence.ts";

interface PanelOptions {
  /** `n / total` badge, shown for map stops only. */
  counter?: string;
  /** Timeline entries print the year beside the line, not inside the card. */
  omitYear?: boolean;
  /** Extra class applied to the panel element. */
  modifier?: string;
}

/**
 * Renders one section per sequence entry and returns them in scroll order.
 * Entries are identified by `data-position` rather than `id` so the browser
 * never performs its own jump for a `#stop-n` hash — restoring that position
 * is this app's job.
 */
export function renderSections(
  host: HTMLElement,
  sequence: Sequence,
  journey: Journey,
): HTMLElement[] {
  const sections = sequence.entries.map((entry, position) =>
    createSection(entry, position, sequence, journey),
  );

  host.replaceChildren(...groupTimelineRuns(sections));
  return sections;
}

/**
 * Wraps each run of consecutive timeline entries in its own container. The two
 * runs are not siblings — map stops sit between them — so one container per run
 * is what makes the line cap at each run's own end dots, and what keeps the
 * alternating sides counting from the start of each run.
 */
function groupTimelineRuns(sections: HTMLElement[]): HTMLElement[] {
  const grouped: HTMLElement[] = [];
  let run: HTMLElement | null = null;

  for (const section of sections) {
    if (section.tagName !== "TIMELINE-ENTRY") {
      run = null;
      grouped.push(section);
      continue;
    }
    if (!run) {
      const container = document.createElement("timeline-container");
      container.layout = "alternating";
      run = container;
      grouped.push(container);
    }
    run.append(section);
  }

  return grouped;
}

function createSection(
  entry: SequenceEntry,
  position: number,
  sequence: Sequence,
  journey: Journey,
): HTMLElement {
  const section =
    entry.kind === "stop"
      ? createStopSection(entry, sequence)
      : journey.layout === "timeline"
        ? createTimelineSection(entry)
        : createCardSection(entry);

  section.dataset.position = String(position);
  return section;
}

/** A map stop: card in the right half over the live map. */
function createStopSection(
  entry: SequenceEntry,
  sequence: Sequence,
): HTMLElement {
  const index = entry.stopIndex ?? 0;
  const section = document.createElement("section");
  section.className = "stop";
  section.setAttribute(
    "aria-label",
    `Stop ${index + 1} of ${sequence.stopCount}: ${entry.card.title}`,
  );
  section.append(
    createPanel(entry.card, {
      counter: `${pad(index + 1)} / ${pad(sequence.stopCount)}`,
    }),
  );
  return section;
}

/**
 * A place-less card in `map` layout: same right-half position as a stop, but
 * over a dimmed map, since no point on it is being talked about.
 */
function createCardSection(entry: SequenceEntry): HTMLElement {
  const section = document.createElement("section");
  section.className = "stop stop--card";
  section.setAttribute("aria-label", entry.card.title);

  const scrim = document.createElement("div");
  scrim.className = "stop__scrim";

  section.append(scrim, createPanel(entry.card));
  return section;
}

/**
 * A place-less card in `timeline` layout: a central line with the year on one
 * side and the card on the other, alternating so consecutive entries mirror.
 */
function createTimelineSection(entry: SequenceEntry): HTMLElement {
  const section = document.createElement("timeline-entry");
  section.setAttribute("aria-label", entry.card.title);

  // Slotted rather than set as the `label` property, because the year needs
  // typography this app owns and the property renders in the shadow DOM.
  if (entry.card.year) {
    const year = document.createElement("span");
    year.slot = "label";
    year.className = "timeline-year";
    year.textContent = entry.card.year;
    section.append(year);
  }

  section.append(
    createPanel(entry.card, { omitYear: true, modifier: "panel--timeline" }),
  );
  return section;
}

function createPanel(
  card: JourneyCard,
  options: PanelOptions = {},
): HTMLElement {
  const panel = document.createElement("article");
  panel.className = options.modifier ? `panel ${options.modifier}` : "panel";

  if (options.counter) {
    const counter = document.createElement("p");
    counter.className = "panel__counter";
    counter.textContent = options.counter;
    panel.append(counter);
  }

  const meta = createMeta(card, options.omitYear === true);
  if (meta) panel.append(meta);

  const heading = document.createElement("h2");
  heading.className = "panel__title";
  heading.textContent = card.title;
  panel.append(heading);

  // Imagery leads, then the text that explains it.
  const media = createMedia(card.images);
  if (media) panel.append(media);

  if (card.body.trim() !== "") {
    const body = document.createElement("markdown-view");
    body.className = "panel__body";
    body.markdown = card.body;
    panel.append(body);
  }

  // A card carrying both has to fit them together, so the image gives up some
  // of its height budget rather than pushing the text out of view.
  if (media && card.body.trim() !== "")
    panel.classList.add("panel--media-and-body");

  return panel;
}

/**
 * The secondary line above the title: year, then location, side by side. Either
 * may be absent — with both missing the line is omitted entirely so no empty
 * gap is left above the title.
 */
function createMeta(card: JourneyCard, omitYear: boolean): HTMLElement | null {
  const year = omitYear ? null : card.year;
  if (!year && !card.location) return null;

  const meta = document.createElement("p");
  meta.className = "panel__meta";

  if (year) {
    const element = document.createElement("span");
    element.className = "panel__year";
    element.textContent = year;
    meta.append(element);
  }

  if (card.location) {
    const location = document.createElement("span");
    location.className = "panel__location";
    location.textContent = card.location;
    meta.append(location);
  }

  return meta;
}

/** Single images render plainly; multiples become a constant-height carousel. */
function createMedia(images: JourneyImage[]): HTMLElement | null {
  if (images.length === 0) return null;
  if (images.length === 1) return createFigure(images[0]);

  const gallery = document.createElement("photo-gallery");
  gallery.className = "panel__media";
  gallery.showIndicators = true;
  gallery.showCounter = true;
  gallery.append(
    ...images.map((image) => {
      const item = document.createElement("gallery-item");
      item.src = image.src;
      item.alt = image.alt;
      if (image.caption) item.caption = image.caption;
      return item;
    }),
  );
  return gallery;
}

function createFigure(image: JourneyImage): HTMLElement {
  const figure = document.createElement("figure");
  figure.className = "panel__media panel__figure";

  const img = document.createElement("img");
  img.src = image.src;
  img.alt = image.alt;
  img.loading = "lazy";
  figure.append(img);

  if (image.caption) {
    const caption = document.createElement("figcaption");
    caption.textContent = image.caption;
    figure.append(caption);
  }

  return figure;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
