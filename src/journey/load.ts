import { parse } from "yaml";
import { formatIssues, journeySchema, type Journey } from "./schema.ts";

export type JourneyResult =
  | { ok: true; journey: Journey }
  | { ok: false; title: string; details: string[] };

/**
 * Parses and validates a journey YAML document. Never throws: syntax errors,
 * a non-mapping root, and schema violations all come back as `ok: false` with
 * one human-readable detail line per problem.
 */
export function parseJourney(source: string): JourneyResult {
  let raw: unknown;
  try {
    raw = parse(source);
  } catch (error) {
    return {
      ok: false,
      title: "journey.yaml is not valid YAML",
      details: [error instanceof Error ? error.message : String(error)],
    };
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      title: "journey.yaml is empty or not a mapping",
      details: ["Expected a top-level mapping with a `stops` list."],
    };
  }

  const result = journeySchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      title: "journey.yaml does not match the expected schema",
      details: formatIssues(result.error),
    };
  }

  return { ok: true, journey: result.data };
}

/** Fetches a journey YAML document and validates it. Never throws. */
export async function loadJourney(url: string): Promise<JourneyResult> {
  let source: string;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        ok: false,
        title: `Could not load ${url}`,
        details: [`The server responded with ${response.status} ${response.statusText}.`],
      };
    }
    source = await response.text();
  } catch (error) {
    return {
      ok: false,
      title: `Could not load ${url}`,
      details: [error instanceof Error ? error.message : String(error)],
    };
  }

  return parseJourney(source);
}
