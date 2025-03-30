// frontend/src/hooks/useMap.js
import { useState, useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-hot-toast';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

export const useMap = (mapContainerRef, setOriginValue, setDestinationValue) => { // <-- ADD setOriginValue, setDestinationValue AS PROPS
  // Use a ref to hold the map instance to prevent issues with state updates
  // during StrictMode double invocation. The state `mapIsReady` can signal readiness.
  const mapInstanceRef = useRef(null);
  const [mapIsReady, setMapIsReady] = useState(false); // Signal when map is truly ready

  // ... other state/refs for markers/layers ...
  const originMarker = useRef(null);
  const destinationMarker = useRef(null);
  const routeLayerRef = useRef(null);
  const towerLayerRef = useRef(null);
  const highlightLayerRef = useRef(null);


  // --- Initialization ---
  // No longer useCallback needed here as it runs directly in useEffect
  const initializeMap = () => {
    // console.log("Attempting map initialization...");
    // Check if map is already initialized via the ref
    if (mapInstanceRef.current) {
        // console.log("Map init skipped: Instance already exists in ref.");
        return;
    }
    // Check container ref and key
    if (!mapContainerRef.current || !L || !MAPTILER_KEY) {
      // console.log("Map init skipped: Container ref or Leaflet/Key missing.");
      // Log details
      // console.log({ hasRef: !!mapContainerRef.current, L: !!L, key: !!MAPTILER_KEY });
      return;
    }

    // Check if the container already has a Leaflet instance attached (belt-and-suspenders)
    if (mapContainerRef.current._leaflet_id) {
        console.warn("Map init skipped: Container element already has _leaflet_id.");
        // Attempt to find the existing instance (though mapInstanceRef.current should ideally hold it)
        // mapInstanceRef.current = mapContainerRef.current._leaflet_map; // Example, might not work reliably
        // setMapIsReady(!!mapInstanceRef.current);
        return;
    }


    // console.log("Proceeding with L.map()...");
    try {
      const mapInstance = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([42.336687, -71.095762], 13);

      // console.log("L.map() successful, adding tile layer...");

      L.tileLayer(
         `https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
         { tileSize: 512, zoomOffset: -1, minZoom: 3, crossOrigin: true }
      ).addTo(mapInstance);

      // console.log("Tile layer added, adding controls...");

      L.control.zoom({ position: 'topleft' }).addTo(mapInstance);
      L.control.attribution({ position: 'bottomright', prefix: '<a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a>' }).addTo(mapInstance);

      // console.log("Controls added, setting map instance ref...");
      mapInstanceRef.current = mapInstance; // Store instance in ref
      setMapIsReady(true); // Set readiness state
      // console.log("Map instance ref set and map marked as ready.");

      // Invalidate size after a short delay
      setTimeout(() => {
          if (mapInstanceRef.current) { // Check ref still exists
            // console.log("Invalidating map size...");
            mapInstanceRef.current.invalidateSize();
            // console.log("Map size invalidated.");
          }
      }, 100);

    } catch (error) {
      console.error("ERROR during Leaflet map initialization:", error);
      toast.error("Map failed to initialize. Check console.", { id: 'map-init-error' });
      mapInstanceRef.current = null; // Clear ref on error
      setMapIsReady(false); // Mark as not ready
    }
  };

  // Effect for initialization and cleanup
  useEffect(() => {
    // Only initialize if the ref is set and map isn't already created
    if (mapContainerRef.current && !mapInstanceRef.current) {
        // console.log("useMap useEffect: Initializing map.");
        initializeMap();
    }

    // Cleanup function: This runs on unmount AND before re-running the effect in StrictMode
    return () => {
      // console.log("useMap useEffect cleanup running...");
      if (mapInstanceRef.current) {
        // console.log("Removing Leaflet map instance on cleanup.");
        try {
            mapInstanceRef.current.remove(); // Call Leaflet's remove method
        } catch(e) {
            console.error("Error removing map during cleanup:", e);
        }
        mapInstanceRef.current = null; // Clear the ref
        setMapIsReady(false); // Mark as not ready
      } else {
          // console.log("Cleanup: No map instance found in ref to remove.");
      }
    };
  }, [mapContainerRef]); // Run only when the container ref changes (should be stable)


  // --- Marker Management (Now uses mapInstanceRef.current) ---
  const updateMarker = useCallback((latlng, isOrigin) => {
    const map = mapInstanceRef.current; // Get map from ref
    if (!map) return null;

    const markerRef = isOrigin ? originMarker : destinationMarker; // Use refs for markers too
    const iconHtml = `<div class="${isOrigin ? 'origin-marker' : 'destination-marker'}"></div>`;
    const title = isOrigin ? "Origin" : "Destination";

    if (!latlng) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return null;
    }

    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
      return markerRef.current;
    } else {
      try {
        const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
        const newMarker = L.marker(latlng, { icon: icon, title: title, zIndexOffset: 1000 }).addTo(map);
        markerRef.current = newMarker; // Store in ref
        return newMarker;
      } catch (error) { console.error("Failed to create marker:", error); return null; }
    }
  }, []); // No dependency on map state

  // --- Layer Management (Uses mapInstanceRef.current) ---
  const displayRouteLine = useCallback((latLngs, options = {}) => {
    const map = mapInstanceRef.current;
    if (!map || !Array.isArray(latLngs) || latLngs.length < 2) return;
    if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
    try {
      const routeLine = L.polyline(latLngs, {
        color: options.color || '#4285F4', // Default blue
        weight: options.weight || 5,
        opacity: options.opacity || 0.85,
        smoothFactor: 1,
        ...(options.dashArray && { dashArray: options.dashArray })
      }).addTo(map);
      routeLayerRef.current = routeLine;
      return routeLine;
    } catch (error) { console.error("Error displaying route line:", error); return null; }
  }, []);

  const clearRouteLine = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map && routeLayerRef.current) {
      try { map.removeLayer(routeLayerRef.current); } catch (e) { /* Ignore */ }
      routeLayerRef.current = null;
    }
  }, []);

  const displayLayerGroup = useCallback((layerGroup, layerType) => {
    const map = mapInstanceRef.current;
    if (!map || !layerGroup) return;
    let layerRef;
    if (layerType === 'towers') layerRef = towerLayerRef;
    else if (layerType === 'highlight') layerRef = highlightLayerRef;
    else return;
    if (layerRef.current) { try { map.removeLayer(layerRef.current); } catch(e) {} }
    layerGroup.addTo(map);
    layerRef.current = layerGroup;
  }, []);

  const clearLayerGroup = useCallback((layerType) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    let layerRef;
    if (layerType === 'towers') layerRef = towerLayerRef;
    else if (layerType === 'highlight') layerRef = highlightLayerRef;
    else return;
    if (layerRef.current) { try { map.removeLayer(layerRef.current); } catch (e) {} }
    layerRef.current = null;
  }, []);

  // --- View Management (Uses mapInstanceRef.current) ---
  const flyTo = useCallback((latlng, zoom) => {
    const map = mapInstanceRef.current;
    if (map && latlng) { map.flyTo(latlng, zoom || map.getZoom()); }
  }, []);

  const fitBounds = useCallback((bounds, options = {}) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    // ... (logic to handle bounds array or LatLngBounds object) ...
     try {
        const latLngBounds = (bounds?.isValid) ? bounds : L.latLngBounds(bounds);
        if (latLngBounds.isValid()) {
            map.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 16, ...options });
        }
     } catch (e) { console.error("Error fitting bounds:", e); }
  }, []);


  // --- Return ---
  // Return the ref's current value and the readiness state
  // Other functions now close over the ref and don't need map state as dependency
  return {
    map: mapInstanceRef.current, // Provide the current instance
    mapIsReady, // Signal readiness
    // initializeMap, // No longer need to expose this
    updateMarker,
    displayRouteLine,
    clearRouteLine,
    displayLayerGroup,
    clearLayerGroup,
    flyTo,
    fitBounds,
    setOriginValue,       // <-- RETURN THE SETTER FUNCTIONS
    setDestinationValue,  // <-- RETURN THE SETTER FUNCTIONS
  };
};