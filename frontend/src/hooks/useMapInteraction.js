import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

/**
 * useMapInteraction Hook
 * 
 * Provides functions for interacting with the map, specifically:
 * - Temporarily disabling map interactions (zoom, drag, etc.).
 */
export const useMapInteraction = (map, mapContainerRef) => {
  // --- State ---
  const [isBlockingInteraction, setIsBlockingInteraction] = useState(false); // Tracks if map interactions are blocked

  // --- Prevent Map Interaction Function ---
  // Disables various map interaction handlers (drag, zoom, etc.) and returns a cleanup function to re-enable them.
  const preventMapInteraction = useCallback(() => {
    const mapElement = mapContainerRef?.current; // Get map container element from ref
    // --- Guard Clauses ---
    if (!map || !mapElement) {
      console.warn("[useMapInteraction] Cannot prevent interaction: Map or map element not found.");
      return () => {}; // Return a no-operation cleanup function if map is not ready
    }

    // --- Disable Interactions ---
    // console.log("[useMapInteraction] Disabling map interactions..."); // Debug log
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    if (map.tap) map.tap.disable(); // Disable tap handler if it exists

    // Add CSS class to visually indicate disabled state (e.g., change cursor)
    mapElement.classList.add('map-interactions-disabled');
    setIsBlockingInteraction(true);

    // --- Return Cleanup Function ---
    // This function will be called to re-enable interactions
    return () => {
      // Check if map instance still exists during cleanup (component might unmount)
      if (map) { // Use mapInstanceRef if available, otherwise use the 'map' prop closure
         // console.log("[useMapInteraction] Re-enabling map interactions..."); // Debug log
         map.dragging.enable();
         map.touchZoom.enable();
         map.doubleClickZoom.enable();
         map.scrollWheelZoom.enable();
         map.boxZoom.enable();
         map.keyboard.enable();
         if (map.tap) map.tap.enable();

         // Remove the disabled state CSS class
         if (mapElement) {
           mapElement.classList.remove('map-interactions-disabled');
         }
         setIsBlockingInteraction(false);
      } else {
          // console.log("[useMapInteraction] Map instance gone during cleanup, skipping re-enable."); // Debug log
      }
    };
  }, [map, mapContainerRef]); // Dependencies: map instance and the mapContainerRef


  // --- Returned Values from Hook ---
  return {
    isBlockingInteraction,    // Boolean indicating if map interactions are currently disabled
    preventMapInteraction,    // Function that disables map interactions and returns a cleanup function
  };
};