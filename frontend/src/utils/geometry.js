/**
 * Geometry related utility functions for the frontend, primarily using Leaflet.
 */
import L from 'leaflet'; // Assuming Leaflet is globally available via CDN as per index.html

// --- Helper Function: closestPointOnSegment ---
// Finds the closest point on a single line segment to a given point.
// Adapted from Leaflet.GeometryUtil geometryutil.js https://github.com/makinacorpus/Leaflet.GeometryUtil/blob/master/src/leaflet.geometryutil.js
// License: https://github.com/makinacorpus/Leaflet.GeometryUtil/blob/master/LICENSE
const closestPointOnSegment = (map, p, p1, p2) => {
    if (!map || !p || !p1 || !p2) {
        console.warn("closestPointOnSegment: Invalid points received", { p, p1, p2 });
        return null;
    }

    // Project points to screen coordinates for linear calculation
    let P, P1, P2;
    try {
        P = map.latLngToLayerPoint(p);
        P1 = map.latLngToLayerPoint(p1);
        P2 = map.latLngToLayerPoint(p2);
    } catch (e) {
        console.error("closestPointOnSegment: Error projecting points:", e);
        return null; // Cannot proceed if projection fails
    }

    let dx = P2.x - P1.x;
    let dy = P2.y - P1.y;
    let dot = dx * dx + dy * dy; // Squared length of the segment
    let t; // Parameter along the segment [0, 1]

    if (dot > 0) {
        // Project vector P1->P onto vector P1->P2
        t = ((P.x - P1.x) * dx + (P.y - P1.y) * dy) / dot;

        if (t > 1) { // Closest point is P2
            P1 = P2;
        } else if (t > 0) { // Closest point is along the segment
            P1.x += dx * t;
            P1.y += dy * t;
        }
        // If t <= 0, closest point is P1 (already set)
    }
    // If dot === 0, P1 and P2 are the same point, so P1 is the closest

    // Convert the calculated layer point back to LatLng
    try {
        return map.layerPointToLatLng(P1);
    } catch (e) {
        console.error("closestPointOnSegment: Error converting layer point back to LatLng:", e);
        return null;
    }
};


// --- Main Exported Functions ---

/**
 * Calculates a simple signal score (0-5) based on towers along the route.
 * This helps visualize the overall signal quality of a route option.
 *
 * @param {Array<object>} towersAlongRoute - List of tower objects, each expected to have 'averageSignal'.
 * @returns {number} Signal score (0-5), rounded to one decimal place.
 */
export const calculateSignalScore = (towersAlongRoute) => {
  if (!Array.isArray(towersAlongRoute) || towersAlongRoute.length === 0) {
    return 0;
  }

  const signalSum = towersAlongRoute.reduce((sum, t) => {
    const signal = t?.averageSignal;
    const validSignal = (typeof signal === 'number' && !isNaN(signal)) ? signal : -110;
    return sum + validSignal;
  }, 0);

  const avgSignal = signalSum / towersAlongRoute.length;

  const minSignalDb = -110;
  const maxSignalDb = -70;
  const signalRange = maxSignalDb - minSignalDb;

  const normSignalScore = Math.max(0, Math.min(1, (avgSignal - minSignalDb) / signalRange));

  const maxTowersForDensityBonus = 15;
  const densityFactor = Math.min(1, towersAlongRoute.length / maxTowersForDensityBonus);

  const combinedScore = (normSignalScore * 5 * 0.8) + (densityFactor * 5 * 0.2);

  const finalScore = Math.round(combinedScore * 10) / 10;
  return Math.max(0, Math.min(5, finalScore));
};


/**
 * Finds towers from a list that are within a specified distance of a route geometry.
 * FRONTEND IMPLEMENTATION - uses Leaflet for calculations.
 *
 * @param {object | null} map - The Leaflet map instance (needed for distance/projection).
 * @param {Array<object>} towersToFilter - Master list of tower objects {lat, lon, ...}.
 * @param {object | null} routeGeometry - GeoJSON-like geometry { coordinates: [[lng, lat], ...] }.
 * @param {number} [maxDistance=1500] - Maximum distance in meters.
 * @returns {Array<object>} Filtered list of towers with 'distanceToRoute' and 'positionAlongRoute'.
 */
export const findTowersAlongRouteFE = (
    map,
    towersToFilter,
    routeGeometry,
    maxDistance = 1500
) => {
    // --- Input Validation ---
    if (!map || !L) { // Still need L for L.latLng, L.polyline etc.
        console.error("findTowersAlongRouteFE: Leaflet map instance (L) is required.");
        return [];
    }
    if (!Array.isArray(towersToFilter)) {
         console.warn("findTowersAlongRouteFE: towersToFilter is not an array.");
         return [];
    }
    if (towersToFilter.length === 0) { return []; }
     if (!routeGeometry?.coordinates || !Array.isArray(routeGeometry.coordinates)) {
         console.warn("findTowersAlongRouteFE: Invalid or missing routeGeometry.coordinates.");
         return [];
     }

    // --- Coordinate Conversion & Polyline Creation ---
    const routeLatLngs = routeGeometry.coordinates
        .map(coord => {
            if (Array.isArray(coord) && coord.length === 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                try { return L.latLng(coord[1], coord[0]); }
                catch (e) { console.error("findTowersAlongRouteFE: Invalid coordinate in route geometry:", coord, e); return null; }
            } else { console.warn("findTowersAlongRouteFE: Skipping invalid coordinate format:", coord); return null; }
        })
        .filter(ll => ll !== null); // Filter out nulls

    if (routeLatLngs.length < 2) {
        console.warn("findTowersAlongRouteFE: Route requires at least 2 valid coordinates.");
        return [];
    }

    const routeLine = L.polyline(routeLatLngs);
    const routeBounds = routeLine.getBounds();

    // --- Pre-calculate total route distance ---
    let totalDist = 0;
    for (let i = 1; i < routeLatLngs.length; i++) {
        totalDist += map.distance(routeLatLngs[i], routeLatLngs[i - 1]);
    }
    if (!(totalDist > 0)) {
        console.warn(`findTowersAlongRouteFE: Route has invalid total distance (${totalDist}). Cannot calculate positions.`);
         return [];
    }

    // --- Filtering Setup ---
    const nearbyTowers = []; // Initialize as plain array
    const degreePadding = maxDistance / 111000 * 1.5;
    const expandedBounds = routeBounds.pad(degreePadding);

    // --- Iterate through Towers ---
    towersToFilter.forEach((tower, index) => { // No type annotation needed
        if (typeof tower !== 'object' || tower === null) {
            console.warn(`findTowersAlongRouteFE: Skipping invalid tower data at index ${index}: not an object.`);
            return;
        }
        if (tower.lat == null || tower.lon == null || isNaN(tower.lat) || isNaN(tower.lon)) {
            return;
        }

        try {
            const towerPoint = L.latLng(tower.lat, tower.lon);

            if (!expandedBounds.contains(towerPoint)) { return; }

            let minDistance = Infinity;
            let closestPtOnRoute = null;
            let distAlongRouteToClosest = 0;
            let cumulativeDist = 0;

            for (let i = 0; i < routeLatLngs.length - 1; i++) {
                const p1 = routeLatLngs[i];
                const p2 = routeLatLngs[i + 1];
                const segmentDist = map.distance(p1, p2);

                const ptOnSeg = closestPointOnSegment(map, towerPoint, p1, p2);

                if (!ptOnSeg) continue;

                const distanceToSegment = map.distance(towerPoint, ptOnSeg);

                if (distanceToSegment < minDistance) {
                    minDistance = distanceToSegment;
                    closestPtOnRoute = ptOnSeg;
                    distAlongRouteToClosest = cumulativeDist + map.distance(p1, ptOnSeg);
                }
                cumulativeDist += segmentDist;
            }

            if (minDistance <= maxDistance) {
                const positionAlong = distAlongRouteToClosest / totalDist;

                if (isFinite(minDistance) && isFinite(positionAlong)) {
                    // Create plain JS object
                    const processedTower = {
                        ...tower,
                        distanceToRoute: minDistance,
                        positionAlongRoute: Math.max(0, Math.min(1, positionAlong))
                    };
                    nearbyTowers.push(processedTower);
                } else {
                    console.warn(`findTowersAlongRouteFE: Skipping tower due to invalid calculation results (distance: ${minDistance}, position: ${positionAlong}). Tower data:`, tower);
                }
            }
        } catch (e) {
            console.error(`findTowersAlongRouteFE: Error processing tower at index ${index}:`, tower, e);
        }
    }); // End of forEach

    // --- Sort by Position Along Route ---
    nearbyTowers.sort((a, b) => a.positionAlongRoute - b.positionAlongRoute);

    // console.log(`[findTowersAlongRouteFE] Filtered down to ${nearbyTowers.length} towers before returning.`);

    return nearbyTowers;
};

// Add other geometry utils if needed