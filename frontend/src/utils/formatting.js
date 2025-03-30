/**
 * Utility functions for formatting data for display.
 */

/**
 * Formats distance in meters to a human-readable string (km or m).
 * @param {number | undefined | null} distanceInMeters - Distance in meters.
 * @returns {string} Formatted distance string or 'N/A'.
 */
export const formatDistance = (distanceInMeters) => {
    if (typeof distanceInMeters !== 'number' || isNaN(distanceInMeters)) return 'N/A';
    if (distanceInMeters < 0) return '0 m';
    const distanceInKm = distanceInMeters / 1000;
    if (distanceInKm < 1) return `${Math.round(distanceInMeters)} m`;
    if (distanceInKm < 10) return `${distanceInKm.toFixed(1)} km`;
    return `${Math.round(distanceInKm)} km`;
    };

    /**
     * Formats duration in seconds to a human-readable string (hours/minutes).
     * @param {number | undefined | null} durationInSeconds - Duration in seconds.
     * @returns {string} Formatted duration string or 'N/A'.
     */
    export const formatDuration = (durationInSeconds) => {
    if (typeof durationInSeconds !== 'number' || isNaN(durationInSeconds)) return 'N/A';
    if (durationInSeconds < 0) return '0 min';
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.round((durationInSeconds % 3600) / 60); // Round minutes
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
    };

    /**
     * Formats an ISO date string to a short date format (e.g., "Jan 1, 2024").
     * @param {string | undefined | null} dateString - ISO date string.
     * @returns {string} Formatted date string or 'Invalid date'.
     */
    export const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    try {
        return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
        });
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Invalid date';
    }
    };

    /**
     * Gets a suitable emoji icon for a route type.
     * @param {string} type - Route type ('fastest', 'cell_coverage', 'balanced').
     * @returns {string} Emoji icon.
     */
    export const getRouteTypeIcon = (type) => {
    const icons = {
        fastest: '⚡️',
        cell_coverage: '📱',
        balanced: '⚖️'
    };
    return icons[type] || '🚗'; // Default car icon
    };

    /**
     * Gets a suitable emoji icon for a direction maneuver type.
     * @param {string | number} type - Maneuver type (string name or GraphHopper sign number).
     * @returns {string} Emoji icon.
     */
    export const getDirectionIcon = (type) => {
    // Normalize type if it's a number (GraphHopper sign)
    const maneuverType = typeof type === 'number' ? signToManeuverType(type) : type?.toLowerCase() || '';

    const iconMap = {
        'straight': '⬆️', 'continue': '⬆️',
        'left': '⬅️', 'slight-left': '↖️', 'sharp-left': '↩️',
        'right': '➡️', 'slight-right': '↗️', 'sharp-right': '↪️',
        'uturn': '🔄', 'uturn-left': '🔄', 'uturn-right': '🔄',
        'arrive': '🏁', 'destination': '📍',
        'depart': '🚩', 'start': '🔵',
        'roundabout': '🔄', 'exit-roundabout': '⤴️',
        'keep-left': '↖️', 'keep-right': '↗️',
        'merge': '↔️', 'fork': '↔️', 'via': ' V ', // Add more as needed
    };
    return iconMap[maneuverType] || '•'; // Default dot
    };

    // Helper to map GraphHopper sign codes to descriptive maneuver types (used by getDirectionIcon)
    const signToManeuverType = (sign) => {
        const map = {
            '-98': 'uturn', '-8': 'uturn-left', '-7': 'keep-left', '-6': 'exit-roundabout',
            '-3': 'sharp-left', '-2': 'left', '-1': 'slight-left', '0': 'straight',
            '1': 'slight-right', '2': 'right', '3': 'sharp-right', '4': 'destination',
            '5': 'via', '6': 'roundabout', '7': 'keep-right', '8': 'uturn-right'
        };
        return map[sign] || 'straight'; // Default to straight
    };