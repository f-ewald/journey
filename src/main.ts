import "@f-ewald/components/tokens.css";
import "@f-ewald/components/mapbox-map.js";
import "./style.css";

import type { Map as MapboxMap } from "mapbox-gl";
import { loadJourney } from "./journey/load.ts";
import type { Journey } from "./journey/schema.ts";
import { zoomFor } from "./journey/schema.ts";
import { MapController } from "./map/controller.ts";
import { prefersReducedMotion } from "./motion.ts";
import { indexFromHash, replaceHash } from "./hash.ts";
import { observeScroll, type ScrollState } from "./scroll.ts";
import { renderError } from "./ui/error-view.ts";
import { renderFullscreenButton } from "./ui/fullscreen.ts";
import { renderRail } from "./ui/rail.ts";
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

  const result = await loadJourney(JOURNEY_URL);
  if (!result.ok) {
    renderError(app, result.title, result.details);
    return;
  }

  const token = import.meta.env.VITE_MAPBOX_TOKEN?.trim() ?? "";
  if (token === "") {
    renderError(app, "No Mapbox access token configured", [
      "Copy `.env.example` to `.env`, set VITE_MAPBOX_TOKEN, then restart the dev server.",
    ]);
    return;
  }

  start(result.journey, token);
}

function start(journey: Journey, token: string): void {
  document.title = journey.title;

  const initial = indexFromHash(journey.stops.length) ?? 0;
  const controller = new MapController(journey);
  mountMap(journey, token, initial);

  const sections = renderSections(requireElement("#stops"), journey);
  const rail = renderRail(requireElement("#rail"), journey, (index) =>
    scrollToStop(sections, index),
  );

  if (initial > 0) sections[initial].scrollIntoView({ behavior: "auto", block: "start" });

  let latest: ScrollState | null = null;
  let lastActive = -1;
  let framed = false;

  observeScroll(
    sections,
    (state) => {
      latest = state;
      controller.drawLine(state.segmentIndex, state.segmentProgress);
      if (state.activeIndex === lastActive) return;

      lastActive = state.activeIndex;
      controller.focus(state.activeIndex, { animate: framed });
      framed = true;
      rail.setActive(state.activeIndex);
      replaceHash(state.activeIndex);
    },
    initial,
  );

  renderFullscreenButton(requireElement("#fullscreen"), () =>
    realign(sections, lastActive, controller),
  );

  bindMapReady(controller, () => latest);
  bindResize(controller);
}

/**
 * Re-pins the deck to the active stop after the viewport height changes, since
 * every section is sized in `vh` and the scroll offset would otherwise land
 * between two stops. Deferred two frames so the new layout is settled first.
 */
function realign(sections: HTMLElement[], index: number, controller: MapController): void {
  const section = sections[index];
  if (!section) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      section.scrollIntoView({ behavior: "auto", block: "start" });
      controller.reframe();
    }),
  );
}

/** Constructs the map already centred on `initialIndex`, avoiding a first-stop flash. */
function mountMap(journey: Journey, token: string, initialIndex: number): void {
  const stop = journey.stops[initialIndex] ?? journey.stops[0];
  const element = document.createElement("mapbox-map");
  element.accessToken = token;
  element.styleUrl = journey.mapStyle;
  element.center = [stop.lng, stop.lat];
  element.zoom = zoomFor(stop, journey);
  requireElement("#map-layer").replaceChildren(element);
}

/**
 * Applies whatever scroll state already exists once the map — or a reloaded
 * style — is ready, since markers and the line cannot be drawn before then.
 */
function bindMapReady(controller: MapController, getState: () => ScrollState | null): void {
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
    controller.focus(state.activeIndex, { animate: false });
    controller.drawLine(state.segmentIndex, state.segmentProgress);
  };

  element.addEventListener("map-ready", (event) => apply(mapFrom(event), false));
  element.addEventListener("map-style-reloaded", (event) => apply(mapFrom(event), true));
}

function bindResize(controller: MapController): void {
  let timer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => controller.reframe(), RESIZE_DEBOUNCE_MS);
  });
}

function scrollToStop(sections: HTMLElement[], index: number): void {
  const section = sections[index];
  if (!section) return;
  section.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
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
