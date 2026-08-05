# Map Journey

A frontend-only, scroll-driven map presentation. A full-viewport Mapbox map sits
fixed behind the page; scrolling advances through a sequence of stops. The
camera flies each stop into the centre of the left third, a large-format content
panel fills the right half, a dot rail on the right edge jumps between stops, and
a dotted line draws progressively along the journey as you scroll — and retracts
when you scroll back.

Cards that belong to no place can bracket the journey: an intro before the first
stop and an outro after the last, either over the dimmed map or laid out along a
timeline.

Built on [`@f-ewald/components`](https://www.npmjs.com/package/@f-ewald/components).

## Getting started

```bash
npm install
cp .env.example .env      # paste your Mapbox token in
npm run dev
```

A Mapbox token is required: create one at
<https://account.mapbox.com/access-tokens/>. Without it the app renders an
explicit error instead of a blank map. `.env` is gitignored.

Your deck is yours: `journey.yaml`, `intro.yaml`, `outro.yaml` and everything
under `public/images/` are gitignored, so a personal journey and its
photographs never end up in the repository. The `.example.yaml` files are what
ship here, and they document every option.

### The smallest deck that works

`public/journey.yaml` is the only content file you need, and three lines of it
are enough:

```yaml
stops:
  - title: Berlin
    lng: 13.405
    lat: 52.52
```

Every other key has a default: that deck is titled "Journey", uses the
`standard` basemap, and opens on Berlin at zoom 11. A stop only ever requires
`title`, `lng` and `lat`.

To bracket the journey with cards that belong to no place, name the two
optional card files:

```yaml
intro: intro.yaml
outro: outro.yaml

stops:
  - title: Berlin
    lng: 13.405
    lat: 52.52
```

Each of those is a `cards:` list, where a card only requires `title`:

```yaml
cards:
  - title: Where it started
```

An empty `cards: []` is valid too, and simply contributes nothing — so a file
can stay wired up while you empty it out.

For a fuller starting point, with every option present and commented, copy the
examples instead of writing the files by hand:

```bash
cp public/journey.example.yaml public/journey.yaml
cp public/intro.example.yaml public/intro.yaml
cp public/outro.example.yaml public/outro.yaml
```

### Where the pictures go

Put image files anywhere under `public/images/`. Paths in YAML are written from
the site root rather than from the YAML file, so `public/images/berlin/street.jpg`
is referenced as `/images/berlin/street.jpg`:

```yaml
stops:
  - title: Berlin
    lng: 13.405
    lat: 52.52
    images:
      - /images/berlin/street.jpg
```

The long form adds alt text and an optional caption, and mixing the two forms
in one list is fine:

```yaml
stops:
  - title: Berlin
    lng: 13.405
    lat: 52.52
    images:
      - /images/berlin/street.jpg
      - src: /images/berlin/gate.jpg
        alt: A tram curving between old-town buildings at dusk
        caption: Leaving the city
```

Folder names may contain spaces. One image renders as a plain figure; several
become a carousel.

Run `npm run validate` after adding pictures. It checks that every referenced
file actually exists, which matters more than it sounds: the dev server answers
an unknown path with the app's own HTML and a `200`, so a mistyped path yields a
silently blank image rather than an error.

## Scripts

| Script              | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Dev server with hot reload.                                      |
| `npm run validate`  | Parse and schema-check `public/journey.yaml` and its card files. |
| `npm run typecheck` | `tsc --noEmit`.                                                  |
| `npm run build`     | Typecheck, then build into `dist/`.                              |
| `npm run preview`   | Serve the production build.                                      |

## Authoring content

All content lives in `public/journey.yaml` — gitignored, so start by copying
`public/journey.example.yaml` over it. It is fetched at runtime, so editing it
needs no rebuild — save the file and reload the page. Run `npm run validate`
to check it without opening a browser. Every problem is reported the way a
compiler reports one — `journey.yaml:40:10`, the document path, and the
offending line with a caret under the column:

```
journey.yaml:40:10
stops.1.lng — Invalid input: expected number, received string
  40 |     lng: eight
                ^
```

The running app shows exactly the same thing on screen rather than failing
silently, so a broken deck can be fixed from the projector. It also checks that every referenced image exists:
the dev server answers an unknown path with the app's HTML and a `200`, so a
mistyped image path otherwise yields a silently broken image rather than an
error.

```yaml
title: California Coast Journey # optional, also used as the page title
mapStyle: watercolor # optional, see "Basemaps" below
mapTheme: faded # optional: default | faded | monochrome
defaultZoom: 10 # optional, used when a stop omits `zoom`
flyDurationMs: 2570 # optional, camera flight time; higher is slower
layout: timeline # optional: map | timeline — intro/outro cards only
intro: intro.yaml # optional, cards shown before the stops
outro: outro.yaml # optional, cards shown after the stops
singleCardPerScreen: false # optional, timeline layout only
showZoomControls: false # optional, zoom buttons + manual panning

stops:
  - title: Northwind Labs # required — the place or organisation
    location: Porto, Portugal # optional, geographic context for the title
    year: 2012 # optional, shown above the title
    lng: -122.4194 # required
    lat: 37.7749 # required
    zoom: 11.5 # optional, overrides defaultZoom
    body: | # optional markdown, see below
      Fog rolls through the Golden Gate most summer mornings.
    images: # optional
      - src: /images/golden-gate.jpg
        alt: The Golden Gate Bridge at dawn
        caption: Leaving the city # optional
      - /images/bay.jpg # shorthand: a bare path
```

### Text on a card

Put it in `body`, using a YAML block scalar — the `|` keeps your line breaks:

```yaml
- title: College & Startup
  location: Vienna, Austria
  year: 2003
  lng: 7.0119
  lat: 51.4576
  body: |
    Studied here, and started a first company on the side. Markdown works in
    this field: **bold**, *italic*, and [links](https://example.com).

    - Bullet lists suit a few short highlights
    - One line each stays readable from the back of the room

    > A blockquote pulls out a line worth dwelling on.
```

When a stop has both, the image renders above the body text, and the image's
height budget shrinks so the text still fits on the card without scrolling.

Everything is indented under `body:` and separated by blank lines, exactly as in
a markdown file. Headings, ordered and unordered lists, tables, code blocks,
blockquotes, links and emphasis all render, styled to match the deck and scaled
up for projection. The markdown is sanitised before it is inserted, so pasted
content cannot inject scripts.

Two things worth knowing when writing for a room rather than a screen:

- The card grows with its content and scrolls internally past roughly 88% of the
  viewport height, so keep a stop to a handful of lines. If a card scrolls, the
  audience will not see the overflow.
- The stop's title is already the card's heading. Start the body at `###` if you
  need a sub-heading, so you don't compete with it.

`year` and `location` share one line above the title, in the same monospaced
face, with the location a shade darker. Both are optional and independent:
supply either, both, or neither. With both missing the line is dropped entirely
rather than left as blank space. `year` accepts a number or a string, so both
`year: 2012` and `year: "2012-2015"` work. Unknown keys are rejected, so a typo
like `titel:` is an error rather than a silently missing field.

`flyDurationMs` sets how long the camera takes to travel between stops, in
milliseconds — raise it to slow the transition down. It applies per hop, so a
short hop and a transatlantic one take the same time. Under
`prefers-reduced-motion` the camera jumps instantly and the value is ignored.
Scroll and rail-click scrolling are handled by the browser and are not affected.

### Basemaps

`mapStyle` takes a name, or any Mapbox style URL:

| Name                               | Basemap                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `standard`                         | Mapbox Standard (default)                                  |
| `light` / `outdoors` / `satellite` | The corresponding Mapbox styles                            |
| `watercolor`                       | Stamen Watercolor — painterly, with place names layered on |
| `terrain`                          | Stamen Terrain                                             |
| `toner`                            | Stamen Toner — high-contrast black and white               |

The Stamen basemaps are raster tiles hosted by Stadia Maps, who took them over
when Stamen retired their own servers in 2023. Browsers are served without an
API key, but that anonymous access is **rate limited** — once it starts
returning `429` the map stays blank, because Mapbox waits for the first tiles
before reporting itself ready. For anything that has to be reliable, put a free
key in `.env` as `VITE_STADIA_API_KEY`. Attribution is carried by the style and
appears in the map's own attribution control, as Stadia's terms require.

Watercolor carries no lettering of its own, so Toner's place labels are drawn
over it — Toner's rather than Terrain's, because Terrain's include road shields,
the street-map clutter this deck suppresses everywhere else.

### Moving the map by hand

`showZoomControls: true` adds zoom buttons and lets the map be dragged and
zoomed. The wheel and the arrow keys always stay with the deck, so scrolling
still advances the journey rather than zooming the map, and rotation stays off
since no camera flight ever sets a bearing. Scrolling to the next stop flies the
camera there, discarding whatever you moved to.

The basemap is [Mapbox Standard](https://docs.mapbox.com/map-styles/reference/standard/)
with road, POI and transit labels suppressed and administrative boundaries kept,
so the map reads politically and geographically rather than as a street map.
`mapTheme` tunes its saturation and only applies to Standard — the classic
Mapbox styles and the Stamen basemaps ignore it, and the label configuration is
skipped for them automatically. Images are served straight from `public/`; one image
renders as a plain figure, several become a carousel.

### Intro and outro cards

Some things in a story have no place on a map. Put those in their own files
under `public/` and name them from `journey.yaml` with `intro:` and `outro:`.
Both are optional, and scrolling runs straight through in one sequence:

```
intro cards  →  map stops  →  outro cards
```

A card file is a `cards:` list using the same fields as a stop, minus `lng`,
`lat` and `zoom`. The list may be empty — the deck then opens or closes straight
on the map, with no need to delete the file or unwire it:

```yaml
cards:
  - title: Where it started
    year: 1994 # optional
    location: Lisbon # optional
    body: | # optional markdown, exactly as on a stop
      Same **markdown** and the same image support.
    images: # optional
      - /images/start.jpg
```

`layout` chooses how these cards are presented. It governs the intro and outro
only — map stops always keep their card-over-the-map treatment, because they are
already represented by a point on the map.

- **`map`** (the default) — each card sits in the right half exactly like a
  stop, over a map that recedes behind frosted glass. The camera parks on the
  first stop for intro cards and the last for outro cards, so entering and
  leaving the journey needs no extra flight.
- **`timeline`** — the map is hidden and the cards run down a line in the middle
  of the screen, the year on one side and the card on the other, alternating
  every entry. Several are visible at once, but each is its own snap point, so
  one keypress still advances exactly one card. A card with no `year` simply
  leaves that side of the line empty. Drawn by `timeline-container`'s
  `alternating` layout, one container per run, so the line caps at each run's
  own end dots.

Set `singleCardPerScreen: true` to give each timeline card the whole viewport
instead, matching the map stops. It has no effect in `map` layout, where the
cards already fill the screen.

## Navigation

- **Scroll** — one stop per viewport, snapped.
- **Keyboard** — space, page up/down and the arrow keys work as usual.
- **Dot rail** — click any dot to glide to that stop; the active stop is the
  elongated bar.
- **Full screen** — the button below the rail expands the deck to fill the
  display; press it again or hit Escape to leave.
- **URL** — the active card is mirrored as `#intro-1`, `#stop-3` or `#outro-2`,
  so a reload or a shared link resumes at the same place. Namespacing the hash
  by kind means an existing `#stop-n` link keeps pointing at the same stop no
  matter how many intro cards are added in front of it.

Respects `prefers-reduced-motion`: camera moves and rail scrolling become
instant jumps and the line stops animating.

## Non-goals

Phones and narrow viewports are **not** supported — the layout is a fixed
horizontal split intended for a laptop or projector, and there is no fallback
arrangement. There is also no deployment setup: a static deploy would embed the
Mapbox token in the client bundle, which needs a separate URL-restricted public
token.

## Working on the code

Agent guidance, architecture and the invariants that are easy to break are in
[`CLAUDE.md`](./CLAUDE.md); traps that have already cost real debugging time
are in [`docs/gotchas.md`](./docs/gotchas.md).

## Layout of the source

| Path            | Contents                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/journey/`  | YAML schema (zod), the runtime loader, and the intro/stops/outro sequence.                                                        |
| `src/map/`      | Mapbox controller (camera, markers, line) and its pure geometry helpers.                                                          |
| `src/ui/`       | Sections and panels, and the error surface. The dot rail, the fullscreen toggle and the timeline come from `@f-ewald/components`. |
| `src/scroll.ts` | The single active-card and line-progress signal everything else consumes.                                                         |
| `src/hash.ts`   | `#intro-n` / `#stop-n` / `#outro-n` deep linking.                                                                                 |
| `scripts/`      | `validate-journey.mjs`, which reuses the same schema as the app.                                                                  |
