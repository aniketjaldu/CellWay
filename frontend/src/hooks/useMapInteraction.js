import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import L from 'leaflet'; // Needed for LatLng type if using TS

// Get API Key from environment variables
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

export const useMapInteraction = (map, onLocationFound) => {
  const [isLocating, setIsLocating] = useState(false);

  // --- Geolocation ---
  const locateUser = useCallback(() => {
    if (!map) {
        toast.error("Map is not ready yet.", { id: 'locate-no-map' });
        return;
    }
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser.', { id: 'locate-unsupported' });
      return;
    }

    setIsLocating(true);
    const locateToastId = toast.loading("Getting your location...", { id: 'locate-start' });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const latlng = L.latLng(latitude, longitude);
        let placeName = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`; // Default

        try {
          // Reverse geocode using MapTiler
          if (MAPTILER_KEY) {
            const response = await fetch(
              `https://api.maptiler.com/geocoding/${longitude},${latitude}.json?key=${MAPTILER_KEY}`
            );
            if (response.ok) {
              const data = await response.json();
              if (data?.features?.[0]?.place_name) {
                placeName = data.features[0].place_name;
              }
            } else { console.warn(`Reverse geocoding failed: ${response.statusText}`); }
          }
        } catch (error) { console.error('Reverse geocoding error:', error); }
        finally {
          toast.success('Location found!', { id: locateToastId });
          setIsLocating(false);
          // Call the callback provided by the parent component
          // with the location details
          onLocationFound?.({ lat: latitude, lng: longitude, name: placeName, latlng: latlng });
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error(`Could not get location: ${error.message}`, { id: locateToastId });
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Options
    );
  }, [map, onLocationFound]); // Dependencies

  // --- Map Interaction Control ---
  const preventMapInteraction = useCallback(() => {
    const mapElement = document.getElementById('map'); // Assuming map container has id="map"
    if (!map || !mapElement) return () => {}; // Return no-op cleanup if no map

    // Disable map interactions
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    if (map.tap) map.tap.disable();

    // Add a class to indicate the map is disabled (for cursor styling etc.)
    mapElement.classList.add('map-interactions-disabled');
    // console.log("Map interactions DISABLED");

    // Return cleanup function to re-enable interactions
    return () => {
      if (map) { // Check map still exists on cleanup
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        if (map.tap) map.tap.enable();
        mapElement.classList.remove('map-interactions-disabled');
        // console.log("Map interactions ENABLED");
      }
    };
  }, [map]); // Dependency: map instance

  // --- Return ---
  return {
    isLocating,
    locateUser,
    preventMapInteraction, // Returns a cleanup function
  };
};