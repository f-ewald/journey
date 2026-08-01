#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseJourney } from "../src/journey/load.ts";

const path = fileURLToPath(new URL("../public/journey.yaml", import.meta.url));

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

  const { title, stops } = result.journey;
  console.log(`journey.yaml is valid — "${title}", ${stops.length} stop(s)`);
}

function fail(title, details) {
  console.error(`journey.yaml: ${title}`);
  for (const detail of details) console.error(`  - ${detail}`);
  process.exitCode = 1;
}

await main();
