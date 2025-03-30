import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import L from 'leaflet'; // Needed for L.LatLng type if using TS

import * as api from '../services/api.js'; // API service functions
import { findTowersAlongRouteFE } from '../utils/geometry.js'; // Geometry utility for finding nearby towers


// --- JSDoc Type Definitions ---
/**
 * @typedef {object} TowerData - Raw tower data, typically from API or CSV.
 * @property {number} lat
 * @property {number} lon
 * @property {string|number} [id] - Optional unique identifier.
 * @property {number} [averageSignal]
 * // ... other potential properties like mcc, net, cell, range, updated, radio
 */
/**
 * @typedef {object} ProcessedTowerData - Tower data enhanced with route context.
 * @property {number} lat
 * @property {number} lon
 * @property {string|number} [id]
 * @property {number} [averageSignal]
 * @property {number} distanceToRoute - Distance from the route in meters (-1 if not calculated).
 * @property {number} positionAlongRoute - Normalized position along the route (0 to 1, -1 if not calculated).
 * // ... other potential properties inherited from TowerData
 */
/**
 * @typedef {object} BoundsLiteral - Bounding box defined by corner coordinates.
 * @property {number} min_lat
 * @property {number} min_lng
 * @property {number} max_lat
 * @property {number} max_lng
 */
/**
 * @typedef {object} RouteGeometry - GeoJSON LineString geometry.
 * @property {string} type - Typically "LineString".
 * @property {number[][]} coordinates - Array of [lng, lat] coordinates.
 */


// --- Constants ---
const MAX_DISPLAY_TOWERS = 300; // Limit the number of towers displayed on the map for performance


/**
 * useTowers Hook
 * 
 * Manages fetching, processing, and displaying cell tower data on the map.
 * Allows fetching towers within specific map bounds and optionally filtering
 * them based on proximity to a given route geometry.
 *
 * @param {L.Map | null} map - The Leaflet map instance.
 * @param {RouteGeometry | null} currentRouteGeometry - The geometry of the currently active route (if any).
 * @returns {{
 *  isLoading: boolean,
 *  showTowers: boolean,
 *  toggleShowTowers: () => void,
 *  fetchTowersInBounds: (bounds: BoundsLiteral) => Promise<void>,
 *  towersToDisplay: ProcessedTowerData[],
 *  towersAlongRoute: ProcessedTowerData[],
 *  allFetchedTowersCount: number,
 *  towerDataSource: string
 * }} An object containing tower state and functions.
 */
export const useTowers = (map, currentRouteGeometry) => {
  // --- State Variables ---
  const [isLoading, setIsLoading] = useState(false); // Tracks if tower data is currently being fetched
  const [showTowers, setShowTowers] = useState(false); // Controls the visibility of tower markers on the map
  /** @type {[ProcessedTowerData[], React.Dispatch<React.SetStateAction<ProcessedTowerData[]>>]} */
  const [towersToDisplay, setTowersToDisplay] = useState([]); // Towers processed and ready for display (potentially filtered/limited)
  const [towerDataSource, setTowerDataSource] = useState('unknown'); // Source of the currently loaded tower data ('CSV', 'mock', 'error', 'unknown')
  const [fetchCounter, setFetchCounter] = useState(0); // Simple counter to trigger the processing effect after fetching

  // --- Refs ---
  /** @type {React.MutableRefObject<TowerData[]>} */
  const allTowersRef = useRef([]); // Ref to store *all* towers fetched for the current bounds (unfiltered)


  // --- Fetch Towers Function ---
  // Fetches tower data from the API based on geographical bounds.
  const fetchTowersInBounds = useCallback(async (bounds) => {
    // --- Input Validation ---
    if (!bounds || bounds.min_lat == null || bounds.min_lng == null || bounds.max_lat == null || bounds.max_lng == null) {
      console.error("[useTowers] fetchTowersInBounds: Invalid or incomplete bounds received.", bounds);
      toast.error("Cannot fetch towers: Invalid map bounds provided.", { id: 'fetch-towers-bounds-err' });
      return; // Exit if bounds are invalid
    }

    // --- Start Fetching ---
    setIsLoading(true); // Set loading state
    // console.log(`[useTowers] Fetching towers in bounds:`, bounds); // Debug log
    const loadingToastId = toast.loading("Fetching cell tower data...", { id: 'fetch-towers' }); // Show loading notification

    try {
      // --- API Call ---
      const response = await api.fetchTowers(
        bounds.min_lat, bounds.min_lng, bounds.max_lat, bounds.max_lng // Pass bounds to API
      );
      /** @type {TowerData[]} */
      const fetchedTowers = response.data?.towers || []; // Extract towers or default to empty array
      const source = response.data?.source || 'unknown'; // Extract data source or default

      toast.dismiss(loadingToastId); // Dismiss loading notification
      // console.log(`[useTowers] Fetched ${fetchedTowers.length} towers (source: ${source}). Updating ref...`); // Debug log

      // --- Update State and Refs ---
      allTowersRef.current = fetchedTowers; // Store all fetched towers in the ref
      setTowerDataSource(source); // Update data source state
      setFetchCounter(c => c + 1); // Increment counter to trigger the processing useEffect

    } catch (error) { // --- Error Handling ---
      toast.dismiss(loadingToastId); // Dismiss loading notification
      console.error("[useTowers] Error fetching cell tower data:", error);
      toast.error(error.response?.data?.error || "Failed to fetch cell tower data.", { id: 'fetch-towers-api-err' });
      allTowersRef.current = []; // Clear stored towers on error
      setTowerDataSource('error'); // Set source to error
      setTowersToDisplay([]); // Clear displayed towers immediately on error
      // Optionally trigger processing effect even on error if needed: setFetchCounter(c => c + 1);
    } finally {
      setIsLoading(false); // Clear loading state regardless of outcome
    }
  }, []); // No dependencies needed as it uses refs and constants


  // --- Process Towers Effect ---
  // This effect runs whenever the map, route geometry, or fetched tower data (via fetchCounter) changes.
  // It filters/processes the towers based on whether a route is active.
  useEffect(() => {
    // console.log(`[useTowers Process Effect] Running. Map: ${!!map}, Route: ${!!currentRouteGeometry}, Fetched Count: ${allTowersRef.current.length}, FetchCounter: ${fetchCounter}`); // Debug log
    /** @type {ProcessedTowerData[]} */
    let processedTowers = []; // Initialize array for processed towers

    // --- Process based on context ---
    if (map) { // Only process if the map instance is available
      if (currentRouteGeometry) {
        // If a route is active, find towers along that route
        // console.log("[useTowers Process Effect] Processing towers ALONG ROUTE"); // Debug log
        processedTowers = findTowersAlongRouteFE(map, allTowersRef.current, currentRouteGeometry, 1500); // Use utility function
      } else {
        // If no route is active, process all fetched towers (add default properties)
        // console.log("[useTowers Process Effect] Processing ALL fetched towers (no route)"); // Debug log
        processedTowers = allTowersRef.current.map(t => ({
          ...t,
          distanceToRoute: -1, // Default value indicating not calculated
          positionAlongRoute: -1 // Default value indicating not calculated
        }));
      }

      // --- Limit Displayed Towers ---
      // Apply display limit if the number of processed towers exceeds the maximum
      if (processedTowers.length > MAX_DISPLAY_TOWERS) {
        // console.log(`[useTowers Process Effect] Limiting tower display from ${processedTowers.length} to ${MAX_DISPLAY_TOWERS}`); // Debug log
        // Slice the array (could implement more sophisticated sampling/prioritization if needed)
        processedTowers = processedTowers.slice(0, MAX_DISPLAY_TOWERS);
      }
    } else {
      // If map is not ready, clear processed towers
      // console.log("[useTowers Process Effect] Skipping processing (no map instance)"); // Debug log
      processedTowers = [];
    }

    // --- Update State ---
    // console.log("[useTowers Process Effect] Setting towersToDisplay count:", processedTowers.length); // Debug log
    setTowersToDisplay(processedTowers); // Update the state with the processed towers ready for display

  }, [map, currentRouteGeometry, fetchCounter]); // Dependencies: map, route geometry, and fetch counter


  // --- Toggle Tower Visibility Function ---
  // Toggles the `showTowers` state between true and false.
  const toggleShowTowers = useCallback(() => {
    // console.log("[useTowers] Toggling tower visibility."); // Debug log
    setShowTowers(prevShowTowers => !prevShowTowers); // Update state using functional update
  }, []); // No dependencies needed


  // --- Returned Values from Hook ---
  return {
    isLoading,                 // Is tower data currently being fetched? (boolean)
    showTowers,                // Should tower markers be displayed on the map? (boolean)
    toggleShowTowers,          // Function to toggle the visibility state
    fetchTowersInBounds,       // Function to fetch towers for given bounds
    towersToDisplay,           // Array of processed towers ready for display (filtered/limited)
    towersAlongRoute: currentRouteGeometry ? towersToDisplay : [], // Convenience array: towers to display if route exists, empty otherwise
    allFetchedTowersCount: allTowersRef.current.length, // Total number of towers fetched for the current bounds
    towerDataSource,           // Source of the fetched tower data (string: 'CSV', 'mock', 'error', 'unknown')
  };
};