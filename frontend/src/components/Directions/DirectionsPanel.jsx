import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import './DirectionsPanel.css';
import { getDirectionIcon } from '../../utils/formatting'; // Import utility
import { closeIconUrl } from '../../assets/icons/index.js';

const DirectionsPanel = ({
  isVisible,
  isMinimized,
  directions, // { distanceFormatted, durationFormatted, ascendFormatted, descendFormatted, steps: [...] }
  originName,
  destinationName,
  activeStepIndex,
  onStepClick, // (step, index) => void
  onToggleMinimize, // () => void
  onClose, // () => void - Used to clear the route state
  onSave, // () => void
  canSave, // boolean, e.g., user logged in
  // Map interaction prevention
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
}) => {
  const contentRef = useRef(null);
  const activeItemRef = useRef(null);

  // Scroll active step into view
  useEffect(() => {
    if (activeItemRef.current && contentRef.current) {
      contentRef.current.scrollTo({
        top: activeItemRef.current.offsetTop - contentRef.current.offsetTop - 10, // Adjust offset as needed
        behavior: 'smooth',
      });
    }
  }, [activeStepIndex]);

  // Prevent scroll propagation on the content area
  useEffect(() => {
    const contentElement = contentRef.current;
    // Check if L exists and DomEvent is available before using it
    if (contentElement && !isMinimized && window.L?.DomEvent) {
      L.DomEvent.disableScrollPropagation(contentElement);
      L.DomEvent.disableClickPropagation(contentElement); // Also prevent clicks bubbling to map
      // Cleanup might not be strictly necessary if Leaflet handles it on element removal
    }
  }, [contentRef, isMinimized]);


  if (!isVisible) {
    return null; // Don't render anything if not visible
  }

  // Minimized View
  if (isMinimized) {
    return (
      <div
        className="directions-panel-container minimized"
        onClick={onToggleMinimize}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        title="Expand Directions"
        role="button"
        aria-label="Expand Directions"
      >
        <div className="directions-panel-header">
          {/* Use emoji or character directly */}
          <div className="directions-toggle-icon">🗺️</div>
        </div>
      </div>
    );
  }

  // Full View
  return (
    <div
      className="directions-panel-container"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="directions-panel-header">
        <div className="directions-title">
          <div className="direction-endpoints">
            <span className="direction-origin">{originName || 'Origin'}</span>
            <span className="direction-separator">→</span>
            <span className="direction-destination">{destinationName || 'Destination'}</span>
          </div>
        </div>
        <div className="directions-actions">
          {canSave && onSave && (
            <button
              className="directions-action-button save-button"
              onClick={onSave}
              title="Save Route"
              aria-label="Save Route"
            >
              {/* Use emoji or character directly */}
              💾
            </button>
          )}
          <button
            className="directions-action-button minimize-button"
            onClick={onToggleMinimize}
            title="Minimize Directions"
            aria-label="Minimize Directions"
          >
            {/* Use emoji or character directly */}
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="directions-panel-content" ref={contentRef}>
        {/* Summary */}
        {directions && (
          <div className="directions-summary">
            <div><strong>Dist:</strong> {directions.distanceFormatted}</div>
            <div><strong>Time:</strong> {directions.durationFormatted}</div>
            {directions.ascendFormatted && <div><strong>Asc:</strong> {directions.ascendFormatted}</div>}
            {directions.descendFormatted && <div><strong>Desc:</strong> {directions.descendFormatted}</div>}
          </div>
        )}

        {/* Instructions List */}
        <div className="instruction-list-container">
          <ul className="instruction-list">
            {(directions?.steps && directions.steps.length > 0) ? directions.steps.map((step, index) => (
              <li
                key={index}
                ref={activeStepIndex === index ? activeItemRef : null} // Attach ref to active item
                className={`instruction-item ${activeStepIndex === index ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent map click handler
                  onStepClick(step, index);
                }}
                role="button"
                tabIndex={0} // Make it focusable
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStepClick(step, index); }} // Keyboard accessibility
              >
                <div className={`instruction-icon icon-${step.type?.toLowerCase() || 'default'}`}>
                  {getDirectionIcon(step.type) || '•'}
                </div>
                <div className="instruction-text">
                  <div className="instruction-direction">{step.instruction}</div>
                  {step.distanceFormatted && <div className="instruction-distance">{step.distanceFormatted}</div>}
                  {/* Add other details like street name if needed */}
                  {/* {step.streetName && <div className="instruction-road-info">{step.streetName}</div>} */}
                </div>
              </li>
            )) : (
              <li className="instruction-item no-directions">
                <div className="instruction-text">No detailed directions available.</div>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

DirectionsPanel.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  isMinimized: PropTypes.bool.isRequired,
  directions: PropTypes.shape({
    distanceFormatted: PropTypes.string,
    durationFormatted: PropTypes.string,
    ascendFormatted: PropTypes.string,
    descendFormatted: PropTypes.string,
    steps: PropTypes.arrayOf(PropTypes.shape({
      type: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      instruction: PropTypes.string,
      distanceFormatted: PropTypes.string,
      coordinates: PropTypes.array,
      streetName: PropTypes.string,
      segmentCoordinates: PropTypes.array,
    })),
  }),
  originName: PropTypes.string,
  destinationName: PropTypes.string,
  activeStepIndex: PropTypes.number,
  onStepClick: PropTypes.func.isRequired,
  onToggleMinimize: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired, // Callback to clear route state
  onSave: PropTypes.func, // Optional save callback
  canSave: PropTypes.bool, // Whether save button should be shown
  // Map interaction
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onTouchStart: PropTypes.func,
  onTouchEnd: PropTypes.func,
};

export default DirectionsPanel;