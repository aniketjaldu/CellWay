import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import './SavedRoutesPanel.css';
import { formatDate, getRouteTypeIcon } from '../../utils/formatting';
import * as api from '../../services/api'; // API service for fetching routes
import { closeIconUrl } from '../../assets/icons/index.js';


/**
 * SavedRoutesPanel Component
 * 
 * Displays a modal panel listing the user's saved routes.
 * Fetches routes from the API when visible and allows the user to load a selected route.
 */
const SavedRoutesPanel = ({
  isVisible,
  onClose,
  onLoadRoute,
  // Map interaction prevention props
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
}) => {
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);


  // --- Fetch Saved Routes Effect ---
  useEffect(() => {
    if (!isVisible) {
      // Reset state when the panel is hidden to avoid showing stale data
      setSavedRoutes([]);
      setIsLoading(false);
      setError(null);
      return; // Exit if panel is not visible
    }

    const fetchSavedRoutesData = async () => {
      setIsLoading(true); // Start loading state
      setError(null);     // Clear previous errors
      try {
        const response = await api.fetchSavedRoutes(); // Fetch routes from API
        // Process routes: ensure IDs are strings (backend should ideally handle this)
        const processedRoutes = (response.data || []).map(route => ({
          ...route,
          _id: String(route._id), // Ensure _id is a string
          user_id: String(route.user_id) // Ensure user_id is a string
        }));
        setSavedRoutes(processedRoutes); // Update state with fetched routes
      } catch (err) {
        console.error("Error fetching saved routes:", err);
        setError(err.response?.data?.error || "Failed to load saved routes. Please try again."); // Set error message
        setSavedRoutes([]); // Clear routes on error
      } finally {
        setIsLoading(false); // End loading state
      }
    };

    fetchSavedRoutesData(); // Fetch data when the component becomes visible

  }, [isVisible]); // Dependency: re-fetch only when visibility changes


  // --- Load Route Handler ---
  const handleLoadClick = (route) => {
    onClose(); // Close the panel first
    // Use a short timeout to allow panel closing animation before loading the route (and potentially shifting the map)
    setTimeout(() => {
      onLoadRoute(route); // Call parent handler to load the selected route
    }, 50); // Small delay (adjust if needed)
  };


  // --- Conditional Rendering: Panel Visibility ---
  if (!isVisible) {
    return null; // Do not render the panel if it's not visible
  }


  // --- Render Panel ---
  return (
    <div className="saved-routes-overlay" onClick={onClose}> {/* Overlay closes panel on click */}
      <div
        className="saved-routes-container"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the panel
        // Pass through map interaction prevention handlers
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* --- Panel Header --- */}
        <div className="saved-routes-header">
          <h2>My Saved Routes</h2> {/* Panel Title */}
          <button className="saved-routes-close-button" onClick={onClose} title="Close" aria-label="Close"> {/* Close Button */}
            <img src={closeIconUrl} alt="Close" className="icon-img small" />
          </button>
        </div>


        {/* --- Panel Content (List or Messages) --- */}
        <div className="saved-routes-content">
          {/* --- Loading State --- */}
          {isLoading && <div className="saved-routes-message">Loading routes...</div>}

          {/* --- Error State --- */}
          {error && <div className="saved-routes-message error">{error}</div>}

          {/* --- Empty State --- */}
          {!isLoading && !error && savedRoutes.length === 0 && (
            <div className="saved-routes-message">No routes saved yet. Calculate and save a route to see it here.</div>
          )}

          {/* --- Routes List --- */}
          {!isLoading && !error && savedRoutes.length > 0 && (
            <div className="routes-list">
              {savedRoutes.map((route) => ( // Map over saved routes to render each item
                <div
                  key={route._id} // Use unique route ID as key
                  className="route-item"
                  onClick={() => handleLoadClick(route)} // Load route on click
                  title="Load this route"              // Tooltip
                  role="button"                        // Accessibility role
                  tabIndex={0}                         // Make focusable
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLoadClick(route); }} // Keyboard accessibility
                >
                  {/* --- Optional Route Image --- */}
                  {route.route_image && (
                    <div className="route-image">
                      <img src={route.route_image} alt="Route Preview" loading="lazy" /> {/* Lazy load image */}
                    </div>
                  )}

                  {/* --- Route Details --- */}
                  <div className="route-details">
                    <div className="route-points">
                      <div className="route-origin">{route.origin?.place_name || 'Unknown Origin'}</div> {/* Origin name */}
                      <div className="route-destination">{route.destination?.place_name || 'Unknown Destination'}</div> {/* Destination name */}
                    </div>
                    <div className="route-meta">
                      <span className="route-type"> {/* Route type (e.g., Balanced) */}
                        {getRouteTypeIcon(route.route_type)} {/* Icon */}
                        {route.route_type?.replace('_', ' ') || 'Route'} {/* Formatted type name */}
                      </span>
                      <span className="route-date">{formatDate(route.created_at)}</span> {/* Formatted date saved */}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// --- Prop Type Definitions ---
SavedRoutesPanel.propTypes = {
  isVisible: PropTypes.bool.isRequired,        // Is the panel currently visible? (boolean)
  onClose: PropTypes.func.isRequired,         // Handler function to close the panel (function)
  onLoadRoute: PropTypes.func.isRequired,     // Handler function when a route is selected to be loaded (function)
  // Map interaction prevention handlers (optional)
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onTouchStart: PropTypes.func,
  onTouchEnd: PropTypes.func,
};

export default SavedRoutesPanel;