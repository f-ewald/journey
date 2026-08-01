import { z } from "zod";

export const DEFAULT_MAP_STYLE = "mapbox://styles/mapbox/light-v11";
export const DEFAULT_ZOOM = 11;

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

const stopSchema = z.strictObject({
  title: z.string().min(1),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  zoom: z.number().min(0).max(22).optional(),
  body: z.string().default(""),
  images: z.array(imageSchema).default([]),
});

export const journeySchema = z.strictObject({
  title: z.string().min(1).default("Map Journey"),
  mapStyle: z.string().min(1).default(DEFAULT_MAP_STYLE),
  defaultZoom: z.number().min(0).max(22).default(DEFAULT_ZOOM),
  stops: z.array(stopSchema).min(1),
});

export type JourneyImage = z.infer<typeof imageSchema>;
export type JourneyStop = z.infer<typeof stopSchema>;
export type Journey = z.infer<typeof journeySchema>;

/**
 * Renders zod issues as one `path: message` line per issue, using `(root)` for
 * issues that carry no path.
 */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

/** Effective zoom for a stop: its own override, else the deck default. */
export function zoomFor(stop: JourneyStop, journey: Journey): number {
  return stop.zoom ?? journey.defaultZoom;
}
