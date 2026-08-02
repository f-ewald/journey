import { Marker } from "mapbox-gl";
import type { Map as MapboxMap, PaddingOptions } from "mapbox-gl";
import "@f-ewald/components/map-circle.js";
import "@f-ewald/components/map-pin.js";
import type { Journey } from "../journey/schema.ts";
import { zoomFor } from "../journey/schema.ts";
import { prefersReducedMotion } from "../motion.ts";
import {
  journeyCoordinates,
  leftThirdPadding,
  toCoordinate,
  type Coordinate,
} from "./geometry.ts";

const LINE_SOURCE = "journey-line";
const LINE_LAYER = "journey-line";
/** The import id Mapbox Standard exposes its configuration under. */
const BASEMAP_IMPORT = "basemap";

/**
 * Pushes the basemap toward political and geographic reading: administrative
 * boundaries stay, while road, POI and transit labels — and 3D objects, which
 * only add noise at presentation zooms — are suppressed. Roads themselves
 * remain as recessive context.
 */
const BASEMAP_CONFIG: Record<string, boolean> = {
  showRoadLabels: false,
  showPointOfInterestLabels: false,
  showTransitLabels: false,
  showPlaceLabels: true,
  showAdminBoundaries: true,
  show3dObjects: false,
};

interface StopMarkers {
  circle: Marker;
  pin: Marker;
}

/**
 * Owns everything drawn on top of the basemap: the per-stop markers, the
 * progressive journey line, and the camera.
 *
 * Registration is re-run on `map-style-reloaded` because a style change drops
 * consumer-registered sources and layers.
 */
export class MapController {
  private map: MapboxMap | null = null;
  private markers: StopMarkers[] = [];
  private activeIndex = 0;
  private lineCoordinates: Coordinate[] = [];

  private readonly journey: Journey;

  constructor(journey: Journey) {
    this.journey = journey;
  }

  /** Binds to a ready map instance and registers markers and the line layer. */
  attach(map: MapboxMap): void {
    this.map = map;
    this.applyBasemapConfig(map);
    this.createMarkers(map);
    this.createLineLayer(map);
    this.applyMarkerVisibility();
    this.writeLine();
  }

  /**
   * Applies the Standard basemap configuration. Classic styles (light, outdoors,
   * satellite) carry no `basemap` import and simply have nothing to configure,
   * so this is skipped rather than allowed to throw.
   */
  private applyBasemapConfig(map: MapboxMap): void {
    const imports = (map.getStyle() as { imports?: Array<{ id: string }> } | undefined)?.imports;
    if (!imports?.some((entry) => entry.id === BASEMAP_IMPORT)) return;

    for (const [key, value] of Object.entries(BASEMAP_CONFIG)) {
      map.setConfigProperty(BASEMAP_IMPORT, key, value);
    }
    map.setConfigProperty(BASEMAP_IMPORT, "theme", this.journey.mapTheme);
  }

  /** Re-registers everything a style swap discarded. */
  reattach(map: MapboxMap): void {
    this.markers.forEach(({ circle, pin }) => {
      circle.remove();
      pin.remove();
    });
    this.markers = [];
    this.attach(map);
  }

  /** Flies the camera so `index` lands in the centre of the left third. */
  focus(index: number, options: { animate?: boolean } = {}): void {
    const map = this.map;
    const stop = this.journey.stops[index];
    if (!map || !stop) return;

    this.activeIndex = index;
    this.applyMarkerVisibility();

    const camera = {
      center: [stop.lng, stop.lat] as Coordinate,
      zoom: zoomFor(stop, this.journey),
      padding: leftThirdPadding(window.innerWidth) satisfies PaddingOptions,
    };

    const animate = options.animate !== false && !prefersReducedMotion();
    if (!animate) {
      map.jumpTo(camera);
      return;
    }
    map.flyTo({ ...camera, duration: this.journey.flyDurationMs, essential: true });
  }

  /** Re-applies the left-third framing after a viewport resize. */
  reframe(): void {
    this.focus(this.activeIndex, { animate: false });
  }

  /**
   * Draws the line through every stop up to `segmentIndex`, plus `progress` of
   * the way toward the next one. Passing a smaller progress retracts the line.
   */
  drawLine(segmentIndex: number, progress: number): void {
    const fraction = prefersReducedMotion() && progress > 0 ? 1 : progress;
    this.lineCoordinates = journeyCoordinates(this.journey.stops, segmentIndex, fraction);
    this.writeLine();
  }

  private writeLine(): void {
    const source = this.map?.getSource(LINE_SOURCE);
    if (!source || source.type !== "geojson") return;
    source.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: this.lineCoordinates },
    });
  }

  private createLineLayer(map: MapboxMap): void {
    if (!map.getSource(LINE_SOURCE)) {
      map.addSource(LINE_SOURCE, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
      });
    }
    if (map.getLayer(LINE_LAYER)) return;

    map.addLayer({
      id: LINE_LAYER,
      type: "line",
      source: LINE_SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": accentColor(),
        "line-width": 5,
        "line-dasharray": [0, 2],
      },
    });
  }

  private createMarkers(map: MapboxMap): void {
    this.markers = this.journey.stops.map((stop, index) => {
      const circle = document.createElement("map-circle");
      circle.size = 16;
      circle.ringWidth = 3;
      circle.color = accentColor();

      const pin = document.createElement("map-pin");
      pin.size = 34;
      pin.highlighted = true;
      pin.color = accentColor();
      pin.textContent = String(index + 1);

      return {
        circle: new Marker({ element: circle, anchor: "center" })
          .setLngLat(toCoordinate(stop))
          .addTo(map),
        pin: new Marker({ element: pin, anchor: "bottom" })
          .setLngLat(toCoordinate(stop))
          .addTo(map),
      };
    });
  }

  /** Visited stops show a circle, the active stop a pin, later stops nothing. */
  private applyMarkerVisibility(): void {
    this.markers.forEach(({ circle, pin }, index) => {
      const isActive = index === this.activeIndex;
      const isVisited = index < this.activeIndex;
      setMarkerVisible(circle, isVisited);
      setMarkerVisible(pin, isActive);
    });
  }
}

function setMarkerVisible(marker: Marker, visible: boolean): void {
  marker.getElement().style.display = visible ? "" : "none";
}

function accentColor(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--ui-primary").trim();
  return value === "" ? "#4f46e5" : value;
}
