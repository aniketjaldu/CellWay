import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './RouteTypeSelectionModal.css';
import { formatDistance, formatDuration, getRouteTypeIcon } from '../../utils/formatting';
import { closeIconUrl } from '../../assets/icons/index.js';

const RouteTypeSelectionModal = ({
  isVisible,
  onClose,
  onSelectType, // (selectedType) => void
  currentType, // Currently active/preferred type
  computedRoutes, // { fastest: { routeData }, cell_coverage: { routeData }, balanced: { routeData } }
  isLoading, // Are routes still being calculated?
  initialSkipPreference, // boolean
  onSkipPreferenceChange, // (shouldSkip: boolean) => void
}) => {
  const [skipChoice, setSkipChoice] = useState(initialSkipPreference);

  const handleSelect = (type) => {
    onSelectType(type); // Call parent handler
  };

  const handleCheckboxChange = (e) => {
    const checked = e.target.checked;
    setSkipChoice(checked);
    onSkipPreferenceChange(checked); // Notify parent of preference change
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="route-type-modal-overlay" onClick={onClose}>
      <div className="route-type-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="route-type-modal-header">
          <h3>Choose Route Priority</h3>
          <button className="route-type-modal-close" onClick={onClose} title="Close" aria-label="Close">
            {/* Use img tag with imported URL */}
            <img src={closeIconUrl} alt="Close" className="icon-img small" />
          </button>
        </div>

        <p className="route-type-modal-description">Select how you want your route optimized.</p>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="route-type-loading-indicator">
            <p>Calculating route options...</p>
            {/* Optional: Spinner or more detailed status */}
          </div>
        )}

        <div className="route-selection-options">
          {['fastest', 'cell_coverage', 'balanced'].map((type) => {
            const routeData = computedRoutes[type];
            // Check if data exists AND has the necessary properties
            const isAvailable = !!routeData?.routes?.[0]?.distance && routeData.routes[0].duration != null;
            const isActive = currentType === type;

            return (
              <button
                key={type}
                className={`route-selection-option ${isActive ? 'active' : ''} ${isAvailable ? 'available' : (isLoading ? '' : 'unavailable')}`}
                onClick={() => handleSelect(type)}
                disabled={!isAvailable} // Disable if data not yet computed or invalid
              >
                <div className="route-selection-icon">{getRouteTypeIcon(type)}</div>
                <div className="route-selection-label">{type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                <div className="route-selection-desc">
                  {isAvailable ? (
                    // Access distance/duration correctly from the nested structure
                    `${formatDistance(routeData.routes[0].distance)}, ${formatDuration(routeData.routes[0].duration)}`
                  ) : (
                    <span className="calculating">{isLoading ? 'Calculating...' : 'Unavailable'}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="route-selection-dont-ask">
          <label className="dont-ask-label">
            <input type="checkbox" checked={skipChoice} onChange={handleCheckboxChange} />
            <span className="dont-ask-text">Remember my choice and use it automatically next time</span>
          </label>
        </div>

        {/* Optional: Add explicit close/confirm button if needed */}
        {/* <div className="route-selection-actions">
            <button className="route-selection-cancel" onClick={onClose}>Close</button>
        </div> */}
      </div>
    </div>
  );
};

RouteTypeSelectionModal.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectType: PropTypes.func.isRequired,
  currentType: PropTypes.string.isRequired,
  computedRoutes: PropTypes.object.isRequired,
  isLoading: PropTypes.bool.isRequired,
  initialSkipPreference: PropTypes.bool.isRequired,
  onSkipPreferenceChange: PropTypes.func.isRequired,
};

export default RouteTypeSelectionModal;