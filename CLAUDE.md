# CLAUDE.md

Guidance for AI agents working in this repository. User-facing authoring docs
live in [`README.md`](./README.md) — read that for the YAML content format.
Traps that have already cost real debugging time are in
[`docs/gotchas.md`](./docs/gotchas.md); **read it before changing scroll,
layout, or image handling.**

## What this is

A frontend-only, scroll-driven map presentation. A fixed full-viewport Mapbox
map sits behind snap-scrolled sections; the camera flies each stop into the
centre of the left third while a large card fills the right half. A dot rail on
the right edge navigates, and a dotted line draws progressively along the
journey.

No backend, no deployment, no tests. Built on
[`@f-ewald/components`](https://www.npmjs.com/package/@f-ewald/components) —
`mapbox-map`, `map-pin`, `map-circle`, `markdown-view`, `photo-gallery`,
`scroll-dots`, `fullscreen-button`, `timeline-container`/`timeline-entry` all
come from there. Prefer adding a generic capability to that package over
hand-rolling it here.

## Commands

| Command             | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Dev server with hot reload.                                |
| `npm run validate`  | Schema-check the YAML files and verify every image exists. |
| `npm run typecheck` | `tsc --noEmit`.                                            |
| `npm run build`     | Typecheck, then build into `dist/`.                        |

Run `validate` after any content or schema change, and `build` before calling
work done. There is no test suite — verification is done in a real browser, see
"Verifying a change" below.

## Architecture

Content is fetched at runtime, so editing YAML needs no rebuild.

```
public/journey.yaml + intro.yaml + outro.yaml
   ↓ load.ts (zod, never throws)
buildSequence() → one flat list: intro cards → map stops → outro cards
   ↓
main.ts wires: sections + rail + hash + map controller
   ↑
scroll.ts publishes the single {activeIndex, segmentIndex, segmentProgress} signal
```

| Path            | Contents                                                             |
| --------------- | -------------------------------------------------------------------- |
| `src/journey/`  | zod schema, the loader, and the intro/stops/outro sequence.          |
| `src/map/`      | Mapbox controller (camera, markers, line) and pure geometry helpers. |
| `src/ui/`       | Sections and panels, and the error surface.                          |
| `src/scroll.ts` | The one active-card and line-progress signal everything consumes.    |
| `src/hash.ts`   | `#intro-n` / `#stop-n` / `#outro-n` deep linking.                    |
| `src/main.ts`   | Orchestration. The riskiest file — most invariants live here.        |
| `scripts/`      | `validate-journey.mjs`, sharing the runtime schema.                  |

## Invariants

Break these and the deck fails in ways that are hard to see.

1. **One index space.** `activeIndex` is a _sequence position_ spanning intro
   cards, stops and outro cards — not a stop index. Convert with
   `cameraStopFor()`. A place-less card has `stopIndex: null`; anything reading
   `journey.stops[i]` directly must go through that conversion.

2. **The journey line never advances outside the stop range.** `lineSegmentFor()`
   clamps it: zero before the first stop, fully drawn at and after the last.
   Skipping it draws the line during the intro.

3. **`scroll.ts` is the only scroll observer.** Camera, markers, line, rail and
   hash all derive from its single emit. Do not add a second listener.

4. **The active card is derived from section offsets, not a viewport-midpoint
   observer.** The handover sits halfway through the travel from the previous
   section. A fixed half-viewport threshold breaks short sections — timeline
   entries are ~40vh, and it reported card 2 as active while the page was still
   at the very top, making card 1 unreachable.

5. **The schema is `strictObject` and shared** by the runtime and
   `npm run validate`. An unknown key is a hard error, so adding a YAML field
   means editing `schema.ts` — otherwise the whole deck refuses to load.

6. **Errors surface, never throw.** `load.ts` returns
   `{ ok: false, title, details }` and `renderError` shows it on screen. Keep
   that contract.

## Conventions

- **TypeScript**: `erasableSyntaxOnly` is on, so no parameter properties
  (`constructor(private readonly x)`) and no enums. `verbatimModuleSyntax`
  requires `import type` for type-only imports. Relative imports use the real
  `.ts` extension.
- **Comments** explain _why_, never _what_. Every exported function gets a
  doc comment describing its contract.
- **CSS** uses `--ui-*` tokens from the component package with their exact
  fallbacks. Component internals are not reachable from here — style the host
  or slot content in.
- **Content** belongs in YAML under `public/`, never hardcoded in TS.

## Non-goals

Phones and narrow viewports are **not** supported — the layout is a fixed
horizontal split for a laptop or projector. There is no deployment setup: a
static deploy would embed the Mapbox token in the client bundle.

Do not add a test framework, a backend, or a router.

## Verifying a change

There is no test suite, so drive a real browser:

```bash
npm run dev -- --port 5199
node your-check.mjs   # playwright-core from ~/Development/components/node_modules
```

Launch Chromium with `--use-gl=swiftshader --enable-unsafe-swiftshader` so
Mapbox renders headless. Prefer computed styles and geometry measurements over
screenshots for anything involving fixed positioning or scrolling — see
`docs/gotchas.md` for why, and for the traps that make browser checks lie.

Always stop the dev server by explicit numeric PID (`lsof -ti tcp:5199`) and
delete scratch scripts afterwards.
