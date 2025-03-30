import React, { useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import L from 'leaflet';

import { formatDate } from '../../utils/formatting.js';

// Note: CSS classes like .cell-tower-marker, .strong, .medium, .weak, .along-route,
// .tower-popup, .tower-popup-header, .signal-badge, .tower-popup-content
// should be defined in a relevant CSS file (e.g., App.css or MapMarkers.css).


/**
 * TowerMarkers Component
 * 
 * Manages the rendering of cell tower markers on a Leaflet map.
 * It efficiently adds, updates, and removes markers based on the provided tower data,
 * using a memoized key to optimize updates. Includes popups with tower details.
 */
const TowerMarkers = ({ map, towers }) => {
  const layerRef = useRef(null); // Ref to store the Leaflet layer group for tower markers
  const renderedMarkerIds = useRef(new Set()); // Ref to track IDs of currently rendered markers

  // --- Memoization for Efficient Updates ---
  // Create a stable key based on tower IDs/coordinates to trigger effect only when data truly changes
  const towerDataKey = useMemo(() => {
    return towers.map(t => `${t.id || t.lat + ',' + t.lon}`).join('|');
  }, [towers]);


  // --- Marker Rendering Effect ---
  useEffect(() => {
    // console.log(`[TowerMarkers Effect] Running. Received ${towers.length} towers. Key: ${towerDataKey}`); // Debug log
    if (!map) return; // Exit if map instance is not available

    const newLayerGroup = layerRef.current || L.layerGroup(); // Use existing layer group or create a new one
    const currentIds = new Set(); // Set to track IDs of towers in the current 'towers' prop


    // --- Iterate and Add/Update Markers ---
    towers.forEach(tower => {
      // Basic validation for tower coordinates
      if (tower.lat == null || tower.lon == null) {
        console.warn("[TowerMarkers] Skipping tower with invalid coordinates:", tower);
        return; // Skip this tower if coordinates are invalid
      }

      const towerId = `${tower.id || tower.lat + ',' + tower.lon}`; // Create a unique identifier for the tower
      currentIds.add(towerId); // Add ID to the set of current towers

      // --- Add New Marker if Not Already Rendered ---
      if (!renderedMarkerIds.current.has(towerId)) {
        const signalStrength = tower.averageSignal || -120; // Default to weak signal if missing
        let signalClass = 'weak'; // Determine CSS class based on signal strength
        if (signalStrength > -80) signalClass = 'strong';
        else if (signalStrength > -95) signalClass = 'medium';

        // Check if the tower is marked as being along the route
        const isAlongRoute = typeof tower.distanceToRoute === 'number' && tower.distanceToRoute >= 0;

        // Define HTML for the custom marker icon
        const iconHtml = `<div class="cell-tower-marker ${signalClass} ${isAlongRoute ? 'along-route' : ''}"></div>`;

        try {
          // Create a Leaflet DivIcon using the HTML
          const icon = L.divIcon({
            html: iconHtml,
            className: '', // No extra container class needed
            iconSize: [12, 12], // Size of the icon
            iconAnchor: [6, 6], // Anchor point (center)
          });

          // Create the marker
          const marker = L.marker([tower.lat, tower.lon], {
            icon: icon,
            zIndexOffset: 800, // Ensure towers are potentially above route lines but below highlights/popups
          });

          // --- Build Popup Content ---
          let popupContent = '<div class="tower-popup">'; // Start popup container

          // Header section
          popupContent += '<div class="tower-popup-header">';
          popupContent += `<strong>${tower.radio || 'Tower'}</strong>`; // Radio type or default 'Tower'
          if (typeof signalStrength === 'number' && !isNaN(signalStrength)) {
            popupContent += `<span class="signal-badge ${signalClass}">${signalStrength} dBm</span>`; // Signal strength badge
          }
          popupContent += '</div>'; // Close header

          // Content section
          popupContent += '<div class="tower-popup-content">';
          if (tower.mcc != null && tower.net != null) {
            popupContent += `<div><strong>Net:</strong> ${tower.mcc}-${tower.net}</div>`; // Network info
          }
          if (tower.area != null && tower.cell != null) {
            popupContent += `<div><strong>ID:</strong> ${tower.area}-${tower.cell}</div>`; // Cell ID info
          }
          if (tower.range != null && typeof tower.range === 'number') {
            popupContent += `<div><strong>Range:</strong> ~${tower.range}m</div>`; // Estimated range
          }
          if (isAlongRoute) {
            popupContent += `<div><strong>Route Dist:</strong> ${Math.round(tower.distanceToRoute)}m</div>`; // Distance to route
          }
          if (tower.updated != null && typeof tower.updated === 'number' && tower.updated > 0) {
            try {
              const formattedDate = formatDate(new Date(tower.updated * 1000).toISOString()); // Format update time
              popupContent += `<div><strong>Updated:</strong> ${formattedDate}</div>`;
            } catch (e) {
              console.error("Error formatting tower update date:", tower.updated, e); // Log date formatting errors
            }
          }
          popupContent += '</div>'; // Close content

          popupContent += '</div>'; // Close popup container
          // --- End Popup Content ---

          marker.bindPopup(popupContent, { minWidth: 160 }); // Bind the popup to the marker
          marker.customId = towerId; // Store the ID on the marker object for removal logic
          newLayerGroup.addLayer(marker); // Add the marker to the layer group

        } catch (error) {
          console.error("Error creating tower marker or popup:", error, tower); // Log errors during marker creation
        }
      }
    });


    // --- Remove Old Markers ---
    // Iterate through existing markers in the layer group
    if (layerRef.current) {
      layerRef.current.eachLayer(layer => {
        // If a rendered marker's ID is not in the set of current tower IDs, remove it
        if (layer.customId && !currentIds.has(layer.customId)) {
          newLayerGroup.removeLayer(layer); // Remove marker from the group
          // console.log(`[TowerMarkers] Removed marker with ID: ${layer.customId}`); // Debug log
        }
      });
    }


    // --- Update Layer Group on Map ---
    // Add the layer group to the map if it's the first render
    if (!layerRef.current) {
      newLayerGroup.addTo(map);
    }
    layerRef.current = newLayerGroup; // Update the ref to the current layer group
    renderedMarkerIds.current = currentIds; // Update the ref tracking rendered IDs
    // console.log("[TowerMarkers Effect] renderedMarkerIds updated:", renderedMarkerIds.current); // Debug log

  }, [map, towerDataKey]); // Effect dependencies: map instance and the memoized tower data key


  // --- Cleanup on Unmount Effect ---
  useEffect(() => {
    // Return a cleanup function that runs when the component unmounts
    return () => {
      if (map && layerRef.current) {
        // console.log("[TowerMarkers Cleanup Effect] Removing layer group from map on unmount."); // Debug log
        map.removeLayer(layerRef.current); // Remove the entire layer group from the map
        layerRef.current = null; // Clear the layer group ref
        renderedMarkerIds.current.clear(); // Clear the set of rendered marker IDs
      }
    };
  }, [map]); // Dependency: map instance


  // --- Component Rendering ---
  // This component manages map layers directly and does not render any visible DOM elements itself
  return null;
};


// --- Prop Type Definitions ---
TowerMarkers.propTypes = {
  map: PropTypes.object, // Leaflet map instance (required for interaction)
  towers: PropTypes.arrayOf( // Array of tower data objects
    PropTypes.shape({
      lat: PropTypes.number,
      lon: PropTypes.number,
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Optional ID
      radio: PropTypes.string,
      averageSignal: PropTypes.number,
      mcc: PropTypes.number,
      net: PropTypes.number,
      area: PropTypes.number,
      cell: PropTypes.number,
      range: PropTypes.number,
      updated: PropTypes.number,
      distanceToRoute: PropTypes.number, // Optional distance marker
    })
  ).isRequired,
};

export default TowerMarkers;