import { z } from "zod";

export const DEFAULT_MAP_STYLE = "mapbox://styles/mapbox/standard";
/** Only applies to styles built on Mapbox Standard; ignored by classic styles. */
export const DEFAULT_MAP_THEME = "faded";
export const DEFAULT_ZOOM = 11;
/** Camera flight time between stops, in milliseconds. Higher is slower. */
export const DEFAULT_FLY_DURATION_MS = 2570;
/** How place-less intro and outro cards are presented when unspecified. */
export const DEFAULT_LAYOUT = "map";
/** Fallback deck title, used before the YAML loads and when it omits one. */
export const DEFAULT_TITLE = "Journey";

const imageObjectSchema = z.strictObject({
  src: z.string().min(1),
  alt: z.string().default(""),
  caption: z.string().optional(),
});

/** Accepts either a bare path string or a full `{ src, alt, caption }` mapping. */
const imageSchema = z.union([
  z
    .string()
    .min(1)
    .transform((src) => ({ src, alt: "", caption: undefined })),
  imageObjectSchema,
]);

/** `year: 2011` and `year: "2011-2014"` are both valid; both become strings. */
const yearSchema = z
  .union([z.string().min(1), z.number()])
  .transform((value) => String(value));

/** Fields every card carries, whether or not it is pinned to a place. */
const cardFields = {
  title: z.string().min(1),
  year: yearSchema.nullish(),
  /** Geographic context for the title, e.g. "Porto, CA". */
  location: z.string().min(1).nullish(),
  body: z.string().default(""),
  images: z.array(imageSchema).default([]),
};

/** A card with no coordinates, used for the intro and outro sequences. */
const placelessCardSchema = z.strictObject({ ...cardFields });

const stopSchema = z.strictObject({
  ...cardFields,
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  zoom: z.number().min(0).max(22).optional(),
});

/**
 * Schema for `intro.yaml` and `outro.yaml`. An empty list is valid and simply
 * contributes no cards, so a deck can open or close straight on the map without
 * having to delete the file or unwire it from `journey.yaml`. `cards:` written
 * with no value at all reads as empty too.
 */
export const cardFileSchema = z.strictObject({
  cards: z
    .array(placelessCardSchema)
    .nullish()
    .transform((cards) => cards ?? []),
});

export const journeySchema = z.strictObject({
  title: z.string().min(1).default(DEFAULT_TITLE),
  mapStyle: z.string().min(1).default(DEFAULT_MAP_STYLE),
  mapTheme: z
    .enum(["default", "faded", "monochrome"])
    .default(DEFAULT_MAP_THEME),
  defaultZoom: z.number().min(0).max(22).default(DEFAULT_ZOOM),
  flyDurationMs: z.number().min(0).max(20000).default(DEFAULT_FLY_DURATION_MS),
  /** How the place-less intro and outro cards are presented. */
  layout: z.enum(["map", "timeline"]).default(DEFAULT_LAYOUT),
  /** Path to a card file shown before the stops, relative to the site root. */
  intro: z.string().min(1).nullish(),
  /** Path to a card file shown after the stops, relative to the site root. */
  outro: z.string().min(1).nullish(),
  /** Gives each timeline card the whole viewport instead of fitting several on screen. */
  singleCardPerScreen: z.boolean().default(false),
  stops: z.array(stopSchema).min(1),
});

export type JourneyImage = z.infer<typeof imageSchema>;
export type PlacelessCard = z.infer<typeof placelessCardSchema>;
export type JourneyStop = z.infer<typeof stopSchema>;
export type JourneyCard = PlacelessCard | JourneyStop;
export type CardFile = z.infer<typeof cardFileSchema>;
export type Journey = z.infer<typeof journeySchema>;

/** One schema violation, with the document path that caused it. */
export interface SchemaIssue {
  /** Path into the document, e.g. `["stops", 2, "lat"]`. Empty at the root. */
  path: Array<string | number>;
  /** The same path rendered for display, or `(root)`. */
  label: string;
  message: string;
}

/** Flattens a zod error into one issue per violation, keeping the raw path. */
export function schemaIssues(error: z.ZodError): SchemaIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.filter(
      (segment): segment is string | number =>
        typeof segment === "string" || typeof segment === "number",
    );
    return {
      path,
      label: path.length > 0 ? path.join(".") : "(root)",
      message: issue.message,
    };
  });
}

/** Effective zoom for a stop: its own override, else the deck default. */
export function zoomFor(stop: JourneyStop, journey: Journey): number {
  return stop.zoom ?? journey.defaultZoom;
}
