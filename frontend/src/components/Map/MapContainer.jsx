import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';

import './MapContainer.css'; // Import component-specific CSS


/**
 * MapContainer Component
 * 
 * A simple container component designed to hold the Leaflet map instance.
 * It utilizes `forwardRef` to allow parent components to get a direct reference to the underlying DOM element,
 * which is typically required for map initialization libraries like Leaflet.
 */
const MapContainer = forwardRef(({ className = '', children }, ref) => {

  // Note: Removed temporary inline styles as these should be defined
  //       and managed in the corresponding MapContainer.css file
  //       for better separation of concerns and maintainability.

  return (
    <div
      id="map" // ID often used by map libraries to target the container
      ref={ref} // Forwarded ref for map initialization
      className={`map-container ${className}`} // Apply base class and any additional classes
    >
      {children} {/* Allows rendering map controls or other elements inside */}
    </div>
  );
});


// --- Display Name for React DevTools ---
MapContainer.displayName = 'MapContainer';


// --- Prop Type Definitions ---
MapContainer.propTypes = {
  className: PropTypes.string, // Optional additional CSS classes to apply
  children: PropTypes.node,    // Optional children elements to render within the container
};

export default MapContainer;