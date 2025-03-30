import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import L from 'leaflet';
import { getDirectionIcon } from '../../utils/formatting';

// Note: Highlight styles (.highlighted-segment, .step-marker-icon etc.) should remain in App.css
// or be moved to a shared MapMarkers.css file.

const RouteHighlight = ({ map, instruction, type, clearHighlight }) => {
  const highlightLayerRef = useRef(null);

  useEffect(() => {
    // Always clear previous highlight first
    if (highlightLayerRef.current) {
        map.removeLayer(highlightLayerRef.current);
        highlightLayerRef.current = null;
    }

    if (!map || !instruction) return; // No map or instruction to highlight

    try {
      const group = L.layerGroup();
      let boundsToFit = null;

      // Highlight the segment geometry
      if (instruction.segmentCoordinates && instruction.segmentCoordinates.length > 1) {
        const latLngs = instruction.segmentCoordinates.map(coord => L.latLng(coord[1], coord[0]));
        const segmentLine = L.polyline(latLngs, {
          className: 'highlighted-segment', // Use CSS class for styling
          // color: '#ff3300', weight: 7, opacity: 0.9, dashArray: '5, 5' // Fallback styles
        });
        group.addLayer(segmentLine);
        boundsToFit = segmentLine.getBounds();
      }

      // Add a marker at the start coordinate of the maneuver
      if (instruction.coordinates) {
        let lat, lng;
        if (Array.isArray(instruction.coordinates)) [lng, lat] = instruction.coordinates;
        else if (instruction.coordinates.lat !== undefined) { lat = instruction.coordinates.lat; lng = instruction.coordinates.lng; }

        if (lat !== undefined && lng !== undefined) {
          const pointLatLng = L.latLng(lat, lng);
          const iconHtml = `<div class="step-marker-icon">${getDirectionIcon(type) || '•'}</div>`;
          const icon = L.divIcon({
            html: iconHtml, className: 'step-marker-container',
            iconSize: [24, 24], iconAnchor: [12, 12]
          });
          const hollowCircle = L.circleMarker(pointLatLng, {
            className: 'hollow-step-marker', // Use CSS class
            // radius: 10, color: '#ff3300', weight: 2, opacity: 0.9, fill: false // Fallback styles
          });
          const iconMarker = L.marker(pointLatLng, { icon, interactive: false });

          group.addLayer(hollowCircle);
          group.addLayer(iconMarker);

          if (!boundsToFit) boundsToFit = L.latLngBounds(pointLatLng, pointLatLng);
          else boundsToFit.extend(pointLatLng);
        }
      }

      if (group.getLayers().length > 0) {
        group.addTo(map);
        highlightLayerRef.current = group; // Store ref

        if (boundsToFit?.isValid()) {
          map.flyToBounds(boundsToFit, { padding: [80, 80], maxZoom: 17 });
        }
      }

    } catch (error) {
      console.error("Error highlighting route segment:", error);
      // Ensure cleanup happens on error
      if (highlightLayerRef.current) {
          map.removeLayer(highlightLayerRef.current);
          highlightLayerRef.current = null;
      }
    }

    // Cleanup function for when instruction changes or component unmounts
    return () => {
      if (highlightLayerRef.current) {
        map.removeLayer(highlightLayerRef.current);
        highlightLayerRef.current = null;
      }
    };

  }, [map, instruction, type]); // Rerun when instruction changes

  return null; // Component renders layers directly on the map
};

RouteHighlight.propTypes = {
  map: PropTypes.object, // Leaflet map instance
  instruction: PropTypes.object, // The specific direction step object
  type: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Maneuver type
  clearHighlight: PropTypes.func, // Function from useMap to clear layer group 'highlight' (optional, handled internally now)
};

export default RouteHighlight;