import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import L from 'leaflet';

import { getDirectionIcon } from '../../utils/formatting';

/**
 * RouteHighlight Component
 * 
 * This component is responsible for highlighting a specific route instruction (step)
 * on the Leaflet map. It draws the segment's geometry and adds a marker at the
 * maneuver point, then fits the map view to the highlighted elements.
 * It automatically cleans up the previous highlight when the instruction changes or the component unmounts.
 */
const RouteHighlight = ({ map, instruction, type }) => {
  const highlightLayerRef = useRef(null); // Ref to store the Leaflet layer group for the highlight


  // --- Highlight Effect ---
  useEffect(() => {

    // --- Cleanup Previous Highlight ---
    // Always remove the previous highlight layer before adding a new one
    if (highlightLayerRef.current) {
      map.removeLayer(highlightLayerRef.current);
      highlightLayerRef.current = null; // Clear the ref
    }

    // --- Guard Clauses ---
    // Exit if map instance or instruction data is missing
    if (!map || !instruction) {
      return; // Nothing to highlight
    }


    try {
      const highlightGroup = L.layerGroup(); // Create a layer group to hold highlight elements
      let boundsToFit = null; // Initialize bounds for fitting the map view


      // --- Highlight Segment Geometry ---
      if (instruction.segmentCoordinates && instruction.segmentCoordinates.length > 1) {
        // Convert [lng, lat] coordinates to Leaflet LatLng objects
        const latLngs = instruction.segmentCoordinates.map(coord => L.latLng(coord[1], coord[0]));
        // Create a polyline for the segment
        const segmentLine = L.polyline(latLngs, {
          className: 'highlighted-segment', // Use CSS class for styling
        });
        highlightGroup.addLayer(segmentLine); // Add the line to the group
        boundsToFit = segmentLine.getBounds(); // Get bounds of the segment line
      }


      // --- Add Marker at Maneuver Point ---
      if (instruction.coordinates) {
        let lat, lng;
        // Handle different potential coordinate formats
        if (Array.isArray(instruction.coordinates)) {
          [lng, lat] = instruction.coordinates;
        } else if (instruction.coordinates.lat !== undefined) {
          lat = instruction.coordinates.lat;
          lng = instruction.coordinates.lng;
        }

        if (lat !== undefined && lng !== undefined) {
          const pointLatLng = L.latLng(lat, lng); // Create LatLng for the marker

          // Create a DivIcon for the step marker using HTML
          const iconHtml = `<div class="step-marker-icon">${getDirectionIcon(type) || '•'}</div>`;
          const stepIcon = L.divIcon({
            html: iconHtml,
            className: 'step-marker-container', // CSS class for the container
            iconSize: [24, 24],                // Size of the icon
            iconAnchor: [12, 12],              // Anchor point (center)
          });

          // Create a hollow circle marker
          const hollowCircle = L.circleMarker(pointLatLng, {
            className: 'hollow-step-marker', // Use CSS class for styling
          });

          // Create the icon marker itself
          const iconMarker = L.marker(pointLatLng, {
            icon: stepIcon,
            interactive: false, // Marker should not be interactive
          });

          highlightGroup.addLayer(hollowCircle); // Add circle to the group
          highlightGroup.addLayer(iconMarker);   // Add icon marker to the group

          // Extend bounds to include the marker
          if (!boundsToFit) {
            boundsToFit = L.latLngBounds(pointLatLng, pointLatLng); // Create bounds if only marker exists
          } else {
            boundsToFit.extend(pointLatLng); // Extend existing bounds
          }
        }
      }


      // --- Add Highlight to Map and Fit Bounds ---
      if (highlightGroup.getLayers().length > 0) { // Only add if there's something to show
        highlightGroup.addTo(map); // Add the layer group to the map
        highlightLayerRef.current = highlightGroup; // Store the reference to the added layer group

        // Fit map view to the highlighted elements if bounds are valid
        if (boundsToFit?.isValid()) {
          map.flyToBounds(boundsToFit, { padding: [80, 80], maxZoom: 17 }); // Animate map view
        }
      }

    } catch (error) {
      console.error("Error highlighting route segment:", error);
      // --- Error Handling Cleanup ---
      // Ensure cleanup happens even if an error occurs during highlight creation
      if (highlightLayerRef.current) {
        map.removeLayer(highlightLayerRef.current);
        highlightLayerRef.current = null;
      }
    }


    // --- Effect Cleanup Function ---
    // This function runs when the component unmounts or dependencies change
    return () => {
      if (highlightLayerRef.current) {
        map.removeLayer(highlightLayerRef.current); // Remove the highlight layer from the map
        highlightLayerRef.current = null; // Clear the reference
      }
    };

  }, [map, instruction, type]); // Dependencies: Rerun effect if map, instruction, or type changes


  // --- Component Rendering ---
  // This component manages map layers directly and does not render any visible DOM elements itself
  return null;
};


// --- Prop Type Definitions ---
RouteHighlight.propTypes = {
  map: PropTypes.object, // Leaflet map instance (required for interaction)
  instruction: PropTypes.object, // The specific direction step object to highlight
  type: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Maneuver type for icon lookup
};

export default RouteHighlight;