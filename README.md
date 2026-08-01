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
title: California Coast Journey            # optional, also used as the page title
mapStyle: mapbox://styles/mapbox/light-v11 # optional
defaultZoom: 10                            # optional, used when a stop omits `zoom`

stops:
  - title: Lisbon       # required
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

Unknown keys are rejected, so a typo like `titel:` is an error rather than a
silently missing field. Images are served straight from `public/`; one image
renders as a plain figure, several become a carousel.

## Navigation

- **Scroll** — one stop per viewport, snapped.
- **Keyboard** — space, page up/down and the arrow keys work as usual.
- **Dot rail** — click any dot to glide to that stop; the active stop is the
  elongated bar.
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
| `src/ui/` | Sections and panels, the dot rail, and the error surface. |
| `src/scroll.ts` | The single active-stop and line-progress signal everything else consumes. |
| `src/hash.ts` | `#stop-n` deep linking. |
| `scripts/` | `validate-journey.mjs`, which reuses the same schema as the app. |
