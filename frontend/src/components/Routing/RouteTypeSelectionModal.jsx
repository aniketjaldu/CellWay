import React, { useState } from 'react';
import PropTypes from 'prop-types';

import './RouteTypeSelectionModal.css';
import { formatDistance, formatDuration, getRouteTypeIcon } from '../../utils/formatting';
import { closeIconUrl } from '../../assets/icons/index.js';


/**
 * RouteTypeSelectionModal Component
 * 
 * A modal dialog that allows the user to select their preferred route optimization type
 * (Fastest, Cell Coverage, Balanced) after route options have been calculated.
 * It displays summary information for each available route type.
 */
const RouteTypeSelectionModal = ({
  isVisible,
  onClose,
  onSelectType,
  currentType,
  computedRoutes,
  isLoading,
  initialSkipPreference,
  onSkipPreferenceChange,
}) => {
  const [skipChoice, setSkipChoice] = useState(initialSkipPreference);


  // --- Event Handlers ---
  const handleSelect = (type) => {
    onSelectType(type); // Notify parent component of selected type
  };

  const handleCheckboxChange = (event) => {
    const isChecked = event.target.checked;
    setSkipChoice(isChecked);
    onSkipPreferenceChange(isChecked); // Notify parent component of preference change
  };


  // --- Conditional Rendering: Modal Visibility ---
  if (!isVisible) {
    return null; // Do not render the modal if it's not visible
  }


  // --- Render Modal ---
  return (
    <div className="route-type-modal-overlay" onClick={onClose}> {/* Close modal on overlay click */}
      <div className="route-type-modal-content" onClick={(e) => e.stopPropagation()}> {/* Prevent closing when clicking inside content */}

        {/* --- Modal Header --- */}
        <div className="route-type-modal-header">
          <h3>Choose Route Priority</h3> {/* Modal Title */}
          <button className="route-type-modal-close" onClick={onClose} title="Close" aria-label="Close"> {/* Close Button */}
            <img src={closeIconUrl} alt="Close" className="icon-img small" />
          </button>
        </div>


        {/* --- Modal Description --- */}
        <p className="route-type-modal-description">
          Select how you want your route optimized based on your preferences.
        </p>


        {/* --- Loading Indicator --- */}
        {isLoading && (
          <div className="route-type-loading-indicator">
            <p>Calculating route options...</p> {/* Loading message */}
            {/* Optional: Add a spinner component here */}
          </div>
        )}


        {/* --- Route Selection Options --- */}
        <div className="route-selection-options">
          {['fastest', 'cell_coverage', 'balanced'].map((type) => { // Iterate through route types
            const routeData = computedRoutes[type];
            // Determine if route data is valid and available for display
            const isAvailable = !!routeData?.routes?.[0]?.distance && routeData.routes[0].duration != null;
            const isActive = currentType === type; // Check if this type is the currently selected one

            return (
              <button
                key={type}
                className={`route-selection-option ${isActive ? 'active' : ''} ${isAvailable ? 'available' : (isLoading ? '' : 'unavailable')}`} // Apply classes based on state
                onClick={() => handleSelect(type)} // Select type on click
                disabled={!isAvailable} // Disable button if route data is unavailable
              >
                <div className="route-selection-icon">{getRouteTypeIcon(type)}</div> {/* Route type icon */}
                <div className="route-selection-label">{type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div> {/* Formatted route type label */}
                <div className="route-selection-desc"> {/* Route summary (distance, duration) or status */}
                  {isAvailable ? (
                    // Display formatted distance and duration if available
                    `${formatDistance(routeData.routes[0].distance)}, ${formatDuration(routeData.routes[0].duration)}`
                  ) : (
                    // Display status if route data is not available
                    <span className="calculating">{isLoading ? 'Calculating...' : 'Unavailable'}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>


        {/* --- "Don't Ask Again" Checkbox --- */}
        <div className="route-selection-dont-ask">
          <label className="dont-ask-label">
            <input type="checkbox" checked={skipChoice} onChange={handleCheckboxChange} /> {/* Checkbox input */}
            <span className="dont-ask-text">Remember my choice and use it automatically next time</span> {/* Checkbox label */}
          </label>
        </div>


        {/* --- Optional Modal Actions --- */}
        {/* <div className="route-selection-actions">
            <button className="route-selection-cancel" onClick={onClose}>Close</button> // Optional explicit close button
        </div> */}

      </div>
    </div>
  );
};


// --- Prop Type Definitions ---
RouteTypeSelectionModal.propTypes = {
  isVisible: PropTypes.bool.isRequired,              // Is the modal currently visible? (boolean)
  onClose: PropTypes.func.isRequired,               // Handler function to close the modal (function)
  onSelectType: PropTypes.func.isRequired,          // Handler function when a route type is selected (function)
  currentType: PropTypes.string.isRequired,         // The currently selected/active route type (string)
  computedRoutes: PropTypes.object.isRequired,      // Object containing computed route data for each type (object)
  isLoading: PropTypes.bool.isRequired,             // Is route calculation in progress? (boolean)
  initialSkipPreference: PropTypes.bool.isRequired, // Initial state of the "don't ask again" preference (boolean)
  onSkipPreferenceChange: PropTypes.func.isRequired,// Handler function when skip preference changes (function)
};

export default RouteTypeSelectionModal;