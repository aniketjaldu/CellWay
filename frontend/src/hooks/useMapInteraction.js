import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import L from 'leaflet'; // Needed for L.latLng

// --- Environment Variable ---
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY; // API Key for MapTiler reverse geocoding


/**
 * useMapInteraction Hook
 * 
 * Provides functions for interacting with the map, specifically:
 * - Locating the user's current position using the browser's Geolocation API.
 * - Temporarily disabling map interactions (zoom, drag, etc.).
 */
export const useMapInteraction = (map, onLocationFound) => {
  // --- State ---
  const [isLocating, setIsLocating] = useState(false); // Tracks if geolocation is in progress


  // --- Geolocation Function ---
  // Attempts to get the user's current location and performs reverse geocoding.
  const locateUser = useCallback(() => {
    // --- Guard Clauses ---
    if (!map) {
      toast.error("Map is not ready yet.", { id: 'locate-no-map' });
      return; // Exit if map instance is not available
    }
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser.', { id: 'locate-unsupported' });
      return; // Exit if browser doesn't support geolocation
    }

    // --- Start Locating Process ---
    setIsLocating(true); // Set loading state
    const locateToastId = toast.loading("Getting your location...", { id: 'locate-start' }); // Show loading notification

    navigator.geolocation.getCurrentPosition(
      // --- Success Callback ---
      async (position) => {
        const { latitude, longitude } = position.coords; // Extract coordinates
        const latlng = L.latLng(latitude, longitude); // Create Leaflet LatLng object
        let placeName = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`; // Default place name is coordinates

        // --- Reverse Geocoding (Optional) ---
        try {
          if (MAPTILER_KEY) { // Only attempt if API key is available
            const response = await fetch(
              `https://api.maptiler.com/geocoding/${longitude},${latitude}.json?key=${MAPTILER_KEY}` // MapTiler reverse geocoding URL
            );
            if (response.ok) {
              const data = await response.json();
              // Use the first feature's place name if available
              if (data?.features?.[0]?.place_name) {
                placeName = data.features[0].place_name;
              }
            } else {
              console.warn(`Reverse geocoding failed: ${response.status} ${response.statusText}`); // Log warning on failure
            }
          } else {
            console.warn("MapTiler key not available, skipping reverse geocoding for user location.");
          }
        } catch (error) {
          console.error('Reverse geocoding error:', error); // Log reverse geocoding errors
        } finally {
          // --- Finalize Locating Process ---
          toast.success('Location found!', { id: locateToastId }); // Update notification to success
          setIsLocating(false); // Clear loading state
          // Call the parent component's callback with the location details
          onLocationFound?.({ lat: latitude, lng: longitude, name: placeName, latlng: latlng });
        }
      },
      // --- Error Callback ---
      (error) => {
        console.error('Geolocation error:', error); // Log geolocation error
        // Show specific error message based on error code
        let errorMsg = `Could not get location: ${error.message}`;
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Location permission denied. Please enable location services for this site.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "Location information is unavailable.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "Getting location timed out. Please try again.";
        }
        toast.error(errorMsg, { id: locateToastId }); // Update notification with error message
        setIsLocating(false); // Clear loading state
      },
      // --- Geolocation Options ---
      {
        enableHighAccuracy: true, // Request high accuracy
        timeout: 10000,           // Set timeout to 10 seconds
        maximumAge: 0,            // Do not use cached position
      }
    );
  }, [map, onLocationFound]); // Dependencies: map instance and the callback function


  // --- Prevent Map Interaction Function ---
  // Disables various map interaction handlers (drag, zoom, etc.) and returns a cleanup function to re-enable them.
  const preventMapInteraction = useCallback(() => {
    const mapElement = document.getElementById('map'); // Get map container element (assuming id="map")
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
         mapElement.classList.remove('map-interactions-disabled');
      } else {
          // console.log("[useMapInteraction] Map instance gone during cleanup, skipping re-enable."); // Debug log
      }
    };
  }, [map]); // Dependency: map instance


  // --- Returned Values from Hook ---
  return {
    isLocating,             // Boolean indicating if geolocation is in progress
    locateUser,             // Function to initiate user location finding
    preventMapInteraction,  // Function that disables map interactions and returns a cleanup function
  };
};