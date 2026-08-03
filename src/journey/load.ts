import { LineCounter, parseDocument, type Document } from "yaml";
import {
  cardFileSchema,
  journeySchema,
  schemaIssues,
  type CardFile,
  type Journey,
  type JourneyCard,
  type SchemaIssue,
} from "./schema.ts";

/**
 * One problem with a content file, located precisely enough to fix without
 * hunting: the file it is in, the line and column it starts at, the path
 * through the document, and the offending source line itself.
 */
export interface SourceIssue {
  /** File the problem is in, e.g. `journey.yaml`. Absent for non-file errors. */
  file?: string;
  /** 1-based line, when the problem could be located in the source. */
  line?: number;
  /** 1-based column. */
  column?: number;
  /** Path into the document, e.g. `stops.2.lat`. */
  path?: string;
  message: string;
  /** The offending source line, trimmed of trailing whitespace. */
  excerpt?: string;
}

export type JourneyResult =
  | { ok: true; journey: Journey }
  | { ok: false; title: string; issues: SourceIssue[] };

export type CardFileResult =
  | { ok: true; cards: CardFile["cards"] }
  | { ok: false; title: string; issues: SourceIssue[] };

export type DeckResult =
  | { ok: true; journey: Journey; intro: JourneyCard[]; outro: JourneyCard[] }
  | { ok: false; title: string; issues: SourceIssue[] };

type Failure = { ok: false; title: string; issues: SourceIssue[] };

interface ParsedDocument {
  doc: Document.Parsed;
  lineCounter: LineCounter;
}

/**
 * Parses `source` into a document that still knows where everything came from,
 * or fails with every syntax error located by line and column.
 */
function parseWithPositions(
  source: string,
  file: string,
): { ok: true; parsed: ParsedDocument } | Failure {
  const lineCounter = new LineCounter();
  const doc = parseDocument(source, { lineCounter });

  if (doc.errors.length > 0) {
    return {
      ok: false,
      title: `${file} is not valid YAML`,
      issues: doc.errors.map((error) => {
        const start = error.linePos?.[0];
        return {
          file,
          line: start?.line,
          column: start?.col,
          message: describe(error.message),
          excerpt: start ? lineAt(source, start.line) : undefined,
        };
      }),
    };
  }

  return { ok: true, parsed: { doc, lineCounter } };
}

/**
 * Locates a schema issue in the source. A missing key has no node of its own,
 * so the path is walked back toward the root until something with a position is
 * found — pointing at the mapping that should have contained it.
 */
function locate(
  { doc, lineCounter }: ParsedDocument,
  source: string,
  file: string,
  issue: SchemaIssue,
): SourceIssue {
  for (let path = issue.path; ; path = path.slice(0, -1)) {
    const node: unknown =
      path.length > 0 ? doc.getIn(path, true) : doc.contents;
    const range = (node as { range?: [number, number, number] } | undefined)
      ?.range;
    if (range) {
      const position = lineCounter.linePos(range[0]);
      return {
        file,
        line: position.line,
        column: position.col,
        path: issue.label,
        message: issue.message,
        excerpt: lineAt(source, position.line),
      };
    }
    if (path.length === 0)
      return { file, path: issue.label, message: issue.message };
  }
}

/**
 * The parser appends its own `at line N, column M:` and a source excerpt to
 * every message. Both are reported separately here, so only the description is
 * kept — otherwise each problem prints its location and excerpt twice.
 */
function describe(message: string): string {
  return message.split(/ at line \d+, column \d+:/)[0].trim();
}

/**
 * Position of `path` within a YAML source, for problems found after parsing —
 * a referenced image that does not exist, say — so they can be reported the
 * same way schema violations are.
 */
export function locatePath(
  source: string,
  path: Array<string | number>,
): Pick<SourceIssue, "line" | "column" | "excerpt"> {
  const parsed = parseWithPositions(source, "");
  if (!parsed.ok) return {};
  const located = locate(parsed.parsed, source, "", { path, label: "", message: "" });
  return { line: located.line, column: located.column, excerpt: located.excerpt };
}

/** The 1-based `line` of `source`, with trailing whitespace removed. */
function lineAt(source: string, line: number): string | undefined {
  return source.split("\n")[line - 1]?.trimEnd();
}

/**
 * Parses and validates a journey YAML document. Never throws: syntax errors,
 * a non-mapping root, and schema violations all come back as `ok: false` with
 * one located issue per problem.
 */
export function parseJourney(
  source: string,
  file = "journey.yaml",
): JourneyResult {
  const parsed = parseWithPositions(source, file);
  if (!parsed.ok) return parsed;

  const raw: unknown = parsed.parsed.doc.toJS();
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      title: `${file} is empty or not a mapping`,
      issues: [
        { file, message: "Expected a top-level mapping with a `stops` list." },
      ],
    };
  }

  const result = journeySchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      title: `${file} does not match the expected schema`,
      issues: schemaIssues(result.error).map((issue) =>
        locate(parsed.parsed, source, file, issue),
      ),
    };
  }

  return { ok: true, journey: result.data };
}

/** Parses and validates an intro/outro card file. Never throws. */
export function parseCardFile(source: string, file: string): CardFileResult {
  const parsed = parseWithPositions(source, file);
  if (!parsed.ok) return parsed;

  const raw: unknown = parsed.parsed.doc.toJS();
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      title: `${file} is empty or not a mapping`,
      issues: [
        { file, message: "Expected a top-level mapping with a `cards` list." },
      ],
    };
  }

  const result = cardFileSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      title: `${file} does not match the expected schema`,
      issues: schemaIssues(result.error).map((issue) =>
        locate(parsed.parsed, source, file, issue),
      ),
    };
  }

  return { ok: true, cards: result.data.cards };
}

/** Fetches `url` as text, or describes why it could not be read. */
async function fetchText(
  url: string,
): Promise<{ ok: true; source: string } | Failure> {
  const file = fileNameOf(url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        ok: false,
        title: `Could not load ${file}`,
        issues: [
          {
            file,
            message: `The server responded with ${response.status} ${response.statusText}.`,
          },
        ],
      };
    }
    return { ok: true, source: await response.text() };
  } catch (error) {
    return {
      ok: false,
      title: `Could not load ${file}`,
      issues: [
        {
          file,
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

/** Fetches a journey YAML document and validates it. Never throws. */
export async function loadJourney(url: string): Promise<JourneyResult> {
  const text = await fetchText(url);
  if (!text.ok) return text;
  return parseJourney(text.source, fileNameOf(url));
}

/** Fetches an intro/outro card file and validates it. Never throws. */
export async function loadCardFile(url: string): Promise<CardFileResult> {
  const text = await fetchText(url);
  if (!text.ok) return text;
  return parseCardFile(text.source, fileNameOf(url));
}

/** Resolves a card file path from `journey.yaml` against the site root. */
export function cardFileUrl(path: string): string {
  return path.startsWith("/") || /^https?:/.test(path) ? path : `/${path}`;
}

function fileNameOf(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "");
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
