import { parse } from "yaml";
import {
  cardFileSchema,
  formatIssues,
  journeySchema,
  type CardFile,
  type Journey,
  type JourneyCard,
} from "./schema.ts";

export type JourneyResult =
  | { ok: true; journey: Journey }
  | { ok: false; title: string; details: string[] };

export type CardFileResult =
  | { ok: true; cards: CardFile["cards"] }
  | { ok: false; title: string; details: string[] };

export type DeckResult =
  | { ok: true; journey: Journey; intro: JourneyCard[]; outro: JourneyCard[] }
  | { ok: false; title: string; details: string[] };

type ParseFailure = { title: string; details: string[] };

/**
 * Parses `source` as a YAML mapping. Returns the raw value, or a failure
 * describing the syntax error or wrong root type, labelled with `name`.
 */
function parseMapping(
  source: string,
  name: string,
  rootHint: string,
): { ok: true; raw: unknown } | ({ ok: false } & ParseFailure) {
  let raw: unknown;
  try {
    raw = parse(source);
  } catch (error) {
    return {
      ok: false,
      title: `${name} is not valid YAML`,
      details: [error instanceof Error ? error.message : String(error)],
    };
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      title: `${name} is empty or not a mapping`,
      details: [`Expected a top-level mapping with a \`${rootHint}\` list.`],
    };
  }

  return { ok: true, raw };
}

/**
 * Parses and validates a journey YAML document. Never throws: syntax errors,
 * a non-mapping root, and schema violations all come back as `ok: false` with
 * one human-readable detail line per problem.
 */
export function parseJourney(
  source: string,
  name = "journey.yaml",
): JourneyResult {
  const mapping = parseMapping(source, name, "stops");
  if (!mapping.ok) return mapping;

  const result = journeySchema.safeParse(mapping.raw);
  if (!result.success) {
    return {
      ok: false,
      title: `${name} does not match the expected schema`,
      details: formatIssues(result.error),
    };
  }

  return { ok: true, journey: result.data };
}

/** Parses and validates an intro/outro card file. Never throws. */
export function parseCardFile(source: string, name: string): CardFileResult {
  const mapping = parseMapping(source, name, "cards");
  if (!mapping.ok) return mapping;

  const result = cardFileSchema.safeParse(mapping.raw);
  if (!result.success) {
    return {
      ok: false,
      title: `${name} does not match the expected schema`,
      details: formatIssues(result.error),
    };
  }

  return { ok: true, cards: result.data.cards };
}

/** Fetches `url` as text, or describes why it could not be read. */
async function fetchText(
  url: string,
): Promise<{ ok: true; source: string } | ({ ok: false } & ParseFailure)> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        ok: false,
        title: `Could not load ${url}`,
        details: [
          `The server responded with ${response.status} ${response.statusText}.`,
        ],
      };
    }
    return { ok: true, source: await response.text() };
  } catch (error) {
    return {
      ok: false,
      title: `Could not load ${url}`,
      details: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/** Fetches a journey YAML document and validates it. Never throws. */
export async function loadJourney(url: string): Promise<JourneyResult> {
  const text = await fetchText(url);
  if (!text.ok) return text;
  return parseJourney(text.source, url.replace(/^\//, ""));
}

/** Fetches an intro/outro card file and validates it. Never throws. */
export async function loadCardFile(url: string): Promise<CardFileResult> {
  const text = await fetchText(url);
  if (!text.ok) return text;
  return parseCardFile(text.source, url.replace(/^\//, ""));
}

/** Resolves a card file path from `journey.yaml` against the site root. */
export function cardFileUrl(path: string): string {
  return path.startsWith("/") || /^https?:/.test(path) ? path : `/${path}`;
}

/**
 * Loads the journey plus any intro and outro card files it names. Fails with
 * the first offending file, so the error surface always names one document.
 */
export async function loadDeck(url: string): Promise<DeckResult> {
  const journeyResult = await loadJourney(url);
  if (!journeyResult.ok) return journeyResult;
  const { journey } = journeyResult;

  const intro = journey.intro
    ? await loadCardFile(cardFileUrl(journey.intro))
    : null;
  if (intro && !intro.ok) return intro;

  const outro = journey.outro
    ? await loadCardFile(cardFileUrl(journey.outro))
    : null;
  if (outro && !outro.ok) return outro;

  return {
    ok: true,
    journey,
    intro: intro?.cards ?? [],
    outro: outro?.cards ?? [],
  };
}
