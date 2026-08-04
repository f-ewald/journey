import type { StyleSpecification } from "mapbox-gl";

/** A Mapbox style URL, or a full style built here for raster basemaps. */
export type MapStyle = string | StyleSpecification;

/**
 * Stamen's tiles have been hosted by Stadia Maps since Stamen retired their own
 * servers in 2023. Browser requests are served without an API key; only
 * server-side requests, which carry no `Origin`, are rejected.
 */
const STADIA_TILES = "https://tiles.stadiamaps.com/tiles";

/**
 * Anonymous access is rate limited, so a key is worth setting for anything
 * that has to be reliable — a live talk especially. Absent, tiles still load
 * until the limit is hit.
 */
// Guarded because the schema imports this module and `npm run validate` runs it
// under plain Node, where Vite's `import.meta.env` shim does not exist.
const STADIA_KEY = import.meta.env?.VITE_STADIA_API_KEY?.trim() ?? "";

/** Tile template for one Stadia layer, keyed if a key was supplied. */
function tileUrl(layer: string, extension: string): string {
  const key =
    STADIA_KEY === "" ? "" : `?api_key=${encodeURIComponent(STADIA_KEY)}`;
  return `${STADIA_TILES}/${layer}/{z}/{x}/{y}.${extension}${key}`;
}

/** Required by Stadia's terms, and shown by Mapbox's own attribution control. */
const STAMEN_ATTRIBUTION = [
  '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener">Stadia Maps</a>',
  '&copy; <a href="https://stamen.com/" target="_blank" rel="noopener">Stamen Design</a>',
  '&copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a>',
  '&copy; <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
].join(" ");

/** Highest zoom Stamen renders natively; past this the tiles are upscaled. */
const STAMEN_MAX_ZOOM = 16;

interface StamenOptions {
  /** Tile set id under Stadia's `/tiles/` path. */
  tiles: string;
  extension: "jpg" | "png";
  /**
   * Label tile set drawn above the basemap. Watercolor and terrain ship no
   * lettering of their own, so without this the map is unreadable as geography.
   */
  labels?: string;
}

/**
 * Builds a style around Stamen's raster tiles. Raster basemaps have no style
 * document to point at, so the whole specification is assembled here.
 */
function stamenStyle({
  tiles,
  extension,
  labels,
}: StamenOptions): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: [tileUrl(tiles, extension)],
        tileSize: 256,
        maxzoom: STAMEN_MAX_ZOOM,
        attribution: STAMEN_ATTRIBUTION,
      },
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  };

  if (labels) {
    style.sources.labels = {
      type: "raster",
      tiles: [tileUrl(labels, "png")],
      tileSize: 256,
      maxzoom: STAMEN_MAX_ZOOM,
    };
    style.layers.push({ id: "labels", type: "raster", source: "labels" });
  }

  return style;
}

/**
 * Named basemaps selectable from `journey.yaml`. Anything not listed here has
 * to be a style URL.
 */
const PRESETS: Record<string, () => MapStyle> = {
  standard: () => "mapbox://styles/mapbox/standard",
  light: () => "mapbox://styles/mapbox/light-v11",
  outdoors: () => "mapbox://styles/mapbox/outdoors-v12",
  satellite: () => "mapbox://styles/mapbox/satellite-streets-v12",
  // Watercolor is painterly and carries no lettering at all, so place names are
  // layered back on. Toner's labels rather than terrain's: terrain's carry road
  // shields, which is exactly the street-map clutter the deck suppresses
  // elsewhere.
  watercolor: () =>
    stamenStyle({
      tiles: "stamen_watercolor",
      extension: "jpg",
      labels: "stamen_toner_labels",
    }),
  // Terrain and toner already draw their own labels, so they need no overlay.
  terrain: () => stamenStyle({ tiles: "stamen_terrain", extension: "png" }),
  toner: () => stamenStyle({ tiles: "stamen_toner", extension: "png" }),
};

/** Every name `mapStyle` accepts, in the order they are documented. */
export const MAP_STYLE_PRESETS = Object.keys(PRESETS);

/** Whether `value` is a style URL rather than a preset name. */
export function isStyleUrl(value: string): boolean {
  return value.startsWith("mapbox://") || /^https?:\/\//.test(value);
}

/** True for a preset name or a style URL — what the schema accepts. */
export function isKnownMapStyle(value: string): boolean {
  return isStyleUrl(value) || value in PRESETS;
}

/** Resolves `mapStyle` to something Mapbox GL can load. URLs pass through. */
export function resolveMapStyle(value: string): MapStyle {
  return PRESETS[value]?.() ?? value;
}
