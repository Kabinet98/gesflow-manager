/**
 * Geo utilities for land boundary calculations.
 */

interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS = 6371000; // meters

/** Haversine distance between two points in meters. */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate polygon area in m² using the Shoelace formula on
 * geodesic-projected coordinates.
 */
export function calculatePolygonArea(coords: LatLng[]): number {
  if (coords.length < 3) return 0;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  // Project to flat surface relative to centroid
  const avgLat =
    coords.reduce((s, c) => s + c.lat, 0) / coords.length;

  const projected = coords.map((c) => ({
    x: toRad(c.lng - coords[0].lng) * EARTH_RADIUS * Math.cos(toRad(avgLat)),
    y: toRad(c.lat - coords[0].lat) * EARTH_RADIUS,
  }));

  // Shoelace
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const j = (i + 1) % projected.length;
    area += projected[i].x * projected[j].y;
    area -= projected[j].x * projected[i].y;
  }
  return Math.abs(area) / 2;
}

/** Calculate centroid of a polygon. */
export function calculatePolygonCenter(coords: LatLng[]): LatLng {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  const sum = coords.reduce(
    (acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / coords.length, lng: sum.lng / coords.length };
}

/** Format area for display: m² if < 10000, hectares otherwise. */
export function formatArea(areaM2: number): string {
  if (areaM2 < 10000) {
    return `${Math.round(areaM2).toLocaleString("fr-FR")} m²`;
  }
  const hectares = areaM2 / 10000;
  return `${hectares.toFixed(2).replace(".", ",")} ha`;
}

/**
 * Douglas-Peucker line simplification.
 * Reduces the number of points while preserving shape.
 */
export function douglasPeucker(points: LatLng[], epsilon: number): LatLng[] {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance from the line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(
  point: LatLng,
  lineStart: LatLng,
  lineEnd: LatLng
): number {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversineDistance(point.lat, point.lng, lineStart.lat, lineStart.lng);

  let t = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projLat = lineStart.lat + t * dy;
  const projLng = lineStart.lng + t * dx;
  return haversineDistance(point.lat, point.lng, projLat, projLng);
}

/**
 * Filter GPS noise: discard points with poor accuracy or impossible jumps.
 */
export function filterGPSNoise(
  points: Array<LatLng & { accuracy?: number }>,
  maxAccuracy: number = 20,
  maxJump: number = 50
): LatLng[] {
  if (points.length === 0) return [];

  const filtered: LatLng[] = [{ lat: points[0].lat, lng: points[0].lng }];

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    // Skip points with bad accuracy
    if (p.accuracy != null && p.accuracy > maxAccuracy) continue;

    const prev = filtered[filtered.length - 1];
    const dist = haversineDistance(prev.lat, prev.lng, p.lat, p.lng);
    // Skip impossible jumps
    if (dist > maxJump) continue;

    filtered.push({ lat: p.lat, lng: p.lng });
  }

  return filtered;
}
