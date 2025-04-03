import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { convertMetersToMiles, formatDuration, getDirectionIcon } from '../../utils/formatting'; // Utility functions for formatting route data

import './DirectionsPanel.css';
import { closeIconUrl } from '../../assets/icons/index.js';


/**
 * DirectionsPanel Component
 * 
 * Displays route directions, steps, and related information for the selected route.
 */
const DirectionsPanel = ({ 
  isVisible, 
  isMinimized,
  routeInfo,
  activeStep, 
  onStepClick,
  onBackClick,
  onMinimizeToggle,
  origin,
  destination,
  routeType,
  routingProvider, // Add routing provider parameter
  onToggleMinimize,
  onClose,
  onSave,
  canSave,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
}) => {
  const panelRef = useRef(null); // Ref for the panel element for scrolling functionality
  const [headerHeight, setHeaderHeight] = useState(0); // State to track the height of the panel header

  // --- Auto-scroll when active step changes ---
  useEffect(() => {
    if (panelRef.current && activeStep !== null && activeStep >= 0) {
      const stepElement = document.querySelector(`.direction-step[data-step="${activeStep}"]`);
      if (stepElement) {
        const scrollContainer = panelRef.current.querySelector('.directions-panel-body');
        if (scrollContainer) {
          const stepTop = stepElement.offsetTop;
          const containerScrollTop = scrollContainer.scrollTop;
          const containerHeight = scrollContainer.clientHeight;
          
          // Scroll if step is not fully visible in the container
          if (stepTop < containerScrollTop || stepTop > containerScrollTop + containerHeight - 100) {
            // Scroll the element into view with some padding
            scrollContainer.scrollTo({
              top: stepTop - 20, // 20px padding from top
              behavior: 'smooth'
            });
          }
        }
      }
    }
  }, [activeStep]);

  // --- Measure header height for CSS calculations ---
  useEffect(() => {
    if (panelRef.current) {
      const headerElement = panelRef.current.querySelector('.directions-panel-header');
      if (headerElement) {
        setHeaderHeight(headerElement.offsetHeight);
      }
    }
  }, [isVisible]); // Re-measure when visibility changes

  // --- Panel should not render if not visible ---
  if (!isVisible) {
    return null;
  }

  // --- Extract route information ---
  const distance = routeInfo?.distance || 0;
  const duration = routeInfo?.duration || 0;
  const steps = routeInfo?.steps || [];
  const route_summary = routeInfo?.summary || '';

  // --- Format route information for display ---
  const distanceMiles = convertMetersToMiles(distance);
  const durationFormatted = formatDuration(duration);

  // --- Return minimized view if minimized ---
  if (isMinimized) {
    return (
      <div className="directions-panel-minimized">
        <div className="directions-minimized-content">
          <div className="directions-minimized-summary">
            <span className="directions-minimized-distance">{distanceMiles}</span>
            <span className="directions-minimized-duration">{durationFormatted}</span>
          </div>
          <button className="directions-panel-expand-button" onClick={onMinimizeToggle} aria-label="Expand directions panel">
            ▲ {/* Up arrow */}
          </button>
        </div>
      </div>
    );
  }

  // --- Get route type display string ---
  const getRouteTypeDisplay = (type) => {
    switch (type) {
      case 'fastest': return 'Fastest Route';
      case 'cell_coverage': return 'Best Cell Coverage';
      case 'balanced': return 'Balanced (Speed & Coverage)';
      default: return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Route';
    }
  };

  // --- Get routing provider display string ---
  const getRoutingProviderDisplay = (provider) => {
    switch (provider) {
      case 'graphhopper': return 'GraphHopper';
      case 'osrm': return 'OSRM';
      default: return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown';
    }
  };

  // --- Return full panel view ---
  return (
    <div className="directions-panel-container" ref={panelRef}>
      <div className="directions-panel-header">
        <button className="directions-panel-back-button" onClick={onBackClick} aria-label="Close directions">
          ← {/* Left arrow */}
        </button>
        <div className="directions-panel-title">
          <h2>Directions</h2>
          <div className="directions-route-type">{getRouteTypeDisplay(routeType)}</div>
          {routingProvider && (
            <div className="directions-routing-provider">via {getRoutingProviderDisplay(routingProvider)}</div>
          )}
        </div>
        <button className="directions-panel-minimize-button" onClick={onMinimizeToggle} aria-label="Minimize directions panel">
          ▼ {/* Down arrow */}
        </button>
      </div>

      <div className="directions-panel-summary">
        <div className="directions-stats">
          <div className="directions-distance">{distanceMiles}</div>
          <div className="directions-duration">{durationFormatted}</div>
        </div>
        <div className="directions-route-summary">{route_summary}</div>
        <div className="directions-endpoints">
          <div className="directions-origin">{origin}</div>
          <div className="directions-destination">{destination}</div>
        </div>
      </div>

      <div className="directions-panel-body" style={{ maxHeight: `calc(80vh - ${headerHeight}px)` }}>
        <div className="directions-steps">
          {steps.map((step, index) => (
            <div 
              key={index}
              className={`direction-step ${activeStep === index ? 'active' : ''}`}
              data-step={index}
              onClick={() => onStepClick(index)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onStepClick(index);
                }
              }}
            >
              <div className="direction-step-icon">
                {index === 0 ? (
                  <div className="direction-start-icon">●</div>
                ) : index === steps.length - 1 ? (
                  <div className="direction-end-icon">◆</div>
                ) : (
                  <div className="direction-icon">{index}</div>
                )}
              </div>
              <div className="direction-step-content">
                <div className="direction-instruction">{step.instruction}</div>
                {step.distance > 0 && (
                  <div className="direction-distance-small">
                    {convertMetersToMiles(step.distance)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

DirectionsPanel.propTypes = {
  isVisible: PropTypes.bool.isRequired,            // Whether the panel should be visible
  isMinimized: PropTypes.bool.isRequired,          // Whether the panel is minimized
  routeInfo: PropTypes.object,                     // Route information object with distance, duration, steps
  activeStep: PropTypes.number,                    // Index of currently active step (-1 or null if none)
  onStepClick: PropTypes.func.isRequired,          // Handler for when a step is clicked
  onBackClick: PropTypes.func.isRequired,          // Handler for when back button is clicked
  onMinimizeToggle: PropTypes.func.isRequired,     // Handler for when minimize button is clicked
  origin: PropTypes.string,                        // Origin location display name
  destination: PropTypes.string,                   // Destination location display name
  routeType: PropTypes.string,                     // Type of route ('fastest', 'cell_coverage', 'balanced')
  routingProvider: PropTypes.string,               // Routing provider used ('graphhopper', 'osrm')
  onToggleMinimize: PropTypes.func.isRequired,     // Handler to toggle minimize panel (function)
  onClose: PropTypes.func.isRequired,              // Handler for panel close (function)
  onSave: PropTypes.func,                          // Handler for save route action (function, optional)
  canSave: PropTypes.bool,                         // Can route be saved (boolean, optional)
  onMouseEnter: PropTypes.func,                    // Handler for mouse enter (function, optional)
  onMouseLeave: PropTypes.func,                     // Handler for mouse leave (function, optional)
  onTouchStart: PropTypes.func,                      // Handler for touch start (function, optional)
  onTouchEnd: PropTypes.func,                        // Handler for touch end (function, optional)
};

export default DirectionsPanel;