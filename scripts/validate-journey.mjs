#!/usr/bin/env node
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { locatePath, parseCardFile, parseJourney } from "../src/journey/load.ts";

const publicDir = new URL("../public/", import.meta.url);

/**
 * Validates public/journey.yaml and any intro/outro card files it names,
 * exiting non-zero with one line per problem.
 */
async function main() {
  const journeyResult = await readAndParse("journey.yaml", parseJourney);
  if (!journeyResult) return;
  const { journey } = journeyResult;

  const documents = [
    { name: "journey.yaml", source: journeyResult.source, cards: journey.stops, root: "stops" },
  ];

  for (const [key, path] of [
    ["intro", journey.intro],
    ["outro", journey.outro],
  ]) {
    if (!path) continue;
    const name = path.replace(/^\//, "");
    const result = await readAndParse(name, (source) => parseCardFile(source, name));
    if (!result) return;
    documents.push({ name, source: result.source, cards: result.cards, root: "cards" });
  }

  const missing = documents.flatMap((document) => findMissingImages(document));
  const resolved = await Promise.all(missing.map(async (entry) => ((await exists(entry.target)) ? null : entry)));
  const broken = resolved.filter((entry) => entry !== null);
  if (broken.length > 0) {
    fail("Content references images that do not exist", broken.map((entry) => entry.issue));
    return;
  }

  const counts = documents.map((document) => `${document.cards.length} in ${document.name}`);
  console.log(`Content is valid — "${journey.title}", ${counts.join(", ")}`);
}

/** Reads a file under `public/` and runs `parse` on it, or fails loudly. */
async function readAndParse(name, parse) {
  let source;
  try {
    source = await readFile(fileURLToPath(new URL(name, publicDir)), "utf8");
  } catch (error) {
    fail(`Could not read public/${name}`, [{ file: name, message: error.message }]);
    return null;
  }

  const result = parse(source);
  if (!result.ok) {
    fail(result.title, result.issues);
    return null;
  }
  // The source travels with the result so later checks can locate their own
  // findings in it, the same way schema violations are located.
  return { ...result, source };
}

/**
 * Collects every root-relative image reference in a document.
 * The dev server answers an unknown path with the SPA fallback HTML and a 200,
 * so a mistyped path yields a silently broken image rather than an error.
 */
function findMissingImages({ name, source, cards, root }) {
  const candidates = [];
  for (const [index, card] of cards.entries()) {
    for (const [imageIndex, image] of card.images.entries()) {
      if (!image.src.startsWith("/")) continue;
      // The shorthand form is a bare string, so `src` only exists as its own
      // node when the long form was used.
      const path = [root, index, "images", imageIndex];
      candidates.push({
        target: new URL(`.${image.src}`, publicDir),
        issue: {
          file: name,
          path: path.join("."),
          message: `No such file: ${image.src} (in "${card.title}")`,
          ...locatePath(source, path),
        },
      });
    }
  }
  return candidates;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prints each issue the way a compiler would — `file:line:col`, the message,
 * then the offending source line with a caret — so a failure can be acted on
 * without opening the file to hunt for it.
 */
function fail(title, issues) {
  console.error(title);
  for (const issue of issues) {
    const position = issue.line === undefined ? "" : `:${issue.line}:${issue.column ?? 1}`;
    const where = issue.file ? `${issue.file}${position}` : "";
    console.error(`\n  ${where}`.trimEnd());
    console.error(`  ${issue.path ? `${issue.path} — ` : ""}${issue.message}`);
    if (issue.excerpt) {
      const gutter = issue.line === undefined ? "" : `${issue.line} | `;
      console.error(`    ${gutter}${issue.excerpt}`);
      if (issue.column !== undefined) {
        console.error(`    ${" ".repeat(gutter.length + issue.column - 1)}^`);
      }
    }
  }
  process.exitCode = 1;
}

await main();
