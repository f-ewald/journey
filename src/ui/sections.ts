import "@f-ewald/components/markdown-view.js";
import "@f-ewald/components/photo-gallery.js";
import "@f-ewald/components/gallery-item.js";
import type { Journey, JourneyImage, JourneyStop } from "../journey/schema.ts";

/**
 * Renders one full-viewport section per stop and returns them in order. Stops
 * are identified by `data-stop` rather than `id` so the browser never performs
 * its own jump for a `#stop-n` hash — restoring that position is this app's job.
 */
export function renderSections(host: HTMLElement, journey: Journey): HTMLElement[] {
  const sections = journey.stops.map((stop, index) =>
    createSection(stop, index, journey.stops.length),
  );
  host.replaceChildren(...sections);
  return sections;
}

function createSection(stop: JourneyStop, index: number, total: number): HTMLElement {
  const section = document.createElement("section");
  section.className = "stop";
  section.dataset.stop = String(index);
  section.setAttribute("aria-label", `Stop ${index + 1} of ${total}: ${stop.title}`);
  section.append(createPanel(stop, index, total));
  return section;
}

function createPanel(stop: JourneyStop, index: number, total: number): HTMLElement {
  const panel = document.createElement("article");
  panel.className = "panel";

  const counter = document.createElement("p");
  counter.className = "panel__counter";
  counter.textContent = `${pad(index + 1)} / ${pad(total)}`;

  panel.append(counter);

  const meta = createMeta(stop);
  if (meta) panel.append(meta);

  const heading = document.createElement("h2");
  heading.className = "panel__title";
  heading.textContent = stop.title;
  panel.append(heading);

  // Imagery leads, then the text that explains it.
  const media = createMedia(stop.images);
  if (media) panel.append(media);

  if (stop.body.trim() !== "") {
    const body = document.createElement("markdown-view");
    body.className = "panel__body";
    body.markdown = stop.body;
    panel.append(body);
  }

  // A card carrying both has to fit them together, so the image gives up some
  // of its height budget rather than pushing the text out of view.
  if (media && stop.body.trim() !== "") panel.classList.add("panel--media-and-body");

  return panel;
}

/**
 * The secondary line above the title: year, then location, side by side. Either
 * may be absent — with both missing the line is omitted entirely so no empty
 * gap is left above the title.
 */
function createMeta(stop: JourneyStop): HTMLElement | null {
  if (!stop.year && !stop.location) return null;

  const meta = document.createElement("p");
  meta.className = "panel__meta";

  if (stop.year) {
    const year = document.createElement("span");
    year.className = "panel__year";
    year.textContent = stop.year;
    meta.append(year);
  }

  if (stop.location) {
    const location = document.createElement("span");
    location.className = "panel__location";
    location.textContent = stop.location;
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
