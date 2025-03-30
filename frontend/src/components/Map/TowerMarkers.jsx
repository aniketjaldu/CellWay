import React, { useEffect, useRef, useMemo } from 'react'; // Import useMemo
import PropTypes from 'prop-types';
import L from 'leaflet';
import { formatDate } from '../../utils/formatting.js';

const TowerMarkers = ({ map, towers }) => {
  const layerRef = useRef(null);
  const renderedMarkerIds = useRef(new Set());

  // Memoize based on tower IDs/coords
  const towerDataKey = useMemo(() => {
      return towers.map(t => `${t.id || t.lat + ',' + t.lon}`).join('|');
  }, [towers]);

  useEffect(() => {
    // console.log(`[TowerMarkers Effect] Running. Received ${towers.length} towers.`);
    if (!map) return;

    const newLayerGroup = layerRef.current || L.layerGroup();
    const currentIds = new Set();

    towers.forEach(tower => {
      // Basic validation
      if (tower.lat == null || tower.lon == null) {
          console.warn("[TowerMarkers] Skipping tower with invalid coords:", tower);
          return;
      }

      const towerId = `${tower.id || tower.lat + ',' + tower.lon}`;
      currentIds.add(towerId);

      // Only add if not already rendered
      if (!renderedMarkerIds.current.has(towerId)) {
        const signalStrength = tower.averageSignal || -120; // Default weak
        let signalClass = 'weak';
        if (signalStrength > -80) signalClass = 'strong';
        else if (signalStrength > -95) signalClass = 'medium';

        // Check if distanceToRoute is valid number >= 0
        const isAlongRoute = typeof tower.distanceToRoute === 'number' && tower.distanceToRoute >= 0;
        const iconHtml = `<div class="cell-tower-marker ${signalClass} ${isAlongRoute ? 'along-route' : ''}"></div>`;

        try {
          const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [12, 12], iconAnchor: [6, 6] });
          const marker = L.marker([tower.lat, tower.lon], { icon: icon, zIndexOffset: 800 });

          // --- Debug Popup Content Generation ---
          let popupContent = '<div class="tower-popup">'; // Start popup div

          // Header
          popupContent += '<div class="tower-popup-header">';
          popupContent += `<strong>${tower.radio || 'Tower'}</strong>`;
          // Ensure signalStrength is a number before adding badge
          if (typeof signalStrength === 'number' && !isNaN(signalStrength)) {
              popupContent += `<span class="signal-badge ${signalClass}">${signalStrength} dBm</span>`;
          }
          popupContent += '</div>'; // Close header

          // Content
          popupContent += '<div class="tower-popup-content">';
          // Check each piece of data before adding
          if (tower.mcc != null && tower.net != null) { // Check for null/undefined
              popupContent += `<div><strong>Net:</strong> ${tower.mcc}-${tower.net}</div>`;
          }
          if (tower.area != null && tower.cell != null) {
              popupContent += `<div><strong>ID:</strong> ${tower.area}-${tower.cell}</div>`;
          }
          if (tower.range != null && typeof tower.range === 'number') {
              popupContent += `<div><strong>Range:</strong> ~${tower.range}m</div>`;
          }
          // Check isAlongRoute flag which already checks distanceToRoute validity
          if (isAlongRoute) {
              popupContent += `<div><strong>Route Dist:</strong> ${Math.round(tower.distanceToRoute)}m</div>`;
          }
          if (tower.updated != null && typeof tower.updated === 'number' && tower.updated > 0) { // Check if updated is a valid timestamp
              try {
                  // Ensure formatDate handles potential errors
                  const formattedDate = formatDate(new Date(tower.updated * 1000).toISOString());
                  popupContent += `<div><strong>Updated:</strong> ${formattedDate}</div>`;
              } catch (e) {
                  console.error("Error formatting tower update date:", tower.updated, e);
              }
          }
          popupContent += '</div>'; // Close content

          popupContent += '</div>'; // Close popup div

          // Log the generated content for a sample tower
          if (towerId.includes('mock') || Math.random() < 0.01) { // Log for mocks or ~1% of real towers
            //  console.log(`[TowerMarkers] Popup content for ${towerId}:`, popupContent);
          }
          // --- End Debug ---

          // Bind the generated HTML string
          marker.bindPopup(popupContent, { minWidth: 160 });

          marker.customId = towerId;
          newLayerGroup.addLayer(marker);

        } catch (error) { console.error("Error creating tower marker or popup:", error, tower); }
      }
    });

    // Remove old markers... (logic remains the same)
    if (layerRef.current) {
        layerRef.current.eachLayer(layer => {
            if (layer.customId && !currentIds.has(layer.customId)) {
                newLayerGroup.removeLayer(layer);
                // console.log(`[TowerMarkers] Removed marker with ID: ${layer.customId}`);
            }
        });
    }
    
    // Update layer ref... (logic remains the same)
    if (!layerRef.current) { newLayerGroup.addTo(map); }
    layerRef.current = newLayerGroup;
    renderedMarkerIds.current = currentIds;
    // console.log("[TowerMarkers Effect] renderedMarkerIds updated:", renderedMarkerIds.current); 

  }, [map, towerDataKey]); // Dependency on memoized key

  // Cleanup layer on unmount... (logic remains the same)
  useEffect(() => {
    return () => {
      if (map && layerRef.current) {
        // console.log("[TowerMarkers Cleanup Effect] Removing layer group from map on unmount.");
        map.removeLayer(layerRef.current);
        layerRef.current = null; // Optionally reset the ref
        renderedMarkerIds.current.clear(); // Clear the rendered IDs set
      }
    };
  }, [map]);

  return null;
};

TowerMarkers.propTypes = {
  map: PropTypes.object, // Leaflet map instance
  towers: PropTypes.array.isRequired,
};

export default TowerMarkers;