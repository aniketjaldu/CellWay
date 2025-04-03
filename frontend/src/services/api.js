/**
 * Centralized API Service Module
 * 
 * Configures an Axios instance for making requests to the backend API.
 * Includes request/response interceptors for global error handling and feedback.
 * Provides typed functions for interacting with specific API endpoints.
 */
import axios from 'axios';
import { toast } from 'react-hot-toast'; // Library for displaying notifications

// --- Axios Instance Creation ---
// Creates a pre-configured instance of Axios for all API calls.
const api = axios.create({
  // Base URL for all API requests. Reads from environment variable or uses a default.
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api',
  // Send cookies with requests (essential for session-based authentication).
  withCredentials: true,
  // Set a global timeout for requests (e.g., 30 seconds).
  timeout: 30000,
});


// --- Axios Response Interceptor ---
// Intercepts all responses globally to handle common error scenarios.
api.interceptors.response.use(
  // --- Success Handler ---
  // For successful responses (status code 2xx), simply return the response.
  (response) => response,

  // --- Error Handler ---
  // For error responses (status codes 3xx, 4xx, 5xx) or network errors.
  (error) => {
    const status = error.response?.status; // HTTP status code from the response
    const message = error.response?.data?.error || error.message; // Error message from backend or Axios error message
    const requestUrl = error.config?.url; // URL of the failed request

    // console.error(`API Error: Status ${status || 'Network Error'} on ${requestUrl} - ${message}`, error.config); // Log detailed error

    // --- Specific Status Code Handling ---
    if (status === 401) {
      // Unauthorized: User is not logged in or session expired.
      // Avoid showing toast for the initial session check ('/auth/user') as 401 is expected if not logged in.
      if (!requestUrl?.endsWith('/auth/user')) {
        // For other 401 errors, prompt user to log in (can be handled more gracefully with redirects in UI).
        toast.error("Authentication required. Please log in.", { id: 'auth-error-401' });
        // Consider triggering a global logout state update here.
      }
    } else if (status === 403) {
      // Forbidden: User is logged in but lacks permission for the action.
      toast.error("You don't have permission for this action.", { id: 'auth-error-403' });
    } else if (status === 500 || status === 503) {
      // Server Error (500 Internal Server Error, 503 Service Unavailable): Backend issue.
      toast.error("A server error occurred. Please try again later or contact support.", { id: 'server-error-5xx' });
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      // Timeout Error: Request took too long.
      toast.error("The request timed out. Please check your connection and try again.", { id: 'timeout-error' });
    }
    // --- Default Handling ---
    // For other errors (e.g., 400 Bad Request, 404 Not Found, 409 Conflict),
    // we often want the specific component making the call to handle the error message
    // (e.g., showing validation errors next to a form field).
    // The interceptor logs the error, but doesn't show a generic toast for these cases by default.

    // IMPORTANT: Reject the promise to ensure the error propagates
    // to the .catch() block of the original API call in the component/hook.
    return Promise.reject(error);
  }
);

// --- Axios Response Interceptor ---
// Intercepts all responses globally to handle common error scenarios.
api.interceptors.response.use(
  // --- Success Handler ---
  // For successful responses (status code 2xx), simply return the response.
  (response) => response,

  // --- Error Handler ---
  // For error responses (status codes 3xx, 4xx, 5xx) or network errors.
  async (error) => {
    const status = error.response?.status; // HTTP status code from the response
    const message = error.response?.data?.error || error.message; // Error message from backend or Axios error message
    const requestUrl = error.config?.url; // URL of the failed request
    const originalRequest = error.config; // Original request configuration

    console.error(`API Error: Status ${status || 'Network Error'} on ${requestUrl} - ${message}`); // Log detailed error
    
    // --- Session Recovery Logic ---
    // Special handling for 401 errors to attempt session recovery
    if (status === 401 && !originalRequest._retry) {
      // Skip recovery on login-related endpoints as they inherently handle auth
      const isAuthEndpoint = requestUrl?.includes('/auth/login') || 
                           requestUrl?.includes('/auth/register') ||
                           requestUrl?.includes('/auth/logout');
      
      // Only try to recover for non-auth endpoints and not for session check
      if (!isAuthEndpoint && !requestUrl?.endsWith('/auth/user')) {
        try {
          // Mark request so we don't retry infinitely
          originalRequest._retry = true;
          
          // Check if we still have a valid session by calling session-check endpoint
          const sessionCheck = await api.get('/auth/session-check');
          
          if (sessionCheck.data?.session?.has_user_id) {
            // If we still have a user ID in session, retry the original request
            return api(originalRequest);
          } else {
            // Session truly expired, inform user
            toast.error("Your session has expired. Please log in again.", { id: 'session-expired' });
            // Could trigger a custom event here to redirect to login
            window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
          }
        } catch (recoveryError) {
          console.error("Session recovery failed:", recoveryError);
        }
      }
    }

    // --- Regular Error Handling ---
    if (status === 401) {
      // Unauthorized: User is not logged in or session expired.
      // Avoid showing toast for the initial session check ('/auth/user') as 401 is expected if not logged in.
      if (!requestUrl?.endsWith('/auth/user') && !originalRequest._retry) {
        // Only show for non-recovery attempts to avoid duplicate toasts
        toast.error("Authentication required. Please log in.", { id: 'auth-error-401' });
      }
    } else if (status === 403) {
      // Forbidden: User is logged in but lacks permission for the action.
      toast.error("You don't have permission for this action.", { id: 'auth-error-403' });
    } else if (status === 500 || status === 503) {
      // Server Error (500 Internal Server Error, 503 Service Unavailable): Backend issue.
      toast.error("A server error occurred. Please try again later or contact support.", { id: 'server-error-5xx' });
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      // Timeout Error: Request took too long.
      toast.error("The request timed out. Please check your connection and try again.", { id: 'timeout-error' });
    }

    // IMPORTANT: Reject the promise to ensure the error propagates
    // to the .catch() block of the original API call in the component/hook.
    return Promise.reject(error);
  }
);


// ==================================================
//               API Endpoint Functions
// ==================================================

// --- Authentication Endpoints ---

/**
 * Logs in a user.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const loginUser = (email, password) => api.post('/auth/login', { email, password });

/**
 * Registers a new user.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const registerUser = (email, password) => api.post('/auth/register', { email, password });

/**
 * Logs out the current user.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const logoutUser = () => api.post('/auth/logout');

/**
 * Checks if a user session is active on the backend.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const checkUserSession = () => api.get('/auth/user');

/**
 * Requests a password reset email for the given email address.
 * @param {string} email - User's email.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const forgotPasswordRequest = (email) => api.post('/auth/forgot-password', { email });

/**
 * Resets the user's password using a token.
 * @param {string} token - Password reset token from the email link.
 * @param {string} newPassword - The new password chosen by the user.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const resetPassword = (token, newPassword) => {
  console.log('Resetting password with API call to:', `${import.meta.env.VITE_API_BASE_URL}/auth/reset-password`);
  return api.post('/auth/reset-password', { token, newPassword });
};


// --- Routing Endpoints ---

/**
 * Fetches a calculated route based on start/end coordinates and optimization type.
 * @param {number} startLat - Starting latitude.
 * @param {number} startLng - Starting longitude.
 * @param {number} endLat - Ending latitude.
 * @param {number} endLng - Ending longitude.
 * @param {'fastest'|'cell_coverage'|'balanced'} routeType - The desired route optimization type.
 * @param {AbortSignal} [signal] - Optional AbortSignal to cancel the request.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const fetchRoute = (startLat, startLng, endLat, endLng, routeType, signal = undefined) => {
  return api.get('/routing/calculate', {
    params: {
      start_lat: startLat.toFixed(6), // Format coordinates
      start_lng: startLng.toFixed(6),
      end_lat: endLat.toFixed(6),
      end_lng: endLng.toFixed(6),
      route_type: routeType
    },
    signal // Pass the abort signal to Axios
  });
};

/**
 * Saves the currently calculated route details for the logged-in user.
 * @param {object} routeData - Object containing origin, destination, route_data (all computed types), active route_type, image, etc.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const saveRoute = (routeData) => api.post('/routing/save', routeData);

/**
 * Fetches the list of saved routes for the currently logged-in user.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const fetchSavedRoutes = () => api.get('/routing/saved');


// --- Geocoding Endpoints (Using Backend Proxy) ---

/**
 * Performs forward geocoding (address/place name to coordinates) via the backend proxy.
 * @param {string} query - The address or place name to search for.
 * @param {boolean} [autocomplete=true] - Whether to enable autocomplete suggestions.
 * @param {{lat: number, lng: number} | null} [proximity=null] - Coordinates to bias search results towards {lat, lng}.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const geocodeQuery = (query, autocomplete = true, proximity = null) => {
  const params = { query, autocomplete: String(autocomplete) }; // Ensure autocomplete is sent as string 'true'/'false'
  if (proximity && proximity.lng != null && proximity.lat != null) {
    // Backend expects longitude first for proximity parameter
    params.proximity_lng = proximity.lng;
    params.proximity_lat = proximity.lat;
  }
  // Calls the backend endpoint defined in geo_routes.py
  return api.get('/geo/geocode', { params });
};

/**
 * Performs reverse geocoding (coordinates to address/place name) via the backend proxy.
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const reverseGeocodeCoords = (lat, lng) => {
  // Calls the backend endpoint defined in geo_routes.py
  return api.get('/geo/reverse-geocode', { params: { lat, lng } });
};


// --- Cell Tower Endpoint ---

/**
 * Fetches cell tower data within a specified bounding box from the backend.
 * @param {number} minLat - Minimum latitude of the bounding box.
 * @param {number} minLng - Minimum longitude of the bounding box.
 * @param {number} maxLat - Maximum latitude of the bounding box.
 * @param {number} maxLng - Maximum longitude of the bounding box.
 * @returns {Promise<axios.AxiosResponse<any>>} Axios response promise.
 */
export const fetchTowers = (minLat, minLng, maxLat, maxLng) => {
  // console.log("[api.js] Fetching towers with bounds:", { minLat, minLng, maxLat, maxLng }); // Debug log
  return api.get('/towers', { // Ensure endpoint matches backend blueprint route
    params: {
      min_lat: minLat,
      min_lng: minLng,
      max_lat: maxLat,
      max_lng: maxLng
    }
  });
};

// --- Map API ---
/**
 * Fetches map configuration from the backend.
 * This includes API keys, initial view settings, and other map options.
 * 
 * @returns {Promise<Object>} Map configuration object
 */
export const getMapConfig = async () => {
  try {
    const response = await api.get('/map/config');
    return response.data;
  } catch (error) {
    console.error('Error fetching map configuration:', error);
    throw error;
  }
};

// --- Add Session Check Endpoint ---
/**
 * Checks session status for diagnostics.
 * @returns {Promise<axios.AxiosResponse<any>>} Session status information.
 */
export const checkSessionStatus = () => api.get('/auth/session-check');

// --- Default Export ---
// Export the configured Axios instance if it needs to be used directly elsewhere (e.g., for custom requests).
// However, it's generally better practice to use the exported endpoint functions.
// export default api