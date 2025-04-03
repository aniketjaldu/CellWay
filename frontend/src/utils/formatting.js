/**
 * Utility Functions for Data Formatting
 * 
 * This module provides helper functions to format various data types
 * (distance, duration, dates, types) into human-readable strings or icons
 * suitable for display in the UI.
 */

// ==================================================
//               Distance Formatting
// ==================================================

/**
 * Formats distance in meters to a human-readable string (e.g., "1.2 km", "500 m").
 * 
 * @param {number | undefined | null} distanceInMeters - The distance value in meters.
 * @returns {string} A formatted distance string (e.g., "1.2 km", "500 m") or 'N/A' if input is invalid.
 */
export const formatDistance = (distanceInMeters) => {
    // --- Input Validation ---
    if (typeof distanceInMeters !== 'number' || isNaN(distanceInMeters)) {
      return 'N/A'; // Return 'Not Available' for invalid input
    }
    if (distanceInMeters < 0) {
      return '0 m'; // Handle negative distances as 0
    }
  
    // --- Formatting Logic ---
    const distanceInKm = distanceInMeters / 1000; // Convert to kilometers
  
    if (distanceInKm < 1) {
      // If less than 1 km, display in meters (rounded)
      return `${Math.round(distanceInMeters)} m`;
    } else if (distanceInKm < 10) {
      // If between 1 km and 10 km, display with one decimal place
      return `${distanceInKm.toFixed(1)} km`;
    } else {
      // If 10 km or more, display as rounded kilometers
      return `${Math.round(distanceInKm)} km`;
    }
  };
  
  
  // ==================================================
  //               Duration Formatting
  // ==================================================
  
  /**
   * Formats duration in seconds to a human-readable string (e.g., "1h 15m", "25 min").
   * 
   * @param {number | undefined | null} durationInSeconds - The duration value in seconds.
   * @returns {string} A formatted duration string (e.g., "1h 15m", "25 min") or 'N/A' if input is invalid.
   */
  export const formatDuration = (durationInSeconds) => {
    // --- Input Validation ---
    if (typeof durationInSeconds !== 'number' || isNaN(durationInSeconds)) {
      return 'N/A'; // Return 'Not Available' for invalid input
    }
    if (durationInSeconds < 0) {
      return '0 min'; // Handle negative durations as 0 minutes
    }
  
    // --- Formatting Logic ---
    const hours = Math.floor(durationInSeconds / 3600); // Calculate full hours
    const minutes = Math.round((durationInSeconds % 3600) / 60); // Calculate remaining minutes (rounded)
  
    if (hours > 0) {
      // If duration is one hour or more, display hours and minutes
      return `${hours}h ${minutes}m`;
    } else {
      // If duration is less than one hour, display only minutes
      return `${minutes} min`;
    }
  };
  
  
  // ==================================================
  //               Date Formatting
  // ==================================================
  
  /**
   * Formats an ISO date string or Date object to a short, locale-aware date format (e.g., "Jan 1, 2024").
   * 
   * @param {string | Date | undefined | null} dateInput - The date string (ISO format recommended) or Date object.
   * @returns {string} A formatted date string (e.g., "Jan 1, 2024") or 'Unknown date' / 'Invalid date' on error.
   */
  export const formatDate = (dateInput) => {
    // --- Input Validation ---
    if (!dateInput) {
      return 'Unknown date'; // Handle null or undefined input
    }
  
    // --- Formatting Logic ---
    try {
      const dateObject = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      // Check if the created date object is valid
      if (isNaN(dateObject.getTime())) {
        throw new Error("Invalid Date object created from input.");
      }
      // Format using locale-aware options
      return dateObject.toLocaleDateString(undefined, { // 'undefined' uses the browser's default locale
        year: 'numeric',
        month: 'short', // e.g., "Jan", "Feb"
        day: 'numeric',
      });
    } catch (error) {
      console.error("Error formatting date:", dateInput, error); // Log formatting errors
      return 'Invalid date'; // Return error string
    }
  };
  
  
  // ==================================================
  //               Route Type Icon Mapping
  // ==================================================
  
  /**
   * Returns an appropriate emoji icon based on the route optimization type.
   * 
   * @param {string | undefined | null} type - The route type identifier ('fastest', 'cell_coverage', 'balanced').
   * @returns {string} An emoji icon representing the route type, or a default car icon.
   */
  export const getRouteTypeIcon = (type) => {
    const icons = {
      fastest: '⚡️',       // Lightning bolt for fastest
      cell_coverage: '📱', // Antenna bars for cell coverage (alternative: 📶)
      balanced: '⚖️',       // Scales for balanced
    };
    return icons[type?.toLowerCase()] || '🚗'; // Return mapped icon or default car icon
  };
  
  
  // ==================================================
  //               Direction Icon Mapping
  // ==================================================
  
  /**
   * Returns an appropriate emoji icon based on a direction maneuver type or sign code.
   * 
   * @param {string | number | undefined | null} type - The maneuver type identifier (string name or GraphHopper sign number).
   * @returns {string} An emoji icon representing the maneuver, or a default dot icon.
   */
  export const getDirectionIcon = (type) => {
    // Normalize the input type (convert number signs to string types)
    const maneuverType = typeof type === 'number' ? _signToManeuverType(type) : String(type || '').toLowerCase();
  
    // Mapping from maneuver type strings to emoji icons
    const iconMap = {
      'straight': '⬆️',
      'continue': '⬆️',
      'left': '⬅️',
      'slight-left': '↖️',
      'sharp-left': '↩️',
      'right': '➡️',
      'slight-right': '↗️',
      'sharp-right': '↪️',
      'uturn': '🔄',
      'uturn-left': '🔄', // Group U-turns
      'uturn-right': '🔄',
      'arrive': '🏁', // Finish flag for arrive
      'destination': '📍', // Pin for destination step
      'depart': '🚩', // Flag for depart
      'start': '🔵', // Blue circle for start
      'roundabout': '🔄', // Generic roundabout
      'exit-roundabout': '⤴️', // Exit roundabout
      'keep-left': '↖️',
      'keep-right': '↗️',
      'merge': '↔️', // Simple merge/fork icon
      'fork': '↔️',
      'via': ' V ', // Simple 'V' for via points
      // Add more mappings as needed based on routing provider specifics
    };
    return iconMap[maneuverType] || '•'; // Return mapped icon or default bullet point icon
  };
  
  
  // --- Internal Helper: Sign to Maneuver Type ---
  // Converts GraphHopper numerical sign codes into descriptive string types.
  const _signToManeuverType = (sign) => {
    const map = {
      '-98': 'uturn',
      '-8': 'uturn-left',
      '-7': 'keep-left',
      '-6': 'exit-roundabout',
      '-3': 'sharp-left',
      '-2': 'left',
      '-1': 'slight-left',
      '0': 'straight',
      '1': 'slight-right',
      '2': 'right',
      '3': 'sharp-right',
      '4': 'destination', // Note: GraphHopper uses sign 4 for destination arrival
      '5': 'via',
      '6': 'roundabout',
      '7': 'keep-right',
      '8': 'uturn-right',
    };
    return map[String(sign)] || 'straight'; // Default to 'straight' if sign code is unknown
  };