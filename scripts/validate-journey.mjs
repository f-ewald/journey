#!/usr/bin/env node
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseCardFile, parseJourney } from "../src/journey/load.ts";

const publicDir = new URL("../public/", import.meta.url);

/**
 * Validates public/journey.yaml and any intro/outro card files it names,
 * exiting non-zero with one line per problem.
 */
async function main() {
  const journeyResult = await readAndParse("journey.yaml", parseJourney);
  if (!journeyResult) return;
  const { journey } = journeyResult;

  const documents = [{ name: "journey.yaml", cards: journey.stops, root: "stops" }];

  for (const [key, path] of [
    ["intro", journey.intro],
    ["outro", journey.outro],
  ]) {
    if (!path) continue;
    const name = path.replace(/^\//, "");
    const result = await readAndParse(name, (source) => parseCardFile(source, name));
    if (!result) return;
    documents.push({ name: `${name} (${key})`, cards: result.cards, root: "cards" });
  }

  const missing = documents.flatMap((document) => findMissingImages(document));
  const resolved = await Promise.all(missing.map(async (entry) => ((await exists(entry.target)) ? null : entry)));
  const broken = resolved.filter((entry) => entry !== null);
  if (broken.length > 0) {
    fail(
      "content references images that do not exist",
      broken.map((entry) => entry.message),
    );
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
    fail(`Could not read public/${name}`, [error.message]);
    return null;
  }

  const result = parse(source);
  if (!result.ok) {
    fail(result.title, result.details);
    return null;
  }
  return result;
}

/**
 * Collects every root-relative image reference in a document.
 * The dev server answers an unknown path with the SPA fallback HTML and a 200,
 * so a mistyped path yields a silently broken image rather than an error.
 */
function findMissingImages({ name, cards, root }) {
  const candidates = [];
  for (const [index, card] of cards.entries()) {
    for (const image of card.images) {
      if (!image.src.startsWith("/")) continue;
      candidates.push({
        target: new URL(`.${image.src}`, publicDir),
        message: `${name} → ${root}.${index}.images: ${image.src} ("${card.title}")`,
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

function fail(title, details) {
  console.error(title);
  for (const detail of details) console.error(`  - ${detail}`);
  process.exitCode = 1;
}

await main();
