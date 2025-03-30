import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

import './DirectionsPanel.css';
import { getDirectionIcon } from '../../utils/formatting';
import { closeIconUrl } from '../../assets/icons/index.js';


/**
 * DirectionsPanel Component
 * 
 * Displays route directions in a panel, including summary, step-by-step instructions,
 * and actions like save and minimize.
 */
const DirectionsPanel = ({
  isVisible,
  isMinimized,
  directions,
  originName,
  destinationName,
  activeStepIndex,
  onStepClick,
  onToggleMinimize,
  onClose,
  onSave,
  canSave,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
}) => {
  const contentRef = useRef(null);  // Ref for the scrollable content area
  const activeItemRef = useRef(null); // Ref for the active instruction item


  // --- Scroll to Active Step Effect ---
  useEffect(() => {
    if (activeItemRef.current && contentRef.current) {
      contentRef.current.scrollTo({
        top: activeItemRef.current.offsetTop - contentRef.current.offsetTop - 10, // Adjust scroll offset
        behavior: 'smooth', // Smooth scrolling behavior
      });
    }
  }, [activeStepIndex]);


  // --- Prevent Map Scroll/Click Propagation Effect ---
  useEffect(() => {
    const contentElement = contentRef.current;
    if (contentElement && !isMinimized && window.L?.DomEvent) {
      L.DomEvent.disableScrollPropagation(contentElement);  // Disable scroll propagation to map
      L.DomEvent.disableClickPropagation(contentElement);  // Disable click propagation to map
    }
    // Cleanup (though might not be strictly necessary as Leaflet might handle it)
  }, [contentRef, isMinimized]);



  // --- Conditional Rendering: Panel Visibility ---
  if (!isVisible) {
    return null; // Do not render the panel if it's not visible
  }


  // --- Minimized Panel View ---
  if (isMinimized) {
    return (
      <div
        className="directions-panel-container minimized"
        onClick={onToggleMinimize}       // Expand panel on click
        onMouseEnter={onMouseEnter}       // Prevent map interactions when panel hovered
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}       // Prevent map interactions on touch
        onTouchEnd={onTouchEnd}
        title="Expand Directions"         // Accessibility title
        role="button"                    // Semantic role for accessibility
        aria-label="Expand Directions"   // ARIA label for accessibility
      >
        <div className="directions-panel-header">
          <div className="directions-toggle-icon">🗺️</div> {/* Map emoji icon to expand */}
        </div>
      </div>
    );
  }


  // --- Full Panel View ---
  return (
    <div
      className="directions-panel-container"
      onMouseEnter={onMouseEnter}       // Prevent map interactions when panel hovered
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}       // Prevent map interactions on touch
      onTouchEnd={onTouchEnd}
    >
      {/* --- Header Section --- */}
      <div className="directions-panel-header">
        <div className="directions-title">
          <div className="direction-endpoints">
            <span className="direction-origin">{originName || 'Origin'}</span>      {/* Origin Name */}
            <span className="direction-separator">→</span>                         {/* Separator Arrow */}
            <span className="direction-destination">{destinationName || 'Destination'}</span> {/* Destination Name */}
          </div>
        </div>

        {/* --- Header Actions --- */}
        <div className="directions-actions">
          {canSave && onSave && ( // Conditionally render Save button if save functionality is enabled
            <button
              className="directions-action-button save-button"
              onClick={onSave}              // Save route on click
              title="Save Route"              // Accessibility title
              aria-label="Save Route"         // ARIA label for accessibility
            >
              💾 {/* Floppy disk emoji for save */}
            </button>
          )}
          <button
            className="directions-action-button minimize-button"
            onClick={onToggleMinimize}       // Minimize panel on click
            title="Minimize Directions"       // Accessibility title
            aria-label="Minimize Directions"  // ARIA label for accessibility
          >
            × {/* Multiplication X character for minimize/close */}
          </button>
        </div>
      </div>


      {/* --- Content Section (Summary and Instructions) --- */}
      <div className="directions-panel-content" ref={contentRef}>

        {/* --- Route Summary --- */}
        {directions && ( // Conditionally render summary if directions data is available
          <div className="directions-summary">
            <div><strong>Dist:</strong> {directions.distanceFormatted}</div>    {/* Formatted distance */}
            <div><strong>Time:</strong> {directions.durationFormatted}</div>    {/* Formatted duration */}
            {directions.ascendFormatted && <div><strong>Asc:</strong> {directions.ascendFormatted}</div>}   {/* Formatted ascent */}
            {directions.descendFormatted && <div><strong>Desc:</strong> {directions.descendFormatted}</div>} {/* Formatted descent */}
          </div>
        )}


        {/* --- Instruction List Container --- */}
        <div className="instruction-list-container">
          <ul className="instruction-list">
            {(directions?.steps && directions.steps.length > 0) ? ( // Render steps if available
              directions.steps.map((step, index) => (
                <li
                  key={index}
                  ref={activeStepIndex === index ? activeItemRef : null} // Attach ref to active item for scrolling
                  className={`instruction-item ${activeStepIndex === index ? 'active' : ''}`} // Apply 'active' class to active step
                  onClick={(e) => { e.stopPropagation(); onStepClick(step, index); }} // Handle step click, stop map event
                  role="button"                  // Semantic role for accessibility
                  tabIndex={0}                   // Make focusable for keyboard navigation
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStepClick(step, index); }} // Keyboard accessibility
                >
                  <div className={`instruction-icon icon-${step.type?.toLowerCase() || 'default'}`}> {/* Icon container */}
                    {getDirectionIcon(step.type) || '•'} {/* Direction icon or default bullet */}
                  </div>
                  <div className="instruction-text">
                    <div className="instruction-direction">{step.instruction}</div>           {/* Instruction text */}
                    {step.distanceFormatted && <div className="instruction-distance">{step.distanceFormatted}</div>} {/* Formatted distance for step */}
                  </div>
                </li>
              ))
            ) : (
              // --- No Directions Message ---
              <li className="instruction-item no-directions">
                <div className="instruction-text">No detailed directions available.</div> {/* Message when no directions */}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};


DirectionsPanel.propTypes = {
  isVisible: PropTypes.bool.isRequired,         // Is the panel visible? (boolean)
  isMinimized: PropTypes.bool.isRequired,       // Is the panel minimized? (boolean)
  directions: PropTypes.shape({                 // Directions data object
    distanceFormatted: PropTypes.string,
    durationFormatted: PropTypes.string,
    ascendFormatted: PropTypes.string,
    descendFormatted: PropTypes.string,
    steps: PropTypes.arrayOf(PropTypes.shape({ // Array of steps
      type: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      instruction: PropTypes.string,
      distanceFormatted: PropTypes.string,
      coordinates: PropTypes.array,
      streetName: PropTypes.string,
      segmentCoordinates: PropTypes.array,
    })),
  }),
  originName: PropTypes.string,                // Name of the origin location (string)
  destinationName: PropTypes.string,           // Name of the destination location (string)
  activeStepIndex: PropTypes.number,           // Index of the active step (number)
  onStepClick: PropTypes.func.isRequired,      // Handler for step click (function)
  onToggleMinimize: PropTypes.func.isRequired, // Handler to toggle minimize panel (function)
  onClose: PropTypes.func.isRequired,         // Handler for panel close (function)
  onSave: PropTypes.func,                    // Handler for save route action (function, optional)
  canSave: PropTypes.bool,                   // Can route be saved (boolean, optional)
  onMouseEnter: PropTypes.func,              // Handler for mouse enter (function, optional)
  onMouseLeave: PropTypes.func,             // Handler for mouse leave (function, optional)
  onTouchStart: PropTypes.func,              // Handler for touch start (function, optional)
  onTouchEnd: PropTypes.func,                // Handler for touch end (function, optional)
};


export default DirectionsPanel;