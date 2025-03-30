import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import './SearchPanel.css';
import { searchIconUrl, closeIconUrl } from '../../assets/icons/index.js';

const SearchPanel = ({
  isVisible,
  onToggleSearch,
  originValue,
  destinationValue,
  originSuggestions,
  destinationSuggestions,
  showOriginSuggestions,
  showDestinationSuggestions,
  onInputChange, // (event, isOrigin) => void
  onInputFocus, // (isOrigin) => void
  onInputBlur, // (isOrigin) => void
  onSuggestionSelect, // (suggestion, isOrigin) => void
  onClearInput, // (isOrigin) => void
  // Optional props moved from App.jsx search section
  showCellTowers,
  onToggleCellTowers,
  allFetchedTowersCount,
  routesAreLoading,
  // Map interaction prevention
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
}) => {
  const suggestionClickedRef = useRef(false); // Internal ref to manage blur/click race

  const handleSuggestionClick = (suggestion, isOrigin) => {
    suggestionClickedRef.current = true; // Prevent blur hiding suggestions
    onSuggestionSelect(suggestion, isOrigin);
  };

  const handleBlur = (isOrigin) => {
    // Use a small delay to allow click event on suggestion to register
    setTimeout(() => {
      if (!suggestionClickedRef.current) {
        onInputBlur(isOrigin); // Call parent blur handler
      }
      suggestionClickedRef.current = false; // Reset click tracker
    }, 200);
  };

  const handleToggleTowersButton = () => {
    // console.log("[SearchPanel] handleToggleTowersButton: Toggling cell towers. Current showCellTowers:", showCellTowers);
    onToggleCellTowers();
  };

  return (
    <>
      {/* Top Center Search Toggle Button */}
      <div className="search-button-container">
        <button
          className="search-toggle-button" // Renamed class for clarity
          onClick={onToggleSearch}
          aria-label={isVisible ? "Close search" : "Open search"}
          title={isVisible ? "Close search panel" : "Open search panel"}
        >
          <img src={isVisible ? closeIconUrl : searchIconUrl} alt={isVisible ? "Close" : "Search"} className="icon-img" />
        </button>
      </div>

      {/* Search Panel Content */}
      {isVisible && (
        <div
          className="search-panel-container" // Renamed class
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="search-panel-content">
            <div className="search-panel-header"><span>Where to?</span></div>

            {/* Origin Input */}
            <div className="search-input-wrapper">
              <div className="input-group">
                <div className="input-container">
                  <input
                    type="text" placeholder="Origin" value={originValue}
                    onChange={(e) => onInputChange(e, true)}
                    onFocus={() => onInputFocus(true)}
                    onBlur={() => handleBlur(true)} // Use internal blur handler
                    aria-label="Route origin"
                  />
                  {originValue && <button className="clear-input" onClick={() => onClearInput(true)} title="Clear Origin">×</button>}
                  {showOriginSuggestions && originSuggestions.length > 0 && (
                    <div className="suggestions-dropdown origin-suggestions" onWheel={onMouseEnter}> {/* Prevent map scroll */}
                      {originSuggestions.map((s, i) =>
                        <div key={`${s.id || 'sug-org'}-${i}`}
                          className="suggestion-item"
                          // Use internal click handler
                          onClick={() => handleSuggestionClick(s, true)}
                          onMouseDown={e => e.preventDefault()} // Prevent input blur on click
                        >
                          {s.place_name}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Destination Input */}
            <div className="search-input-wrapper">
              <div className="input-group">
                <div className="input-container">
                  <input
                    type="text" placeholder="Destination" value={destinationValue}
                    onChange={(e) => onInputChange(e, false)}
                    onFocus={() => onInputFocus(false)}
                    onBlur={() => handleBlur(false)} // Use internal blur handler
                    aria-label="Route destination"
                  />
                  {destinationValue && <button className="clear-input" onClick={() => onClearInput(false)} title="Clear Destination">×</button>}
                  {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                    <div className="suggestions-dropdown destination-suggestions" onWheel={onMouseEnter}> {/* Prevent map scroll */}
                      {destinationSuggestions.map((s, i) =>
                        <div key={`${s.id || 'sug-dest'}-${i}`}
                          className="suggestion-item"
                          // Use internal click handler
                          onClick={() => handleSuggestionClick(s, false)}
                          onMouseDown={e => e.preventDefault()} // Prevent input blur on click
                        >
                          {s.place_name}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Optional: Cell Tower Toggle (can be moved to MapControls if preferred) */}
            {onToggleCellTowers && (
              <div className="cell-tower-toggle-section">
                <button
                  className={`toggle-button ${showCellTowers ? 'active' : ''}`}
                  onClick={handleToggleTowersButton}
                >
                  <span className="toggle-icon">📡</span>
                  <span className="toggle-label">{showCellTowers ? 'Show Cell Towers' : 'Hide Cell Towers'}</span>
                </button>
                <div className="tower-count-display">
                  {allFetchedTowersCount > 0
                    ? `${allFetchedTowersCount} towers in area`
                    : 'No tower data loaded'}
                </div>
              </div>
            )}

            {/* Optional: Loading Indicator */}
            {routesAreLoading && (
              <div className="search-loading-indicator">
                Calculating route...
              </div>
            )}

          </div> {/* End search-panel-content */}
        </div> // End search-panel-container
      )}
    </>
  );
};

SearchPanel.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onToggleSearch: PropTypes.func.isRequired,
  originValue: PropTypes.string.isRequired,
  destinationValue: PropTypes.string.isRequired,
  originSuggestions: PropTypes.array.isRequired,
  destinationSuggestions: PropTypes.array.isRequired,
  showOriginSuggestions: PropTypes.bool.isRequired,
  showDestinationSuggestions: PropTypes.bool.isRequired,
  onInputChange: PropTypes.func.isRequired,
  onInputFocus: PropTypes.func.isRequired,
  onInputBlur: PropTypes.func.isRequired,
  onSuggestionSelect: PropTypes.func.isRequired,
  onClearInput: PropTypes.func.isRequired,
  // Optional
  showCellTowers: PropTypes.bool,
  onToggleCellTowers: PropTypes.func,
  allFetchedTowersCount: PropTypes.number,
  routesAreLoading: PropTypes.bool,
  // Map interaction
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onTouchStart: PropTypes.func,
  onTouchEnd: PropTypes.func,
};

export default SearchPanel;