import "@f-ewald/components/tokens.css";
import "@f-ewald/components/fullscreen-button.js";
import "@f-ewald/components/mapbox-map.js";
import "@f-ewald/components/scroll-dots.js";
import "./style.css";

import type { DotSelectDetail, ScrollDotsItem } from "@f-ewald/components";
import type { Map as MapboxMap } from "mapbox-gl";
import { loadDeck } from "./journey/load.ts";
import type { Journey, PlacelessCard } from "./journey/schema.ts";
import { zoomFor } from "./journey/schema.ts";
import {
  buildSequence,
  cameraStopFor,
  lineSegmentFor,
  type Sequence,
  type SequenceEntry,
} from "./journey/sequence.ts";
import { MapController } from "./map/controller.ts";
import { resolveMapStyle } from "./map/styles.ts";
import { prefersReducedMotion } from "./motion.ts";
import { positionFromHash, replaceHash } from "./hash.ts";
import { observeScroll, type ScrollState } from "./scroll.ts";
import { renderError } from "./ui/error-view.ts";
import { renderSections } from "./ui/sections.ts";

const JOURNEY_URL = "journey.yaml";
const RESIZE_DEBOUNCE_MS = 200;

// Set before the load event so the browser cannot re-apply the previous scroll
// position on top of the one restored from the hash.
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

/** Loads and validates content, then either starts the deck or shows why not. */
async function main(): Promise<void> {
  const app = requireElement("#app");

  const result = await loadDeck(JOURNEY_URL);
  if (!result.ok) {
    renderError(app, result.title, result.issues);
    return;
  }

  const token = import.meta.env.VITE_MAPBOX_TOKEN?.trim() ?? "";
  if (token === "") {
    renderError(app, "No Mapbox access token configured", [
      {
        message:
          "Copy `.env.example` to `.env`, set VITE_MAPBOX_TOKEN, then restart the dev server.",
      },
    ]);
    return;
  }

  await start(result.journey, result.intro, result.outro, token);
}

async function start(
  journey: Journey,
  intro: PlacelessCard[],
  outro: PlacelessCard[],
  token: string,
): Promise<void> {
  document.title = journey.title;
  // Gates the pointer-events rules that let drags reach the map canvas.
  document.body.classList.toggle("map-interactive", journey.showZoomControls);

  const sequence = buildSequence(journey, intro, outro);
  const initial = positionFromHash(sequence) ?? 0;
  const controller = new MapController(journey);
  mountMap(journey, token, cameraStopFor(sequence, initial));

  const sections = renderSections(requireElement("#stops"), sequence, journey);
  const rail = renderRail(sequence, (position) =>
    scrollToSection(sections, position),
  );

  await settle(sections, initial);

  let latest: ScrollState | null = null;
  let lastActive = -1;
  let lastStop = -1;

  observeScroll(sections, (state) => {
    latest = state;
    drawLine(controller, sequence, state);
    if (state.activeIndex === lastActive) return;

    lastActive = state.activeIndex;
    // Place-less cards park the camera on the nearest stop, so the flight is
    // only worth triggering when the stop underneath actually changes.
    const stop = cameraStopFor(sequence, state.activeIndex);
    if (stop !== lastStop) {
      controller.focus(stop, { animate: lastStop !== -1 });
      lastStop = stop;
    }
    rail.active = state.activeIndex;
    replaceHash(sequence.entries[state.activeIndex]);
  });

  renderFullscreenButton(() => realign(sections, lastActive, controller));

  bindMapReady(controller, sequence, () => latest);
  bindResize(controller);
}

/**
 * Waits for the timeline containers to lay out, then pins the deck to its
 * starting card.
 *
 * A container renders its slot asynchronously, so until it does its entries
 * have no box and are not scroll-snap areas. The browser latches its snap
 * target onto the first section that does have one — the first map stop — and
 * then follows it down the page as the entries appear, landing the deck
 * several cards in. Pinning explicitly afterwards is what settles it, so this
 * runs even for card zero.
 */
async function settle(sections: HTMLElement[], initial: number): Promise<void> {
  const containers = [...document.querySelectorAll("timeline-container")];
  await Promise.all(containers.map((container) => container.updateComplete));
  pinTo(sections[initial], "auto");
}

/** Mounts the dot rail. It is controlled, so `active` is written on every change. */
function renderRail(sequence: Sequence, onSelect: (position: number) => void) {
  const rail = document.createElement("scroll-dots");
  rail.label = "Journey cards";
  rail.items = sequence.entries.map(dotFor);
  rail.addEventListener("dot-select", (event) => {
    onSelect((event as CustomEvent<DotSelectDetail>).detail.index);
  });
  requireElement("#rail").replaceChildren(rail);
  return rail;
}

/** Place-less cards read as subordinate to the map stops they bracket. */
function dotFor(entry: SequenceEntry): ScrollDotsItem {
  if (entry.kind === "stop")
    return `Stop ${entry.ordinal + 1}: ${entry.card.title}`;
  return { label: entry.card.title, muted: true };
}

/**
 * Mounts the fullscreen toggle. `onChange` re-pins the deck, since every
 * section is sized in `vh` and the viewport height changes on the way in and
 * out — which would otherwise leave the scroll between two cards.
 */
function renderFullscreenButton(onChange: () => void): void {
  const button = document.createElement("fullscreen-button");
  button.addEventListener("fullscreen-change", onChange);
  requireElement("#fullscreen").replaceChildren(button);
}

/** Advances the journey line, ignoring progress made outside the stop range. */
function drawLine(
  controller: MapController,
  sequence: Sequence,
  state: ScrollState,
): void {
  const segment = lineSegmentFor(
    sequence,
    state.segmentIndex,
    state.segmentProgress,
  );
  controller.drawLine(segment.segmentIndex, segment.segmentProgress);
}

/**
 * Re-pins the deck to the active card after the viewport height changes, since
 * every section is sized in `vh` and the scroll offset would otherwise land
 * between two cards. Deferred two frames so the new layout is settled first.
 */
function realign(
  sections: HTMLElement[],
  position: number,
  controller: MapController,
): void {
  const section = sections[position];
  if (!section) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      pinTo(section, "auto");
      controller.reframe();
    }),
  );
}

/** Constructs the map already centred on `initialStop`, avoiding a first-stop flash. */
function mountMap(journey: Journey, token: string, initialStop: number): void {
  const stop = journey.stops[initialStop] ?? journey.stops[0];
  const element = document.createElement("mapbox-map");
  element.accessToken = token;
  // A raster basemap has no style document to point at, so the resolved value
  // may be a whole style object. Mapbox GL's `style` option takes either, but
  // the component types the property as the URL case only.
  element.styleUrl = resolveMapStyle(journey.mapStyle) as string;
  element.center = [stop.lng, stop.lat];
  element.zoom = zoomFor(stop, journey);
  requireElement("#map-layer").replaceChildren(element);
}

/**
 * Applies whatever scroll state already exists once the map — or a reloaded
 * style — is ready, since markers and the line cannot be drawn before then.
 */
function bindMapReady(
  controller: MapController,
  sequence: Sequence,
  getState: () => ScrollState | null,
): void {
  const element = requireElement("#map-layer").querySelector("mapbox-map");
  if (!element) return;

  const apply = (map: MapboxMap, isReload: boolean) => {
    if (isReload) {
      controller.reattach(map);
    } else {
      controller.attach(map);
    }

    const state = getState();
    if (!state) return;
    controller.focus(cameraStopFor(sequence, state.activeIndex), {
      animate: false,
    });
    drawLine(controller, sequence, state);
  };

  element.addEventListener("map-ready", (event) =>
    apply(mapFrom(event), false),
  );
  element.addEventListener("map-style-reloaded", (event) =>
    apply(mapFrom(event), true),
  );
}

function bindResize(controller: MapController): void {
  let timer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => controller.reframe(), RESIZE_DEBOUNCE_MS);
  });
}

function scrollToSection(sections: HTMLElement[], position: number): void {
  const section = sections[position];
  if (!section) return;
  pinTo(section, prefersReducedMotion() ? "auto" : "smooth");
}

/** Every section snaps to its top edge, so programmatic scrolls target it too. */
function pinTo(section: HTMLElement, behavior: ScrollBehavior): void {
  section.scrollIntoView({ behavior, block: "start" });
}

function mapFrom(event: Event): MapboxMap {
  return (event as CustomEvent<{ map: MapboxMap }>).detail.map;
}

function requireElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

void main();
