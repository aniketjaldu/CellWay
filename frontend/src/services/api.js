/**
 * Centralized API service for interacting with the backend.
 */
import axios from 'axios';
import { toast } from 'react-hot-toast'; // Use toast for feedback

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api', // Use env var or default
  withCredentials: true, // Send cookies
  timeout: 30000, // Set a reasonable timeout (e.g., 30 seconds)
});

// --- Interceptors (Optional but Recommended) ---
api.interceptors.response.use(
  (response) => response, // Simply return successful responses
  (error) => {
    // Handle common errors globally
    const status = error.response?.status;
    const message = error.response?.data?.error || error.message;

    console.error(`API Error: ${status || 'Network Error'} - ${message}`, error.config);

    if (status === 401) {
      // Unauthorized - potentially redirect to login or show specific message
      // Avoid toast for 401 on /api/auth/user check, as it's expected
      if (!error.config.url.endsWith('/auth/user')) {
         toast.error("Authentication required. Please log in.", { id: 'auth-error' });
      }
      // Optionally trigger logout state change here if using a state manager
    } else if (status === 403) {
      // Forbidden
      toast.error("You don't have permission to perform this action.", { id: 'forbidden-error' });
    } else if (status === 500 || status === 503) {
      // Server errors
      toast.error("Server error occurred. Please try again later.", { id: 'server-error' });
    } else if (error.code === 'ECONNABORTED') {
         toast.error("Request timed out. Please check your connection or try again.", { id: 'timeout-error' });
    }
    // Don't toast for 400/404/409 etc. by default, let calling function handle specific user errors

    // IMPORTANT: Reject the promise so the calling function's .catch() still triggers
    return Promise.reject(error);
  }
);


// --- Auth Endpoints ---
export const loginUser = (email, password) => api.post('/auth/login', { email, password });
export const registerUser = (email, password) => api.post('/auth/register', { email, password });
export const logoutUser = () => api.post('/auth/logout');
export const checkUserSession = () => api.get('/auth/user'); // Renamed for clarity
export const forgotPasswordRequest = (email) => api.post('/auth/forgot-password', { email });

// --- Routing Endpoints ---
/**
 * Fetches a route based on coordinates and type.
 * @param {number} startLat
 * @param {number} startLng
 * @param {number} endLat
 * @param {number} endLng
 * @param {'fastest'|'cell_coverage'|'balanced'} routeType
 * @returns {Promise<AxiosResponse<any>>} Axios response promise
 */
export const fetchRoute = (startLat, startLng, endLat, endLng, routeType) => {
  return api.get('/routing/calculate', {
    params: {
      start_lat: startLat.toFixed(6),
      start_lng: startLng.toFixed(6),
      end_lat: endLat.toFixed(6),
      end_lng: endLng.toFixed(6),
      route_type: routeType
    }
  });
};

/**
 * Saves a route for the logged-in user.
 * @param {object} routeData - Object containing origin, destination, route_data, route_type, etc.
 * @returns {Promise<AxiosResponse<any>>} Axios response promise
 */
export const saveRoute = (routeData) => api.post('/routing/save', routeData);

/**
 * Fetches saved routes for the logged-in user.
 * @returns {Promise<AxiosResponse<any>>} Axios response promise
 */
export const fetchSavedRoutes = () => api.get('/routing/saved');

// --- Geocoding Endpoints (Using Backend Proxy) ---
// Note: Frontend currently uses MapTiler directly. These are if you want to proxy via backend.
// export const geocodeAddress = (query, autocomplete = false, proximity = null) => {
//   const params = { query, autocomplete };
//   if (proximity) {
//     params.proximity_lng = proximity[0];
//     params.proximity_lat = proximity[1];
//   }
//   return api.get('/geo/geocode', { params });
// };
// export const reverseGeocodeCoords = (lat, lng) => api.get('/geo/reverse-geocode', { params: { lat, lng } });

// --- Cell Tower Endpoint ---
/**
 * Fetches cell towers within a bounding box.
 * @param {number} minLat
 * @param {number} minLng
 * @param {number} maxLat
 * @param {number} maxLng
 * @returns {Promise<AxiosResponse<any>>} Axios response promise
 */
export const fetchTowers = (minLat, minLng, maxLat, maxLng) => {
  // console.log("[api.js] fetchTowers called with:", { minLat, minLng, maxLat, maxLng });
  return api.get('/towers', { // Note the trailing slash matches blueprint route
    params: {
      min_lat: minLat,
      min_lng: minLng,
      max_lat: maxLat,
      max_lng: maxLng
    }
  });
};

export default api; // Export the configured instance if needed elsewhere