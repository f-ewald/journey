# Gotchas

Traps that have already cost real debugging time in this repository. Each one
produced a symptom that looked like a different bug. Read the relevant section
before touching that area.

## Tooling

**Vite serves unknown paths as the app's HTML with a `200`, not a `404`.** A
mistyped image path yields `content-type: text/html`, a few hundred bytes, and
an `<img>` that silently collapses — no console error. This is why
`npm run validate` checks that every referenced image exists on disk. If an
image is invisible, check the path before suspecting CSS.

**Vite pre-bundles linked dependencies.** After rebuilding `@f-ewald/components`
while it is `npm link`ed, the dev server keeps serving the old copy. Restart
with `rm -rf node_modules/.vite && npm run dev -- --force`, or you will debug a
fix that was never loaded.

**`import.meta.env` does not exist in `npm run validate`.** The validator runs
the TypeScript sources directly under Node, so any module the schema reaches
must not read Vite-only globals unguarded — `import.meta.env.X` throws
`Cannot read properties of undefined` there while working perfectly in the
browser. Use `import.meta.env?.X`.

**`sips -Z` overwrites the file in place.** Use `--out` to preserve originals.
Verified the hard way: 908×689/190K became 800×607/57K in the same file.

**An XML comment may not contain `--`.** SVG is XML, so writing a CSS custom
property name such as `--ui-primary` inside a comment in `favicon.svg` makes the
whole file invalid and the icon silently stops rendering — no console error, no
broken-image marker, just an absent favicon. Write token names without their
leading dashes in SVG comments.

**Safari does not reliably take an SVG favicon.** Ship a `favicon.ico`
alongside it, declared first, and let SVG-capable browsers pick the later
`type="image/svg+xml"` link.

**ImageMagick renders SVG gradients badly.** `magick favicon.svg out.png` turned
an indigo radial gradient nearly black, which looks exactly like a broken file.
Rasterise SVGs through a real browser before concluding anything about how one
looks.

**`key in object` walks the prototype chain.** Validating a name against a
lookup table with `in` accepted `toString`, `constructor` and `__proto__` as map
style names; `__proto__` then threw an uncaught `TypeError` on resolution,
turning a content typo into a crash. Use `Object.hasOwn(table, key)` whenever
the key comes from user content.

## Scroll and snap

**`scroll-snap-type: mandatory` reverts a programmatic `scrollTo`** to the
nearest snap position. A screenshot taken after one can show a state the user
can never actually reach, which looks exactly like a rendering bug.

**The browser latches its snap target onto an _element_, not an offset.** A
`timeline-container` renders its `<slot>` asynchronously, so until it does its
entries have no box and are not snap areas. The browser picked the first
element that _did_ have one — the first map stop — then followed it down the
page as the entries appeared, opening the deck three cards in. `settle()` in
`main.ts` waits for the containers' `updateComplete` and then pins the starting
card explicitly. This is _not_ scroll anchoring: `overflow-anchor: none` changes
nothing, which is what ruled it out.

**A section shorter than the viewport can never scroll to the top of the page**
if it is last — the document simply ends. The last timeline container carries
60vh of trailing space via `::after` so the final card stays reachable. Making
that one card taller instead works, but leaves it visibly out of step with its
siblings.

**Mixed snap heights work**, but only with `scroll-snap-stop: always`. Timeline
entries (~40vh) and map stops (100vh) share one scroll container and still
advance exactly one card per keypress.

## Rendering and animation

**Animating `height` is a main-thread layout animation.** With a concurrent
Mapbox camera flight it gets starved to about two frames and renders with
squared-off edges. The rail's active dot snaps its size instead and only
transitions opacity; the rail is promoted to its own compositor layer. This is
now handled inside `scroll-dots`.

**A light-DOM rule beats a component's own `:host` declaration.** Setting
`display: block` on `timeline-entry` from `style.css` overrode the component's
`:host([alternating]) { display: grid }` and stopped the entry stretching its
line to the height set here, breaking the line between entries. Do not set
`display` on a component host unless you mean to replace its own value.

**`flex-grow` does not stretch a content-sized container.** With only a
`min-height`, there is no free space to distribute. A grid container's auto row
does stretch — that is why the alternating timeline entry is a grid.

**A bare `1fr` grid track grows to its content's minimum width.** In a
`1fr auto 1fr` layout that pushes the middle column off centre — the timeline
line and dot ended up 57px off. Use `minmax(0, 1fr)`.

## Mapbox

**Mapbox Standard needs `map.setConfigProperty('basemap', …)`**, guarded by
checking `map.getStyle().imports` for a `basemap` entry — classic styles have
none and throw. Config must be re-applied on `map-style-reloaded`, not just
`map-ready`, because a style swap drops consumer-registered sources and layers.

**"Missing CSS declarations for Mapbox GL JS" is a false positive.**
`<mapbox-map>` injects the stylesheet into its shadow root.

**The Static Images API cannot render the `standard` style** — it returns 400 on
`mapbox.mapbox-landmark-icons-v1`. Use a real browser to preview basemaps.

**Geocode, do not estimate.** The name of a research campus silently fell back
to the nearest city centre, and a street address resolved to a different street
entirely. Verify each pin against the rendered map.

## Writing browser checks

**A hash-only `page.goto()` is a same-document navigation — the app never
reloads.** Deep-link restore only runs on load, so testing `#outro-1` by
navigating from `#intro-1` on the same page silently tests nothing and produces
convincing but meaningless results. This produced two false bug reports. Use a
fresh page per hash.

**Mapbox markers live in `<mapbox-map>`'s shadow root**, so
`document.querySelectorAll('map-pin')` finds nothing. Query through
`document.querySelector('mapbox-map').shadowRoot`.

**Playwright element screenshots of `position: fixed` elements during a smooth
scroll capture stale coordinates** and come out blank. Measure computed styles
and bounding boxes instead.

**`loading="lazy"` images report `naturalWidth === 0` until scrolled into
view.** Scroll first, then measure.

**Measure the line's endpoint, not its vertex count.** `densify()` emits the
same 25 points for any fraction, so a segment that is 1% drawn and one that is
100% drawn have identical vertex counts. Counting them shows no progress at all.
