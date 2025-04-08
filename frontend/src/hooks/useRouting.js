import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import html2canvas from 'html2canvas'; // Library for capturing DOM elements as canvas
import L from 'leaflet';

import * as api from '../services/api.js'; // API service functions
import { formatDistance, formatDuration, getRouteTypeIcon, formatDate } from '../utils/formatting.js'; // Formatting utilities
import { calculateSignalScore, calculateHaversineDistance } from '../utils/geometry.js'; // Geometry utilities (e.g., signal score)


// --- JSDoc Type Definitions ---
// Provides type hinting for better code understanding and potentially for IDEs
/**
 * @typedef {object} Waypoint - Represents a start or end point of a route.
 * @property {string} name - Display name of the waypoint.
 * @property {number[]} location - Coordinates as [longitude, latitude].
 */
/**
 * @typedef {object} RouteStep - Represents a single step in the route directions.
 * @property {string|number} type - Maneuver type identifier (e.g., 'left', 'straight', 0, -2).
 * @property {string} instruction - Text instruction for the step.
 * @property {string} distanceFormatted - Formatted distance string for the step.
 * @property {number[]} [coordinates] - Start coordinate of the maneuver [longitude, latitude].
 * @property {string} [streetName] - Name of the street for the step.
 * @property {number[][]} [segmentCoordinates] - Coordinates forming the geometry of this step [[longitude, latitude], ...].
 */
/**
 * @typedef {object} RouteLeg - Represents a segment of the route, typically containing multiple steps.
 * @property {RouteStep[]} steps - Array of steps in this leg.
 */
/**
 * @typedef {object} RouteGeometry - Represents the overall geometry of the route.
 * @property {string} type - GeoJSON geometry type (e.g., "LineString").
 * @property {number[][]} coordinates - Array of coordinates forming the route path [[longitude, latitude], ...].
 */
/**
 * @typedef {object} RouteObject - Represents a single calculated route from the API.
 * @property {RouteGeometry} geometry - The route's geometry.
 * @property {RouteLeg[]} legs - Array of route legs (usually one for point-to-point).
 * @property {number} distance - Total distance in meters.
 * @property {number} duration - Total duration in seconds.
 * @property {number} [weight] - Internal routing weight (optional).
 * @property {string} [weight_name] - Name of the weight metric (optional).
 * @property {number} [ascend] - Total ascent in meters (optional).
 * @property {number} [descend] - Total descent in meters (optional).
 * @property {string} [profile_used] - Routing profile used (e.g., 'car') (optional).
 */
/**
 * @typedef {object} RouteApiResponse - Represents the structure of the API response for route calculation.
 * @property {string} code - Status code (e.g., "Ok", "NoRoute", "Error").
 * @property {RouteObject[]} routes - Array of calculated routes (usually one primary, potentially alternatives).
 * @property {Waypoint[]} waypoints - Array of waypoints (usually origin and destination).
 * @property {TowerData[]} [towers] - Array of cell tower data along the route (optional).
 * @property {string} [optimization_type] - The optimization type used for this specific route (optional).
 * @property {string} [tower_data_source] - Source of the tower data (optional).
 * @property {string} [message] - Error message if the 'code' indicates failure.
 */
/**
 * @typedef {object} SavedRouteData - Represents the structure of a saved route document from the database.
 * @property {string} _id - Database document ID.
 * @property {string} user_id - ID of the user who saved the route.
 * @property {{place_name: string, lat: number, lng: number}} origin - Origin details.
 * @property {{place_name: string, lat: number, lng: number}} destination - Destination details.
 * @property {object.<string, RouteApiResponse>} route_data - Object containing computed route data, keyed by type ('fastest', 'cell_coverage', 'balanced').
 * @property {string} route_type - The route type that was active when the route was saved.
 * @property {string} [route_image] - Base64 encoded image preview of the route (optional).
 * @property {object.<string, {coordinates: number[][]}>} [route_geometry] - Object containing simplified geometry for each route type (optional).
 * @property {boolean} [has_multiple_routes] - Flag indicating if multiple route types were computed and saved (optional).
 * @property {string} [created_at] - ISO string representation of the creation date (optional).
 */
/**
 * @typedef {object} TowerData - Represents cell tower data (structure depends on the source).
 * @property {number} lat
 * @property {number} lon
 * @property {number} [averageSignal]
 * // ... other potential properties like mcc, net, cell, range, updated, radio
 */

// --- Helper Function: extractDirections ---
// Processes raw route data from the API into a format suitable for the DirectionsPanel component.
const extractDirections = (routeData, originName, destinationName) => {
  const route = routeData?.routes?.[0]; // Get the primary route object
  const steps = route?.legs?.[0]?.steps; // Get steps from the first leg

  // Return null if essential route data or steps are missing
  if (!route || !steps) {
    console.warn("extractDirections: Missing route or steps data.");
    return null;
  }

  // Mapping from GraphHopper sign codes to maneuver types used for icons/logic
  const signToManeuverType = (sign) => {
    const map = {
      '-98': 'uturn', '-8': 'uturn-left', '-7': 'keep-left', '-6': 'exit-roundabout',
      '-3': 'sharp-left', '-2': 'left', '-1': 'slight-left', '0': 'straight',
      '1': 'slight-right', '2': 'right', '3': 'sharp-right', '4': 'destination',
      '5': 'via', '6': 'roundabout', '7': 'keep-right', '8': 'uturn-right'
    };
    return map[String(sign)] || 'straight'; // Default to 'straight' if sign is unknown
  };

  let formattedSteps = [];
  const startName = originName || 'Origin'; // Use provided name or default

  // Add a "Depart" step at the beginning
  formattedSteps.push({
    type: 'start',
    instruction: `Depart from ${startName}`,
    distanceFormatted: '',
    coordinates: steps[0]?.geometry?.coordinates?.[0] || route?.geometry?.coordinates?.[0] || null, // Use first step's start coord or route start coord
    segmentCoordinates: [], // No segment for depart step
  });

  // Process each step from the API response
  steps.forEach((step) => {
    const maneuver = step.maneuver || {};
    const type = signToManeuverType(maneuver.type);
    const name = step.name || ''; // Street name
    const distance = formatDistance(step.distance) || ''; // Formatted distance
    let instruction = step.instruction_text || ''; // Use provided text if available

    // Generate instruction text if missing (basic fallback)
    if (!instruction) {
      if (type === 'straight') instruction = name ? `Continue on ${name}` : 'Continue straight';
      else if (type.includes('left') || type.includes('right')) instruction = name ? `${type.replace('-', ' ')} onto ${name}` : type.replace('-', ' ');
      else if (type === 'roundabout') instruction = `Enter roundabout${name ? ` and take exit onto ${name}` : ''}`;
      else if (type === 'exit-roundabout') instruction = `Exit roundabout${name ? ` onto ${name}` : ''}`;
      else if (type === 'destination') instruction = `Arrive at ${destinationName || 'Destination'}`;
      else instruction = `${type}${name ? ` onto ${name}` : ''}`;
      instruction = instruction.charAt(0).toUpperCase() + instruction.slice(1); // Capitalize
    }

    formattedSteps.push({
      type: type,
      instruction: instruction,
      distanceFormatted: distance,
      coordinates: step.geometry?.coordinates?.[0] || null, // Start coordinate of the maneuver
      streetName: name,
      segmentCoordinates: step.geometry?.coordinates || [], // Geometry of this step's segment
    });
  });

  // Add an "Arrive" step if the last step isn't already the destination
  const endName = destinationName || 'Destination';
  const lastStep = formattedSteps[formattedSteps.length - 1];
  if (lastStep && lastStep.type !== 'destination') {
    const finalCoord = route.geometry?.coordinates?.[route.geometry.coordinates.length - 1]; // Get the very last coordinate of the route
    formattedSteps.push({
      type: 'destination',
      instruction: `Arrive at ${endName}`,
      distanceFormatted: '',
      coordinates: finalCoord || null,
      segmentCoordinates: finalCoord ? [finalCoord] : [], // Segment is just the final point
    });
  }

  // Return formatted directions object
  return {
    distanceFormatted: formatDistance(route.distance) || 'N/A',
    durationFormatted: formatDuration(route.duration) || 'N/A',
    ascendFormatted: route.ascend > 0 ? `${Math.round(route.ascend)}m ↗️` : '', // Add ascent/descent info
    descendFormatted: route.descend > 0 ? `${Math.round(route.descend)}m ↘️` : '',
    steps: formattedSteps,
  };
};


// --- Helper Function: getRouteLineColor ---
// Returns a specific color based on the route type.
const getRouteLineColor = (type) => {
  const colorMap = {
    fastest: '#4285F4',       // Google Blue
    cell_coverage: '#0F9D58', // Google Green
    balanced: '#F4B400',       // Google Yellow/Orange
  };
  return colorMap[type] || '#666666'; // Default grey for unknown types
};


/**
 * useRouting Hook
 * 
 * Manages all aspects of route calculation, display, saving, and loading within the application.
 * Handles state for route types, points, computed data, directions, UI panels, and saved routes.
 * Interacts with API services and map utility functions.
 *
 * @param {L.Map | null} map - The Leaflet map instance.
 * @param {{id: string} | null} user - The current user object (or null if not logged in).
 * @param {object | null} mapUtils - Object containing map utility functions provided by `useMap`.
 * @returns {object} An object containing routing state and functions.
 */
export const useRouting = (map, user, mapUtils) => {
  // Destructure map utility functions for easier access, provide empty functions as fallbacks if mapUtils is null/undefined
  const {
    displayRouteLine = () => null,
    clearRouteLine = () => { },
    fitBounds = () => { },
    updateMarker = () => null,
    clearLayerGroup = () => { },
    setOriginValue = () => { }, // Function to update origin search input value
    setDestinationValue = () => { } // Function to update destination search input value
  } = mapUtils || {};


  // --- State Variables ---
  const [routeType, setRouteTypeState] = useState(() => localStorage.getItem('preferredRouteType') || 'fastest'); // Current active/preferred route type ('fastest', 'cell_coverage', 'balanced')
  const [currentRoutePoints, setCurrentRoutePointsState] = useState({ start: null, end: null }); // { start: {lat, lng, place_name?}, end: {lat, lng, place_name?} }
  const [routeInfo, setRouteInfo] = useState(null); // Summary info of the currently displayed route { distance, duration, routeType, signalQuality, towerCount, routes: [RouteObject] }
  const [routesAreLoading, setRoutesAreLoading] = useState(false); // Is any route calculation currently in progress?
  const [allRoutesComputed, setAllRoutesComputed] = useState(false); // Have all route types (fastest, cell, balanced) finished computing?
  const [computedRoutes, setComputedRoutes] = useState({ fastest: null, cell_coverage: null, balanced: null }); // Stores the full API response for each computed route type
  /** @type {[object.<string, TowerData[]>, React.Dispatch<React.SetStateAction<object.<string, TowerData[]>>>]} */
  const [computedRouteTowers, setComputedRouteTowers] = useState({ fastest: [], cell_coverage: [], balanced: [] }); // Stores towers associated with each computed route type
  const [routeDirections, setRouteDirections] = useState(null); // Formatted step-by-step directions for the DirectionsPanel
  const [showDirectionsPanel, setShowDirectionsPanel] = useState(false); // Controls visibility of the DirectionsPanel
  const [isDirectionsMinimized, setIsDirectionsMinimized] = useState(false); // Controls minimized state of DirectionsPanel
  const [activeDirectionStep, setActiveDirectionStepState] = useState(null); // Index of the currently highlighted direction step
  const [routeOriginDisplay, setRouteOriginDisplay] = useState(''); // Display name for the origin point
  const [routeDestinationDisplay, setRouteDestinationDisplay] = useState(''); // Display name for the destination point
  /** @type {[SavedRouteData[], React.Dispatch<React.SetStateAction<SavedRouteData[]>>]} */
  const [savedRoutes, setSavedRoutes] = useState([]); // Array of saved routes fetched from the backend
  const [isLoadingSavedRoutes, setIsLoadingSavedRoutes] = useState(false); // Loading state for fetching saved routes

  // --- Refs ---
  const calculationAbortController = useRef(null); // Ref to store AbortController for cancelling ongoing calculations
  const routeLineLayerRef = useRef(null); // Ref to store the currently displayed route polyline layer


  // --- Display Route Function ---
  // Takes route data and displays the corresponding polyline and directions.
  const displayRoute = useCallback((routeData, displayedRouteType) => {
    // Guard clauses
    if (!map || !displayRouteLine || !fitBounds) {
      console.error("displayRoute: Map instance or required map utilities (displayRouteLine, fitBounds) are not available.");
      return;
    }
    const route = routeData?.routes?.[0];
    const geometry = route?.geometry?.coordinates;
    if (!route || !geometry) {
      console.error("displayRoute: No valid route object or geometry found for route type:", displayedRouteType, routeData);
      clearRouteLine?.(); // Clear any existing line
      setRouteInfo(null);
      setRouteDirections(null);
      setShowDirectionsPanel(false);
      routeLineLayerRef.current = null;
      return;
    }

    try {
      // Convert coordinates and display polyline
      const routeLatLngs = geometry.map(coord => L.latLng(coord[1], coord[0])); // Convert [lng, lat] to Leaflet LatLng
      if (routeLatLngs.length < 2) throw new Error("Invalid route geometry: less than 2 points.");

      const routeLineLayer = displayRouteLine(routeLatLngs, { color: getRouteLineColor(displayedRouteType) }); // Display the line
      if (routeLineLayer) {
        fitBounds?.(routeLineLayer.getBounds()); // Fit map view to the route bounds
        routeLineLayerRef.current = routeLineLayer; // Store ref to the displayed layer
      } else {
        routeLineLayerRef.current = null; // Clear ref if display failed
      }

      // Extract and set directions
      const directions = extractDirections(routeData, routeOriginDisplay, routeDestinationDisplay);
      setRouteDirections(directions);
      setShowDirectionsPanel(!!directions); // Show panel only if directions were extracted
      setIsDirectionsMinimized(false); // Ensure panel is not minimized when new route is displayed
      setActiveDirectionStepState(null); // Reset active step
      clearLayerGroup?.('highlight'); // Clear any previous step highlight

      // Calculate and set route info (summary)
      const towersForThisRoute = computedRouteTowers[displayedRouteType] || [];
      const signalQuality = calculateSignalScore(towersForThisRoute); // Calculate signal score
      setRouteInfo({
        distance: route.distance,
        duration: route.duration,
        routeType: displayedRouteType,
        signalQuality: signalQuality,
        towerCount: towersForThisRoute.length,
        routes: routeData.routes, // Keep the original route objects if needed later
      });

    } catch (error) {
      console.error(`Error displaying route type ${displayedRouteType}:`, error);
      toast.error(`Error displaying ${displayedRouteType} route.`);
      clearRouteLine?.(); // Clean up map on error
      setRouteInfo(null);
      setRouteDirections(null);
      setShowDirectionsPanel(false);
      routeLineLayerRef.current = null;
    }
  }, [map, displayRouteLine, fitBounds, clearLayerGroup, routeOriginDisplay, routeDestinationDisplay, computedRouteTowers, clearRouteLine]); // Dependencies


  // --- Set Active Route Type ---
  // Updates the preferred route type and displays the corresponding route if already computed.
  const setRouteType = useCallback((type) => {
    if (['fastest', 'cell_coverage', 'balanced'].includes(type)) {
      setRouteTypeState(type); // Update state
      localStorage.setItem('preferredRouteType', type); // Persist preference

      // If all routes are computed, display the selected type immediately
      if (allRoutesComputed && computedRoutes[type]) {
        displayRoute(computedRoutes[type], type);
      }
      // Handle case where selection changes but the chosen route isn't available (shouldn't happen with current UI)
      else if (allRoutesComputed && !computedRoutes[type]) {
        toast.error(`Route data for '${type}' is not available.`);
      }
    } else {
      console.warn("setRouteType called with invalid type:", type);
    }
  }, [allRoutesComputed, computedRoutes, displayRoute]); // Dependencies


  // --- Set Route Points ---
  // Updates the start and end points for routing.
  const setCurrentRoutePoints = useCallback((points) => {
    setCurrentRoutePointsState(points);
  }, []);


  // --- Clear Routing State ---
  // Resets all routing-related state variables and clears map layers.
  const clearRoutingState = useCallback(() => {
    calculationAbortController.current?.abort(); // Abort any ongoing calculation
    calculationAbortController.current = null;
    clearRouteLine?.(); // Clear route line from map
    clearLayerGroup?.('highlight'); // Clear step highlight from map
    setCurrentRoutePointsState({ start: null, end: null }); // Reset points
    setRouteInfo(null); // Reset summary info
    setRoutesAreLoading(false); // Reset loading state
    setAllRoutesComputed(false); // Reset computed flag
    setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null }); // Reset computed data
    setComputedRouteTowers({ fastest: [], cell_coverage: [], balanced: [] }); // Reset computed towers
    setRouteDirections(null); // Reset directions
    setShowDirectionsPanel(false); // Hide directions panel
    setIsDirectionsMinimized(false); // Reset minimized state
    setActiveDirectionStepState(null); // Reset active step
    setRouteOriginDisplay(''); // Reset display names
    setRouteDestinationDisplay('');
    routeLineLayerRef.current = null; // Clear layer ref
  }, [clearRouteLine, clearLayerGroup]); // Dependencies


  // --- Calculate All Route Types ---
  // Fetches route data for fastest, cell_coverage, and balanced types concurrently.
  const calculateAllRouteTypes = useCallback(async (points, originName, destName) => {
    // --- Input Validation ---
    if (!points?.start?.lat || !points?.end?.lat) {
      toast.error("Cannot calculate route: Origin or Destination point is missing.");
      return;
    }
    if (routesAreLoading) {
      console.warn("Route calculation requested but already in progress. Ignoring.");
      return; // Prevent concurrent calculations
    }

    // --- Reset State and Prepare for Calculation ---
    calculationAbortController.current?.abort(); // Abort previous calculation if any
    calculationAbortController.current = new AbortController(); // Create new abort controller
    const { signal } = calculationAbortController.current; // Get signal for API calls

    setRoutesAreLoading(true); // Set loading state
    setAllRoutesComputed(false); // Reset computed flag
    setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null }); // Clear previous results
    setComputedRouteTowers({ fastest: [], cell_coverage: [], balanced: [] }); // Clear previous towers
    clearRouteLine?.(); // Clear existing route line
    setRouteDirections(null); // Clear directions
    setShowDirectionsPanel(false); // Hide panel
    setRouteOriginDisplay(originName || ''); // Set display names
    setRouteDestinationDisplay(destName || '');
    routeLineLayerRef.current = null; // Clear layer ref

    const { start, end } = points;
    const typesToCalculate = ['fastest', 'cell_coverage', 'balanced'];
    let calculationSuccess = false; // Flag to track if at least one calculation succeeded
    let firstSuccessfulRouteData = null; // Store the first successful result for immediate display
    let firstSuccessfulRouteType = null;

    // --- Perform API Calls Concurrently ---
    try {
      // First, approximate the direct distance to check if it's likely over the limit
      // This is a quick check to save API calls for obviously long routes
      const directDistance = calculateHaversineDistance(
        start.lat, start.lng, 
        end.lat, end.lng
      );
      
      // If the direct distance is over 800km (giving some margin below our 900km limit),
      // it's almost certainly going to exceed our limit with actual road routing
      if (directDistance > 800) {
        toast.error(
          "Route distance exceeds the 900km maximum limit of the GraphHopper API free tier.", 
          { id: 'distance-limit-exceeded' }
        );
        clearRoutingState();
        setOriginValue(''); // Reset origin input field
        setDestinationValue(''); // Reset destination input field
        setShowDirectionsPanel(false); // Hide directions panel
        updateMarker?.(null, true); // Remove origin marker
        updateMarker?.(null, false); // Remove destination marker
        setAllRoutesComputed(false); // Prevent route modifiers panel from showing
        setRoutesAreLoading(false);
        return;
      }

      const results = await Promise.all( // Fetch all route types in parallel
        typesToCalculate.map(type =>
          api.fetchRoute(start.lat, start.lng, end.lat, end.lng, type, signal) // Pass signal to API call
            .then(response => {
              // Check for successful response and valid geometry
              if (response.data?.code === 'Ok' && response.data.routes?.[0]?.geometry) {
                return { type, data: response.data }; // Return successful data
              } else {
                // Throw error for backend failures or missing geometry
                throw new Error(response.data?.message || `Backend calculation failed for ${type} route.`);
              }
            })
            .catch(error => {
              // Handle specific AbortError or general errors
              if (error.name === 'AbortError' || signal.aborted) {
                console.log(`Calculation for '${type}' route aborted.`);
                return { type, error: 'Aborted' }; // Indicate abortion
              }
              
              // Extract error message from response if available
              const errorMessage = error.response?.data?.error || error.message || 'Calculation failed';
              
              // Check if this is our distance limit error
              if (errorMessage.includes('exceeds the 900km maximum')) {
                // Instead of showing individual toasts, we'll show one consolidated toast outside the loop
                console.error(`Route distance limit exceeded for '${type}' route`);
                return { type, error: 'DistanceLimitExceeded' };
              }
              
              console.error(`Failed to calculate '${type}' route:`, errorMessage);
              toast.error(`Failed to calculate ${type} route. ${errorMessage}`, { id: `calc-err-${type}` });
              return { type, error: errorMessage }; // Return error info
            })
        )
      );

      // Check if all routes failed with distance limit exceeded
      if (results.every(result => result.error === 'DistanceLimitExceeded')) {
        toast.error(
          "Route distance exceeds the 900km maximum limit of the GraphHopper API free tier.", 
          { id: 'distance-limit-exceeded' }
        );
        clearRoutingState();
        setOriginValue(''); // Reset origin input field
        setDestinationValue(''); // Reset destination input field
        setShowDirectionsPanel(false); // Hide directions panel
        updateMarker?.(null, true); // Remove origin marker
        updateMarker?.(null, false); // Remove destination marker
        setAllRoutesComputed(false); // Prevent route modifiers panel from showing
        setRoutesAreLoading(false);
        return;
      }
      
      // If the overall calculation was aborted, stop processing
      if (signal.aborted) {
        console.log("Route calculation process aborted.");
        setRoutesAreLoading(false);
        return;
      }

      // --- Process Results ---
      const newComputedRoutes = {};
      const newComputedRouteTowers = {};
      results.forEach(result => {
        if (result.data) { // If calculation for this type succeeded
          newComputedRoutes[result.type] = result.data;
          newComputedRouteTowers[result.type] = result.data.towers || []; // Store associated towers
          calculationSuccess = true; // Mark that at least one succeeded
          // Store the first successful result
          if (!firstSuccessfulRouteData) {
            firstSuccessfulRouteData = result.data;
            firstSuccessfulRouteType = result.type;
          }
        } else { // If calculation failed or was aborted
          newComputedRoutes[result.type] = null;
          newComputedRouteTowers[result.type] = [];
        }
      });

      setComputedRoutes(newComputedRoutes); // Update state with all computed routes (or nulls)
      setComputedRouteTowers(newComputedRouteTowers); // Update state with towers for each route

      // --- Display Route or Handle Failure ---
      if (!calculationSuccess) {
        throw new Error("All route calculations failed or were aborted."); // Throw error if none succeeded
      }

      // Determine which route type to display initially (preferred type or first successful)
      const typeToDisplay = newComputedRoutes[routeType] ? routeType : firstSuccessfulRouteType;
      const routeDataToDisplay = newComputedRoutes[typeToDisplay];

      if (routeDataToDisplay) {
        displayRoute(routeDataToDisplay, typeToDisplay); // Display the chosen route
      } else {
        console.error("No valid routes available to display after calculation.");
        toast.error("Could not display any calculated route.");
        clearRoutingState(); // Clear everything if display fails
      }

    } catch (error) { // Catch errors from Promise.all or the processing block
      if (error.name !== 'AbortError' && !signal.aborted) { // Don't show error toast if aborted
        console.error('Error during route calculation process:', error);
        toast.error(error.message || "An unexpected error occurred while calculating routes.");
      }
      clearRoutingState(); // Clear state on error
    } finally {
      // Ensure loading state is reset and computed flag is set unless aborted
      if (!signal.aborted) {
        setRoutesAreLoading(false);
        setAllRoutesComputed(true); // Mark all calculations as finished (even if some failed)
        calculationAbortController.current = null; // Clear abort controller ref
      }
    }
  }, [routesAreLoading, routeType, clearRouteLine, displayRoute, clearRoutingState, setOriginValue, setDestinationValue, updateMarker]); // Dependencies


  // --- Set Active Direction Step ---
  // Updates the index of the currently highlighted step in the DirectionsPanel.
  const setActiveDirectionStep = useCallback((index) => {
    setActiveDirectionStepState(index);
  }, []);


  // --- Toggle Directions Panel Minimized State ---
  const toggleDirectionsMinimized = useCallback(() => {
    setIsDirectionsMinimized(prev => !prev);
  }, []);


  // --- Fetch Saved Routes ---
  // Fetches the list of saved routes for the current user.
  const fetchSavedRoutes = useCallback(async () => {
    if (!user) {
      setSavedRoutes([]); // Clear routes if user logs out
      return;
    }
    setIsLoadingSavedRoutes(true); // Set loading state
    try {
      const response = await api.fetchSavedRoutes(); // Call API
      /** @type {SavedRouteData[]} */
      // Process response data
      const routes = (response.data || []).map(route => ({
        ...route,
        _id: String(route._id), // Ensure IDs are strings
        user_id: String(route.user_id)
      }));
      setSavedRoutes(routes); // Update state
    } catch (error) {
      console.error("Error fetching saved routes:", error);
      toast.error(error.response?.data?.error || "Failed to load saved routes.");
      setSavedRoutes([]); // Clear routes on error
    } finally {
      setIsLoadingSavedRoutes(false); // Clear loading state
    }
  }, [user]); // Dependency: user


  // --- Effect to Fetch Saved Routes on User Change ---
  useEffect(() => {
    fetchSavedRoutes(); // Fetch routes when user state changes (login/logout)
  }, [user, fetchSavedRoutes]); // Dependencies


  // --- Helper: Capture Map Area ---
  // Takes a snapshot of a specific map area (origin or destination).
  // Temporarily hides UI elements, sets view, captures canvas, restores view/UI.
  const captureMapArea = useCallback(async (mapContainerElement, lat, lng, zoom, markerIcon) => {
    // --- Guard Clauses ---
    if (!map) throw new Error("Map instance not available for capture.");
    if (!mapContainerElement || !document.body.contains(mapContainerElement)) {
      throw new Error("Map container element not valid or not attached for capture.");
    }

    // --- Capture Logic ---
    let marker = null; // To store the temporary marker
    try {
      map.setView([lat, lng], zoom, { animate: false }); // Set view instantly
      // Short delay to allow tiles to potentially load (adjust as needed)
      await new Promise(resolve => setTimeout(resolve, 1500)); // Increased wait time

      // Add temporary marker
      marker = L.marker([lat, lng], { icon: markerIcon, zIndexOffset: 2000 }).addTo(map);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay after adding marker

      // Double-check container validity before capturing
      if (!mapContainerElement || !document.body.contains(mapContainerElement)) {
        throw new Error("Map container detached before html2canvas capture.");
      }

      // Capture canvas using html2canvas
      const canvas = await html2canvas(mapContainerElement, {
        useCORS: true,       // Allow cross-origin images (like map tiles)
        allowTaint: true,    // Allow potentially tainted canvas (needed for some map tiles)
        scale: 1,            // Use native resolution
        logging: false,      // Disable html2canvas logging
        backgroundColor: '#ffffff', // Set background for transparent areas
        // Ignore Leaflet controls during capture
        ignoreElements: (element) => element.closest('.leaflet-control-container'),
      });

      return canvas; // Return the captured canvas

    } finally {
      // --- Cleanup ---
      if (marker) { // Remove temporary marker if it was added
        try { map.removeLayer(marker); } catch (e) { /* Ignore removal error */ }
      }
    }
  }, [map]); // Dependency: map instance


  // --- Save Current Route ---
  // Captures map snapshots, prepares route data, and sends it to the backend API.
  const saveCurrentRoute = useCallback(async (mapContainerElement) => {
    // --- Get Current Route Data ---
    const currentActiveType = routeInfo?.routeType; // Get the currently displayed route type
    const currentFullRouteData = currentActiveType ? computedRoutes[currentActiveType] : null; // Get the full data for that type
    const currentRouteObject = currentFullRouteData?.routes?.[0]; // Get the specific route object

    // --- Validation Checks ---
    if (!user) { toast.error("Please log in to save routes."); return; }
    if (!map) { toast.error("Map is not available to capture image."); return; }
    if (!mapContainerElement || !document.body.contains(mapContainerElement)) {
      toast.error("Map container element not valid or not attached for capture."); return;
    }
    if (!currentRouteObject || !currentRoutePoints?.start || !currentRoutePoints?.end) {
      toast.error("No valid route is currently displayed to save."); return;
    }
    if (!routeOriginDisplay || !routeDestinationDisplay) {
      toast.error("Origin or Destination name is missing. Cannot save route."); return;
    }

    // --- Preparation ---
    const saveToastId = toast.loading("Preparing route snapshot...", { id: 'save-route-start' }); // Start loading toast
    let originalCenter = null, originalZoom = null; // Store original map view
    const hiddenElementsInfo = []; // Store info about temporarily hidden elements

    // Define temporary marker icons for capture
    const tempOriginIcon = L.divIcon({
      className: 'save-capture-marker origin',
      html: `<div style="background-color: #2A93EE; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5);"></div>`,
      iconSize: [26, 26], iconAnchor: [13, 13]
    });
    const tempDestIcon = L.divIcon({
      className: 'save-capture-marker destination',
      html: `<div style="background-color: #EE2A2A; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5);"></div>`,
      iconSize: [26, 26], iconAnchor: [13, 13]
    });

    // --- Capture and Save Logic ---
    try {
      // --- Prepare Map for Capture ---
      originalCenter = map.getCenter(); // Store current view
      originalZoom = map.getZoom();

      // Hide UI elements that overlay the map
      const selectorsToHide = ['.search-panel-container', '.search-button-container', '.auth-buttons-container', '.map-controls-container', '.directions-panel-container']; // Add any other overlays
      document.querySelectorAll(selectorsToHide.join(', ')).forEach(el => {
        hiddenElementsInfo.push({ element: el, originalDisplay: el.style.display }); // Store original display style
        el.style.setProperty('display', 'none', 'important'); // Hide element forcefully
      });
      clearRouteLine?.(); // Temporarily remove route line
      updateMarker?.(null, true); // Temporarily remove origin marker
      updateMarker?.(null, false); // Temporarily remove destination marker

      map.invalidateSize(); // Ensure map recalculates size after hiding elements
      await new Promise(resolve => setTimeout(resolve, 300)); // Short delay for DOM updates

      // --- Capture Origin and Destination Snapshots ---
      toast.loading("Capturing origin snapshot...", { id: saveToastId });
      const originCanvas = await captureMapArea(mapContainerElement, currentRoutePoints.start.lat, currentRoutePoints.start.lng, 18, tempOriginIcon); // Capture origin (adjust zoom)
      toast.loading("Capturing destination snapshot...", { id: saveToastId });
      const destCanvas = await captureMapArea(mapContainerElement, currentRoutePoints.end.lat, currentRoutePoints.end.lng, 18, tempDestIcon); // Capture destination (adjust zoom)

      // --- Restore Map State ---
      if (originalCenter && originalZoom != null) {
        map.setView(originalCenter, originalZoom, { animate: false }); // Restore original view instantly
      }
      // Restore visibility of hidden UI elements
      hiddenElementsInfo.forEach(({ element, originalDisplay }) => {
        element.style.display = originalDisplay || ''; // Restore original display style
      });
      // Restore the route line and markers
      const routeObjectToRestore = currentFullRouteData?.routes?.[0];
      if (routeObjectToRestore?.geometry?.coordinates) {
        const routeLatLngs = routeObjectToRestore.geometry.coordinates.map(coord => L.latLng(coord[1], coord[0]));
        displayRouteLine?.(routeLatLngs, { color: getRouteLineColor(currentActiveType) });
      }
      if (currentRoutePoints.start) updateMarker?.(L.latLng(currentRoutePoints.start.lat, currentRoutePoints.start.lng), true);
      if (currentRoutePoints.end) updateMarker?.(L.latLng(currentRoutePoints.end.lat, currentRoutePoints.end.lng), false);

      map.invalidateSize(); // Invalidate size again after restoring elements
      await new Promise(resolve => setTimeout(resolve, 100)); // Short delay

      // --- Combine Canvases ---
      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = originCanvas.width * 2; // Combine side-by-side
      combinedCanvas.height = originCanvas.height;
      const combinedCtx = combinedCanvas.getContext('2d');
      if (!combinedCtx) throw new Error("Failed to get 2D context for combining images.");
      combinedCtx.drawImage(originCanvas, 0, 0); // Draw origin image
      combinedCtx.drawImage(destCanvas, originCanvas.width, 0); // Draw destination image next to it

      const routeImage = combinedCanvas.toDataURL('image/jpeg', 0.8); // Convert combined canvas to JPEG data URL (adjust quality 0.0-1.0)

      // --- Prepare Data for API ---
      toast.loading("Saving route data...", { id: saveToastId });

      const allRouteData = {}; // Store full RouteApiResponse for each computed type
      const allRouteGeometry = {}; // Store simplified geometry for each computed type
      let hasMultipleRoutesSaved = false; // Flag if more than one type is saved

      Object.keys(computedRoutes).forEach(type => {
        if (computedRoutes[type]) { // If this route type was successfully computed
          allRouteData[type] = computedRoutes[type]; // Store the full data
          // Store simplified geometry if available
          if (computedRoutes[type].routes?.[0]?.geometry?.coordinates) {
            allRouteGeometry[type] = {
              coordinates: computedRoutes[type].routes[0].geometry.coordinates
            };
          }
          if (Object.keys(allRouteData).length > 1) hasMultipleRoutesSaved = true; // Set flag if multiple types exist
        }
      });

      // Construct payload for the save API endpoint
      const saveData = {
        origin: {
          place_name: routeOriginDisplay,
          lat: currentRoutePoints.start.lat,
          lng: currentRoutePoints.start.lng
        },
        destination: {
          place_name: routeDestinationDisplay,
          lat: currentRoutePoints.end.lat,
          lng: currentRoutePoints.end.lng
        },
        route_data: allRouteData, // Contains all computed routes keyed by type
        route_type: currentActiveType, // The type active when saving
        route_image: routeImage, // Combined image data URL
        route_geometry: allRouteGeometry, // Simplified geometry for previews
        has_multiple_routes: hasMultipleRoutesSaved // Flag indicating multiple types saved
      };

      // --- Call Save API ---
      const response = await api.saveRoute(saveData); // Send data to backend

      if (response.data?.success) {
        toast.success("Route saved successfully!", { id: saveToastId }); // Update toast on success
        fetchSavedRoutes(); // Refresh the list of saved routes
      } else {
        // Throw error if backend indicates failure
        throw new Error(response.data?.error || "Failed to save route on the server.");
      }
    } catch (error) { // Catch errors from capture, canvas, or API call
      console.error("Error during saveCurrentRoute process:", error);
      toast.error(`Error saving route: ${error.message}`, { id: saveToastId }); // Show error toast

      // --- Ensure UI is restored on error ---
      hiddenElementsInfo.forEach(({ element, originalDisplay }) => {
        element.style.display = originalDisplay || ''; // Restore UI elements
      });
      // Restore map state as best as possible
      if (map) {
        const routeObjectOnError = currentFullRouteData?.routes?.[0];
        if (routeObjectOnError?.geometry?.coordinates) {
          const routeLatLngs = routeObjectOnError.geometry.coordinates.map(coord => L.latLng(coord[1], coord[0]));
          displayRouteLine?.(routeLatLngs, { color: getRouteLineColor(currentActiveType) });
        }
        if (currentRoutePoints.start) updateMarker?.(L.latLng(currentRoutePoints.start.lat, currentRoutePoints.start.lng), true);
        if (currentRoutePoints.end) updateMarker?.(L.latLng(currentRoutePoints.end.lat, currentRoutePoints.end.lng), false);
        if (originalCenter && originalZoom != null) {
          map.setView(originalCenter, originalZoom, { animate: false }); // Restore view
        }
        map.invalidateSize(); // Invalidate size
      }
    }
  }, [
    user, map, routeInfo, computedRoutes, currentRoutePoints, routeOriginDisplay,
    routeDestinationDisplay, fetchSavedRoutes, displayRouteLine, clearRouteLine,
    updateMarker, captureMapArea // Dependencies
  ]);


  // --- Load Saved Route ---
  // Clears current state and displays a previously saved route.
  const loadSavedRoute = useCallback(async (savedRouteData) => {
    // --- Validation ---
    if (!map || !savedRouteData?.origin?.lat || !savedRouteData?.destination?.lat || !savedRouteData?.route_data) {
      console.error("Cannot load saved route: Invalid data provided.", savedRouteData);
      toast.error("Could not load the selected route: Invalid data.");
      return;
    }
    // console.log("loadSavedRoute: Loading route ID:", savedRouteData._id); // Debug log

    // --- Reset Current State ---
    clearRoutingState();

    // --- Prepare Data from Saved Route ---
    const originLL = L.latLng(savedRouteData.origin.lat, savedRouteData.origin.lng);
    const destLL = L.latLng(savedRouteData.destination.lat, savedRouteData.destination.lng);
    const originName = savedRouteData.origin.place_name || `${savedRouteData.origin.lat.toFixed(5)}, ${savedRouteData.origin.lng.toFixed(5)}`;
    const destName = savedRouteData.destination.place_name || `${savedRouteData.destination.lat.toFixed(5)}, ${savedRouteData.destination.lng.toFixed(5)}`;
    const savedActiveType = savedRouteData.route_type || 'balanced'; // Default to balanced if type missing

    // --- Update State with Saved Route Data ---
    setOriginValue?.(originName); // Update search input (origin)
    setDestinationValue?.(destName); // Update search input (destination)
    setCurrentRoutePointsState({ start: savedRouteData.origin, end: savedRouteData.destination }); // Set route points
    setRouteOriginDisplay(originName); // Set display names
    setRouteDestinationDisplay(destName);
    setRouteTypeState(savedActiveType); // Set active route type

    // Reconstruct computedRoutes and computedRouteTowers from saved data
    const newComputed = { fastest: null, cell_coverage: null, balanced: null };
    const newTowers = { fastest: [], cell_coverage: [], balanced: [] };
    let availableTypesCount = 0;

    // Check if route_data is an object (newer format) or single object (older format)
    if (typeof savedRouteData.route_data === 'object' && savedRouteData.route_data !== null) {
      Object.keys(newComputed).forEach(type => {
        if (savedRouteData.route_data[type]) { // If data exists for this type
          newComputed[type] = savedRouteData.route_data[type];
          newTowers[type] = savedRouteData.route_data[type].towers || []; // Get towers or default to empty array
          availableTypesCount++;
        }
      });
    } else {
      // Fallback for potentially older format where route_data might be the single active route object
      console.warn("Loading potentially older saved route format.");
      newComputed[savedActiveType] = savedRouteData.route_data; // Assume route_data is the active one
      newTowers[savedActiveType] = savedRouteData.route_data?.towers || [];
      availableTypesCount = 1;
    }

    setComputedRoutes(newComputed); // Set reconstructed computed routes state
    setComputedRouteTowers(newTowers); // Set reconstructed towers state
    setAllRoutesComputed(true); // Mark as computed (since we loaded them)
    setRoutesAreLoading(false); // Ensure loading is false

    // --- Display the Loaded Route ---
    const routeToDisplay = newComputed[savedActiveType];
    if (routeToDisplay) {
      displayRoute(routeToDisplay, savedActiveType); // Display the route
    } else {
      console.error("Data for the saved active route type not found in loaded data:", savedActiveType);
      toast.error("Could not display the primary saved route data.");
    }

    // --- Update Map View and Markers ---
    fitBounds?.([originLL, destLL]); // Fit map to the loaded route bounds
    updateMarker?.(originLL, true); // Add origin marker
    updateMarker?.(destLL, false); // Add destination marker

    // --- User Feedback ---
    // Small delay to allow map updates before showing toast
    await new Promise(resolve => setTimeout(resolve, 100));
    if (availableTypesCount > 1) {
      toast.success(`Loaded route. ${availableTypesCount} optimization options available.`, { duration: 4000 });
    } else {
      toast.success(`Loaded saved route (${savedActiveType}).`);
    }

  }, [map, updateMarker, clearRoutingState, displayRoute, fitBounds, setOriginValue, setDestinationValue]); // Dependencies


  // --- Returned Values from Hook ---
  return {
    // State
    routeType,
    currentRoutePoints,
    routeInfo,
    routesAreLoading,
    allRoutesComputed,
    computedRoutes, // Expose all computed routes for modal
    routeDirections,
    showDirectionsPanel,
    isDirectionsMinimized,
    activeDirectionStep,
    routeOriginDisplay,
    routeDestinationDisplay,
    savedRoutes,
    isLoadingSavedRoutes,
    // Functions
    setRouteType,
    setCurrentRoutePoints,
    setRouteDisplayNames: (origin, dest) => { // Combined setter for display names
      setRouteOriginDisplay(origin);
      setRouteDestinationDisplay(dest);
    },
    calculateAllRouteTypes,
    clearRoutingState,
    setActiveDirectionStep,
    toggleDirectionsMinimized,
    saveCurrentRoute,
    fetchSavedRoutes, // Expose function to allow manual refresh if needed
    loadSavedRoute,
  };
};