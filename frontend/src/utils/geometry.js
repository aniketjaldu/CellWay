/**
 * Geometry Utility Functions
 * 
 * Provides frontend geometry-related helper functions, primarily leveraging the Leaflet library
 * for calculations like finding nearby points, calculating distances, and determining signal scores.
 */
import L from 'leaflet'; // Leaflet library for map interactions and geometry calculations

// --- JSDoc Type Definitions ---
// Define types for better code understanding and documentation.
/**
 * @typedef {object} TowerData - Raw tower data structure.
 * @property {number} lat - Latitude.
 * @property {number} lon - Longitude.
 * @property {string|number} [id] - Optional unique identifier.
 * @property {number} [averageSignal] - Average signal strength (e.g., in dBm).
 * // ... other potential tower properties
 */
/**
 * @typedef {object} ProcessedTowerData - Tower data enhanced with route context.
 * @property {number} lat - Latitude.
 * @property {number} lon - Longitude.
 * @property {string|number} [id] - Optional unique identifier.
 * @property {number} [averageSignal] - Average signal strength.
 * @property {number} distanceToRoute - Calculated distance from the tower to the nearest point on the route (meters).
 * @property {number} positionAlongRoute - Normalized position along the route (0.0 at start, 1.0 at end).
 * // ... other potential properties inherited from TowerData
 */
/**
 * @typedef {object} RouteGeometry - GeoJSON LineString geometry structure.
 * @property {string} type - Typically "LineString".
 * @property {number[][]} coordinates - Array of [longitude, latitude] coordinates defining the route path.
 */


// ==================================================
//               Internal Helper Functions
// ==================================================

/**
 * Finds the closest point on a single line segment to a given point 'p'.
 * Uses Leaflet's projection methods for accurate calculation on the map projection.
 * Adapted from Leaflet.GeometryUtil: https://github.com/makinacorpus/Leaflet.GeometryUtil
 * License: https://github.com/makinacorpus/Leaflet.GeometryUtil/blob/master/LICENSE
 * 
 * @private
 * @param {L.Map} map - The Leaflet map instance.
 * @param {L.LatLng} p - The point to find the closest point to.
 * @param {L.LatLng} p1 - The start point of the line segment.
 * @param {L.LatLng} p2 - The end point of the line segment.
 * @returns {L.LatLng | null} The LatLng of the closest point on the segment, or null if calculation fails.
 */
const _closestPointOnSegment = (map, p, p1, p2) => {
  // --- Input Validation ---
  if (!map || !p || !p1 || !p2) {
    console.warn("_closestPointOnSegment: Invalid input points or map instance received.", { p, p1, p2, map });
    return null;
  }

  let P, P1, P2; // Projected points (layer coordinates)
  try {
    // Project geographical coordinates (LatLng) to screen coordinates (LayerPoint)
    // This allows for linear geometry calculations based on the map's current view/projection.
    P = map.latLngToLayerPoint(p);
    P1 = map.latLngToLayerPoint(p1);
    P2 = map.latLngToLayerPoint(p2);
  } catch (e) {
    console.error("_closestPointOnSegment: Error projecting LatLng points to layer points:", e);
    return null; // Cannot proceed without valid projected points
  }

  // --- Calculation ---
  const dx = P2.x - P1.x; // Difference in x coordinates
  const dy = P2.y - P1.y; // Difference in y coordinates
  const dot = dx * dx + dy * dy; // Squared length of the segment vector (P1 -> P2)
  let t; // Parameter representing the position along the segment [0, 1]

  if (dot > 0) { // Ensure the segment has non-zero length
    // Project the vector (P1 -> P) onto the segment vector (P1 -> P2)
    // t = dot_product(P1P, P1P2) / squared_length(P1P2)
    t = ((P.x - P1.x) * dx + (P.y - P1.y) * dy) / dot;

    if (t > 1) {
      // If t > 1, the projection falls beyond P2, so the closest point is P2 itself.
      P1 = P2;
    } else if (t > 0) {
      // If 0 < t <= 1, the projection falls within the segment.
      // Calculate the closest point's coordinates along the segment.
      P1.x += dx * t;
      P1.y += dy * t;
    }
    // If t <= 0, the projection falls before P1, so the closest point is P1 itself (already set).
  }
  // If dot === 0, P1 and P2 are the same point, so P1 is the closest point.

  // --- Convert Back to LatLng ---
  try {
    // Convert the calculated closest layer point back to geographical coordinates.
    return map.layerPointToLatLng(P1);
  } catch (e) {
    console.error("_closestPointOnSegment: Error converting calculated layer point back to LatLng:", e);
    return null; // Return null if conversion fails
  }
};


// ==================================================
//               Exported Utility Functions
// ==================================================

/**
 * Calculates a simple signal quality score (0-5, higher is better) based on the average
 * signal strength of towers along a route and their density.
 * 
 * @param {TowerData[]} towersAlongRoute - List of tower objects found along the route.
 *                                         Each object should ideally have an 'averageSignal' property.
 * @returns {number} A signal score between 0 and 5, rounded to one decimal place.
 */
export const calculateSignalScore = (towersAlongRoute) => {
  // --- Input Validation ---
  if (!Array.isArray(towersAlongRoute) || towersAlongRoute.length === 0) {
    return 0; // Return 0 score if no towers are provided
  }

  // --- Calculate Average Signal ---
  const signalSum = towersAlongRoute.reduce((sum, t) => {
    const signal = t?.averageSignal;
    // Use signal if valid number, otherwise default to a weak signal value (-110 dBm)
    const validSignal = (typeof signal === 'number' && !isNaN(signal)) ? signal : -110;
    return sum + validSignal;
  }, 0);
  const avgSignal = signalSum / towersAlongRoute.length; // Calculate the average

  // --- Normalize Average Signal ---
  // Define realistic min/max signal strengths for normalization (adjust if needed)
  const minSignalDb = -110;
  const maxSignalDb = -70;
  const signalRange = maxSignalDb - minSignalDb;
  // Normalize the average signal to a 0-1 scale (higher signal -> closer to 1)
  const normSignalScore = Math.max(0, Math.min(1, (avgSignal - minSignalDb) / signalRange));

  // --- Calculate Density Factor ---
  // Consider tower density, capping the bonus effect at a certain number of towers
  const maxTowersForDensityBonus = 15; // More towers beyond this don't increase the density score further
  const densityFactor = Math.min(1, towersAlongRoute.length / maxTowersForDensityBonus); // Normalize density to 0-1 scale

  // --- Combine Scores ---
  // Weighted combination of normalized signal and density (e.g., 80% signal, 20% density)
  const combinedScore = (normSignalScore * 5 * 0.8) + (densityFactor * 5 * 0.2);

  // --- Final Score ---
  // Round the combined score and clamp between 0 and 5
  const finalScore = Math.round(combinedScore * 10) / 10; // Round to one decimal place
  return Math.max(0, Math.min(5, finalScore)); // Ensure score is within [0, 5] range
};


/**
 * Calculates the haversine distance (great-circle distance) between two sets of coordinates.
 * This gives the straight-line distance between two points on a sphere (Earth).
 * 
 * @param {number} lat1 - Latitude of the first point in degrees
 * @param {number} lon1 - Longitude of the first point in degrees
 * @param {number} lat2 - Latitude of the second point in degrees
 * @param {number} lon2 - Longitude of the second point in degrees
 * @returns {number} Distance in kilometers
 */
export const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  // Input validation
  if ([lat1, lon1, lat2, lon2].some(coord => typeof coord !== 'number' || isNaN(coord))) {
    console.warn('calculateHaversineDistance: Invalid coordinate values', { lat1, lon1, lat2, lon2 });
    return 0;
  }

  // Convert latitude and longitude from degrees to radians
  const toRadians = angle => angle * Math.PI / 180;
  
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  // Haversine formula
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + 
            Math.cos(φ1) * Math.cos(φ2) * 
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  // Earth's radius in kilometers
  const R = 6371;
  
  // Calculate the distance
  return R * c;
};


/**
 * Finds towers from a given list that are within a specified distance of a route geometry.
 * This is a FRONTEND implementation using Leaflet for distance calculations.
 * It enhances the found towers with 'distanceToRoute' and 'positionAlongRoute' properties.
 * 
 * @param {L.Map | null} map - The Leaflet map instance (required for calculations).
 * @param {TowerData[]} towersToFilter - The master list of tower objects {lat, lon, ...} to filter.
 * @param {RouteGeometry | null} routeGeometry - The route's geometry { coordinates: [[lng, lat], ...] }.
 * @param {number} [maxDistance=1500] - Maximum distance in meters from the route for a tower to be included.
 * @returns {ProcessedTowerData[]} A filtered and sorted list of towers along the route, enhanced with distance and position info.
 */
export const findTowersAlongRouteFE = (
  map,
  towersToFilter,
  routeGeometry,
  maxDistance = 1500 // Default max distance
) => {
  // --- Input Validation ---
  if (!map || !L) {
    console.error("findTowersAlongRouteFE: Leaflet map instance (L) is required.");
    return []; // Return empty if map or Leaflet is missing
  }
  if (!Array.isArray(towersToFilter)) {
    console.warn("findTowersAlongRouteFE: towersToFilter input is not an array.");
    return []; // Return empty if towers input is invalid
  }
  if (towersToFilter.length === 0) {
    return []; // Return empty if there are no towers to filter
  }
  if (!routeGeometry?.coordinates || !Array.isArray(routeGeometry.coordinates)) {
    console.warn("findTowersAlongRouteFE: Invalid or missing routeGeometry.coordinates provided.");
    return []; // Return empty if route geometry is invalid
  }

  // --- Prepare Route Data ---
  // Convert route coordinates [lng, lat] to Leaflet LatLng objects [lat, lng]
  const routeLatLngs = routeGeometry.coordinates
    .map(coord => {
      // Validate individual coordinate pairs
      if (Array.isArray(coord) && coord.length === 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
        try {
          return L.latLng(coord[1], coord[0]); // Create LatLng object
        } catch (e) {
          console.error("findTowersAlongRouteFE: Error creating LatLng from coordinate:", coord, e);
          return null; // Skip invalid coordinates
        }
      } else {
        console.warn("findTowersAlongRouteFE: Skipping invalid coordinate format in route:", coord);
        return null; // Skip invalid coordinates
      }
    })
    .filter(ll => ll !== null); // Remove any nulls resulting from invalid coordinates

  // Need at least two valid points to form a line
  if (routeLatLngs.length < 2) {
    console.warn("findTowersAlongRouteFE: Route requires at least 2 valid coordinates to proceed.");
    return [];
  }

  // Create a Leaflet polyline object (used for bounds calculation, not added to map)
  const routeLine = L.polyline(routeLatLngs);
  const routeBounds = routeLine.getBounds(); // Get the bounding box of the route

  // --- Calculate Total Route Distance ---
  // Sum distances between consecutive points along the route
  let totalRouteDistance = 0;
  for (let i = 1; i < routeLatLngs.length; i++) {
    totalRouteDistance += map.distance(routeLatLngs[i], routeLatLngs[i - 1]); // Use map.distance for accurate calculation
  }
  // Check if total distance is valid (greater than 0)
  if (!(totalRouteDistance > 0)) {
    console.warn(`findTowersAlongRouteFE: Route has invalid total distance (${totalRouteDistance}). Cannot calculate normalized positions.`);
    return []; // Cannot calculate normalized position without valid total distance
  }

  // --- Filtering Setup ---
  const nearbyTowers = []; // Array to store towers found near the route
  // Calculate a buffer in degrees for quick spatial filtering (approximate, adjust multiplier if needed)
  const degreePadding = maxDistance / 111000 * 1.5; // ~111km per degree latitude, add 50% buffer
  const expandedBounds = routeBounds.pad(degreePadding); // Expand route bounds slightly

  // --- Iterate Through Towers and Filter ---
  towersToFilter.forEach((tower, index) => {
    // Validate tower object and coordinates
    if (typeof tower !== 'object' || tower === null) {
      console.warn(`findTowersAlongRouteFE: Skipping invalid tower data at index ${index}: not an object.`);
      return;
    }
    if (tower.lat == null || tower.lon == null || isNaN(tower.lat) || isNaN(tower.lon)) {
      console.warn(`findTowersAlongRouteFE: Skipping tower at index ${index} due to invalid lat/lon.`, tower);
      return; // Skip towers with invalid coordinates
    }

    try {
      const towerPoint = L.latLng(tower.lat, tower.lon); // Create LatLng for the tower

      // --- Broad Phase Filter: Check if tower is roughly within the expanded bounds ---
      if (!expandedBounds.contains(towerPoint)) {
        return; // Skip tower if it's clearly too far away
      }

      // --- Narrow Phase Filter: Calculate precise distance to route segments ---
      let minDistanceToRoute = Infinity; // Initialize minimum distance
      let closestPointOnRoute = null; // Store the closest point found on the route line
      let distanceAlongRouteToClosest = 0; // Store distance along the route to the closest point
      let cumulativeDistance = 0; // Track distance along the route as we iterate segments

      // Iterate through each segment of the route polyline
      for (let i = 0; i < routeLatLngs.length - 1; i++) {
        const segmentStart = routeLatLngs[i];
        const segmentEnd = routeLatLngs[i + 1];
        const segmentDistance = map.distance(segmentStart, segmentEnd); // Distance of the current segment

        // Find the closest point on the current segment to the tower
        const pointOnSegment = _closestPointOnSegment(map, towerPoint, segmentStart, segmentEnd);

        if (!pointOnSegment) continue; // Skip if calculation failed for this segment

        // Calculate the perpendicular distance from the tower to that closest point on the segment
        const distanceToSegment = map.distance(towerPoint, pointOnSegment);

        // If this distance is smaller than the current minimum, update minimums
        if (distanceToSegment < minDistanceToRoute) {
          minDistanceToRoute = distanceToSegment;
          closestPointOnRoute = pointOnSegment; // Store the closest point itself (optional)
          // Calculate distance along the route to this closest point
          distanceAlongRouteToClosest = cumulativeDistance + map.distance(segmentStart, pointOnSegment);
        }
        cumulativeDistance += segmentDistance; // Add segment distance to cumulative total
      } // End segment loop

      // --- Add Tower if Within Max Distance ---
      // Check if the calculated minimum distance is within the specified threshold
      if (minDistanceToRoute <= maxDistance) {
        // Calculate normalized position along the route (0.0 to 1.0)
        const positionAlongRoute = distanceAlongRouteToClosest / totalRouteDistance;

        // Final validation of calculated values before adding
        if (isFinite(minDistanceToRoute) && isFinite(positionAlongRoute)) {
          // Create the processed tower object, adding the calculated properties
          const processedTower = {
            ...tower, // Spread original tower properties
            distanceToRoute: minDistanceToRoute, // Add calculated distance
            positionAlongRoute: Math.max(0, Math.min(1, positionAlongRoute)), // Add normalized position (clamped 0-1)
          };
          nearbyTowers.push(processedTower); // Add to the results array
        } else {
          console.warn(`findTowersAlongRouteFE: Skipping tower due to invalid calculation results (distance: ${minDistanceToRoute}, position: ${positionAlongRoute}). Tower data:`, tower);
        }
      }
    } catch (e) {
      // Catch any unexpected errors during processing of a single tower
      console.error(`findTowersAlongRouteFE: Error processing tower at index ${index}:`, tower, e);
    }
  }); // End of towersToFilter.forEach


  // --- Sort Results ---
  // Sort the found nearby towers based on their position along the route (ascending)
  nearbyTowers.sort((a, b) => a.positionAlongRoute - b.positionAlongRoute);

  // console.log(`[findTowersAlongRouteFE] Filtered down to ${nearbyTowers.length} towers along the route.`); // Debug log

  return nearbyTowers; // Return the filtered and sorted array
};