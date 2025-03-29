import { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import SearchIcon from './assets/svg/search-icon.svg';
import CloseIcon from './assets/svg/close-icon.svg';
import UserIcon from './assets/svg/user-icon.svg';
import LoginIcon from './assets/svg/login-icon.svg';
import RegisterIcon from './assets/svg/register-icon.svg';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import html2canvas from 'html2canvas';

// Create axios instance with credentials support
const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  withCredentials: true,
});

function App() {
  // --- Refs for Functions (to prevent stale closures/dependency issues) ---
  const checkAuthRef = useRef(null);
  const fetchSavedRoutesRef = useRef(null);
  const handleLoginRef = useRef(null);
  const handleRegisterRef = useRef(null);
  const handleLogoutRef = useRef(null);
  const toggleAuthFormRef = useRef(null);
  const toggleSavedRoutesRef = useRef(null);
  const loadSavedRouteRef = useRef(null);
  const toggleSearchRef = useRef(null);
  const updateMarkerRef = useRef(null);
  const fetchCellTowersRef = useRef(null);
  const handleInputChangeRef = useRef(null);
  const handleInputFocusRef = useRef(null);
  const handleInputBlurRef = useRef(null);
  const handleSuggestionSelectRef = useRef(null);
  const updateMapViewRef = useRef(null);
  const calculateRouteRef = useRef(null); // Ref for single route type calculation API call
  const formatDistanceRef = useRef(null);
  const formatDurationRef = useRef(null);
  const calculateSignalScoreRef = useRef(null);
  const findTowersAlongRouteRef = useRef(null); // Frontend function to filter towers
  const extractDirectionsRef = useRef(null);
  const displayRouteRef = useRef(null);
  const displayTowersRef = useRef(null); // Ref for the main tower display logic
  const toggleCellTowersRef = useRef(null);
  const calculateAllRouteTypesRef = useRef(null); // Ref for orchestrating all route calcs
  const hasValidRoutePointsRef = useRef(null);
  const getRouteTypeIconRef = useRef(null);
  const getDirectionIconRef = useRef(null);
  const highlightRouteSegmentRef = useRef(null);
  const clearActiveStepMarkerRef = useRef(null); // Ref for clearing step marker
  const formatDateRef = useRef(null);
  const toggleDirectionsRef = useRef(null);
  const clearRouteDisplayRef = useRef(null);
  const getRouteLineColorRef = useRef(null);
  const handleClearInputRef = useRef(null);
  const handleLocateRef = useRef(null);
  const preventMapInteractionRef = useRef(null); // Ref for map interaction prevention
  const saveCurrentRouteRef = useRef(null); // Ref for saving route
  const handleForgotPasswordRef = useRef(null); // Ref for forgot password functionality

  // Map and Layer references
  const mapRef = useRef(null); // DOM element for map container
  const [map, setMap] = useState(null); // Leaflet map instance
  const routeControlRef = useRef(null); // Stores the L.polyline route layer
  const cellTowerLayerRef = useRef(null); // Stores the L.layerGroup for displayed towers
  const [originMarker, setOriginMarker] = useState(null);
  const [destinationMarker, setDestinationMarker] = useState(null);
  const [activeStepMarker, setActiveStepMarker] = useState(null); // Marker/layer for highlighted direction step

  // Search state
  const [searchExpanded, setSearchExpanded] = useState(true);
  const [originValue, setOriginValue] = useState('');
  const [destinationValue, setDestinationValue] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const suggestionClickedRef = useRef(false); // Prevent blur hiding suggestions on click

  // Routing state
  const [routeType, setRouteType] = useState('fastest'); // 'fastest', 'cell_coverage', 'balanced'
  const [currentRoutePoints, setCurrentRoutePoints] = useState({ start: null, end: null }); // { lat, lng } for start/end
  const [routeInfo, setRouteInfo] = useState(null); // { distance, duration, signalQuality, towerCount, routeType }
  const [routesAreLoading, setRoutesAreLoading] = useState(false); // Master loading flag
  const [allRoutesComputed, setAllRoutesComputed] = useState(false); // Flag: all types calculated?
  const [computedRoutes, setComputedRoutes] = useState({ // Stores the data for each route type
    fastest: null,
    cell_coverage: null,
    balanced: null,
  });
  // Store cell towers returned *with* the route from backend (less critical if frontend filtering is primary)
  const [computedRouteTowers, setComputedRouteTowers] = useState({
    fastest: [],
    cell_coverage: [],
    balanced: []
  });

  // Directions state
  const [showDirections, setShowDirections] = useState(false);
  const [routeDirections, setRouteDirections] = useState(null); // Parsed directions object
  const [isDirectionsMinimized, setIsDirectionsMinimized] = useState(false);
  const [activeDirectionStep, setActiveDirectionStep] = useState(null); // Index of highlighted step
  const directionsContentRef = useRef(null); // Ref for directions scrollable content
  const [routeOriginDisplay, setRouteOriginDisplay] = useState(''); // Name for the displayed route origin
  const [routeDestinationDisplay, setRouteDestinationDisplay] = useState(''); // Name for the displayed route destination

  // Cell Tower state
  const allTowers = useRef([]); // Master list of towers fetched for the current area
  const [routeTowers, setRouteTowers] = useState([]); // Towers specifically filtered for the *current* displayed route
  const [showCellTowers, setShowCellTowers] = useState(false); // Toggle visibility

  // Authentication state
  const [user, setUser] = useState(null); // { id: ... } or null
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', or 'forgot_password'
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');       // Auth forms
  const [password, setPassword] = useState(''); // Auth forms
  const [confirmPassword, setConfirmPassword] = useState(''); // For register form
  const [showPassword, setShowPassword] = useState(false); // For password visibility toggle
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // For confirm password visibility toggle
  const [passwordFocused, setPasswordFocused] = useState(false); // Track if password field is focused
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false); // Track if confirm password field is focused
  const [showAuthMenu, setShowAuthMenu] = useState(false); // State for auth menu popup

  // Saved Routes state
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);

  // UI state
  const [showRouteTypeSelection, setShowRouteTypeSelection] = useState(false);
  const [skipRouteTypeSelection, setSkipRouteTypeSelection] = useState(false); // Preference
  const [isLocating, setIsLocating] = useState(false); // Geolocation loading state

  // API key from environment variables
  const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY;

  // --- Function Definitions and Assignments to Refs ---

  // Load route preferences on initial mount
  useEffect(() => {
    console.log("Loading route preferences...");
    const savedRouteType = localStorage.getItem('preferredRouteType');
    const savedSkipSelection = localStorage.getItem('skipRouteTypeSelection');
    if (savedRouteType && ['fastest', 'cell_coverage', 'balanced'].includes(savedRouteType)) {
      setRouteType(savedRouteType);
    }
    setSkipRouteTypeSelection(savedSkipSelection === 'true');
  }, []);

  // Check authentication status on initial mount
  useEffect(() => {
    checkAuthRef.current?.();
  }, []);

  // Check if user is authenticated
  const checkAuth = async () => {
    try {
      const response = await api.get('/user');
      if (response.data?.user_id) {
        setUser({ id: response.data.user_id });
        // Fetch saved routes only if logged in
        fetchSavedRoutesRef.current?.();
      } else {
        setUser(null); // Ensure user is null if check fails
      }
    } catch (error) {
      // 401 error is expected if not logged in
      if (error.response?.status !== 401) {
        console.error('Error checking authentication status:', error);
      }
      setUser(null);
    }
  };
  checkAuthRef.current = checkAuth;

  // Fetch saved routes for the logged-in user
  const fetchSavedRoutes = async () => {
    if (!user) return; // Should only be called when user is set
    try {
      const response = await api.get('/saved-routes');
      setSavedRoutes(response.data || []);
    } catch (error) {
      console.error("Error fetching saved routes:", error);
      toast.error("Could not load saved routes.", { position: "bottom-center" });
      setSavedRoutes([]); // Clear on error
    }
  };
  fetchSavedRoutesRef.current = fetchSavedRoutes;

  // Handle user login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const response = await api.post('/login', { email, password });
      if (response.data?.success) {
        setUser(response.data.user); // Backend should return user info (without password)
        setShowAuthForm(false);
        fetchSavedRoutesRef.current?.(); // Fetch routes after login
        // Clear form fields
        setEmail('');
        setPassword('');
        toast.success('Logged in successfully!', { position: "bottom-center" });
      }
      // No explicit else needed, backend error handled in catch
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Login failed. Please try again.';
      setAuthError(errorMsg);
      console.error("Login error:", error);
    }
  };
  handleLoginRef.current = handleLogin;

  // Handle user registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    if (!email || !password || !confirmPassword) {
      setAuthError('All fields are required');
      return;
    }
    
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }
    
    try {
      const response = await api.post('/register', { email, password });
      if (response.data?.success) {
        setUser(response.data.user); // Backend returns user info
        setShowAuthForm(false);
        // Clear form fields
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        toast.success('Registration successful! You are now logged in.', { position: "bottom-center" });
        // No need to fetch saved routes immediately after registration
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Registration failed. Please try again.';
      setAuthError(errorMsg);
      console.error("Registration error:", error);
    }
  };
  handleRegisterRef.current = handleRegister;

  // Handle user logout
  const handleLogout = async () => {
    try {
      await api.post('/logout');
      setUser(null);
      setSavedRoutes([]); // Clear saved routes on logout
      setShowSavedRoutes(false); // Close panel if open
      toast.success('Logged out.', { position: "bottom-center" });
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Logout failed. Please try again.", { position: "bottom-center" });
    }
  };
  handleLogoutRef.current = handleLogout;

  // Toggle authentication form visibility
  const toggleAuthForm = () => {
    // If we're closing the form, clear all fields
    if (showAuthForm) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
    
    setShowAuthForm(prev => !prev);
    setAuthError(''); // Clear errors when toggling
    
    // Reset form fields if opening
    if (!showAuthForm) {
      setAuthMode('login');
    }
    
    // Always close the auth menu when toggling the form
    setShowAuthMenu(false);
    
    // Disable/enable map interactions based on form visibility
    if (!showAuthForm) {
      // Form is opening, disable map
      const cleanup = preventMapInteractionRef.current();
      // Store cleanup function to be called when form closes
      window.mapInteractionCleanup = cleanup;
    } else if (window.mapInteractionCleanup) {
      // Form is closing, re-enable map
      window.mapInteractionCleanup();
      window.mapInteractionCleanup = null;
    }
  };
  toggleAuthFormRef.current = toggleAuthForm;

  // Toggle saved routes panel visibility
  const toggleSavedRoutes = () => {
    setShowSavedRoutes(prev => {
      // If opening and user exists, fetch routes
      if (!prev && user) {
        fetchSavedRoutesRef.current?.();
      }
      
      // If closing, ensure map interactions are re-enabled
      if (prev && map) {
        // Re-enable map interactions
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        if (map.tap) map.tap.enable();
        
        // Remove the indicator class
        document.getElementById('map')?.classList.remove('map-interactions-disabled');
      }
      
      // Close search bar if it's open
      if (searchExpanded) {
        setSearchExpanded(false);
      }
      
      return !prev;
    });
  };
  toggleSavedRoutesRef.current = toggleSavedRoutes;

  // Load a selected saved route onto the map
  const loadSavedRoute = useCallback((route) => {
    console.log("Loading saved route:", route);
    
    // Check if map is ready and route has the necessary data
    if (!map) {
      console.error("Cannot load saved route: Map not ready");
      toast.error("Could not load the selected route. Map not ready.", { position: "bottom-center" });
      return;
    }
    
    if (!route || !route.origin || !route.destination) {
      console.error("Cannot load saved route: Route data incomplete", route);
      toast.error("Could not load the selected route. Data incomplete.", { position: "bottom-center" });
      return;
    }
    
    // Extract coordinates from the route object
    const originLat = route.origin.lat;
    const originLng = route.origin.lng;
    const destLat = route.destination.lat;
    const destLng = route.destination.lng;
    
    // Get place names or fallback to coordinates
    const originName = route.origin.place_name || `${originLat.toFixed(5)}, ${originLng.toFixed(5)}`;
    const destName = route.destination.place_name || `${destLat.toFixed(5)}, ${destLng.toFixed(5)}`;
    
    // Update UI
    setOriginValue(originName);
    setDestinationValue(destName);
    setOriginSuggestions([]); // Clear suggestions
    setDestinationSuggestions([]);
    
    // Update map markers
    const originLatLng = L.latLng(originLat, originLng);
    const destLatLng = L.latLng(destLat, destLng);
    updateMarkerRef.current?.(originLatLng, true);
    updateMarkerRef.current?.(destLatLng, false);
    
    // Set the route type from the saved route
    const savedType = route.route_type || 'balanced';
    setRouteType(savedType);
    localStorage.setItem('preferredRouteType', savedType); // Update preference too
    
    // Clear any existing route display
    clearRouteDisplayRef.current?.();
    
    // Update state to reflect loaded route
    setCurrentRoutePoints({
      start: { lat: originLat, lng: originLng },
      end: { lat: destLat, lng: destLng }
    });
    
    // Check if we have multiple route types saved
    const hasMultipleRouteTypes = route.has_multiple_routes || 
                                 (route.route_data && typeof route.route_data === 'object' && 
                                  Object.keys(route.route_data).length > 1);
    
    // Set computed routes with the saved route data
    const updatedComputedRoutes = { ...computedRoutes };
    
    // Handle new format (multiple route types)
    if (hasMultipleRouteTypes && typeof route.route_data === 'object') {
      // Load all saved route types
      Object.keys(route.route_data).forEach(type => {
        if (route.route_data[type]) {
          updatedComputedRoutes[type] = route.route_data[type];
        }
      });
      setComputedRoutes(updatedComputedRoutes);
      
      // Set all routes computed to true
      setAllRoutesComputed(true);
      
      // Set current type
      setRouteType(savedType);
      
      // Display the selected route type
      displayRouteRef.current?.(route.route_data[savedType], savedType);
      
      // Set route info for display
      if (route.route_data[savedType]) {
        setRouteInfo({
          distance: route.route_data[savedType].distance,
          duration: route.route_data[savedType].duration,
          routeType: savedType
        });
        
        // Set route directions if available
        if (route.route_data[savedType].legs && route.route_data[savedType].legs[0] && route.route_data[savedType].legs[0].steps) {
          setRouteDirections(route.route_data[savedType].legs[0].steps);
        }
      }
      
      // Update route display information
      setRouteOriginDisplay(originName);
      setRouteDestinationDisplay(destName);
      
      // Fit map to the route bounds
      try {
        // Get coordinates for the current route type
        let coordinates = [];
        
        // Try to get coordinates from route_geometry first (enhanced format)
        if (route.route_geometry && route.route_geometry[savedType] && route.route_geometry[savedType].coordinates) {
          coordinates = route.route_geometry[savedType].coordinates.map(coord => [coord[1], coord[0]]);
        }
        // Fall back to route_data geometry
        else if (route.route_data[savedType].geometry && route.route_data[savedType].geometry.coordinates) {
          coordinates = route.route_data[savedType].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        }
        
        if (coordinates.length > 0) {
          const bounds = L.latLngBounds(coordinates);
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
        } else {
          // Fallback to fitting bounds based on origin and destination
          const bounds = L.latLngBounds([originLatLng, destLatLng]);
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
        }
      } catch (error) {
        console.error("Error fitting map bounds:", error);
        // Fallback to fitting bounds based on origin and destination
        const bounds = L.latLngBounds([originLatLng, destLatLng]);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      }
      
      // Show a toast indicating multiple route types are available
      if (hasMultipleRouteTypes) {
        toast.success(`Multiple route options available. Currently showing "${savedType}" route.`, { 
          position: "bottom-center",
          duration: 4000
        });
      }
      
      return; // Exit early as we've handled the route display
    }
    
    // Handle legacy format (single route type)
    else {
      // Set the single route type
      updatedComputedRoutes[savedType] = route.route_data;
      setComputedRoutes(updatedComputedRoutes);
      
      // Create a route line from the saved route data
      try {
        // Get coordinates from the route data
        let coordinates = [];
        
        // Check if we have enhanced geometry data
        if (route.route_geometry && route.route_geometry.coordinates && route.route_geometry.coordinates.length > 0) {
          coordinates = route.route_geometry.coordinates.map(coord => [coord[1], coord[0]]);
        } 
        // Otherwise extract from the route_data
        else if (route.route_data.geometry && route.route_data.geometry.coordinates) {
          coordinates = route.route_data.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        }
        
        if (coordinates.length > 0) {
          // Create the route line with styling
          const routeStyle = {
            color: getRouteLineColor(savedType),
            weight: 5,
            opacity: 0.7
          };
          
          // Create and add the route line to the map
          if (routeControlRef.current && map) {
            try { map.removeLayer(routeControlRef.current); } catch(e) {}
          }
          
          routeControlRef.current = L.polyline(coordinates, routeStyle).addTo(map);
          
          // Set route info for display
          setRouteInfo({
            distance: route.route_data.distance,
            duration: route.route_data.duration,
            routeType: savedType
          });
          
          // Set route directions if available
          if (route.route_data.legs && route.route_data.legs[0] && route.route_data.legs[0].steps) {
            setRouteDirections(route.route_data.legs[0].steps);
          }
          
          // Update route display information
          setRouteOriginDisplay(originName);
          setRouteDestinationDisplay(destName);
          
          // Fit map to the route bounds
          const bounds = L.latLngBounds(coordinates);
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
          
          // Set all routes computed to true to prevent automatic recalculation
          setAllRoutesComputed(true);
          
          // Set the current route as active
          setRouteType(savedType);
          
          return; // Exit early as we've handled the route display
        }
      } catch (error) {
        console.error("Error displaying saved route:", error);
      }
    }
    
    // Fallback to standard route loading if direct display fails
    // But avoid triggering a recalculation by NOT calling updateMapViewRef
    // Instead, just fit the map to the points
    try {
      const bounds = L.latLngBounds([originLatLng, destLatLng]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      
      // Manually trigger the route display with the saved data
      displayRouteRef.current?.(route.route_data, savedType);
      
      // Set all routes computed to true to prevent automatic recalculation
      setAllRoutesComputed(true);
    } catch (error) {
      console.error("Error fitting map bounds:", error);
      toast.error("Error displaying saved route", { position: "bottom-center" });
    }
  }, [map, computedRoutes]); // Dependencies
  loadSavedRouteRef.current = loadSavedRoute;

  // Toggle search panel expansion
  const toggleSearch = () => setSearchExpanded(prev => !prev);
  toggleSearchRef.current = toggleSearch;

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || map || !window.L || !mapTilerKey) return; // Prevent re-initialization

    console.log("Initializing Leaflet map...");
    try {
      const mapInstance = L.map(mapRef.current, {
         zoomControl: false // Disable default zoom control if adding custom ones
      }).setView([42.336687, -71.095762], 13); // Default view

      L.tileLayer(`https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=${mapTilerKey}`, {
        attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
        tileSize: 512,
        zoomOffset: -1,
        minZoom: 3,
        crossOrigin: true
      }).addTo(mapInstance);

      // Add zoom control
      L.control.zoom({ position: 'topleft' }).addTo(mapInstance);


      setMap(mapInstance);
      // Initialize refs/state dependent on map creation
      if (!cellTowerLayerRef.current) cellTowerLayerRef.current = L.layerGroup().addTo(mapInstance);

      // Invalidate size after a short delay to ensure proper rendering
      setTimeout(() => mapInstance.invalidateSize(), 100);

      console.log("Map initialized successfully.");

      // Cleanup function on component unmount
      return () => {
        console.log("Removing Leaflet map instance.");
        mapInstance.remove();
        setMap(null);
      };
    } catch (error) {
        console.error("Failed to initialize Leaflet map:", error);
        toast.error("Map failed to load. Please refresh the page.", { position: "bottom-center" });
    }
  }, [mapTilerKey]); // Re-run only if mapTilerKey changes (shouldn't happen often)

  // Update or create origin/destination markers
  const updateMarker = useCallback((latlng, isOrigin) => {
    if (!map) return null;

    const currentMarker = isOrigin ? originMarker : destinationMarker;
    const setMarkerFn = isOrigin ? setOriginMarker : setDestinationMarker;
    const iconHtml = isOrigin ? `<div class="origin-marker"></div>` : `<div class="destination-marker"></div>`;
    const title = isOrigin ? "Origin" : "Destination";

    // If latlng is null, remove the marker
    if (!latlng) {
      if (currentMarker) {
        map.removeLayer(currentMarker);
        setMarkerFn(null);
      }
      return null;
    }

    // Create or update marker
    if (currentMarker) {
      currentMarker.setLatLng(latlng);
      return currentMarker;
    } else {
      try {
          const icon = L.divIcon({
              html: iconHtml,
              className: '', // Class applied to the container, not the div itself
              iconSize: [24, 24], // Match CSS size
              iconAnchor: [12, 12] // Center the anchor
          });
          const newMarker = L.marker(latlng, { icon: icon, title: title, zIndexOffset: 1000 }).addTo(map);
          setMarkerFn(newMarker);
          return newMarker;
      } catch(error) {
          console.error("Failed to create marker:", error);
          return null;
      }
    }
  }, [map, originMarker, destinationMarker]); // Dependencies: map, marker states
  updateMarkerRef.current = updateMarker;

  // Fetch Cell Towers from backend for a given bounds
  const fetchCellTowers = useCallback(async (bounds) => {
    if (!map || !bounds) return []; // Return empty array if no map or bounds

    const { min_lat, min_lng, max_lat, max_lng } = bounds;
    console.log(`Fetching cell towers in area: ${min_lat.toFixed(4)},${min_lng.toFixed(4)} to ${max_lat.toFixed(4)},${max_lng.toFixed(4)}`);
    const loadingToastId = toast.loading("Fetching cell tower data...", { position: "bottom-center" });

    try {
      const response = await api.get('/towers', {
        params: { min_lat, min_lng, max_lat, max_lng },
        timeout: 25000 // Increased timeout for potentially large requests
      });

      toast.dismiss(loadingToastId);
      const fetchedTowers = response.data?.towers || [];
      const totalFetched = response.data?.total || 0;
      const source = response.data?.source || 'unknown';

      console.log(`Received ${totalFetched} towers (source: ${source}). Displaying up to limits.`);

      if (totalFetched > 0) {
        allTowers.current = fetchedTowers; // Update the master tower store
        toast.success(`Found ${totalFetched} cell towers (${source})`, {
          duration: 2500, position: "bottom-center", icon: "📡"
        });
      } else {
        allTowers.current = []; // Clear if none found
        toast.info("No cell towers found in this area.", { duration: 3000, position: "bottom-center" });
      }

      // Trigger display update explicitly after fetching
      displayTowersRef.current?.();
      return fetchedTowers; // Return the fetched towers

    } catch (error) {
      console.error("Error fetching cell tower data:", error);
      toast.dismiss(loadingToastId);
      toast.error("Error fetching cell tower data.", { duration: 3000, position: "bottom-center" });
      allTowers.current = []; // Clear on error
      displayTowersRef.current?.(); // Update display to show nothing
      return []; // Return empty array on error
    }
  }, [map]); // Dependency: map instance
  fetchCellTowersRef.current = fetchCellTowers;

  // Prevent map interaction while interacting with UI elements on top
  const preventMapInteraction = useCallback((event) => {
    if (!map) return;
    
    if (event && event.stopPropagation) {
      event.stopPropagation();
    }
    
    // Disable map interactions
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    if (map.tap) map.tap.disable();
    
    // Add a class to indicate the map is disabled
    document.getElementById('map').classList.add('map-interactions-disabled');
    
    return () => {
      // Re-enable map interactions when component unmounts or when called as cleanup
      if (map) {
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        if (map.tap) map.tap.enable();
        
        // Remove the indicator class
        document.getElementById('map').classList.remove('map-interactions-disabled');
      }
    };
  }, [map]);
  preventMapInteractionRef.current = preventMapInteraction;

  // Handle search input changes and fetch geocoding suggestions
  const handleInputChange = useCallback(async (e, isOrigin) => {
    const value = e.target.value;
    const setValue = isOrigin ? setOriginValue : setDestinationValue;
    const setSuggestions = isOrigin ? setOriginSuggestions : setDestinationSuggestions;
    const setShowSuggestions = isOrigin ? setShowOriginSuggestions : setShowDestinationSuggestions;

    setValue(value);

    if (!value.trim() || !mapTilerKey) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      // Use MapTiler Geocoding API directly from frontend
      const response = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(value)}.json?key=${mapTilerKey}&autocomplete=true&limit=5`
      );
      if (!response.ok) throw new Error(`Geocoding API error: ${response.statusText}`);
      const data = await response.json();
      setSuggestions(data?.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching geocoding suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
      // Optionally show a toast message for API errors
      // toast.error("Could not fetch address suggestions.", { position: "bottom-center" });
    }
  }, [mapTilerKey]);
  handleInputChangeRef.current = handleInputChange;

  // Show suggestions on input focus
  const handleInputFocus = useCallback((isOrigin) => {
    const suggestions = isOrigin ? originSuggestions : destinationSuggestions;
    const setShow = isOrigin ? setShowOriginSuggestions : setShowDestinationSuggestions;
    const inputValue = isOrigin ? originValue : destinationValue;
    
    if (suggestions.length > 0) {
      setShow(true);
    } 
    // If we have text in the input but no suggestions (e.g., after loading a saved route),
    // fetch suggestions for the current text
    else if (inputValue && inputValue.trim().length > 2) {
      // Create a synthetic event to pass to handleInputChange
      const syntheticEvent = {
        target: { value: inputValue },
        preventDefault: () => {}
      };
      
      // Trigger the input change handler to fetch suggestions
      handleInputChangeRef.current?.(syntheticEvent, isOrigin);
    }
  }, [originSuggestions, destinationSuggestions, originValue, destinationValue]);
  handleInputFocusRef.current = handleInputFocus;

  // Hide suggestions on input blur (with delay for click handling)
  const handleInputBlur = useCallback((isOrigin) => {
    // Use a small delay to allow click event on suggestion to register
    setTimeout(() => {
      if (!suggestionClickedRef.current) { // Check if a suggestion was clicked
        if (isOrigin) setShowOriginSuggestions(false);
        else setShowDestinationSuggestions(false);
      }
      suggestionClickedRef.current = false; // Reset click tracker
    }, 200);
  }, []);
  handleInputBlurRef.current = handleInputBlur;

  // Clear input field and related state/markers
  const handleClearInput = useCallback((isOrigin) => {
    if (isOrigin) {
      setOriginValue('');
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
      updateMarkerRef.current?.(null, true); // Remove marker
      setCurrentRoutePoints(prev => ({ ...prev, start: null }));
    } else {
      setDestinationValue('');
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
      updateMarkerRef.current?.(null, false); // Remove marker
      setCurrentRoutePoints(prev => ({ ...prev, end: null }));
    }

    // If either point is cleared, remove the route display
    clearRouteDisplayRef.current?.();
    setAllRoutesComputed(false); // Allow recalculation
    setRoutesAreLoading(false); // Stop loading indicators
    // Do not hide search panel when clearing input
  }, []); // No map dependency needed directly, relies on updateMarkerRef
  handleClearInputRef.current = handleClearInput;

  // Handle selecting a geocoding suggestion
  const handleSuggestionSelect = useCallback(async (suggestion, isOrigin) => {
    if (!map || !suggestion?.center) return;
    suggestionClickedRef.current = true; // Indicate a suggestion was clicked (for blur handler)

    const [lng, lat] = suggestion.center;
    const latlng = L.latLng(lat, lng);
    const placeName = suggestion.place_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    // Update input field and hide suggestions
    if (isOrigin) {
      setOriginValue(placeName);
      setShowOriginSuggestions(false);
      setCurrentRoutePoints(prev => ({ ...prev, start: { lat, lng } }));
    } else {
      setDestinationValue(placeName);
      setShowDestinationSuggestions(false);
      setCurrentRoutePoints(prev => ({ ...prev, end: { lat, lng } }));
    }

    // Update the corresponding map marker
    updateMarkerRef.current?.(latlng, isOrigin);

    // Determine the current start and end points *after* the update
    const updatedPoints = isOrigin
      ? { start: { lat, lng }, end: currentRoutePoints?.end }
      : { start: currentRoutePoints?.start, end: { lat, lng } };

    // --- Trigger Route Calculation if Both Points Are Set ---
    if (updatedPoints.start?.lat && updatedPoints.end?.lat) {
      const originLL = L.latLng(updatedPoints.start.lat, updatedPoints.start.lng);
      const destLL = L.latLng(updatedPoints.end.lat, updatedPoints.end.lng);

      // Reset route calculation state before starting new calculation
      clearRouteDisplayRef.current?.(); // Clear previous route visuals
      setAllRoutesComputed(false);
      setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null });
      setComputedRouteTowers({ fastest: [], cell_coverage: [], balanced: [] });
      setRoutesAreLoading(false); // Ensure loading is reset

      // Fit map view to the two points
      try {
          const bounds = L.latLngBounds([originLL, destLL]);
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      } catch (error) {
          console.error("Error fitting map bounds:", error);
      }

      // Fetch initial towers around the waypoints (smaller area)
      const waypointPadding = 0.02; // Smaller buffer around points
      const initialBounds = {
        min_lat: Math.min(originLL.lat, destLL.lat) - waypointPadding,
        min_lng: Math.min(originLL.lng, destLL.lng) - waypointPadding,
        max_lat: Math.max(originLL.lat, destLL.lat) + waypointPadding,
        max_lng: Math.max(originLL.lng, destLL.lng) + waypointPadding
      };
      await fetchCellTowersRef.current?.(initialBounds);
      // Don't automatically show towers, let user toggle

      // Decide whether to show route type selection popup
      if (!skipRouteTypeSelection) {
        setShowRouteTypeSelection(true);
      }

      // Trigger the main map view update and route calculation process
      updateMapViewRef.current?.(originLL, destLL);

      setSearchExpanded(false); // Collapse search panel after selection sets both points
    } else {
      // Only one point selected, just fly map to it
      map.flyTo(latlng, Math.max(map.getZoom(), 14));
    }
  }, [map, currentRoutePoints, skipRouteTypeSelection]); // Dependencies
  handleSuggestionSelectRef.current = handleSuggestionSelect;

  // Update Map View and Trigger Route Calculation Process
  const updateMapView = useCallback((originLatLng, destLatLng) => {
    if (!map || !originLatLng || !destLatLng) {
        console.warn("updateMapView called without map or valid LatLngs.");
        return;
    }
    console.log("Updating map view and triggering route calculation...");

    // Fit map to bounds
    try {
        const bounds = L.latLngBounds([originLatLng, destLatLng]);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } catch (error) {
        console.error("Error fitting map bounds in updateMapView:", error);
    }

    const routePointsForCalc = {
      start: { lat: originLatLng.lat, lng: originLatLng.lng },
      end: { lat: destLatLng.lat, lng: destLatLng.lng }
    };
    setCurrentRoutePoints(routePointsForCalc); // Update state

    // --- Reset state BEFORE fetching towers/calculating routes ---
    console.log("RESETTING route state before calculation.");
    clearRouteDisplayRef.current?.(); // Clear visuals
    setAllRoutesComputed(false);
    setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null });
    setComputedRouteTowers({ fastest: [], cell_coverage: [], balanced: [] });
    setRoutesAreLoading(false); // Ensure loading is off before starting async ops
    setRouteDirections(null);
    setShowDirections(false);

    // Fetch towers for the broader route area asynchronously
    const routePadding = 0.1; // Larger buffer for route calculation
    const towerBounds = {
      min_lat: Math.min(originLatLng.lat, destLatLng.lat) - routePadding,
      min_lng: Math.min(originLatLng.lng, destLatLng.lng) - routePadding,
      max_lat: Math.max(originLatLng.lat, destLatLng.lat) + routePadding,
      max_lng: Math.max(originLatLng.lng, destLatLng.lng) + routePadding
    };

    // Fetch towers, then start route calculation
    fetchCellTowersRef.current?.(towerBounds)
      .then(() => {
        console.log(`Tower fetch complete. Starting route calculation for type: ${routeType}`);
        // Trigger calculation using the directly passed points and current routeType
        // Use setTimeout to allow state updates to potentially render before heavy calc
        setTimeout(() => {
             calculateAllRouteTypesRef.current?.(routePointsForCalc);
        }, 50);
      })
      .catch(error => {
        console.error("Error fetching towers for route calculation, attempting route calc anyway:", error);
        // Still try to calculate routes even if tower fetch fails
        setTimeout(() => {
             calculateAllRouteTypesRef.current?.(routePointsForCalc);
        }, 50);
      });

  }, [map, routeType]); // Dependency: map instance, current routeType
  updateMapViewRef.current = updateMapView;

  // Calculate all route types (Fastest, Cell Coverage, Balanced)
  // This function now orchestrates the 3 backend calls.
  const calculateAllRouteTypes = useCallback(async (points) => {
    if (!points?.start?.lat || !points?.end?.lat) {
      console.error("CALC ALL: Cannot calculate routes - missing or invalid route points:", points);
      toast.error("Cannot calculate route: Origin or Destination missing.", { position: "bottom-center" });
      setRoutesAreLoading(false);
      return;
    }

    // Prevent multiple simultaneous calculations
    if (routesAreLoading) {
      console.warn("CALC ALL: Route calculation already in progress. Skipping.");
      return;
    }

    console.log("CALC ALL: Starting calculation for all route types...");
    setRoutesAreLoading(true);
    setAllRoutesComputed(false);
    // Clear previous results while loading
    setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null });
    setComputedRouteTowers({ fastest: [], cell_coverage: [], balanced: [] });
    clearRouteDisplayRef.current?.(); // Clear visuals

    const { start, end } = points;
    const typesToCalculate = ['fastest', 'cell_coverage', 'balanced'];
    let calculationSuccess = true; // Track overall success

    try {
      // Use Promise.all to run calculations concurrently
      const results = await Promise.all(typesToCalculate.map(type =>
        calculateRouteRef.current?.(start.lat, start.lng, end.lat, end.lng, type)
          .catch(error => {
            console.error(`CALC ALL: Failed to calculate '${type}' route:`, error);
            toast.error(`Failed to calculate ${type} route.`, { position: "bottom-center" });
            calculationSuccess = false; // Mark failure
            return null; // Return null on error for this specific type
          })
      ));

      console.log("CALC ALL: Raw results from backend calls:", results);

      // Process results
      const newComputedRoutes = {};
      const newComputedRouteTowers = {};
      let firstSuccessfulRouteData = null;
      let firstSuccessfulRouteType = null;

      results.forEach((result, index) => {
        const type = typesToCalculate[index];
        if (result?.route) { // Check if calculation for this type was successful
          newComputedRoutes[type] = result.route; // result.route contains { routes, waypoints, ... }
          newComputedRouteTowers[type] = result.towers || [];
          // Store the first successfully calculated route to display initially
          if (!firstSuccessfulRouteData) {
            firstSuccessfulRouteData = result.route;
            firstSuccessfulRouteType = type;
          }
        } else {
          // Ensure entries exist even if calculation failed
          newComputedRoutes[type] = null;
          newComputedRouteTowers[type] = [];
        }
      });

      // Update state with all results
      setComputedRoutes(newComputedRoutes);
      setComputedRouteTowers(newComputedRouteTowers);

      console.log("CALC ALL: Processed computed routes:", newComputedRoutes);

      if (!calculationSuccess && !firstSuccessfulRouteData) {
         // If all calculations failed
        throw new Error("All route calculations failed.");
      }

      // Display the route corresponding to the currently selected routeType,
      // or fall back to the first successful one if the preferred type failed.
      const typeToDisplay = newComputedRoutes[routeType] ? routeType : firstSuccessfulRouteType;
      const routeDataToDisplay = newComputedRoutes[typeToDisplay];

      if (routeDataToDisplay) {
        console.log(`CALC ALL: Displaying route type: ${typeToDisplay}`);
        displayRouteRef.current?.(routeDataToDisplay, typeToDisplay);
      } else {
         console.error("CALC ALL: No routes available to display after calculation.");
         toast.error("Could not display any route.", { position: "bottom-center" });
      }

    } catch (error) {
      console.error('CALC ALL: Error during route calculation process:', error);
      // Toast shown inside the Promise.all catch or here for general failure
      if (error.message === "All route calculations failed.") {
           toast.error("Failed to calculate any routes. Please check points or try again.", { position: "bottom-center" });
      } else {
           toast.error("An unexpected error occurred while calculating routes.", { position: "bottom-center" });
      }
       clearRouteDisplayRef.current?.(); // Clear any partial visuals

    } finally {
      // Mark calculation process as finished, regardless of success/failure
      setAllRoutesComputed(true);
      setRoutesAreLoading(false);
      console.log("CALC ALL: Route calculation process finished.");
    }
  }, [routesAreLoading, routeType]); // Dependencies
  calculateAllRouteTypesRef.current = calculateAllRouteTypes;

  // Calculate Route Function (Calls Backend for a single type)
  const calculateRoute = useCallback(async (startLat, startLng, endLat, endLng, routeTypeParam) => {
    // Validate coordinates before sending
    const coords = [startLat, startLng, endLat, endLng];
    if (coords.some(c => typeof c !== 'number' || isNaN(c))) {
      throw new Error(`Invalid coordinates provided for route calculation.`);
    }

    console.log(`API CALL: Requesting '${routeTypeParam}' route from backend...`);
    try {
      const response = await api.get('/route', {
        params: {
          start_lat: startLat.toFixed(6), // Use fixed precision
          start_lng: startLng.toFixed(6),
          end_lat: endLat.toFixed(6),
          end_lng: endLng.toFixed(6),
          route_type: routeTypeParam
        }
      });

      const data = response.data;
      if (data?.code === 'Ok' && data.routes?.[0]?.geometry) {
        console.log(`API CALL: '${routeTypeParam}' route received successfully.`);
        // Return structure expected by the calling function (calculateAllRouteTypes)
        return {
          route: { // Contains the full route object from backend
            routes: data.routes,
            waypoints: data.waypoints,
            distance: data.routes[0].distance,
            duration: data.routes[0].duration,
            // Include other relevant top-level details if needed
          },
          towers: data.towers || [] // Towers returned by backend specific to this route
        };
      } else {
        // Handle specific errors from backend like 'NoRoute'
        const errorMsg = data?.message || `Backend failed to calculate ${routeTypeParam} route.`;
        console.error(`API CALL: Failed - ${errorMsg}`, data);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error(`API CALL: Error calculating '${routeTypeParam}' route:`, error);
      // Rethrow the error to be caught by the caller (Promise.all)
      throw error;
    }
  }, []); // No dependencies needed for this specific API call function
  calculateRouteRef.current = calculateRoute;

  // Format distance (meters to km or m)
  const formatDistance = (distanceInMeters) => {
    if (typeof distanceInMeters !== 'number' || isNaN(distanceInMeters)) return 'N/A';
    if (distanceInMeters < 0) return '0 m';
    const distanceInKm = distanceInMeters / 1000;
    if (distanceInKm < 1) return `${Math.round(distanceInMeters)} m`;
    if (distanceInKm < 10) return `${distanceInKm.toFixed(1)} km`;
    return `${Math.round(distanceInKm)} km`;
  };
  formatDistanceRef.current = formatDistance;

  // Format duration (seconds to hours/minutes)
  const formatDuration = (durationInSeconds) => {
    if (typeof durationInSeconds !== 'number' || isNaN(durationInSeconds)) return 'N/A';
    if (durationInSeconds < 0) return '0 min';
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.round((durationInSeconds % 3600) / 60); // Round minutes
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  };
  formatDurationRef.current = formatDuration;

  // Calculate a simple signal score (0-5) based on towers along the route
  // Note: This might be less critical if backend does scoring, but useful for frontend display
  const calculateSignalScore = (towersAlongRoute) => {
    if (!towersAlongRoute || towersAlongRoute.length === 0) return 0;
    // Use averageSignal, default to a weak value if missing
    const avgSignal = towersAlongRoute.reduce((sum, t) => sum + (t.averageSignal || -110), 0) / towersAlongRoute.length;
    // Normalize signal strength (-110 to -70 range maps roughly to 0-5 score)
    const normSignal = Math.max(0, Math.min(5, (avgSignal + 110) / 8)); // (110 - 70) / 5 = 8
    // Consider tower density slightly (simple approach)
    const densityFactor = Math.min(1, towersAlongRoute.length / 15); // Cap at 15 towers for density bonus
    // Combine factors (e.g., 80% signal strength, 20% density)
    return Math.round(((normSignal * 0.8) + (5 * densityFactor * 0.2)) * 10) / 10; // Return score rounded to 1 decimal
  };
  calculateSignalScoreRef.current = calculateSignalScore;

  // Find Towers Along Route (FRONTEND IMPLEMENTATION)
  // Filters the `allTowers.current` list based on proximity to the displayed route geometry.
  // This duplicates backend logic but allows frontend filtering if needed.
  const findTowersAlongRoute = useCallback((towersToFilter, routeGeometry, maxDistance = 1000) => {
      if (!map || !towersToFilter || towersToFilter.length === 0 || !routeGeometry?.coordinates || routeGeometry.coordinates.length < 2) {
          // console.log("findTowersAlongRoute (FE): Skipping - Invalid input.");
          return [];
      }
      // console.log(`findTowersAlongRoute (FE): Filtering ${towersToFilter.length} towers within ${maxDistance}m...`);

      // Convert GeoJSON coords [lng, lat] to Leaflet LatLngs [lat, lng]
      const routeLatLngs = routeGeometry.coordinates.map(coord => L.latLng(coord[1], coord[0]));
      if (routeLatLngs.length < 2) return [];

      const nearbyTowers = [];
      const routeLine = L.polyline(routeLatLngs); // Create temporary polyline for calculations

      // Helper to find closest point on a line segment (Leaflet doesn't have built-in)
      // From Leaflet.GeometryUtil
      const closestPointOnSegment = (p, p1, p2) => {
          let x = p1.lat, y = p1.lng;
          let dx = p2.lat - x, dy = p2.lng - y;
          let dot = dx * dx + dy * dy;
          let t;

          if (dot > 0) {
              t = ((p.lat - x) * dx + (p.lng - y) * dy) / dot;
              if (t > 1) { x = p2.lat; y = p2.lng; }
              else if (t > 0) { x += dx * t; y += dy * t; }
          }
          return L.latLng(x, y);
      };

      // Create bounds for quick filtering
      const routeBounds = routeLine.getBounds();
      const expandedBounds = routeBounds.pad(maxDistance / 111000 * 0.2); // Rough padding in degrees

      towersToFilter.forEach(tower => {
          if (tower.lat && tower.lon) {
              const towerPoint = L.latLng(tower.lat, tower.lon);

              // Quick bounds check
              if (!expandedBounds.contains(towerPoint)) {
                  return; // Skip tower if outside expanded bounds
              }

              let minDistance = Infinity;
              let closestPt = null;

              // Find distance to the closest segment
              for (let i = 0; i < routeLatLngs.length - 1; i++) {
                  const p1 = routeLatLngs[i];
                  const p2 = routeLatLngs[i + 1];
                  const ptOnSeg = closestPointOnSegment(towerPoint, p1, p2);
                  const distance = towerPoint.distanceTo(ptOnSeg);

                  if (distance < minDistance) {
                      minDistance = distance;
                      closestPt = ptOnSeg;
                  }
              }


              if (minDistance <= maxDistance) {
                 // Simple distance calculation along path (not fully accurate projection)
                 let distAlong = 0;
                 let foundSegment = false;
                 for (let i = 0; i < routeLatLngs.length - 1; i++) {
                     if (closestPt && map.distance(routeLatLngs[i], closestPt) + map.distance(closestPt, routeLatLngs[i+1]) < map.distance(routeLatLngs[i], routeLatLngs[i+1]) + 1) {
                         distAlong += map.distance(routeLatLngs[i], closestPt);
                         foundSegment = true;
                         break;
                     }
                     distAlong += map.distance(routeLatLngs[i], routeLatLngs[i+1]);
                 }
                 const totalDist = routeLine.getLatLngs().reduce((sum, pt, i, arr) => i > 0 ? sum + map.distance(pt, arr[i-1]) : sum, 0);
                 const positionAlong = totalDist > 0 ? distAlong / totalDist : 0;

                  nearbyTowers.push({
                      ...tower,
                      distanceToRoute: minDistance,
                      positionAlongRoute: Math.max(0, Math.min(1, positionAlong)) // Clamp 0-1
                  });
              }
          }
      });

      // Sort by position along route
      nearbyTowers.sort((a, b) => a.positionAlongRoute - b.positionAlongRoute);

      // console.log(`findTowersAlongRoute (FE): Found ${nearbyTowers.length} towers within ${maxDistance}m.`);
      return nearbyTowers;
  }, [map]); // Dependency: map instance
  findTowersAlongRouteRef.current = findTowersAlongRoute;

  // Extract and format directions from GraphHopper route data
  const extractDirections = useCallback((routeData) => {
    if (!routeData?.routes?.[0]?.legs?.[0]?.steps) {
      console.warn("extractDirections: No steps found in route data.");
      return null;
    }

    const route = routeData.routes[0];
    const steps = route.legs[0].steps;

    // Helper to map GraphHopper sign codes to descriptive maneuver types
    const signToManeuverType = (sign) => {
        // Add more mappings as needed based on GraphHopper documentation
        const map = {
            '-98': 'uturn', '-8': 'uturn-left', '-7': 'keep-left', '-6': 'exit-roundabout',
            '-3': 'sharp-left', '-2': 'left', '-1': 'slight-left', '0': 'straight',
            '1': 'slight-right', '2': 'right', '3': 'sharp-right', '4': 'destination',
            '5': 'via', '6': 'roundabout', '7': 'keep-right', '8': 'uturn-right'
        };
        return map[sign] || 'straight'; // Default to straight
    };

    let formattedSteps = [];

    // Add initial departure step
    formattedSteps.push({
      type: 'start',
      instruction: `Depart from ${originValue || 'Origin'}`,
      distanceFormatted: '',
      coordinates: steps[0]?.geometry?.coordinates?.[0] || null, // First coordinate of first step
      segmentCoordinates: [] // No specific segment for start
    });

    steps.forEach((step, index) => {
      const maneuver = step.maneuver || {};
      const type = signToManeuverType(maneuver.type);
      const name = step.name || '';
      const distance = formatDistanceRef.current?.(step.distance) || '';
      let instruction = step.instruction_text || ''; // Prefer text from GraphHopper

      // Fallback instruction generation if text is missing
      if (!instruction) {
        if (type === 'straight') instruction = name ? `Continue on ${name}` : 'Continue straight';
        else if (type.includes('left') || type.includes('right')) instruction = name ? `${type.replace('-', ' ')} onto ${name}` : type.replace('-', ' ');
        else if (type === 'roundabout') instruction = `Enter roundabout${name ? ` and take exit onto ${name}` : ''}`;
        else if (type === 'exit-roundabout') instruction = `Exit roundabout${name ? ` onto ${name}` : ''}`;
        else if (type === 'destination') instruction = `Arrive at ${destinationValue || 'Destination'}`;
        else instruction = `${type}${name ? ` onto ${name}` : ''}`; // Generic fallback
        instruction = instruction.charAt(0).toUpperCase() + instruction.slice(1); // Capitalize
      }

      formattedSteps.push({
        type: type,
        instruction: instruction,
        distanceFormatted: distance,
        coordinates: step.geometry?.coordinates?.[0] || null, // First coordinate of the step's segment
        streetName: name,
        // Include segment coordinates for highlighting
        segmentCoordinates: step.geometry?.coordinates || []
      });
    });

    // Ensure final step is destination if last step wasn't already
    const lastStep = formattedSteps[formattedSteps.length - 1];
    if (lastStep && lastStep.type !== 'destination') {
      const finalCoord = route.geometry?.coordinates?.[route.geometry.coordinates.length - 1];
      formattedSteps.push({
          type: 'destination',
          instruction: `Arrive at ${destinationValue || 'Destination'}`,
          distanceFormatted: '',
          coordinates: finalCoord || null,
          segmentCoordinates: finalCoord ? [finalCoord] : []
      });
    }

    return {
      distanceFormatted: formatDistanceRef.current?.(route.distance) || '',
      durationFormatted: formatDurationRef.current?.(route.duration) || '',
      ascendFormatted: route.ascend > 0 ? `${Math.round(route.ascend)}m ↗️` : '',
      descendFormatted: route.descend > 0 ? `${Math.round(route.descend)}m ↘️` : '',
      steps: formattedSteps,
    };
  }, [originValue, destinationValue]); // Dependencies
  extractDirectionsRef.current = extractDirections;

  // Display Route on Map
  const displayRoute = useCallback((routeData, displayedRouteType) => {
    if (!map || !routeData?.routes?.[0]?.geometry?.coordinates) {
      console.error("displayRoute: Map not ready or no valid route geometry.");
      clearRouteDisplayRef.current?.(); // Clear any old route
      return;
    }

    clearRouteDisplayRef.current?.(); // Clear previous route visuals first

    try {
      const route = routeData.routes[0];
      // Convert GeoJSON coords [lng, lat] to Leaflet LatLngs [lat, lng]
      const routeLatLngs = route.geometry.coordinates.map(coord => L.latLng(coord[1], coord[0]));

      if (routeLatLngs.length < 2) {
        throw new Error("Invalid route geometry: less than 2 coordinates.");
      }

      // Create and add the route line
      const routeLine = L.polyline(routeLatLngs, {
        color: getRouteLineColorRef.current?.(displayedRouteType) || '#4285F4', // Use color based on type
        weight: 5,
        opacity: 0.85,
        smoothFactor: 1,
      }).addTo(map);

      routeControlRef.current = routeLine; // Store ref to the route layer

      // Fit map to the route bounds
      map.fitBounds(routeLine.getBounds(), { padding: [50, 50], maxZoom: 16 });

      // Extract and set directions
      const directions = extractDirectionsRef.current?.(routeData);
      if (directions?.steps?.length > 0) {
        setRouteOriginDisplay(originValue); // Capture origin used for this route
        setRouteDestinationDisplay(destinationValue); // Capture destination used for this route
        setRouteDirections(directions);
        setShowDirections(true); // Ensure directions panel is shown
        setIsDirectionsMinimized(false); // Ensure it's not minimized
      } else {
        setRouteDirections(null);
        setShowDirections(false);
      }

      // Update route info panel state (signal score calculated in displayTowers)
      setRouteInfo({
        distance: route.distance,
        duration: route.duration,
        routeType: displayedRouteType,
        // signalQuality and towerCount will be updated by displayTowers
      });

      // Trigger tower display update for the new route
      // Use a short timeout to ensure route drawing is potentially rendered first
      setTimeout(() => displayTowersRef.current?.(), 50);

    } catch (error) {
      console.error("Error displaying route:", error);
      toast.error("Error displaying route.", { position: "bottom-center" });
      clearRouteDisplayRef.current?.(); // Clean up partial display on error
    }
  }, [map]); // Dependencies
  displayRouteRef.current = displayRoute;

  // Display Towers on Map
  const displayTowers = useCallback(() => {
    if (!map) return;

    // Always clear previous tower layer first for clean update
    if (cellTowerLayerRef.current) {
      map.removeLayer(cellTowerLayerRef.current);
      cellTowerLayerRef.current = null;
    }

    // Only display if toggled on
    if (!showCellTowers) {
      setRouteTowers([]); // Clear route-specific towers when hidden
      // Update route info panel to remove tower-specific details
       setRouteInfo(prev => prev ? { ...prev, signalQuality: undefined, towerCount: undefined } : null);
      return;
    }

    const towerLayer = L.layerGroup(); // Use a layerGroup for efficiency
    let towersToDisplay = [];
    const currentRoute = routeControlRef.current; // The currently displayed L.polyline
    let routeGeometryForFiltering = null;

    // Create geometry object only if a route is currently displayed
    if (currentRoute) {
      try {
         // Convert Leaflet LatLngs back to GeoJSON format [lng, lat] for filtering function
         const routeCoords = currentRoute.getLatLngs().map(ll => [ll.lng, ll.lat]);
         if (routeCoords.length >= 2) {
             routeGeometryForFiltering = { type: "LineString", coordinates: routeCoords };
         }
      } catch(e) { console.error("Error getting route geometry for tower filtering:", e); }
    }

    const MAX_DISPLAY_TOWERS = 300; // Limit displayed towers for performance

    if (routeGeometryForFiltering) {
      // --- Display Towers Along Route ---
      // Filter the master list (allTowers.current) using the frontend function
      const filteredRouteTowers = findTowersAlongRouteRef.current?.(
        allTowers.current,
        routeGeometryForFiltering,
        1500 // Max distance in meters (adjust as needed)
      ) || [];

      setRouteTowers(filteredRouteTowers); // Update state with towers specific to this route
      towersToDisplay = filteredRouteTowers;

      // Calculate signal score based on the filtered towers
      const signalQuality = calculateSignalScoreRef.current?.(towersToDisplay) || 0;
      // Update routeInfo panel state
      setRouteInfo(prev => prev ? { ...prev, signalQuality: signalQuality, towerCount: towersToDisplay.length } : null);

    } else {
      // --- Display All Towers (No Route Active or Initial Load) ---
      towersToDisplay = allTowers.current || [];
      setRouteTowers([]); // No route-specific towers currently displayed
       // Clear route-specific info in panel
       setRouteInfo(prev => prev ? { ...prev, signalQuality: undefined, towerCount: undefined } : null);
    }

    // Apply display limit
    if (towersToDisplay.length > MAX_DISPLAY_TOWERS) {
      console.log(`Limiting tower display to ${MAX_DISPLAY_TOWERS} (found ${towersToDisplay.length})`);
      // Prioritize towers (e.g., closer or stronger signal if available)
      // Simple slice for now, could implement sorting/sampling if needed
      towersToDisplay = towersToDisplay.slice(0, MAX_DISPLAY_TOWERS);
    }

    // --- Render Markers ---
    console.log(`Rendering ${towersToDisplay.length} towers on map.`);
    towersToDisplay.forEach(tower => {
      if (!tower.lat || !tower.lon) return;

      // Determine signal class for styling
      const signalStrength = tower.averageSignal || -110; // Default weak
      let signalClass = 'weak';
      if (signalStrength > -80) signalClass = 'strong';
      else if (signalStrength > -95) signalClass = 'medium';

      const isAlongRoute = !!routeGeometryForFiltering && tower.distanceToRoute !== undefined;
      const iconHtml = `<div class="cell-tower-marker ${signalClass} ${isAlongRoute ? 'along-route' : ''}"></div>`;

      try {
          const icon = L.divIcon({
              html: iconHtml, className: '', // Let CSS handle styling via internal class
              iconSize: [12, 12],
              iconAnchor: [6, 6]
          });
          const marker = L.marker([tower.lat, tower.lon], { icon: icon, zIndexOffset: 800 });

          // Create popup content
          const popupContent = `
            <div class="tower-popup">
              <div class="tower-popup-header">
                <strong>${tower.radio || 'Tower'}</strong>
                <span class="signal-badge ${signalClass}">${signalStrength} dBm</span>
              </div>
              <div class="tower-popup-content">
                ${tower.mcc && tower.net ? `<div><strong>Net:</strong> ${tower.mcc}-${tower.net}</div>` : ''}
                ${tower.area && tower.cell ? `<div><strong>ID:</strong> ${tower.area}-${tower.cell}</div>` : ''}
                ${tower.range ? `<div><strong>Range:</strong> ~${tower.range}m</div>` : ''}
                ${tower.distanceToRoute !== undefined ? `<div><strong>Route Dist:</strong> ${Math.round(tower.distanceToRoute)}m</div>` : ''}
                ${tower.updated ? `<div><strong>Updated:</strong> ${formatDateRef.current(new Date(tower.updated * 1000).toISOString())}</div>` : ''}
              </div>
            </div>
          `;
          marker.bindPopup(popupContent);

          towerLayer.addLayer(marker);
      } catch(error) {
          console.error("Error creating tower marker or popup:", error, tower);
      }
    });

    // Add the layer group to the map
    towerLayer.addTo(map);
    cellTowerLayerRef.current = towerLayer; // Store reference to the new layer group

  }, [map, showCellTowers, allTowers.current, routeControlRef.current]); // Dependencies
  displayTowersRef.current = displayTowers;

  // Effect to re-render towers when visibility toggle changes or route changes
  useEffect(() => {
    displayTowersRef.current?.();
  }, [showCellTowers, map, routeControlRef.current]); // Rerun on toggle, map init, or when route line changes

  // Toggle Cell Towers Visibility
  const toggleCellTowers = useCallback(() => {
    setShowCellTowers(prev => !prev);
    // The displayTowers function (called via effect or directly) handles the update
  }, []);
  toggleCellTowersRef.current = toggleCellTowers;

  // Use Browser Geolocation to set Origin
  const handleLocate = useCallback(async () => {
    if (!map) return;
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported by your browser.', { position: "bottom-center" });
      return;
    }

    setIsLocating(true);
    const locateToastId = toast.loading("Getting your location...", { position: "bottom-center" });
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const latlng = L.latLng(latitude, longitude);
        let placeName = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`; // Default to coords

        try {
          // Use MapTiler for reverse geocoding
          if (mapTilerKey) {
              const response = await fetch(
                  `https://api.maptiler.com/geocoding/${longitude},${latitude}.json?key=${mapTilerKey}`
              );
              if (response.ok) {
                  const data = await response.json();
                  if (data?.features?.[0]?.place_name) {
                      placeName = data.features[0].place_name;
                  }
              } else {
                   console.warn(`Reverse geocoding failed: ${response.statusText}`);
              }
          }
        } catch (error) {
          console.error('Reverse geocoding error:', error);
          // Fallback to coords already set
        } finally {
          toast.dismiss(locateToastId);
          toast.success('Location found!', { duration: 2000, position: "bottom-center" });

          // Update origin state and marker
          setOriginValue(placeName);
          updateMarkerRef.current?.(latlng, true);
          setCurrentRoutePoints(prev => ({ ...prev, start: { lat: latitude, lng: longitude } }));

          // Check if destination is already set to trigger route calculation
          const currentEnd = currentRoutePoints?.end;
          if (currentEnd?.lat && currentEnd?.lng) {
            // Reset route calculation state before starting new calculation
            clearRouteDisplayRef.current?.(); // Clear previous route visuals
            setAllRoutesComputed(false);
            setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null });
            setComputedRouteTowers({ fastest: [], cell_coverage: [], balanced: [] });
            setRoutesAreLoading(false); // Ensure loading is reset

            // Trigger map update and route calculation
            const originLL = latlng;
            const destLL = L.latLng(currentEnd.lat, currentEnd.lng);
            
            // Fit map view to the two points
            try {
                const bounds = L.latLngBounds([originLL, destLL]);
                map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
            } catch (error) {
                console.error("Error fitting map bounds:", error);
            }

            // Fetch initial towers around the waypoints (smaller area)
            const waypointPadding = 0.02; // Smaller buffer around points
            const initialBounds = {
              min_lat: Math.min(originLL.lat, destLL.lat) - waypointPadding,
              min_lng: Math.min(originLL.lng, destLL.lng) - waypointPadding,
              max_lat: Math.max(originLL.lat, destLL.lat) + waypointPadding,
              max_lng: Math.max(originLL.lng, destLL.lng) + waypointPadding
            };
            await fetchCellTowersRef.current?.(initialBounds);
            
            // Show route type selection popup
            if (!skipRouteTypeSelection) {
              setShowRouteTypeSelection(true);
            }
            
            // Trigger the main map view update and route calculation process
            updateMapViewRef.current?.(originLL, destLL);
            
            setSearchExpanded(false); // Collapse search panel after selection sets both points
          } else {
            // Only origin set, fly map to location
            map.flyTo(latlng, Math.max(map.getZoom(), 14));
          }
          setIsLocating(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.dismiss(locateToastId);
        toast.error(`Could not get location: ${error.message}`, { duration: 4000, position: "bottom-center" });
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Options
    );
  }, [map, mapTilerKey, currentRoutePoints, skipRouteTypeSelection]); // Added skipRouteTypeSelection to dependencies
  handleLocateRef.current = handleLocate;

  // --- Other Helper Functions ---
  const hasValidRoutePoints = () => !!(currentRoutePoints?.start?.lat && currentRoutePoints?.end?.lat);
  hasValidRoutePointsRef.current = hasValidRoutePoints;

  const getRouteTypeIcon = (type) => ({ fastest: '⚡️', cell_coverage: '📱', balanced: '⚖️' }[type] || '🚗');
  getRouteTypeIconRef.current = getRouteTypeIcon;

  const getDirectionIcon = (type) => {
    const normalizedType = type?.toLowerCase() || '';
    const iconMap = {
      'straight': '⬆️', 'continue': '⬆️', 'left': '⬅️', 'slight-left': '↖️',
      'sharp-left': '↩️', 'right': '➡️', 'slight-right': '↗️', 'sharp-right': '↪️',
      'uturn': '🔄', 'uturn-left': '🔄', 'uturn-right': '🔄', 'arrive': '🏁',
      'destination': '📍', 'depart': '🚩', 'start': '🔵', 'roundabout': '🔄',
      'exit-roundabout': '⤴️', 'keep-left': '↖️', 'keep-right': '↗️',
       // Add more as needed
    };
    return iconMap[normalizedType] || '•'; // Default dot
  };
  getDirectionIconRef.current = getDirectionIcon;

  // Highlight a specific direction step on the map
  const highlightRouteSegment = useCallback((instruction, index) => {
      if (!map) return;

      clearActiveStepMarkerRef.current?.(); // Clear previous highlight

      // If clicking the same step again, just clear and return
      if (activeDirectionStep === index) {
          setActiveDirectionStep(null);
          return;
      }

      setActiveDirectionStep(index); // Set new active step

      try {
          const group = L.layerGroup();
          let boundsToFit = null;

          // Highlight the segment geometry if available
          if (instruction.segmentCoordinates && instruction.segmentCoordinates.length > 1) {
              const latLngs = instruction.segmentCoordinates.map(coord => L.latLng(coord[1], coord[0]));
              const segmentLine = L.polyline(latLngs, {
                  color: '#ff3300', // Highlight color
                  weight: 7, opacity: 0.9, dashArray: '5, 5'
              });
              group.addLayer(segmentLine);
              boundsToFit = segmentLine.getBounds(); // Get bounds of the segment
          }

          // Add a marker at the start coordinate of the maneuver
          if (instruction.coordinates) {
              let lat, lng;
              // Handle different possible coordinate structures
              if (Array.isArray(instruction.coordinates)) {
                 [lng, lat] = instruction.coordinates;
              } else if (instruction.coordinates.lat !== undefined) {
                 lat = instruction.coordinates.lat;
                 lng = instruction.coordinates.lng;
              }

              if (lat !== undefined && lng !== undefined) {
                  const pointLatLng = L.latLng(lat, lng);
                  const iconHtml = `<div class="step-marker-icon">${getDirectionIconRef.current?.(instruction.type) || '•'}</div>`;
                  const icon = L.divIcon({
                      html: iconHtml, className: 'step-marker-container',
                      iconSize: [24, 24], iconAnchor: [12, 12]
                  });
                   const hollowCircle = L.circleMarker(pointLatLng, {
                      radius: 10, color: '#ff3300', weight: 2, opacity: 0.9, fill: false
                  });
                  const iconMarker = L.marker(pointLatLng, { icon, interactive: false });

                  group.addLayer(hollowCircle);
                  group.addLayer(iconMarker);

                  // If we only have a point, make sure bounds include it
                  if (!boundsToFit) {
                       boundsToFit = L.latLngBounds(pointLatLng, pointLatLng);
                  } else {
                       boundsToFit.extend(pointLatLng);
                  }
              }
          }

          if (group.getLayers().length > 0) {
              group.addTo(map);
              setActiveStepMarker(group); // Store the layer group

              // Fit map view to the highlighted element(s)
              if (boundsToFit && boundsToFit.isValid()) {
                   map.flyToBounds(boundsToFit, { padding: [80, 80], maxZoom: 17 });
              }
          } else {
               setActiveDirectionStep(null); // No highlight was added
          }

      } catch (error) {
          console.error("Error highlighting route segment:", error);
          setActiveDirectionStep(null);
          clearActiveStepMarkerRef.current?.(); // Clean up on error
      }
  }, [map, activeDirectionStep]);
  highlightRouteSegmentRef.current = highlightRouteSegment;

  // Clear the highlighted direction step marker/segment
  const clearActiveStepMarker = useCallback(() => {
    if (activeStepMarker && map) {
      try {
        map.removeLayer(activeStepMarker);
      } catch (e) { console.warn("Minor error removing active step marker:", e); }
      setActiveStepMarker(null);
      // Don't reset activeDirectionStep here, highlightRouteSegment handles it
    }
  }, [map, activeStepMarker]);
  clearActiveStepMarkerRef.current = clearActiveStepMarker;

  // Format date string
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };
  formatDateRef.current = formatDate;

  // Toggle directions panel minimize state
  const toggleDirections = () => {
    setIsDirectionsMinimized(prev => {
      // If minimizing the panel, re-enable map interactions
      if (!prev && map) {
        // Re-enable all map interactions
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        if (map.tap) map.tap.enable();
        
        // Remove the indicator class if it exists
        const mapElement = document.getElementById('map');
        if (mapElement) {
          mapElement.classList.remove('map-interactions-disabled');
        }
      }
      return !prev;
    });
  };
  toggleDirectionsRef.current = toggleDirections;

  // Clear route display (polyline, markers, info)
  const clearRouteDisplay = useCallback(() => {
    if (routeControlRef.current && map) {
      try { map.removeLayer(routeControlRef.current); } catch(e) {}
      routeControlRef.current = null;
    }
    clearActiveStepMarkerRef.current?.(); // Clear step highlight
    setRouteInfo(null);
    setRouteDirections(null);
    setShowDirections(false);
    setActiveDirectionStep(null);
    setRouteTowers([]); // Clear route-specific towers
    setRouteOriginDisplay(''); // Clear displayed origin name
    setRouteDestinationDisplay(''); // Clear displayed destination name

    // Trigger tower update to potentially show only general towers if visible
    // Use timeout to avoid potential race conditions if called during other updates
    setTimeout(() => displayTowersRef.current?.(), 0);
  }, [map]); // Dependency: map instance
  clearRouteDisplayRef.current = clearRouteDisplay;

  // Get color based on route type
  const getRouteLineColor = (type) => ({
    fastest: '#4285F4',      // Blue
    cell_coverage: '#0F9D58', // Green
    balanced: '#F4B400'       // Yellow/Orange
  }[type] || '#666666'); // Default grey
  getRouteLineColorRef.current = getRouteLineColor;

  // Function to save the currently displayed route
  const saveCurrentRoute = useCallback(async () => {
      // Find the currently displayed route type and its data
      const currentType = routeInfo?.routeType;
      const currentRouteData = currentType ? computedRoutes[currentType] : null;

      if (!user) {
          toast.error("Please log in to save routes.", { position: "bottom-center" });
          toggleAuthFormRef.current?.(); // Open login form
          return;
      }
      if (!currentRouteData || !currentRoutePoints?.start || !currentRoutePoints?.end) {
          toast.error("No valid route to save.", { position: "bottom-center" });
          return;
      }
      if (!originValue || !destinationValue) {
           toast.error("Origin or Destination name missing.", { position: "bottom-center" });
           return;
      }

      // Check which route types have been computed
      const availableRouteTypes = {};
      let hasMultipleRoutes = false;
      
      // Check each route type
      ['fastest', 'cell_coverage', 'balanced'].forEach(type => {
          if (computedRoutes[type]) {
              availableRouteTypes[type] = true;
              if (type !== currentType) hasMultipleRoutes = true;
          }
      });
      
      // Show initial loading toast
      const saveToastId = toast.loading("Capturing route image...", { position: "bottom-center" });
      
      try {
          // Get the map element
          const mapElement = document.getElementById('map');
          
          // Store original map view state and UI element visibility
          const originalCenter = map.getCenter();
          const originalZoom = map.getZoom();
          
          // Store current UI visibility states
          const directionsVisible = document.querySelector('.routing-directions-container')?.style.display;
          const searchVisible = document.querySelector('.search-container')?.style.display;
          const authButtonsVisible = document.querySelector('.auth-buttons')?.style.display;
          const mapControlsVisible = document.querySelector('.map-controls')?.style.display;
          
          // Store current route line visibility
          let routeLine = null;
          if (routeControlRef.current) {
            routeLine = routeControlRef.current;
            map.removeLayer(routeLine);
          }
          
          // Hide all UI elements temporarily
          document.querySelectorAll('.routing-directions-container, .search-container, .search-button-container, .auth-buttons, .map-controls').forEach(el => {
            if (el) el.style.display = 'none';
          });
          
          // Create a canvas for the combined image
          const combinedCanvas = document.createElement('canvas');
          const combinedCtx = combinedCanvas.getContext('2d');
          
          // Calculate the dimensions to maintain aspect ratio
          const aspectRatio = 800 / 400;
          const targetHeight = 400;
          const targetWidth = Math.floor(targetHeight * aspectRatio);
          
          // Clear the combined canvas and set its dimensions
          combinedCanvas.width = targetWidth * 2;
          combinedCanvas.height = targetHeight;
          
          // First, capture origin point closeup
          map.setView([currentRoutePoints.start.lat, currentRoutePoints.start.lng], 21);
          // Wait for map to finish panning/zooming
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Add a temporary marker for the origin if not already visible
          const originMarker = L.marker([currentRoutePoints.start.lat, currentRoutePoints.start.lng], {
            icon: L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #2563eb; width: 40px; height: 40px; border-radius: 50%; border: 5px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.7);"></div>`,
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            })
          }).addTo(map);
          
          // Create a temporary canvas for cropping
          const tempOriginCanvas = await html2canvas(mapElement, {
              useCORS: true,
              allowTaint: true,
              scale: 4,
              logging: false,
              backgroundColor: null
          });
          
          // Create a cropped version focusing on the center
          const originCanvas = document.createElement('canvas');
          originCanvas.width = tempOriginCanvas.width;
          originCanvas.height = tempOriginCanvas.height;
          const originCtx = originCanvas.getContext('2d');
          
          // Calculate crop dimensions (center 60% of the image)
          const cropWidth = Math.floor(tempOriginCanvas.width * 0.6);
          const cropHeight = Math.floor(tempOriginCanvas.height * 0.6);
          const cropX = Math.floor((tempOriginCanvas.width - cropWidth) / 2);
          const cropY = Math.floor((tempOriginCanvas.height - cropHeight) / 2);
          
          // Draw the cropped portion scaled to full size
          originCtx.drawImage(
            tempOriginCanvas, 
            cropX, cropY, cropWidth, cropHeight,
            0, 0, originCanvas.width, originCanvas.height
          );
          
          // Remove temporary origin marker
          map.removeLayer(originMarker);
          
          // Then, capture destination point closeup
          map.setView([currentRoutePoints.end.lat, currentRoutePoints.end.lng], 21);
          // Wait for map to finish panning/zooming
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Add a temporary marker for the destination if not already visible
          const destMarker = L.marker([currentRoutePoints.end.lat, currentRoutePoints.end.lng], {
            icon: L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #dc2626; width: 40px; height: 40px; border-radius: 50%; border: 5px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.7);"></div>`,
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            })
          }).addTo(map);
          
          // Create a temporary canvas for cropping
          const tempDestCanvas = await html2canvas(mapElement, {
              useCORS: true,
              allowTaint: true,
              scale: 4,
              logging: false,
              backgroundColor: null
          });
          
          // Create a cropped version focusing on the center
          const destCanvas = document.createElement('canvas');
          destCanvas.width = tempDestCanvas.width;
          destCanvas.height = tempDestCanvas.height;
          const destCtx = destCanvas.getContext('2d');
          
          // Calculate crop dimensions (center 60% of the image)
          const destCropWidth = Math.floor(tempDestCanvas.width * 0.6);
          const destCropHeight = Math.floor(tempDestCanvas.height * 0.6);
          const destCropX = Math.floor((tempDestCanvas.width - destCropWidth) / 2);
          const destCropY = Math.floor((tempDestCanvas.height - destCropHeight) / 2);
          
          // Draw the cropped portion scaled to full size
          destCtx.drawImage(
            tempDestCanvas, 
            destCropX, destCropY, destCropWidth, destCropHeight,
            0, 0, destCanvas.width, destCanvas.height
          );
          
          // Remove temporary destination marker
          map.removeLayer(destMarker);
          
          // Restore original map view
          map.setView(originalCenter, originalZoom);
          
          // Restore UI elements visibility
          document.querySelectorAll('.routing-directions-container, .search-container, .search-button-container, .auth-buttons, .map-controls').forEach(el => {
            if (el) el.style.display = ''; // Reset to default display value
          });
          
          // Restore route line if it existed
          if (routeLine) {
            routeLine.addTo(map);
          }
          
          // Draw both images side by side on the combined canvas
          combinedCtx.drawImage(originCanvas, 0, 0, targetWidth, targetHeight);
          combinedCtx.drawImage(destCanvas, targetWidth, 0, targetWidth, targetHeight);
          
          // Convert combined canvas to base64 image
          const routeImage = combinedCanvas.toDataURL('image/jpeg', 0.85);
          
          // Dismiss previous toast and show a new one
          toast.dismiss(saveToastId);
          const newSaveToastId = toast.loading("Saving route...", { position: "bottom-center" });
          
          const allRouteData = {};
          const allRouteGeometry = {};
          
          // Add data for each computed route type
          Object.keys(computedRoutes).forEach(type => {
              if (computedRoutes[type]) {
                  allRouteData[type] = computedRoutes[type];
                  
                  // Extract geometry for each route type
                  if (computedRoutes[type].geometry && computedRoutes[type].geometry.coordinates) {
                      allRouteGeometry[type] = {
                          coordinates: computedRoutes[type].geometry.coordinates,
                          color: getRouteLineColor(type),
                          weight: 5,
                          opacity: 0.7
                      };
                  }
              }
          });
          
          const saveData = {
              origin: { place_name: originValue, lat: currentRoutePoints.start.lat, lng: currentRoutePoints.start.lng },
              destination: { place_name: destinationValue, lat: currentRoutePoints.end.lat, lng: currentRoutePoints.end.lng },
              route_data: allRouteData, // Save all computed route types
              route_type: currentType, // Save which one was active
              route_image: routeImage, // Add the route image
              route_geometry: allRouteGeometry, // Save geometry for all routes
              has_multiple_routes: hasMultipleRoutes // Flag indicating if multiple routes are available
          };

          const response = await api.post('/save-route', saveData);
          if (response.data?.success) {
              toast.success("Route saved successfully!", { id: newSaveToastId, position: "bottom-center" });
              fetchSavedRoutesRef.current?.(); // Refresh saved routes list
          } else {
              throw new Error(response.data?.error || "Failed to save route.");
          }
      } catch (error) {
          console.error("Error saving route:", error);
          toast.error(`Error saving route: ${error.message}`, { position: "bottom-center" });
      }
  }, [user, routeInfo, computedRoutes, currentRoutePoints, originValue, destinationValue, map]);
  saveCurrentRouteRef.current = saveCurrentRoute;

  // --- Effects ---

  // Log route type changes
  useEffect(() => {
    console.log(`Route type preference changed to: ${routeType}`);
  }, [routeType]);

  // Log when all routes computed state changes
  useEffect(() => {
    if (allRoutesComputed) console.log('All route types calculation process completed.');
  }, [allRoutesComputed]);

  // Prevent scrolling propagation in directions panel
  useEffect(() => {
    if (directionsContentRef.current && showDirections && !isDirectionsMinimized && window.L?.DomEvent) {
      L.DomEvent.disableScrollPropagation(directionsContentRef.current);
      L.DomEvent.disableClickPropagation(directionsContentRef.current);
    }
    // No cleanup needed as Leaflet handles its listeners internally on remove
  }, [directionsContentRef, showDirections, isDirectionsMinimized]);

  // Add map click listener to clear step highlights
  useEffect(() => {
    if (!map) return;
    const handleMapClick = () => {
      clearActiveStepMarkerRef.current?.();
      setActiveDirectionStep(null); // Also reset the active step index
    };
    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map]);

  // Clear step highlight if directions are minimized or hidden
  useEffect(() => {
    if (isDirectionsMinimized || !showDirections) {
      clearActiveStepMarkerRef.current?.();
      setActiveDirectionStep(null);
    }
  }, [isDirectionsMinimized, showDirections]);

  // Effect to hide password when clicking outside the password field
  useEffect(() => {
    // Only add listeners if auth form is open
    if (!showAuthForm) return;
    
    const handleClickOutside = (event) => {
      // Check if the click is outside the password fields and their toggle buttons
      const passwordField = document.getElementById('password');
      const confirmPasswordField = document.getElementById('confirmPassword');
      const passwordToggle = document.getElementById('password-toggle');
      const confirmPasswordToggle = document.getElementById('confirm-password-toggle');
      
      // Only hide password if clicking outside both the field and its toggle button
      if (passwordField && passwordToggle && 
          !passwordField.contains(event.target) && 
          !passwordToggle.contains(event.target)) {
        setShowPassword(false);
      }
      
      // Only hide confirm password if clicking outside both the field and its toggle button
      if (confirmPasswordField && confirmPasswordToggle && 
          !confirmPasswordField.contains(event.target) && 
          !confirmPasswordToggle.contains(event.target)) {
        setShowConfirmPassword(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAuthForm]);

  // --- Auth Form Container Effect ---
  useEffect(() => {
    if (showAuthForm && map) {
      preventMapInteractionRef.current?.();
    } else if (map) {
      const cleanup = preventMapInteractionRef.current?.();
      if (cleanup) cleanup();
    }
  }, [showAuthForm, map]);

  // --- Inline RouteTypeSelection Component ---
  const RouteTypeSelection = () => {
    if (!showRouteTypeSelection) return null;

    const handleRouteTypeSelect = (selectedType) => {
        setRouteType(selectedType); // Update state immediately
        if (skipRouteTypeSelection) {
            localStorage.setItem('preferredRouteType', selectedType); // Save preference
        }
        setShowRouteTypeSelection(false); // Close modal

        const selectedRouteData = computedRoutes[selectedType];
        if (selectedRouteData) {
            console.log(`RouteTypeSelection: Displaying selected type '${selectedType}'`);
            displayRouteRef.current?.(selectedRouteData, selectedType);
        } else {
            // This case means the data wasn't ready, which shouldn't happen if button wasn't disabled.
            // However, if it does, we might re-trigger calculation for the selected type.
            console.warn(`RouteTypeSelection: Data for '${selectedType}' not ready. Recalculation might be needed.`);
            // Optionally, trigger recalculation if points exist:
            // if (hasValidRoutePointsRef.current?.()) {
            //    calculateAllRouteTypesRef.current?.(currentRoutePoints);
            // }
             toast.success(`Calculating ${selectedType} route...`, { position: "bottom-center" }); // Inform user
        }
    };

    const handleDontAskAgainChange = (e) => {
      const checked = e.target.checked;
      setSkipRouteTypeSelection(checked);
      localStorage.setItem('skipRouteTypeSelection', checked.toString());
      if (checked) { // Save current selection as preference if checking the box
        localStorage.setItem('preferredRouteType', routeType);
      }
    };

    // Handle forgot password functionality
    const handleForgotPassword = async (e) => {
      e.preventDefault();
      setAuthError('');
      try {
        const response = await api.post('/forgot-password', { email });
        if (response.data?.success) {
          toast.success('Password reset email sent successfully!', { position: "bottom-center" });
          setAuthMode('login');
        } else {
          throw new Error(response.data?.error || 'Failed to send password reset email.');
        }
      } catch (error) {
        const errorMsg = error.message || 'Failed to send password reset email.';
        setAuthError(errorMsg);
        console.error("Forgot password error:", error);
      }
    };
    handleForgotPasswordRef.current = handleForgotPassword;

    // Determine if ANY calculation is still ongoing
    const calculationOngoing = routesAreLoading || !allRoutesComputed;

    return (
      <div className="route-type-selection-overlay" onClick={() => setShowRouteTypeSelection(false)}>
        <div className="route-type-selection-content" onClick={(e) => e.stopPropagation()}>
          <h3>Choose Route Priority</h3>
          <p>Select how you want your route optimized.</p>

          {/* Loading Indicator */}
          {calculationOngoing && (
            <div className="route-loading-indicator">
                <p>Calculating route options...</p>
                {/* Optional: Show which are pending */}
                {/* {!computedRoutes.fastest && <span>(Fastest)</span>} ... */}
            </div>
          )}

          <div className="route-selection-options">
            {['fastest', 'cell_coverage', 'balanced'].map((type) => {
              const routeData = computedRoutes[type];
              const isAvailable = !!routeData;
              const isActive = routeType === type;

              return (
                <button
                  key={type}
                  className={`route-selection-option ${isActive ? 'active' : ''} ${isAvailable ? 'available' : 'disabled'}`}
                  onClick={() => handleRouteTypeSelect(type)}
                  disabled={!isAvailable} // Disable if data not yet computed
                >
                  <div className="route-selection-icon">{getRouteTypeIconRef.current?.(type)}</div>
                  <div className="route-selection-label">{type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                  <div className="route-selection-desc">
                    {isAvailable ? (
                      `${formatDistanceRef.current?.(routeData.distance)}, ${formatDurationRef.current?.(routeData.duration)}`
                    ) : (
                      <span className="calculating">Calculating...</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="route-selection-dont-ask">
            <label className="dont-ask-label">
              <input type="checkbox" checked={skipRouteTypeSelection} onChange={handleDontAskAgainChange} />
              <span className="dont-ask-text">Remember my choice and use it automatically next time</span>
            </label>
          </div>

          <div className="route-selection-actions">
              <button className="route-selection-cancel" onClick={() => setShowRouteTypeSelection(false)}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  // --- JSX Return ---
  return (
    <div className="app-container">
      {/* Map Container */}
      <div id="map" ref={mapRef}>

        {/* Top Center Search Toggle Button */}
        <div className="search-button-container">
          <button
            className="search-button"
            onClick={toggleSearchRef.current}
            aria-label={searchExpanded ? "Close search" : "Open search"}
            title={searchExpanded ? "Close search panel" : "Open search panel"}
          >
            <img src={searchExpanded ? CloseIcon : SearchIcon} alt={searchExpanded ? "Close" : "Search"} />
          </button>
        </div>

         {/* Bottom Left Auth/User Buttons */}
        <div className="auth-buttons">
        {user ? (
          <>
            <button className="user-button" onClick={toggleSavedRoutesRef.current} title="View saved routes">My Routes</button>
            <button className="logout-button" onClick={handleLogoutRef.current} title="Log out">Logout</button>
          </>
        ) : (
          <div className="user-icon-container">
            <button 
              className="user-icon-button" 
              onClick={() => setShowAuthMenu(prev => !prev)} 
              title="Account options"
            >
              <div className="user-icon">
                <img src={UserIcon} alt="User" />
              </div>
            </button>
            {showAuthMenu && (
              <div className="auth-menu-popup">
                <div className="auth-menu-arrow"></div>
                <button 
                  className="auth-menu-option" 
                  onClick={() => {
                    setAuthMode('login');
                    setShowAuthForm(true);
                    setShowAuthMenu(false);
                  }}
                >
                  <span className="auth-menu-icon">
                    <img src={LoginIcon} alt="Login" />
                  </span> Login
                </button>
                <button 
                  className="auth-menu-option" 
                  onClick={() => {
                    setAuthMode('register');
                    setShowAuthForm(true);
                    setShowAuthMenu(false);
                  }}
                >
                  <span className="auth-menu-icon">
                    <img src={RegisterIcon} alt="Register" />
                  </span> Register
                </button>
              </div>
            )}
          </div>
        )}
        </div>

        {/* Bottom Right Map Controls */}
        <div className="map-controls">
            {/* Locate Button */}
            <button
                className={`map-control-button locate-button ${isLocating ? 'locating' : ''}`}
                onClick={handleLocateRef.current}
                title="Use Current Location as Origin"
                disabled={isLocating}
            >
                {isLocating ? '...' : '📍'}
            </button>
             {/* Route Type Selector Button */}
            <button
                className={`map-control-button route-type-button ${!hasValidRoutePointsRef.current() ? 'disabled' : ''}`}
                onClick={() => {
                    if (!hasValidRoutePointsRef.current()) {
                        toast.info("Please set both Origin and Destination first.", { position: "bottom-center" });
                        return;
                    }
                    setShowRouteTypeSelection(true); // Always show selection on button click
                    // Trigger background calculation if not already done/running
                    if (!allRoutesComputed && !routesAreLoading) {
                         calculateAllRouteTypesRef.current?.(currentRoutePoints);
                    }
                }}
                disabled={!hasValidRoutePointsRef.current()}
                title="Change Route Optimization"
            >
                {getRouteTypeIconRef.current(routeType)}
            </button>
            {/* Cell Tower Toggle Button */}
            <button
                className={`map-control-button ${showCellTowers ? 'active' : ''}`}
                onClick={toggleCellTowersRef.current}
                title={showCellTowers ? 'Hide Cell Towers' : 'Show Cell Towers'}
            >
                📡
            </button>
        </div>

        {/* --- Panels and Modals --- */}
        {/* Directions Panel (Minimized State) */}
        {routeDirections && isDirectionsMinimized && (
          <div className="routing-directions-container minimized" 
               onClick={toggleDirectionsRef.current} 
               onMouseEnter={preventMapInteractionRef.current}
               onMouseLeave={() => preventMapInteractionRef.current()?.()}
               onTouchStart={preventMapInteractionRef.current}
               onTouchEnd={() => preventMapInteractionRef.current()?.()}
               title="Expand Directions"
          >
             <div className="routing-directions-header"><div className="directions-toggle-icon">🗺️</div></div>
          </div>
        )}

        {/* Directions Panel (Full State) */}
        {routeDirections && showDirections && !isDirectionsMinimized && (
          <div className="routing-directions-container"
               onMouseEnter={preventMapInteractionRef.current}
               onMouseLeave={() => preventMapInteractionRef.current()?.()}
               onTouchStart={preventMapInteractionRef.current}
               onTouchEnd={() => preventMapInteractionRef.current()?.()}
          >
            {/* Header */}
            <div className="routing-directions-header"
                 onMouseEnter={preventMapInteractionRef.current}
                 onMouseLeave={() => preventMapInteractionRef.current()?.()}
                 onWheel={preventMapInteractionRef.current}
                 onTouchStart={preventMapInteractionRef.current}
                 onTouchEnd={() => preventMapInteractionRef.current()?.()}
            >
              <div className="routing-directions-title">
                <div className="direction-endpoints">
                   <span className="direction-origin">{routeOriginDisplay || 'Origin'}</span>
                   <span className="direction-separator">→</span>
                   <span className="direction-destination">{routeDestinationDisplay || 'Destination'}</span>
                </div>
              </div>
              <div className="routing-directions-actions">
                {/* Save Route Button - Only shown when user is logged in */}
                {user && (
                  <button 
                    className="routing-directions-save" 
                    onClick={saveCurrentRouteRef.current} 
                    title="Save Route"
                  >
                    💾
                  </button>
                )}
                <button 
                  className="routing-directions-close" 
                  onClick={toggleDirectionsRef.current} 
                  title="Minimize Directions"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="routing-directions-content" ref={directionsContentRef}>
              {/* Summary */}
              <div className="routing-summary"
                   onMouseEnter={preventMapInteractionRef.current}
                   onWheel={preventMapInteractionRef.current}
                   onTouchStart={preventMapInteractionRef.current}
              >
                <div><strong>Dist:</strong> {routeDirections.distanceFormatted}</div>
                <div><strong>Time:</strong> {routeDirections.durationFormatted}</div>
                {routeDirections.ascendFormatted && <div><strong>Asc:</strong> {routeDirections.ascendFormatted}</div>}
                {routeDirections.descendFormatted && <div><strong>Desc:</strong> {routeDirections.descendFormatted}</div>}
              </div>
              {/* Instructions List */}
              <div className="instruction-list-container">
                <ul className="instruction-list">
                  {(routeDirections.steps && routeDirections.steps.length > 0) ? routeDirections.steps.map((step, index) => (
                    <li key={index}
                        className={`instruction-item ${activeDirectionStep === index ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent map click handler
                            highlightRouteSegmentRef.current?.(step, index);
                        }}
                        onMouseEnter={preventMapInteractionRef.current}
                        onMouseLeave={() => preventMapInteractionRef.current()?.()}
                        onTouchStart={preventMapInteractionRef.current}
                        onTouchEnd={() => preventMapInteractionRef.current()?.()}
                    >
                      <div className={`instruction-icon icon-${step.type?.toLowerCase() || 'default'}`}>
                        {getDirectionIconRef.current?.(step.type) || '•'}
                      </div>
                      <div className="instruction-text">
                        <div className="instruction-direction">{step.instruction}</div>
                        {step.distanceFormatted && <div className="instruction-distance">{step.distanceFormatted}</div>}
                      </div>
                    </li>
                  )) : <li className="instruction-item"><div className="instruction-text">No detailed directions available.</div></li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Authentication Form Modal */}
        {showAuthForm && !user && (
          <div className="auth-form-container" onClick={toggleAuthFormRef.current}> {/* Close on overlay click */}
            <div className="auth-form" onClick={(e) => e.stopPropagation()}> {/* Prevent closing on form click */}
              <div className="auth-header">
                <h2>{authMode === 'login' ? 'Login' : authMode === 'register' ? 'Register' : 'Forgot Password'}</h2>
                 <button className="close-button" onClick={toggleAuthFormRef.current} title="Close">×</button>
              </div>
               {authError && <div className="auth-error">{authError}</div>}
               {authMode === 'forgot_password' ? (
                  <form onSubmit={handleForgotPasswordRef.current}>
                    <div className="form-group">
                      <label htmlFor="email">Email</label>
                      <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="submit-button">Reset Password</button>
                    </div>
                    <div className="auth-switch">
                      <p>Remember your password? <button type="button" onClick={() => { setAuthMode('login'); setAuthError(''); }}>Back to Login</button></p>
                    </div>
                  </form>
               ) : (
                  <form onSubmit={authMode === 'login' ? handleLoginRef.current : handleRegisterRef.current}>
                   <div className="form-group">
                      <label htmlFor="email">Email</label>
                      <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="password">Password</label>
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        id="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                        autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                      />
                      <button 
                        type="button" 
                        id="password-toggle"
                        className="password-visibility-toggle" 
                        onClick={() => setShowPassword(prev => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <span className={`eye-icon ${showPassword ? 'visible' : 'hidden'}`}></span>
                      </button>
                    </div>
                    {authMode === 'register' && (
                      <div className="form-group">
                          <label htmlFor="confirmPassword">Confirm Password</label>
                          <input 
                            type={showConfirmPassword ? 'text' : 'password'} 
                            id="confirmPassword" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            required 
                            autoComplete="new-password" 
                            onFocus={() => setConfirmPasswordFocused(true)}
                            onBlur={() => setConfirmPasswordFocused(false)}
                          />
                          <button 
                            type="button"
                            id="confirm-password-toggle" 
                            className="password-visibility-toggle" 
                            onClick={() => setShowConfirmPassword(prev => !prev)}
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            <span className={`eye-icon ${showConfirmPassword ? 'visible' : 'hidden'}`}></span>
                          </button>
                      </div>
                    )}
                    <div className="form-actions">
                      <button type="submit" className="submit-button">{authMode === 'login' ? 'Login' : 'Register'}</button>
                    </div>
                  <div className="auth-switch">
                     {authMode === 'login' ? (
                       <p>Forgot Password? <button type="button" onClick={() => { setAuthMode('forgot_password'); setAuthError(''); }}>Reset it here</button></p>
                     ) : (
                       <p>Have an account? <button type="button" onClick={() => { setAuthMode('login'); setAuthError(''); }}>Login</button></p>
                     )}
                  </div>
                </form>
               )}
            </div>
          </div>
        )}

        {/* Saved Routes Panel */}
        {showSavedRoutes && user && (
          <div className="saved-routes-container" onClick={toggleSavedRoutesRef.current}> {/* Close on overlay click */}
            <div className="saved-routes" 
                 onClick={(e) => e.stopPropagation()}
                 onMouseEnter={preventMapInteractionRef.current}
                 onMouseLeave={() => preventMapInteractionRef.current()?.()}
                 onTouchStart={preventMapInteractionRef.current}
                 onTouchEnd={() => preventMapInteractionRef.current()?.()}
            >
              <div className="saved-routes-header">
                <h2>My Saved Routes</h2>
                 <button className="close-button" onClick={toggleSavedRoutesRef.current} title="Close">×</button>
              </div>
               {savedRoutes.length === 0 ? (
                    <div className="no-routes"><p>No routes saved yet.</p></div>
               ) : (
                <div className="routes-list">
                  {savedRoutes.map((route, index) => (
                     <div key={route._id || index} className="route-item" 
                          onClick={() => {
                            // Ensure map interactions are re-enabled before loading route
                            if (map) {
                              map.dragging.enable();
                              map.touchZoom.enable();
                              map.doubleClickZoom.enable();
                              map.scrollWheelZoom.enable();
                              map.boxZoom.enable();
                              map.keyboard.enable();
                              if (map.tap) map.tap.enable();
                            }
                            // First close the panel
                            setShowSavedRoutes(false);
                            setSearchExpanded(false); // Collapse search panel
                            // Then load the route (after panel is closed)
                            setTimeout(() => {
                              loadSavedRouteRef.current?.(route);
                            }, 50);
                          }} 
                          title="Load this route"
                          onMouseEnter={preventMapInteractionRef.current}
                          onMouseLeave={() => preventMapInteractionRef.current()?.()}
                          onTouchStart={preventMapInteractionRef.current}
                          onTouchEnd={() => preventMapInteractionRef.current()?.()}
                     >
                      {route.route_image && (
                        <div className="route-image">
                          <img src={route.route_image} alt="Route Map" />
                        </div>
                      )}
                      <div className="route-details">
                        <div className="route-points">
                          <div className="route-origin">{route.origin?.place_name || 'Unknown Origin'}</div>
                          <div className="route-destination">{route.destination?.place_name || 'Unknown Destination'}</div>
                        </div>
                        <div className="route-meta">
                          <span className="route-type">{getRouteTypeIconRef.current(route.route_type)}{route.route_type?.replace('_', ' ')}</span>
                          <span className="route-date">{formatDateRef.current(route.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search Panel */}
        {searchExpanded && (
          <div className="search-container"
               onMouseEnter={preventMapInteractionRef.current}
               onMouseLeave={() => preventMapInteractionRef.current()?.()}
               onTouchStart={preventMapInteractionRef.current}
               onTouchEnd={() => preventMapInteractionRef.current()?.()}
          >
            <div className="search-content">
              <div className="search-header"><span>Where to?</span></div>
               {/* Origin Input */}
               <div className="search-form">
                 <div className="input-group">
                    <div className="input-container">
                        <input
                            type="text" placeholder="Origin" value={originValue}
                            onChange={(e) => handleInputChangeRef.current?.(e, true)}
                            onFocus={() => handleInputFocusRef.current?.(true)}
                            onBlur={() => handleInputBlurRef.current?.(true)}
                            aria-label="Route origin"
                        />
                        {originValue && <button className="clear-input" onClick={() => handleClearInputRef.current?.(true)} title="Clear Origin">×</button>}
                        {showOriginSuggestions && originSuggestions.length > 0 && (
                        <div className="suggestions-dropdown origin-suggestions" onWheel={preventMapInteractionRef.current}>
                            {originSuggestions.map((s, i) =>
                              <div key={`${s.id || 'no-id'}-${i}`}
                                  className="suggestion-item"
                                  onClick={() => handleSuggestionSelectRef.current?.(s, true)}
                                  onMouseDown={e => e.preventDefault()}
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
               <div className="search-form">
                <div className="input-group">
                    <div className="input-container">
                        <input
                            type="text" placeholder="Destination" value={destinationValue}
                            onChange={(e) => handleInputChangeRef.current?.(e, false)}
                            onFocus={() => handleInputFocusRef.current?.(false)}
                            onBlur={() => handleInputBlurRef.current?.(false)}
                            aria-label="Route destination"
                        />
                        {destinationValue && <button className="clear-input" onClick={() => handleClearInputRef.current?.(false)} title="Clear Destination">×</button>}
                        {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                            <div className="suggestions-dropdown destination-suggestions" onWheel={preventMapInteractionRef.current}>
                            {destinationSuggestions.map((s, i) =>
                              <div key={`${s.id || 'no-id'}-${i}`}
                                  className="suggestion-item"
                                  onClick={() => handleSuggestionSelectRef.current?.(s, false)}
                                  onMouseDown={e => e.preventDefault()}
                              >
                                {s.place_name}
                              </div>
                            )}
                            </div>
                        )}
                    </div>
                </div>
               </div>

              {/* Cell Tower Info/Toggle in Search Panel */}
              <div className="cell-tower-toggle">
                <button className={`toggle-button ${showCellTowers ? 'active' : ''}`} onClick={toggleCellTowersRef.current}>
                  <span className="toggle-icon">📡</span>
                  <span className="toggle-label">{showCellTowers ? 'Show Cell Towers' : 'Hide Cell Towers'}</span>
                </button>
                {/* Display count from allTowers ref */}
                <div className="tower-count">
                    {allTowers.current.length > 0
                    ? `${allTowers.current.length} towers in area`
                    : 'No tower data loaded'}
                </div>
              </div>

              {/* Loading Indicator */}
              {routesAreLoading && (
                <div className="loading-indicator">
                  Calculating route...
                </div>
              )}

            </div> {/* End search-content */}
          </div> // End search-container
        )}

        {/* Route Type Selection Modal */}
        <RouteTypeSelection />

        {/* End Map Container */}
      </div>
    </div> // End app-container
  );
}

export default App;