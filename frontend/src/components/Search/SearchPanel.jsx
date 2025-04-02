import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

import './SearchPanel.css';
import { searchIconUrl, closeIconUrl, infoIconUrl } from '../../assets/icons/index.js';
import InfoModal from '../Info/InfoModal';


/**
 * SearchPanel Component
 * 
 * Provides input fields for origin and destination search, displays autocomplete suggestions,
 * and includes an optional toggle for cell tower visibility. Appears below a toggle button.
 */
const SearchPanel = ({
  isVisible,
  onToggleSearch,
  originValue,
  destinationValue,
  originSuggestions,
  destinationSuggestions,
  showOriginSuggestions,
  showDestinationSuggestions,
  onInputChange,
  onInputFocus,
  onInputBlur,
  onSuggestionSelect,
  onClearInput,
  // Optional props for tower toggle
  showCellTowers,
  onToggleCellTowers,
  allFetchedTowersCount,
  // Loading state
  routesAreLoading,
  // Map interaction prevention props
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
}) => {
  const suggestionClickedRef = useRef(false); // Ref to manage blur/click race condition for suggestions
  const [showInfoModal, setShowInfoModal] = useState(false); // State to control info modal visibility


  // --- Event Handlers ---
  const handleSuggestionClick = (suggestion, isOrigin) => {
    suggestionClickedRef.current = true; // Flag that a suggestion was clicked
    onSuggestionSelect(suggestion, isOrigin); // Call parent handler to select the suggestion
  };

  const handleBlur = (isOrigin) => {
    // Delay blur handling slightly to allow suggestion click event to register first
    setTimeout(() => {
      if (!suggestionClickedRef.current) {
        onInputBlur(isOrigin); // Call parent blur handler if suggestion wasn't clicked
      }
      suggestionClickedRef.current = false; // Reset the flag after the timeout
    }, 200); // Small delay (adjust if needed)
  };

  const handleToggleTowersButton = () => {
    // console.log("[SearchPanel] Toggling cell towers. Current showCellTowers:", showCellTowers); // Debug log
    onToggleCellTowers(); // Call parent handler to toggle tower visibility
  };

  const handleToggleInfoModal = () => {
    setShowInfoModal(!showInfoModal); // Toggle the info modal visibility
  };


  // --- Render Component ---
  return (
    <>
      {/* --- Search Toggle Button (Top Center) --- */}
      <div className="search-button-container">
        <button
          className="search-toggle-button"
          onClick={onToggleSearch} // Toggle panel visibility on click
          aria-label={isVisible ? "Close search panel" : "Open search panel"} // Accessibility label
          title={isVisible ? "Close search panel" : "Open search panel"} // Tooltip text
        >
          <img src={isVisible ? closeIconUrl : searchIconUrl} alt={isVisible ? "Close" : "Search"} className="icon-img" /> {/* Dynamic icon */}
        </button>
      </div>


      {/* --- Search Panel (Conditionally Rendered) --- */}
      {isVisible && (
        <div className="search-panel-container"
          // Pass through map interaction prevention handlers
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="search-panel-content">
            {/* --- Panel Header --- */}
            <div className="search-panel-header">
              <span>Where to?</span> {/* Panel Title */}
              <button 
                className="info-button" 
                onClick={handleToggleInfoModal} 
                aria-label="Help information" 
                title="Learn how to use CellWay"
              >
                <img src={infoIconUrl} alt="Info" className="icon-img small" />
              </button>
            </div>


            {/* --- Origin Input --- */}
            <div className="search-input-wrapper">
              <div className="input-group">
                <div className="input-container"> {/* Container for input and suggestions */}
                  <input
                    type="text"
                    placeholder="Enter origin address or place"
                    value={originValue}
                    onChange={(e) => onInputChange(e, true)} // Handle input change
                    onFocus={() => onInputFocus(true)} // Handle input focus
                    onBlur={() => handleBlur(true)} // Handle input blur (with delay)
                    aria-label="Route origin"
                  />
                  {/* --- Clear Input Button --- */}
                  {originValue && (
                    <button className="clear-input" onClick={() => onClearInput(true)} title="Clear Origin">×</button>
                  )}
                  {/* --- Origin Suggestions Dropdown --- */}
                  {showOriginSuggestions && originSuggestions.length > 0 && (
                    <div className="suggestions-dropdown origin-suggestions" onWheel={onMouseEnter}> {/* Prevent map scroll on wheel */}
                      {originSuggestions.map((suggestion, index) =>
                        <div
                          key={`${suggestion.id || 'sug-org'}-${index}`} // Unique key for suggestion
                          className="suggestion-item"
                          onClick={() => handleSuggestionClick(suggestion, true)} // Handle suggestion selection
                          onMouseDown={e => e.preventDefault()} // Prevent input blur when clicking suggestion
                        >
                          {suggestion.place_name} {/* Display suggestion text */}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>


            {/* --- Destination Input --- */}
            <div className="search-input-wrapper">
              <div className="input-group">
                <div className="input-container"> {/* Container for input and suggestions */}
                  <input
                    type="text"
                    placeholder="Enter destination address or place"
                    value={destinationValue}
                    onChange={(e) => onInputChange(e, false)} // Handle input change
                    onFocus={() => onInputFocus(false)} // Handle input focus
                    onBlur={() => handleBlur(false)} // Handle input blur (with delay)
                    aria-label="Route destination"
                  />
                  {/* --- Clear Input Button --- */}
                  {destinationValue && (
                    <button className="clear-input" onClick={() => onClearInput(false)} title="Clear Destination">×</button>
                  )}
                  {/* --- Destination Suggestions Dropdown --- */}
                  {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                    <div className="suggestions-dropdown destination-suggestions" onWheel={onMouseEnter}> {/* Prevent map scroll on wheel */}
                      {destinationSuggestions.map((suggestion, index) =>
                        <div
                          key={`${suggestion.id || 'sug-dest'}-${index}`} // Unique key for suggestion
                          className="suggestion-item"
                          onClick={() => handleSuggestionClick(suggestion, false)} // Handle suggestion selection
                          onMouseDown={e => e.preventDefault()} // Prevent input blur when clicking suggestion
                        >
                          {suggestion.place_name} {/* Display suggestion text */}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>


            {/* --- Optional: Cell Tower Toggle Section --- */}
            {onToggleCellTowers && ( // Conditionally render if toggle handler is provided
              <div className="cell-tower-toggle-section">
                <button
                  className={`toggle-button ${showCellTowers ? 'active' : ''}`} // Apply active class based on state
                  onClick={handleToggleTowersButton} // Toggle tower visibility on click
                >
                  <span className="toggle-icon">📡</span> {/* Antenna icon */}
                  <span className="toggle-label">{showCellTowers ? 'Hide Cell Towers' : 'Show Cell Towers'}</span> {/* Dynamic label */}
                </button>
                <div className="tower-count-display"> {/* Display tower count or status */}
                  {allFetchedTowersCount > 0
                    ? `${allFetchedTowersCount} towers in area`
                    : 'No tower data loaded'}
                </div>
              </div>
            )}


            {/* --- Optional: Loading Indicator --- */}
            {routesAreLoading && ( // Conditionally render loading indicator
              <div className="search-loading-indicator">
                Calculating route... {/* Loading message */}
              </div>
            )}

          </div> {/* End .search-panel-content */}
        </div>
      )}

      {/* --- Info Modal (Conditionally Rendered) --- */}
      {showInfoModal && <InfoModal onClose={() => setShowInfoModal(false)} />}
    </>
  );
};


// --- Prop Type Definitions ---
SearchPanel.propTypes = {
  isVisible: PropTypes.bool.isRequired,              // Is the search panel currently visible? (boolean)
  onToggleSearch: PropTypes.func.isRequired,         // Handler function to toggle panel visibility (function)
  originValue: PropTypes.string.isRequired,          // Current value of the origin input (string)
  destinationValue: PropTypes.string.isRequired,     // Current value of the destination input (string)
  originSuggestions: PropTypes.array.isRequired,     // Array of suggestion objects for origin (array)
  destinationSuggestions: PropTypes.array.isRequired, // Array of suggestion objects for destination (array)
  showOriginSuggestions: PropTypes.bool.isRequired,  // Should origin suggestions be shown? (boolean)
  showDestinationSuggestions: PropTypes.bool.isRequired, // Should destination suggestions be shown? (boolean)
  onInputChange: PropTypes.func.isRequired,          // Handler for input field changes (function)
  onInputFocus: PropTypes.func.isRequired,           // Handler for input field focus (function)
  onInputBlur: PropTypes.func.isRequired,            // Handler for input field blur (function)
  onSuggestionSelect: PropTypes.func.isRequired,     // Handler when a suggestion is selected (function)
  onClearInput: PropTypes.func.isRequired,           // Handler to clear an input field (function)
  // Optional props for tower toggle
  showCellTowers: PropTypes.bool,                    // Are cell towers currently shown? (boolean, optional)
  onToggleCellTowers: PropTypes.func,                // Handler to toggle cell tower visibility (function, optional)
  allFetchedTowersCount: PropTypes.number,           // Count of towers fetched in the area (number, optional)
  // Loading state
  routesAreLoading: PropTypes.bool,                  // Is route calculation in progress? (boolean, optional)
  // Map interaction prevention handlers (optional)
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onTouchStart: PropTypes.func,
  onTouchEnd: PropTypes.func,
};


// --- Export Component ---
export default SearchPanel;