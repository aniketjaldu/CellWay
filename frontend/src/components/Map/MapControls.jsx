import React from 'react';
import PropTypes from 'prop-types';

import './MapControls.css';
import { getRouteTypeIcon } from '../../utils/formatting'; // Import utility


/**
 * MapControls Component
 * 
 * Renders a set of map control buttons, including locate user,
 * cycle route optimization type, and toggle cell tower visibility.
 */
const MapControls = ({
  isLocating,
  onLocate,
  isTowersVisible,
  onToggleTowers,
  currentRouteType,
  onSelectRouteType,
  isRouteActive, // Used to enable/disable route type button
}) => {
  return (
    <div className="map-controls-container">

      {/* --- Locate User Button --- */}
      <button
        className={`map-control-button locate-button ${isLocating ? 'locating' : ''}`} // Apply locating class for animation
        onClick={onLocate}            // Trigger locate function on click
        title="Use Current Location as Origin" // Tooltip text
        disabled={isLocating}         // Disable button while locating
        aria-label={isLocating ? "Locating..." : "Use Current Location"} // Accessibility label
      >
        {isLocating ? '...' : '📍'} {/* Display loading indicator or pin emoji */}
      </button>


      {/* --- Route Type Selector Button --- */}
      <button
        className={`map-control-button route-type-button ${!isRouteActive ? 'disabled' : ''}`} // Apply disabled class if no route is active
        onClick={onSelectRouteType}     // Trigger route type change function on click
        disabled={!isRouteActive}      // Disable button if no route is active
        title={isRouteActive ? "Change Route Optimization" : "Set Origin and Destination first"} // Dynamic tooltip
        aria-label="Change Route Optimization" // Accessibility label
      >
        {getRouteTypeIcon(currentRouteType)} {/* Display icon for the current route type */}
      </button>


      {/* --- Cell Tower Toggle Button --- */}
      <button
        className={`map-control-button tower-toggle-button ${isTowersVisible ? 'active' : ''}`} // Apply active class when towers are visible
        onClick={onToggleTowers}         // Trigger tower visibility toggle on click
        title={isTowersVisible ? 'Hide Cell Towers' : 'Show Cell Towers'} // Dynamic tooltip
        aria-label={isTowersVisible ? 'Hide Cell Towers' : 'Show Cell Towers'} // Dynamic accessibility label
      >
        📡 {/* Antenna emoji for towers */}
      </button>

    </div>
  );
};


// --- Prop Type Definitions ---
MapControls.propTypes = {
  isLocating: PropTypes.bool.isRequired,       // Is the locate function currently active? (boolean)
  onLocate: PropTypes.func.isRequired,        // Handler function for the locate button (function)
  isTowersVisible: PropTypes.bool.isRequired,  // Are cell towers currently visible? (boolean)
  onToggleTowers: PropTypes.func.isRequired,   // Handler function for the tower toggle button (function)
  currentRouteType: PropTypes.string.isRequired, // Current route optimization type (string, e.g., 'balanced')
  onSelectRouteType: PropTypes.func.isRequired, // Handler function for the route type button (function)
  isRouteActive: PropTypes.bool.isRequired,    // Is there an active route currently displayed? (boolean)
};

export default MapControls;