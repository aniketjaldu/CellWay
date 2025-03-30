import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './SavedRoutesPanel.css';
import { formatDate, getRouteTypeIcon } from '../../utils/formatting';
import * as api from '../../services/api'; // Import API service
import { closeIconUrl } from '../../assets/icons/index.js';

const SavedRoutesPanel = ({
  isVisible,
  onClose,
  onLoadRoute, // (route) => void
  // Map interaction prevention
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
}) => {
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isVisible) {
      // Reset state when panel is hidden
      setSavedRoutes([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const fetchRoutes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.fetchSavedRoutes();
        // Ensure ObjectIds are strings (backend should ideally do this)
        const routes = (response.data || []).map(route => ({
            ...route,
            _id: String(route._id),
            user_id: String(route.user_id)
        }));
        setSavedRoutes(routes);
      } catch (err) {
        console.error("Error fetching saved routes:", err);
        setError(err.response?.data?.error || "Failed to load saved routes.");
        setSavedRoutes([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoutes();

  }, [isVisible]); // Fetch when panel becomes visible

  const handleLoadClick = (route) => {
    onClose(); // Close the panel first
    // Use timeout to allow panel closing animation before potential map shifts
    setTimeout(() => {
      onLoadRoute(route);
    }, 50);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="saved-routes-overlay" onClick={onClose}> {/* Close on overlay click */}
      <div
        className="saved-routes-container" // Renamed from .saved-routes
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="saved-routes-header">
          <h2>My Saved Routes</h2>
          <button className="saved-routes-close-button" onClick={onClose} title="Close" aria-label="Close">
             {/* Use img tag with imported URL */}
             <img src={closeIconUrl} alt="Close" className="icon-img small" />
          </button>
        </div>

        <div className="saved-routes-content">
          {isLoading && <div className="saved-routes-message">Loading routes...</div>}
          {error && <div className="saved-routes-message error">{error}</div>}
          {!isLoading && !error && savedRoutes.length === 0 && (
            <div className="saved-routes-message">No routes saved yet.</div>
          )}
          {!isLoading && !error && savedRoutes.length > 0 && (
            <div className="routes-list">
              {savedRoutes.map((route) => (
                <div
                  key={route._id}
                  className="route-item"
                  onClick={() => handleLoadClick(route)}
                  title="Load this route"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLoadClick(route); }}
                >
                  {route.route_image && (
                    <div className="route-image">
                      <img src={route.route_image} alt="Route Preview" loading="lazy" />
                    </div>
                  )}
                  <div className="route-details">
                    <div className="route-points">
                      <div className="route-origin">{route.origin?.place_name || 'Unknown Origin'}</div>
                      <div className="route-destination">{route.destination?.place_name || 'Unknown Destination'}</div>
                    </div>
                    <div className="route-meta">
                      <span className="route-type">
                        {getRouteTypeIcon(route.route_type)}
                        {route.route_type?.replace('_', ' ') || 'Route'}
                      </span>
                      <span className="route-date">{formatDate(route.created_at)}</span>
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

SavedRoutesPanel.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onLoadRoute: PropTypes.func.isRequired,
  // Map interaction
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onTouchStart: PropTypes.func,
  onTouchEnd: PropTypes.func,
};

export default SavedRoutesPanel;