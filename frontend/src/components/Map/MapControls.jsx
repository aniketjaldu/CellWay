import React from 'react';
import PropTypes from 'prop-types';
import './MapControls.css';
import { getRouteTypeIcon } from '../../utils/formatting'; // Import utility

const MapControls = ({
  isLocating,
  onLocate,
  isTowersVisible,
  onToggleTowers,
  currentRouteType,
  onSelectRouteType,
  isRouteActive, // To enable/disable route type button
}) => {
  return (
    <div className="map-controls-container">
      {/* Locate Button */}
      <button
        className={`map-control-button locate-button ${isLocating ? 'locating' : ''}`}
        onClick={onLocate}
        title="Use Current Location as Origin"
        disabled={isLocating}
        aria-label={isLocating ? "Locating..." : "Use Current Location"}
      >
        {isLocating ? '...' : '📍'}
      </button>

      {/* Route Type Selector Button */}
      <button
        className={`map-control-button route-type-button ${!isRouteActive ? 'disabled' : ''}`}
        onClick={onSelectRouteType}
        disabled={!isRouteActive}
        title={isRouteActive ? "Change Route Optimization" : "Set Origin and Destination first"}
        aria-label="Change Route Optimization"
      >
        {getRouteTypeIcon(currentRouteType)}
      </button>

      {/* Cell Tower Toggle Button */}
      <button
        className={`map-control-button tower-toggle-button ${isTowersVisible ? 'active' : ''}`}
        onClick={onToggleTowers}
        title={isTowersVisible ? 'Hide Cell Towers' : 'Show Cell Towers'}
        aria-label={isTowersVisible ? 'Hide Cell Towers' : 'Show Cell Towers'}
      >
        📡
      </button>
    </div>
  );
};

MapControls.propTypes = {
  isLocating: PropTypes.bool.isRequired,
  onLocate: PropTypes.func.isRequired,
  isTowersVisible: PropTypes.bool.isRequired,
  onToggleTowers: PropTypes.func.isRequired,
  currentRouteType: PropTypes.string.isRequired,
  onSelectRouteType: PropTypes.func.isRequired,
  isRouteActive: PropTypes.bool.isRequired,
};

export default MapControls;