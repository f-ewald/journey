export type Coordinate = [number, number];

interface LatLng {
  lng: number;
  lat: number;
}

/** Sub-segments per leg, so the dashed line follows the interpolated path. */
const DENSIFY_STEPS = 24;

/**
 * Linear lng/lat interpolation from `from` toward `to`, cut at `fraction` and
 * split into intermediate vertices so the rendered polyline follows the path
 * rather than one long straight projected segment. Always includes both the
 * start point and the cut point.
 */
function densify(from: Coordinate, to: Coordinate, fraction: number): Coordinate[] {
  const points: Coordinate[] = [];
  for (let step = 0; step <= DENSIFY_STEPS; step += 1) {
    const t = (step / DENSIFY_STEPS) * fraction;
    points.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
  }
  return points;
}

/**
 * Vertices of the journey line: every stop up to `segmentIndex`, plus
 * `progress` (0-1) of the way toward the next one. A smaller `progress`
 * yields a shorter line, so the same call retracts it on reverse scroll.
 */
export function journeyCoordinates(
  stops: LatLng[],
  segmentIndex: number,
  progress: number,
): Coordinate[] {
  if (stops.length === 0) return [];

  const start = Math.min(Math.max(segmentIndex, 0), stops.length - 1);
  const coordinates: Coordinate[] = [toCoordinate(stops[0])];

  for (let index = 0; index < start; index += 1) {
    coordinates.push(...densify(toCoordinate(stops[index]), toCoordinate(stops[index + 1]), 1).slice(1));
  }

  const next = stops[start + 1];
  if (next && progress > 0) {
    const fraction = Math.min(Math.max(progress, 0), 1);
    coordinates.push(...densify(toCoordinate(stops[start]), toCoordinate(next), fraction).slice(1));
  }

  return coordinates;
}

/**
 * Padding that shifts the map's optical centre to one sixth of the viewport
 * width — the middle of the left third — leaving the right half for the panel.
 */
export function leftThirdPadding(viewportWidth: number): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  return { top: 0, bottom: 0, left: 0, right: Math.round((viewportWidth * 2) / 3) };
}

export function toCoordinate(point: LatLng): Coordinate {
  return [point.lng, point.lat];
}
