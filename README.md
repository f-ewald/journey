# Map Journey

A frontend-only, scroll-driven map presentation. A full-viewport Mapbox map sits
fixed behind the page; scrolling advances through a sequence of stops. The
camera flies each stop into the centre of the left third, a large-format content
panel fills the right half, a dot rail on the right edge jumps between stops, and
a dotted line draws progressively along the journey as you scroll — and retracts
when you scroll back.

Built on [`@f-ewald/components`](https://www.npmjs.com/package/@f-ewald/components).

## Setup

```bash
npm install
cp .env.example .env      # then paste your Mapbox token into VITE_MAPBOX_TOKEN
npm run dev
```

A token is required: create one at
<https://account.mapbox.com/access-tokens/>. Without it the app renders an
explicit error instead of a blank map. `.env` is gitignored.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server with hot reload. |
| `npm run validate` | Parse and schema-check `public/journey.yaml`. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run build` | Typecheck, then build into `dist/`. |
| `npm run preview` | Serve the production build. |

## Authoring content

All content lives in `public/journey.yaml`. It is fetched at runtime, so editing
it needs no rebuild — save the file and reload the page. Run `npm run validate`
to check it without opening a browser; any problem is reported with its exact
path (e.g. `stops.2.lat`), and the running app shows the same message on screen
rather than failing silently.

```yaml
title: California Coast Journey          # optional, also used as the page title
mapStyle: mapbox://styles/mapbox/standard # optional
mapTheme: faded                          # optional: default | faded | monochrome
defaultZoom: 10                          # optional, used when a stop omits `zoom`
flyDurationMs: 2570                      # optional, camera flight time; higher is slower

stops:
  - title: Northwind Labs            # required — the place or organisation
    location: Porto, CA # optional, geographic context for the title
    year: 2011                 # optional, shown above the title
    lng: -122.4194             # required
    lat: 37.7749               # required
    zoom: 11.5                 # optional, overrides defaultZoom
    body: |                    # optional markdown
      ## Where it begins

      Fog rolls through the Golden Gate most summer mornings.
    images:                    # optional
      - src: /images/golden-gate.svg
        alt: Stylised view of the Golden Gate Bridge
        caption: Leaving the city
      - /images/bay.jpg        # shorthand: a bare path
```

`year` and `location` share one line above the title, in the same monospaced
face, with the location a shade darker. Both are optional and independent:
supply either, both, or neither. With both missing the line is dropped entirely
rather than left as blank space. `year` accepts a number or a string, so both
`year: 2011` and `year: "2011-2014"` work. Unknown keys are rejected, so a typo
like `titel:` is an error rather than a silently missing field.

`flyDurationMs` sets how long the camera takes to travel between stops, in
milliseconds — raise it to slow the transition down. It applies per hop, so a
short hop and a transatlantic one take the same time. Under
`prefers-reduced-motion` the camera jumps instantly and the value is ignored.
Scroll and rail-click scrolling are handled by the browser and are not affected.

The basemap is [Mapbox Standard](https://docs.mapbox.com/map-styles/reference/standard/)
with road, POI and transit labels suppressed and administrative boundaries kept,
so the map reads politically and geographically rather than as a street map.
`mapTheme` tunes its saturation and only applies to Standard — classic styles
(`light-v11`, `outdoors-v12`, …) ignore it, and the label configuration is
skipped for them automatically. Images are served straight from `public/`; one image
renders as a plain figure, several become a carousel.

## Navigation

- **Scroll** — one stop per viewport, snapped.
- **Keyboard** — space, page up/down and the arrow keys work as usual.
- **Dot rail** — click any dot to glide to that stop; the active stop is the
  elongated bar.
- **Full screen** — the button below the rail expands the deck to fill the
  display; press it again or hit Escape to leave.
- **URL** — the active stop is mirrored as `#stop-3`, so a reload or a shared
  link resumes at the same place.

Respects `prefers-reduced-motion`: camera moves and rail scrolling become
instant jumps and the line stops animating.

## Non-goals

Phones and narrow viewports are **not** supported — the layout is a fixed
horizontal split intended for a laptop or projector, and there is no fallback
arrangement. There is also no deployment setup: a static deploy would embed the
Mapbox token in the client bundle, which needs a separate URL-restricted public
token.

## Layout of the source

| Path | Contents |
| --- | --- |
| `src/journey/` | YAML schema (zod) and the runtime loader. |
| `src/map/` | Mapbox controller (camera, markers, line) and its pure geometry helpers. |
| `src/ui/` | Sections and panels, the dot rail, the fullscreen toggle, and the error surface. |
| `src/scroll.ts` | The single active-stop and line-progress signal everything else consumes. |
| `src/hash.ts` | `#stop-n` deep linking. |
| `scripts/` | `validate-journey.mjs`, which reuses the same schema as the app. |
