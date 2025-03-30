import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import './MapContainer.css'; // Import component-specific CSS

const MapContainer = forwardRef(({ className = '', children }, ref) => {
  return (
    <div
      id="map"
      ref={ref}
      className={`map-container ${className}`}
      // TEMPORARY INLINE STYLES FOR TESTING
      style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100vw', // Use viewport width
          height: '100vh', // Use viewport height
          backgroundColor: 'lightgrey' // Add background to see the div
      }}
    >
      {children}
    </div>
  );
});

MapContainer.displayName = 'MapContainer';

// If you chose to remove prop-types, delete the PropTypes import and this block.
// If using TypeScript, define props with an interface instead.

export default MapContainer;