import React from 'react';
import PropTypes from 'prop-types';
import './InfoModal.css';
import { closeIconUrl } from '../../assets/icons/index.js';

/**
 * InfoModal Component
 * 
 * Displays application help information based on the CellWay User Manual
 */
const InfoModal = ({ onClose }) => {
  return (
    <div className="info-modal-overlay" onClick={onClose}>
      <div className="info-modal-container" onClick={(event) => event.stopPropagation()}>
        
        {/* --- Modal Header --- */}
        <div className="info-modal-header">
          <h2>About</h2>
          <button className="info-close-button" onClick={onClose} title="Close" aria-label="Close">
            <img src={closeIconUrl} alt="Close" className="icon-img small" />
          </button>
        </div>

        {/* --- Modal Content --- */}
        <div className="info-modal-content">
          <div className="info-section">
            <h3>Introduction</h3>
            <p>CellWay is a web-based route planning tool that helps you find the best path between two locations. Beyond just finding the fastest route, CellWay can also estimate routes with potentially better <strong>cell signal strength</strong> or a <strong>balance</strong> between speed and signal quality. You can visualize cell towers, view step-by-step directions, and even save your favorite routes if you create an account.</p>
          </div>

          <div className="info-section">
            <h3>Main Interface</h3>
            <p>CellWay's interface includes:</p>
            <ul>
              <li><strong>Map Area:</strong> The main part of the screen displays an interactive map (using Leaflet).</li>
              <li><strong>Search Panel:</strong> Typically visible at the top center, this is where you enter your start (Origin) and end (Destination) points.</li>
              <li><strong>Map Controls:</strong> Buttons usually located on the bottom right for interacting with the map (Locate Me, Toggle Towers, Change Route Type).</li>
              <li><strong>Authentication Buttons:</strong> Located usually on the bottom left, allowing you to Log In, Register, or access Saved Routes/Logout if logged in.</li>
            </ul>
          </div>

          <div className="info-section">
            <h3>Finding a Route</h3>
            <ol>
              <li>Open the Search Panel if not visible</li>
              <li>Enter your starting point in the "Origin" field</li>
              <li>Select an origin suggestion from the dropdown</li>
              <li>Enter your destination in the "Destination" field</li>
              <li>Select a destination suggestion from the dropdown</li>
              <li>CellWay will automatically calculate route options</li>
            </ol>
            <p><strong>Tips:</strong> Clear inputs using the '×' button. Use "Locate Me" (📍) to set your current location as Origin.</p>
          </div>

          <div className="info-section">
            <h3>Route Types</h3>
            <ul>
              <li><strong>⚡️ Fastest:</strong> Prioritizes shortest travel time (Blue)</li>
              <li><strong>📱 Cell Coverage:</strong> Maximizes estimated cell signal strength (Green)</li>
              <li><strong>⚖️ Balanced:</strong> Compromises between travel time and signal quality (Yellow/Orange)</li>
            </ul>
            <p>Routes can be changed using the Route Type button in Map Controls.</p>
          </div>

          <div className="info-section">
            <h3>Viewing Directions</h3>
            <p>Once a route is displayed, the Directions Panel shows:</p>
            <ul>
              <li>Distance, Time, Ascent and Descent summary</li>
              <li>Step-by-step instructions with maneuver icons</li>
              <li>Interactive steps that highlight route segments on the map</li>
            </ul>
          </div>

          <div className="info-section">
            <h3>Cell Towers</h3>
            <p>Toggle visibility using the Cell Tower button (📡) in Map Controls.</p>
            <ul>
              <li>Towers are color-coded by signal strength (Green=Strong, Yellow=Medium, Red=Weak)</li>
              <li>Click on towers for detailed information</li>
            </ul>
          </div>

          <div className="info-section">
            <h3>User Accounts</h3>
            <p>Creating an account allows you to save and reload routes.</p>
            <ul>
              <li>Register/Login using the User icon (👤)</li>
              <li>Save routes using the Save icon (💾) in the Directions Panel</li>
              <li>Access saved routes through "My Routes"</li>
            </ul>
          </div>

          <div className="info-section">
            <h3>Troubleshooting</h3>
            <ul>
              <li>If route calculation fails, ensure both points are valid and accessible</li>
              <li>For location issues, check browser location permissions</li>
              <li>Toggle cell towers off if the map feels slow</li>
              <li>Check spam/junk folder for password reset emails</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

InfoModal.propTypes = {
  onClose: PropTypes.func.isRequired, // Handler to close the modal
};

export default InfoModal;
