import { useState, useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
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


  // --- Initialization and Cleanup Effect ---
  useEffect(() => {
    let initializationInProgress = false;
    let didCancel = false;
    
    const attemptInitialization = async () => {
      // Set flag to prevent concurrent initialization attempts
      if (initializationInProgress) return;
      initializationInProgress = true;
      
      try {
        // Check if map already exists
        if (mapInstanceRef.current) {
          // console.log("[useMap] Map already initialized, skipping initialization");
          return;
        }
        
        // Get config (use existing or fetch new)
        let config = mapConfig;
        if (!config) {
          // console.log("[useMap] Fetching map configuration...");
          config = await fetchMapConfig();
          if (didCancel) return;
          
          if (!config) {
            console.error("[useMap] Failed to fetch valid map configuration");
            toast.error("Could not load map configuration. Please refresh the page.");
            return;
          }
        }
        
        // Safety check after async operation
        if (didCancel || mapInstanceRef.current) return;
        
        // Ensure DOM element is ready and clean
        if (!mapContainerRef.current) {
          console.error("[useMap] Map container ref is not available");
          return;
        }
        
        // Clean up any existing Leaflet elements
        if (mapContainerRef.current._leaflet_id) {
          console.warn("[useMap] Container has existing Leaflet ID - cleaning up");
          try {
            // Remove any leaflet classes and reset
            const container = mapContainerRef.current;
            container.innerHTML = '';
            delete container._leaflet_id;
          } catch (e) {
            console.error("[useMap] Error cleaning container:", e);
          }
        }
        
        // Create map instance
        // console.log("[useMap] Creating new Leaflet map instance");
        const { initial_view, tile_layer, controls } = config;
        
        const mapInstance = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView(initial_view.center, initial_view.zoom);
        
        L.tileLayer(tile_layer.url, tile_layer.options).addTo(mapInstance);
        L.control.zoom(controls.zoom).addTo(mapInstance);
        L.control.attribution(controls.attribution).addTo(mapInstance);
        
        // Save reference and update state
        mapInstanceRef.current = mapInstance;
        if (!didCancel) {
          setMapIsReady(true);
          // console.log("[useMap] Map initialization complete and ready");
          
          // Invalidate size after a short delay
          setTimeout(() => {
            if (mapInstanceRef.current && !didCancel) {
              mapInstanceRef.current.invalidateSize();
            }
          }, 100);
        }
      } catch (error) {
        console.error("[useMap] Error initializing map:", error);
        toast.error("Map failed to initialize. Please refresh the page.");
      } finally {
        initializationInProgress = false;
      }
    };
    
    // Begin initialization if conditions are met
    if (mapContainerRef.current && !mapInstanceRef.current && !initializationInProgress) {
      attemptInitialization();
    }
    
    // Cleanup function when component unmounts or deps change
    return () => {
      didCancel = true; // Mark any ongoing async operations as cancelled
      
      // Clean up map instance if it exists
      if (mapInstanceRef.current) {
        try {
          // console.log("[useMap] Cleaning up map instance");
          mapInstanceRef.current.remove();
        } catch (e) {
          console.error("[useMap] Error during map cleanup:", e);
        }
        mapInstanceRef.current = null;
        setMapIsReady(false);
      }
    };
  // Use ref identity for mapContainerRef to avoid recreation on render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [/* Only depend on mapContainerRef.current identity, not re-fetch on auth changes */]);


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