import { useState, useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
import { toast } from 'react-hot-toast';
import * as api from '../services/api.js';
import { findTowersAlongRouteFE } from '../utils/geometry.js';

// JSDoc types...
/** @typedef {import('./useTowers').TowerData} TowerData */
/** @typedef {import('./useTowers').ProcessedTowerData} ProcessedTowerData */

const MAX_DISPLAY_TOWERS = 300;

export const useTowers = (map, currentRouteGeometry) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showTowers, setShowTowers] = useState(false);
  /** @type {React.MutableRefObject<TowerData[]>} */
  const allTowers = useRef([]);
  /** @type {[ProcessedTowerData[], React.Dispatch<React.SetStateAction<ProcessedTowerData[]>>]} */
  const [towersToDisplay, setTowersToDisplay] = useState([]);
  const [towerDataSource, setTowerDataSource] = useState('unknown');
  // Add a simple state to trigger the effect after fetch
  const [fetchCounter, setFetchCounter] = useState(0);

  // --- Fetching ---
  const fetchTowersInBounds = useCallback(async (bounds) => {
    if (!bounds || bounds.min_lat == null || bounds.min_lng == null || bounds.max_lat == null || bounds.max_lng == null) {
        console.error("[useTowers] fetchTowersInBounds: Invalid or incomplete bounds received.", bounds);
        return;
    }
    setIsLoading(true);
    // console.log(`[useTowers] Fetching towers in bounds:`, bounds);
    const loadingToastId = toast.loading("Fetching cell tower data...", { id: 'fetch-towers' });

    try {
      const response = await api.fetchTowers(
        bounds.min_lat, bounds.min_lng, bounds.max_lat, bounds.max_lng
      );
      /** @type {TowerData[]} */
      const fetchedTowers = response.data?.towers || [];
      const source = response.data?.source || 'unknown';

      toast.dismiss(loadingToastId);
      // console.log(`[useTowers] Fetched ${fetchedTowers.length} towers (source: ${source}). Updating ref...`);
      allTowers.current = fetchedTowers; // Update ref
      setTowerDataSource(source);
      // **** Trigger useEffect by incrementing counter ****
      setFetchCounter(c => c + 1);

    } catch (error) {
      toast.dismiss(loadingToastId);
      console.error("[useTowers] Error fetching cell tower data:", error);
      allTowers.current = [];
      setTowerDataSource('error');
      setTowersToDisplay([]); // Clear display state immediately on error
      // Optionally trigger effect even on error if needed: setFetchCounter(c => c + 1);
    } finally {
      setIsLoading(false);
    }
  }, []); // Dependencies are minimal

  // --- Effect to Process Towers ---
  // Now depends on fetchCounter as well
  useEffect(() => {
    // Don't process if fetchCounter is 0 (initial state) unless map/route already exist
    // Or simply always process based on current ref state when deps change
    // console.log(`[useTowers Effect] Running. Map: ${!!map}, Route: ${!!currentRouteGeometry}, Fetched Count: ${allTowers.current.length}, FetchCounter: ${fetchCounter}`);
    // console.log("[useTowers Effect] showTowers:", showTowers);
    /** @type {ProcessedTowerData[]} */
    let processed = [];

    if (map) { // Only process if map exists
        if (currentRouteGeometry) {
            // console.log("[useTowers Effect] --> Processing towers ALONG ROUTE");
            processed = findTowersAlongRouteFE(map, allTowers.current, currentRouteGeometry, 1500);
        } else {
            // console.log("[useTowers Effect] --> Processing ALL fetched towers (no route)");
            processed = allTowers.current.map(t => ({
                ...t,
                distanceToRoute: -1,
                positionAlongRoute: -1
            }));
        }

        if (processed.length > MAX_DISPLAY_TOWERS) {
            // console.log(`[useTowers Effect] Limiting tower display to ${MAX_DISPLAY_TOWERS}`);
            processed = processed.slice(0, MAX_DISPLAY_TOWERS);
        }
    } else {
        // console.log("[useTowers Effect] --> Skipping processing (no map)");
        processed = [];
    }


    // console.log("[useTowers Effect] Setting towersToDisplay count:", processed.length);
    setTowersToDisplay(processed);

  // Add fetchCounter to dependency array
  }, [map, currentRouteGeometry, fetchCounter]);


  // --- Visibility Toggle ---
  const toggleShowTowers = useCallback(() => {
    // console.log("[useTowers] toggleShowTowers - BEFORE:", showTowers);
    setShowTowers(prev => !prev);
    // console.log("[useTowers] toggleShowTowers - AFTER:", showTowers);
  }, []);

  // --- Return ---
   return {
    isLoading,
    showTowers,
    toggleShowTowers,
    fetchTowersInBounds,
    towersToDisplay,
    towersAlongRoute: currentRouteGeometry ? towersToDisplay : [],
    allFetchedTowersCount: allTowers.current.length,
    towerDataSource,
  };
};