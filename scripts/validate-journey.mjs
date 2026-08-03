#!/usr/bin/env node
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseJourney } from "../src/journey/load.ts";

const path = fileURLToPath(new URL("../public/journey.yaml", import.meta.url));
const publicDir = new URL("../public/", import.meta.url);

/** Validates public/journey.yaml, exiting non-zero with one line per problem. */
async function main() {
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    fail("Could not read public/journey.yaml", [error.message]);
    return;
  }

  const result = parseJourney(source);
  if (!result.ok) {
    fail(result.title, result.details);
    return;
  }

  const missing = await findMissingImages(result.journey);
  if (missing.length > 0) {
    fail("references images that do not exist", missing);
    return;
  }

  const { title, stops } = result.journey;
  console.log(`journey.yaml is valid — "${title}", ${stops.length} stop(s)`);
}

/**
 * Reports root-relative image paths with no matching file under `public/`.
 * The dev server answers an unknown path with the SPA fallback HTML and a 200,
 * so a mistyped path yields a silently broken image rather than an error.
 */
async function findMissingImages(journey) {
  const missing = [];
  for (const [index, stop] of journey.stops.entries()) {
    for (const image of stop.images) {
      if (!image.src.startsWith("/")) continue;
      const target = new URL(`.${image.src}`, publicDir);
      try {
        await access(target);
      } catch {
        missing.push(`stops.${index}.images: ${image.src} (stop "${stop.title}")`);
      }
    }
  }
  return missing;
}

function fail(title, details) {
  console.error(`journey.yaml: ${title}`);
  for (const detail of details) console.error(`  - ${detail}`);
  process.exitCode = 1;
}

await main();
