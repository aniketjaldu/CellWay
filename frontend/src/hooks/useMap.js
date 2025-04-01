import { useState, useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-hot-toast';
import { getMapConfig } from '../services/api';

/**
 * useMap Hook
 * 
 * Custom React hook to manage a Leaflet map instance, including initialization,
 * marker management, layer display (routes, towers, highlights), and view adjustments.
 * Uses refs to manage the map instance and layers to avoid issues with React StrictMode.
 */
export const useMap = (mapContainerRef) => {
  // --- Refs for Map and Layers ---
  const mapInstanceRef = useRef(null);      // Ref to store the Leaflet map instance
  const originMarkerRef = useRef(null);     // Ref for the origin marker layer
  const destinationMarkerRef = useRef(null); // Ref for the destination marker layer
  const routeLayerRef = useRef(null);       // Ref for the route polyline layer
  const towerLayerRef = useRef(null);       // Ref for the cell tower layer group
  const highlightLayerRef = useRef(null);   // Ref for the route segment highlight layer group

  // --- State ---
  const [mapIsReady, setMapIsReady] = useState(false); // State to signal when the map is initialized and ready
  const [mapConfig, setMapConfig] = useState(null); // State to store the map configuration from backend


  // --- Fetch Map Configuration from Backend ---
  const fetchMapConfig = useCallback(async () => {
    try {
      // Fetch map configuration from backend using the API service
      const config = await getMapConfig();
      
      if (config && config.maptiler_key) {
        setMapConfig(config);
        return config;
      } else {
        throw new Error('Invalid map configuration received from server');
      }
    } catch (error) {
      console.error('[useMap] Error fetching map configuration:', error);
      toast.error('Could not load map configuration from server', { id: 'map-config-error' });
      return null;
    }
  }, []);


  // --- Map Initialization Function ---
  // This function creates the Leaflet map instance and adds base layers/controls.
  // It's called by the useEffect hook below.
  const initializeMap = useCallback(async () => {
    // console.log("[useMap] Attempting map initialization..."); // Debug log

    // --- Guard Clauses: Prevent Re-initialization or Initialization Errors ---
    if (mapInstanceRef.current) {
      // console.log("[useMap] Map init skipped: Instance already exists in ref."); // Debug log
      return; // Exit if map instance already exists
    }
    
    // Ensure we have a configuration before proceeding
    const config = mapConfig || await fetchMapConfig();
    
    if (!mapContainerRef.current || !L || !config) {
      console.error("[useMap] Map init failed: Map container ref, Leaflet library, or map configuration is missing.");
      toast.error("Map initialization failed: Missing dependencies.", { id: 'map-init-deps-error' });
      return; // Exit if essential elements are missing
    }
    
    // Extra check to see if Leaflet might have already attached itself to the container
    if (mapContainerRef.current._leaflet_id) {
      console.warn("[useMap] Map init skipped: Container element already has a Leaflet ID (_leaflet_id). This might indicate a double initialization attempt.");
      return; // Exit to prevent potential issues
    }

    // --- Create Map Instance ---
    // console.log("[useMap] Proceeding with L.map() initialization..."); // Debug log
    try {
      const { initial_view, tile_layer, controls } = config;
      
      const mapInstance = L.map(mapContainerRef.current, {
        zoomControl: false, // Disable default zoom control (added manually below)
        attributionControl: false, // Disable default attribution (added manually below)
      }).setView(initial_view.center, initial_view.zoom); // Set initial view from config

      // console.log("[useMap] L.map() successful."); // Debug log

      // --- Add Tile Layer ---
      L.tileLayer(
        tile_layer.url, // Tile layer URL from config
        tile_layer.options // Tile layer options from config
      ).addTo(mapInstance);
      // console.log("[useMap] Tile layer added."); // Debug log

      // --- Add Map Controls ---
      L.control.zoom(controls.zoom).addTo(mapInstance); // Add zoom control with config
      L.control.attribution(controls.attribution).addTo(mapInstance); // Add attribution control with config
      // console.log("[useMap] Controls added."); // Debug log

      // --- Store Instance and Set Ready State ---
      mapInstanceRef.current = mapInstance; // Store the initialized map instance in the ref
      setMapIsReady(true); // Signal that the map is ready
      // console.log("[useMap] Map instance stored in ref and map marked as ready."); // Debug log

      // --- Invalidate Size ---
      // Sometimes needed after initial render or container size changes to ensure map tiles load correctly
      setTimeout(() => {
        if (mapInstanceRef.current) { // Check ref still exists (component might unmount quickly)
          // console.log("[useMap] Invalidating map size..."); // Debug log
          mapInstanceRef.current.invalidateSize(); // Trigger map size recalculation
          // console.log("[useMap] Map size invalidated."); // Debug log
        }
      }, 100); // Short delay allows container to settle

    } catch (error) {
      console.error("ERROR during Leaflet map initialization:", error);
      toast.error("Map failed to initialize. Please check the console for errors.", { id: 'map-init-error' });
      mapInstanceRef.current = null; // Clear the ref on error
      setMapIsReady(false); // Mark map as not ready
    }
  }, [mapContainerRef, mapConfig, fetchMapConfig]); // Dependencies include mapConfig and fetchMapConfig now


  // --- Initialization and Cleanup Effect ---
  useEffect(() => {
    // Fetch configuration then initialize map
    if (mapContainerRef.current && !mapInstanceRef.current) {
      // If we don't have the config yet, fetch it first
      if (!mapConfig) {
        fetchMapConfig().then(() => {
          // Map will be initialized once mapConfig state is updated
        });
      } else {
        // We already have the config, initialize the map
        initializeMap();
      }
    }

    // --- Cleanup Function ---
    // This function runs when the component unmounts or dependencies change
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove(); // Properly remove the Leaflet map instance
        } catch (e) {
          console.error("[useMap useEffect cleanup] Error removing map instance:", e);
        }
        mapInstanceRef.current = null; // Clear the ref
        setMapIsReady(false); // Reset ready state
      }
    };
  }, [mapContainerRef, initializeMap, mapConfig, fetchMapConfig]); // Dependencies include mapConfig and fetchMapConfig


  // --- Marker Management ---
  const updateMarker = useCallback((latlng, isOrigin) => {
    const map = mapInstanceRef.current; // Get map instance from ref
    if (!map) return null; // Exit if map is not ready

    const markerRef = isOrigin ? originMarkerRef : destinationMarkerRef; // Select the correct marker ref
    const iconHtml = `<div class="${isOrigin ? 'origin-marker' : 'destination-marker'}"></div>`; // CSS class defines marker appearance
    const title = isOrigin ? "Route Origin" : "Route Destination";

    // --- Remove Marker if latlng is null/undefined ---
    if (!latlng) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current); // Remove existing marker from map
        markerRef.current = null; // Clear the ref
      }
      return null;
    }

    // --- Update Existing Marker ---
    if (markerRef.current) {
      markerRef.current.setLatLng(latlng); // Update position of existing marker
      return markerRef.current;
    }
    // --- Create New Marker ---
    else {
      try {
        const icon = L.divIcon({
          html: iconHtml,
          className: '', // No extra container class needed
          iconSize: [24, 24], // Size of the marker icon
          iconAnchor: [12, 12], // Anchor point (center)
        });
        const newMarker = L.marker(latlng, {
          icon: icon,
          title: title,
          zIndexOffset: 1000, // Ensure markers are above route lines
        }).addTo(map);
        markerRef.current = newMarker; // Store new marker in the ref
        return newMarker;
      } catch (error) {
        console.error("Failed to create marker:", error);
        return null;
      }
    }
  }, []); // No dependencies needed as it uses refs


  // --- Layer Management ---

  // Display Route Polyline
  const displayRouteLine = useCallback((latLngs, options = {}) => {
    const map = mapInstanceRef.current;
    if (!map || !Array.isArray(latLngs) || latLngs.length < 2) return null; // Validate input

    // Clear previous route line if it exists
    if (routeLayerRef.current) {
      try { map.removeLayer(routeLayerRef.current); } catch (e) { /* Ignore removal error */ }
      routeLayerRef.current = null;
    }

    try {
      // Create and add new polyline
      const routeLine = L.polyline(latLngs, {
        className: options.className || 'route-line', // Use CSS class or defaults
        color: options.color || '#4285F4',
        weight: options.weight || 5,
        opacity: options.opacity || 0.85,
        smoothFactor: 1,
        ...(options.dashArray && { dashArray: options.dashArray }), // Conditionally add dashArray
      }).addTo(map);
      routeLayerRef.current = routeLine; // Store ref to the new layer
      return routeLine;
    } catch (error) {
      console.error("Error displaying route line:", error);
      return null;
    }
  }, []);

  // Clear Route Polyline
  const clearRouteLine = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map && routeLayerRef.current) {
      try { map.removeLayer(routeLayerRef.current); } catch (e) { /* Ignore removal error */ }
      routeLayerRef.current = null; // Clear the ref
    }
  }, []);

  // Display Generic Layer Group (Towers, Highlight)
  const displayLayerGroup = useCallback((layerGroup, layerType) => {
    const map = mapInstanceRef.current;
    if (!map || !layerGroup) return; // Validate input

    let layerRef; // Select the appropriate ref based on layerType
    if (layerType === 'towers') layerRef = towerLayerRef;
    else if (layerType === 'highlight') layerRef = highlightLayerRef;
    else {
      console.warn(`[useMap] Unknown layerType provided to displayLayerGroup: ${layerType}`);
      return;
    }

    // Clear previous layer of the same type if it exists
    if (layerRef.current) {
      try { map.removeLayer(layerRef.current); } catch (e) { /* Ignore removal error */ }
    }

    layerGroup.addTo(map); // Add the new layer group to the map
    layerRef.current = layerGroup; // Store ref to the new layer group
  }, []);

  // Clear Generic Layer Group (Towers, Highlight)
  const clearLayerGroup = useCallback((layerType) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let layerRef; // Select the appropriate ref based on layerType
    if (layerType === 'towers') layerRef = towerLayerRef;
    else if (layerType === 'highlight') layerRef = highlightLayerRef;
    else {
      console.warn(`[useMap] Unknown layerType provided to clearLayerGroup: ${layerType}`);
      return;
    }

    // Remove the layer if it exists
    if (layerRef.current) {
      try { map.removeLayer(layerRef.current); } catch (e) { /* Ignore removal error */ }
      layerRef.current = null; // Clear the ref
    }
  }, []);


  // --- View Management ---

  // Animate map view to a specific point and zoom level
  const flyTo = useCallback((latlng, zoom) => {
    const map = mapInstanceRef.current;
    if (map && latlng) {
      map.flyTo(latlng, zoom || map.getZoom()); // Use provided zoom or current zoom
    }
  }, []);

  // Adjust map view to fit geographical bounds
  const fitBounds = useCallback((bounds, options = {}) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      // Handle different bounds formats (Leaflet LatLngBounds object or array of coordinates)
      const latLngBounds = (bounds?.isValid) ? bounds : L.latLngBounds(bounds);
      if (latLngBounds.isValid()) {
        map.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 16, ...options }); // Fit bounds with padding
      } else {
        console.warn("[useMap] Invalid bounds provided to fitBounds:", bounds);
      }
    } catch (e) {
      console.error("Error fitting bounds:", e, bounds);
    }
  }, []);


  // --- Returned Values from Hook ---
  return {
    map: mapInstanceRef.current, // Provide the current map instance (can be null initially)
    mapIsReady,                  // Boolean indicating if the map is initialized
    // Marker functions
    updateMarker,
    // Route line functions
    displayRouteLine,
    clearRouteLine,
    // Generic layer group functions (for towers, highlights)
    displayLayerGroup,
    clearLayerGroup,
    // View functions
    flyTo,
    fitBounds,
  };
};