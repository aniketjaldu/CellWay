// App.jsx

import { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import SearchIcon from './assets/svg/search-icon.svg';
import CloseIcon from './assets/svg/close-icon.svg';
import axios from 'axios';
import { toast } from 'react-hot-toast';

// Create axios instance with credentials support
const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  withCredentials: true,
});

function App() {
  // --- Refs for Functions (to prevent circular dependencies) ---
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
  const calculateRouteRef = useRef(null);
  const formatDistanceRef = useRef(null);
  const formatDurationRef = useRef(null);
  const calculateSignalScoreRef = useRef(null);
  const findTowersAlongRouteRef = useRef(null); // Renamed for clarity (was getTowersAlongRoute in request)
  const extractDirectionsRef = useRef(null);
  const displayRouteRef = useRef(null);
  const displayTowersRef = useRef(null); // Ref for the main tower display logic
  const toggleCellTowersRef = useRef(null);
  const processAllRoutesRef = useRef(null);
  const calculateAllRouteTypesRef = useRef(null);
  const hasValidRoutePointsRef = useRef(null);
  const getRouteTypeIconRef = useRef(null);
  const getDirectionIconRef = useRef(null);
  const highlightRouteSegmentRef = useRef(null);
  const formatDateRef = useRef(null);
  const toggleDirectionsRef = useRef(null);
  const cleanupAnimationRef = useRef(null);
  const clearRouteDisplayRef = useRef(null);
  const getRouteLineColorRef = useRef(null);
  const handleClearInputRef = useRef(null);
  const handleLocateRef = useRef(null); // New ref for locate functionality
  // --- End Refs for Functions ---

  // Map references
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  
  // Marker states
  const [originMarker, setOriginMarker] = useState(null);
  const [destinationMarker, setDestinationMarker] = useState(null);
  
  // Search input states
  const [originValue, setOriginValue] = useState('');
  const [destinationValue, setDestinationValue] = useState('');
  
  // Search suggestions states
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  
  // Add a ref to track suggestion clicks to prevent blur from hiding suggestions
  const suggestionClickedRef = useRef(false);
  
  // UI states
  const [searchExpanded, setSearchExpanded] = useState(true);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isLocating, setIsLocating] = useState(false); // New state for locate functionality
  
  // Routing state
  // const [routeControl, setRouteControl] = useState(null); // Not strictly needed if using ref
  const routeControlRef = useRef(null); // Stores the L.polyline route layer
  
  // Input reference
  const originInputRef = useRef(null);
  
  // Authentication states
  const [user, setUser] = useState(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authError, setAuthError] = useState('');

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Route type state
  const [routeType, setRouteType] = useState('fastest');

  // Saved routes
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  
  // API key
  const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY;

  // Stores ALL towers fetched for the current area (either waypoint area or route area)
  const allTowers = useRef([]);

  // State for cell towers (used primarily for display count, maybe redundant)
  // const [cellTowers, setCellTowers] = useState([]); // Can potentially remove if allTowers.current is sufficient

  // State to control tower visibility
  const [showCellTowers, setShowCellTowers] = useState(false);
  const cellTowerLayerRef = useRef(null); // Stores the L.layerGroup for displayed towers

  // State for towers specifically along the *current* displayed route
  const [routeTowers, setRouteTowers] = useState([]); // Towers currently displayed along the route

  // State for routing directions
  const [showDirections, setShowDirections] = useState(false);
  const [routeDirections, setRouteDirections] = useState(null);
  const [isDirectionsMinimized, setIsDirectionsMinimized] = useState(false);
  const [activeDirectionStep, setActiveDirectionStep] = useState(null);
  const [activeStepMarker, setActiveStepMarker] = useState(null);

  // Add a reference for the directions panel content
  const directionsContentRef = useRef(null);

  // Route type selection state
  const [showRouteTypeSelection, setShowRouteTypeSelection] = useState(false);
  const [currentRoutePoints, setCurrentRoutePoints] = useState(null);

  // Add new state for "Don't ask again" preference
  const [skipRouteTypeSelection, setSkipRouteTypeSelection] = useState(false);

  // Store all precomputed routes
  const [computedRoutes, setComputedRoutes] = useState({
    fastest: null,
    cell_coverage: null,
    balanced: null,
    allRoutes: []
  });
  
  // Add missing state for allRoutes
  const [allRoutes, setAllRoutes] = useState([null, null, null]); // Array to hold the three route types
  
  // Store cell towers for each route type (less critical now with frontend filtering)
  const [computedRouteTowers, setComputedRouteTowers] = useState({
    fastest: [],
    cell_coverage: [],
    balanced: []
  });
  
  // Flag to track if all routes have been computed
  const [allRoutesComputed, setAllRoutesComputed] = useState(false);

  // Flag to track if routes are currently being loaded/calculated
  const [routesAreLoading, setRoutesAreLoading] = useState(false);

  // Add a state for route calculation animation
  const [calculationAnimation, setCalculationAnimation] = useState(null);
  
  // Add a state for optimization notice
  const [optimizationNotice, setOptimizationNotice] = useState(null);
  
  // --- Function Definitions and Assignments to Refs ---

  // Load route preferences - load this first
  useEffect(() => {
    console.log("Loading route preferences...");
    const savedRouteType = localStorage.getItem('preferredRouteType');
    const savedSkipSelection = localStorage.getItem('skipRouteTypeSelection');
    if (savedRouteType) {
      setRouteType(savedRouteType);
    }
    // Only set skipRouteTypeSelection if it's explicitly 'true' in localStorage
    if (savedSkipSelection === 'true') {
      setSkipRouteTypeSelection(true);
    } else {
      // Ensure it's false if not explicitly set to true
      setSkipRouteTypeSelection(false);
      localStorage.setItem('skipRouteTypeSelection', 'false');
    }
  }, []);

  // Check if user is authenticated
  useEffect(() => {
    checkAuthRef.current?.();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.get('/user');
      if (response.data && response.data.user_id) {
        setUser({ id: response.data.user_id });
        fetchSavedRoutesRef.current?.();
      }
    } catch (error) {
      console.log('Not authenticated');
    }
  };
  checkAuthRef.current = checkAuth;

  // Fetch saved routes
  const fetchSavedRoutes = async () => {
    try {
      const response = await api.get('/saved-routes');
      if (response.data) {
        setSavedRoutes(response.data);
      }
    } catch (error) {
      console.error("Error fetching saved routes:", error);
    }
  };
  fetchSavedRoutesRef.current = fetchSavedRoutes;

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const response = await api.post('/login', { email, password });
      if (response.data.success) {
        setUser(response.data.user);
        setShowAuthForm(false);
        fetchSavedRoutesRef.current?.();
        setEmail(''); setPassword('');
      }
    } catch (error) {
      setAuthError(error.response?.data?.error || 'Login failed');
    }
  };
  handleLoginRef.current = handleLogin;

  // Handle registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!username || !email || !password) {
      setAuthError('All fields are required'); return;
    }
    try {
      const response = await api.post('/register', { username, email, password });
      if (response.data.success) {
        setUser(response.data.user);
        setShowAuthForm(false);
        setUsername(''); setEmail(''); setPassword('');
      }
    } catch (error) {
      setAuthError(error.response?.data?.error || 'Registration failed');
    }
  };
  handleRegisterRef.current = handleRegister;

  // Handle logout
  const handleLogout = async () => {
    try {
      await api.post('/logout');
      setUser(null); setSavedRoutes([]);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
  handleLogoutRef.current = handleLogout;

  // Toggle auth form
  const toggleAuthForm = () => {
    setShowAuthForm(prev => !prev); setAuthError('');
  };
  toggleAuthFormRef.current = toggleAuthForm;

  // Toggle saved routes
  const toggleSavedRoutes = () => {
    setShowSavedRoutes(prev => {
      if (!prev && user) fetchSavedRoutesRef.current?.();
      return !prev;
    });
  };
  toggleSavedRoutesRef.current = toggleSavedRoutes;

  // Load a saved route
  const loadSavedRoute = (route) => {
    if (!map || !route?.route_data?.origin || !route?.route_data?.destination) return;
    setOriginValue(route.origin.place_name || route.origin);
    setDestinationValue(route.destination.place_name || route.destination);
    const originLatLng = L.latLng(route.route_data.origin.lat, route.route_data.origin.lng);
    const destLatLng = L.latLng(route.route_data.destination.lat, route.route_data.destination.lng);
    updateMarkerRef.current?.(originLatLng, true);
    updateMarkerRef.current?.(destLatLng, false);
    updateMapViewRef.current?.(originLatLng, destLatLng); // This will trigger route calc and tower fetch
    setShowSavedRoutes(false);
  };
  loadSavedRouteRef.current = loadSavedRoute;

  // Toggle search expansion
  const toggleSearch = () => setSearchExpanded(prev => !prev);
  toggleSearchRef.current = toggleSearch;

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.L || map) return; // Prevent re-initialization
    
    const mapInstance = L.map(mapRef.current).setView([42.336687, -71.095762], 13);
    L.tileLayer('https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=' + mapTilerKey, {
      attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank"> MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank"> OpenStreetMap contributors</a>',
      tileSize: 512, zoomOffset: -1, minZoom: 3
    }).addTo(mapInstance);

    setMap(mapInstance);
    if (!currentRoutePoints) setCurrentRoutePoints({ start: null, end: null });
    if (!allTowers.current) allTowers.current = [];

    setTimeout(() => mapInstance.invalidateSize(), 100);

    return () => {
        mapInstance.remove();
      setMap(null); // Clear map state on unmount
    };
  }, [mapTilerKey]); // Only depends on key

  // Update Marker Function
  const updateMarker = useCallback((latlng, isOrigin) => {
    if (!map) return null;
    let marker, currentMarker, setMarkerFn, iconHtml, className, title;
    
    if (isOrigin) {
      currentMarker = originMarker;
      setMarkerFn = setOriginMarker;
      iconHtml = `<div class="origin-marker"></div>`;
      className = '';
      title = "Origin";
      } else {
      currentMarker = destinationMarker;
      setMarkerFn = setDestinationMarker;
      iconHtml = `<div class="destination-marker"></div>`;
      className = '';
      title = "Destination";
    }

    if (currentMarker) {
      currentMarker.setLatLng(latlng);
      marker = currentMarker;
    } else {
      const icon = L.divIcon({ html: iconHtml, className: className, iconSize: [18, 18], iconAnchor: [9, 9] });
      marker = L.marker(latlng, { icon: icon, title: title }).addTo(map);
      setMarkerFn(marker);
    }
    return marker;
  }, [map, originMarker, destinationMarker]); // Dependencies: map, marker states
  updateMarkerRef.current = updateMarker;

  // Fetch Cell Towers Function
  const fetchCellTowers = useCallback(async (bounds) => {
    if (!map) return []; // Return empty array if map not ready
    
    try {
      let { min_lat, min_lng, max_lat, max_lng } = bounds;
      console.log(`Fetching cell towers in area: ${min_lat},${min_lng},${max_lat},${max_lng}`);
      
      // Show loading toast for better UX
      const loadingToast = toast.loading("Fetching cell tower data...", { position: "top-center" });
      
      const response = await api.get('/towers', { 
        params: { min_lat, min_lng, max_lat, max_lng },
        timeout: 20000 // Add timeout to prevent hanging requests
      });
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      const towers = response.data?.towers || [];
      console.log(`Received ${towers.length} cell towers from the backend`);
      
      if (towers.length > 0) {
        // No caching - just use the towers directly
        allTowers.current = towers; // Update the main tower store
        
        // Show success message
        if (towers.length > 0) {
          toast.success(`Found ${towers.length} cell towers in this area`, { 
            position: "top-center", 
            autoClose: 2000,
            icon: "📡"
          });
        }
        
        return towers; // Return fetched towers
      } else {
        allTowers.current = []; // Clear if none found
        toast.warning("No cell towers found in this area", { position: "top-center", autoClose: 3000 });
      }
      return [];
    } catch (error) {
      console.error("Error fetching cell tower data:", error);
      toast.error("Error fetching cell tower data", { position: "top-center", autoClose: 3000 });
      allTowers.current = []; // Clear on error
      return []; // Return empty array on error
    }
  }, [map]); // Dependency: map
  fetchCellTowersRef.current = fetchCellTowers;

  // Handle Input Change Function
  const preventMapInteraction = (event) => {
    event.stopPropagation();
    // Prevent map zoom/pan when scrolling within our components
    const mapContainer = document.querySelector('.mapboxgl-map');
    if (mapContainer) {
      mapContainer.style.pointerEvents = 'none';
      clearTimeout(window.mapPointerTimer);
      window.mapPointerTimer = setTimeout(() => {
        mapContainer.style.pointerEvents = 'auto';
      }, 1000);
    }
  };

  const handleInputChange = useCallback(async (e, isOrigin) => {
    const value = e.target.value;
    const setSuggestions = isOrigin ? setOriginSuggestions : setDestinationSuggestions;
    const setShowSuggestions = isOrigin ? setShowOriginSuggestions : setShowDestinationSuggestions;
    const setValue = isOrigin ? setOriginValue : setDestinationValue;

    setValue(value);

    if (!value.trim()) {
      setSuggestions([]); setShowSuggestions(false); return;
    }
    
    try {
      const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(value)}.json?key=${mapTilerKey}`);
      const data = await response.json();
      if (data?.features) {
        setSuggestions(data.features); setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching geocoding suggestions:', error);
    }
  }, [mapTilerKey]);
  handleInputChangeRef.current = handleInputChange;

  // Handle Input Focus/Blur Functions
  const handleInputFocus = useCallback((isOrigin) => {
    if (isOrigin && originSuggestions.length > 0) setShowOriginSuggestions(true);
    else if (!isOrigin && destinationSuggestions.length > 0) setShowDestinationSuggestions(true);
  }, [originSuggestions, destinationSuggestions]);
  handleInputFocusRef.current = handleInputFocus;

  const handleInputBlur = useCallback((isOrigin) => {
    setTimeout(() => { // Delay to allow click
      if (!suggestionClickedRef.current) {
        if (isOrigin) setShowOriginSuggestions(false);
        else setShowDestinationSuggestions(false);
      }
      suggestionClickedRef.current = false; // Reset click tracker
    }, 200);
  }, []);
  handleInputBlurRef.current = handleInputBlur;

  // Handle Clear Input Function
  const handleClearInput = useCallback((isOrigin) => {
    if (isOrigin) {
      setOriginValue('');
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
      // Clear origin marker and route point if exists
      if (originMarker) {
        updateMarkerRef.current?.(null, true);
        setCurrentRoutePoints(prev => ({ ...prev, start: null }));
      }
    } else {
      setDestinationValue('');
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
      // Clear destination marker and route point if exists
      if (destinationMarker) {
        updateMarkerRef.current?.(null, false);
        setCurrentRoutePoints(prev => ({ ...prev, end: null }));
      }
    }
    
    // Clear route if either origin or destination is cleared
    clearRouteDisplayRef.current?.();
    setAllRoutesComputed(false);
    setRoutesAreLoading(false);
    setIsLoadingRoute(false);
  }, [originMarker, destinationMarker]);
  handleClearInputRef.current = handleClearInput;

  // Handle Suggestion Select Function (Triggers Initial Tower Fetch)
  const handleSuggestionSelect = useCallback(async (suggestion, isOrigin) => {
    if (!map) return;
    suggestionClickedRef.current = true; // Mark click happened

    const [lng, lat] = suggestion.center;
    const latlng = L.latLng(lat, lng);
    const placeName = suggestion.place_name;

    // Update marker
    updateMarkerRef.current?.(latlng, isOrigin);

    // Update input value and suggestions
    if (isOrigin) {
      setOriginValue(placeName);
      setShowOriginSuggestions(false);
      setCurrentRoutePoints(prev => ({ ...prev, start: { lat, lng } }));
    } else {
      setDestinationValue(placeName);
      setShowDestinationSuggestions(false);
      setCurrentRoutePoints(prev => ({ ...prev, end: { lat, lng } }));
    }

    // Check if BOTH points are now set
    const otherMarker = isOrigin ? destinationMarker : originMarker;
    const currentPoints = isOrigin
      ? { start: { lat, lng }, end: currentRoutePoints?.end }
      : { start: currentRoutePoints?.start, end: { lat, lng } };

    if (currentPoints.start && currentPoints.end) {
      const originLL = L.latLng(currentPoints.start.lat, currentPoints.start.lng);
      const destLL = L.latLng(currentPoints.end.lat, currentPoints.end.lng);

      // Clear any existing route and calculations
      clearRouteDisplayRef.current?.();
      setAllRoutesComputed(false);
      setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null });
      setComputedRouteTowers({ fastest: null, cell_coverage: null, balanced: null });
      setRoutesAreLoading(false);
      setIsLoadingRoute(false);
      setCalculationAnimation(null);

      // Fit map to points
      const bounds = L.latLngBounds([originLL, destLL]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      
      // Fetch towers between waypoints
      console.log("Fetching initial towers between waypoints...");
      const waypointPadding = 0.02;
      const initialBounds = {
        min_lat: Math.min(originLL.lat, destLL.lat) - waypointPadding,
        min_lng: Math.min(originLL.lng, destLL.lng) - waypointPadding,
        max_lat: Math.max(originLL.lat, destLL.lat) + waypointPadding,
        max_lng: Math.max(originLL.lng, destLL.lng) + waypointPadding
      };
      await fetchCellTowersRef.current?.(initialBounds);
      // Removed automatic enabling of cell towers
      // setShowCellTowers(true);

      // Show route type selection if not skipping
      if (!skipRouteTypeSelection) {
        setShowRouteTypeSelection(true);
      }

      // Update map view and trigger new route calculation
      updateMapViewRef.current?.(originLL, destLL);
        setSearchExpanded(false);
    } else {
      // Only one point selected, just fly to it
      map.flyTo(latlng, Math.max(map.getZoom(), 14));
    }
  }, [map, destinationMarker, originMarker, currentRoutePoints, skipRouteTypeSelection]);
  handleSuggestionSelectRef.current = handleSuggestionSelect;

  // Update Map View Function (Triggers Route Calculation)
  const updateMapView = useCallback((originLatLng, destLatLng) => {
    if (!map || !originLatLng || !destLatLng) return;
    console.log("Updating map view and triggering route calculation process...");

    const bounds = L.latLngBounds([originLatLng, destLatLng]);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });

    const routePointsForCalc = {
      start: { lat: originLatLng.lat, lng: originLatLng.lng },
      end: { lat: destLatLng.lat, lng: destLatLng.lng }
    };
    
    // Update state, but don't rely on it for immediate calculation
    setCurrentRoutePoints(routePointsForCalc);

    // Force reset ALL route calculation state
    console.log("RESET: Clearing all previous route calculation state");
    window._routeCalcStartTime = null;
    setRoutesAreLoading(false);
    setIsLoadingRoute(false);
    setAllRoutesComputed(false);
    setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null, allRoutes: [] });
    setComputedRouteTowers({ fastest: [], cell_coverage: [], balanced: [] });
    
    // Clear previous route display
    clearRouteDisplayRef.current?.();
    setSearchExpanded(false);

    // Fetch cell towers for the route calculation area with increased padding
    console.log("Fetching towers for route calculation area...");
    const routePadding = 0.1;
    const towerBounds = {
      min_lat: Math.min(originLatLng.lat, destLatLng.lat) - routePadding,
      min_lng: Math.min(originLatLng.lng, destLatLng.lng) - routePadding,
      max_lat: Math.max(originLatLng.lat, destLatLng.lat) + routePadding,
      max_lng: Math.max(originLatLng.lng, destLatLng.lng) + routePadding
    };

    // Fetch towers and then start a clean route calculation
    fetchCellTowersRef.current?.(towerBounds)
      .then(fetchedTowersForRoute => {
        console.log(`Using ${allTowers.current.length} towers for route calculation.`);
        
        // Set loading flags and start time
        setIsLoadingRoute(true);
        setRoutesAreLoading(true);
        window._routeCalcStartTime = Date.now();
        console.log("STARTING NEW CALCULATION with timestamp:", window._routeCalcStartTime);
        
        // Use setTimeout to ensure render cycle completes
        setTimeout(() => {
          // Double check state is consistent
          if (!window._routeCalcStartTime) {
            window._routeCalcStartTime = Date.now();
          }
          
          // Call calculation function with direct route points instead of relying on state
          calculateRouteWithPoints(routePointsForCalc);
        }, 50);
      })
      .catch(error => {
        console.error("Error fetching towers for route calculation:", error);
        // Still try to calculate routes even if tower fetch fails
        setIsLoadingRoute(true);
        setRoutesAreLoading(true);
        window._routeCalcStartTime = Date.now();
        
        setTimeout(() => {
          calculateRouteWithPoints(routePointsForCalc);
        }, 50);
      });
  }, [map]); // Dependencies
  updateMapViewRef.current = updateMapView;

  // Helper function to calculate routes with direct point parameters
  const calculateRouteWithPoints = (routePoints) => {
    console.log("CALCULATE WITH POINTS:", routePoints);
    
    // Critical validation - ensure we have valid route points
    if (!routePoints?.start?.lat || !routePoints?.start?.lng || 
        !routePoints?.end?.lat || !routePoints?.end?.lng) {
      console.error("CALCULATE: Cannot calculate routes - missing route points");
      setRoutesAreLoading(false);
      setIsLoadingRoute(false);
      window._routeCalcStartTime = null;
      return;
    }
    
    // Call the real calculation function with the points
    calculateAllRouteTypesWithPoints(routePoints);
  };

  // Modified calculate function that takes points parameter
  const calculateAllRouteTypesWithPoints = async (points) => {
    console.log("CALCULATE: Starting route calculation with:", points);
    
    // Note: We're intentionally NOT checking routesAreLoading here to avoid getting stuck
    console.log("CALCULATE: Proceeding with route calculation regardless of previous state");
    
    // Ensure we have a calculation start time
    if (!window._routeCalcStartTime) {
      window._routeCalcStartTime = Date.now();
    }
    
    // Set loading flags - regardless of previous state
    setRoutesAreLoading(true);
    setIsLoadingRoute(true);
    setAllRoutesComputed(false);
    
    // No caching - always calculate fresh routes
    try {
      console.time('routeCalculation');
      console.log("CALCULATE: Requesting routes from GraphHopper API");
      
      // Request fastest route first (will generate all 10 routes on the backend)
      const fastestRouteResult = await calculateRouteRef.current?.(
        points.start.lat,
        points.start.lng,
        points.end.lat,
        points.end.lng,
        'fastest'
      );
      
      if (!fastestRouteResult?.route) {
        throw new Error('Failed to calculate routes');
      }
      
      console.log("CALCULATE: Got fastest route successfully");
      
      // Get the fastest route data
      const fastestRouteData = fastestRouteResult.route;
      const fastestTowers = fastestRouteResult.towers;
      
      // Update UI with fastest route immediately for responsive feedback
      setComputedRoutes(prev => ({ ...prev, fastest: fastestRouteData }));
      setComputedRouteTowers(prev => ({ ...prev, fastest: fastestTowers }));
      
      if (routeType === 'fastest') {
        displayRouteRef.current?.(fastestRouteData, 'fastest');
      }
      
      console.log("CALCULATE: Requesting cell coverage and balanced routes");
      
      // Calculate other route types in parallel
      const [cellCoverageResult, balancedResult] = await Promise.all([
        calculateRouteRef.current?.(
          points.start.lat,
          points.start.lng,
          points.end.lat,
          points.end.lng,
          'cell_coverage'
        ).catch(err => {
          console.error("Error calculating cell coverage route:", err);
          return null;
        }),
        
        calculateRouteRef.current?.(
          points.start.lat,
          points.start.lng,
          points.end.lat,
          points.end.lng,
          'balanced'
        ).catch(err => {
          console.error("Error calculating balanced route:", err);
          return null;
        })
      ]);
      
      // Process cell coverage route if available
      let cellCoverageRouteData, cellCoverageTowers;
      if (cellCoverageResult?.route) {
        cellCoverageRouteData = cellCoverageResult.route;
        cellCoverageTowers = cellCoverageResult.towers;
        
        setComputedRoutes(prev => ({ ...prev, cell_coverage: cellCoverageRouteData }));
        setComputedRouteTowers(prev => ({ ...prev, cell_coverage: cellCoverageTowers }));
        
        if (routeType === 'cell_coverage') {
          displayRouteRef.current?.(cellCoverageRouteData, 'cell_coverage');
        }
      } else {
        // Fallback to fastest if cell coverage calculation failed
        cellCoverageRouteData = fastestRouteData;
        cellCoverageTowers = fastestTowers;
        console.warn("Cell coverage route calculation failed, using fastest route as fallback");
      }
      
      // Process balanced route if available
      let balancedRouteData, balancedTowers;
      if (balancedResult?.route) {
        balancedRouteData = balancedResult.route;
        balancedTowers = balancedResult.towers;
        
        setComputedRoutes(prev => ({ ...prev, balanced: balancedRouteData }));
        setComputedRouteTowers(prev => ({ ...prev, balanced: balancedTowers }));
        
        if (routeType === 'balanced') {
          displayRouteRef.current?.(balancedRouteData, 'balanced');
        }
      } else {
        // Fallback to fastest if balanced calculation failed
        balancedRouteData = fastestRouteData;
        balancedTowers = fastestTowers;
        console.warn("Balanced route calculation failed, using fastest route as fallback");
      }
      
      console.timeEnd('routeCalculation');
      console.log("CALCULATE: All routes calculated successfully");
      
      // Create final route data for state updates
      const finalComputedRoutes = {
        fastest: fastestRouteData,
        cell_coverage: cellCoverageRouteData,
        balanced: balancedRouteData
      };
      
      // Update array of routes
      const newAllRoutes = [
        finalComputedRoutes.fastest,
        finalComputedRoutes.cell_coverage,
        finalComputedRoutes.balanced
      ];
      
      setAllRoutes(newAllRoutes);
      
      // No caching - just update state
      setAllRoutesComputed(true);
      setRoutesAreLoading(false);
      setIsLoadingRoute(false);
      window._routeCalcStartTime = null;
      
      console.log("CALCULATE: Route calculation process complete");
    } catch (error) {
      console.error('CALCULATE ERROR:', error);
      
      // Reset all states even on error
      setAllRoutesComputed(true); // Mark as completed
      setRoutesAreLoading(false);
      setIsLoadingRoute(false);
      window._routeCalcStartTime = null;
      
      // Show error to user
      toast.error("Error calculating routes. Please try again.", { position: "top-center" });
      console.log("CALCULATE: Process terminated with errors");
    }
  };

  // Update the reference to point to our wrapper function 
  calculateAllRouteTypesRef.current = calculateRouteWithPoints;

  // Calculate Route Function (Calls Backend)
  const calculateRoute = useCallback(async (startLat, startLng, endLat, endLng, routeType) => {
    const validCoords = [startLat, startLng, endLat, endLng].map(c => Number(parseFloat(c).toFixed(6)));
    if (validCoords.some(isNaN)) {
      throw new Error(`Invalid coordinates: (${startLat}, ${startLng}) to (${endLat}, ${endLng})`);
    }
    const [validStartLat, validStartLng, validEndLat, validEndLng] = validCoords;
    
    console.log(`Calculating ${routeType} route from (${validStartLat}, ${validStartLng}) to (${validEndLat}, ${validEndLng})`);
    try {
      const response = await api.get('/route', {
        params: { start_lat: validStartLat, start_lng: validStartLng, end_lat: validEndLat, end_lng: validEndLng, route_type: routeType }
      });
      const data = response.data;
      console.log(`API Response for ${routeType} route:`, data);
      
      if (data?.code === 'Ok' && data.routes?.length > 0 && data.routes[0].geometry) {
        console.log(`Route ${routeType} calculated successfully`);
        const route = data.routes[0];
        return {
          route: { // Format consistently
          routes: data.routes,
          waypoints: data.waypoints,
          distance: route.distance,
          duration: route.duration
          },
          towers: data.towers || [] // Towers returned by backend route
        };
      } else {
        console.error(`Route ${routeType} calculation failed - Response data:`, data);
        throw new Error(`Failed to calculate ${routeType} route: ${data?.message || 'No route data returned'}`);
      }
    } catch (error) {
      console.error(`Route calculation failed for ${routeType}:`, error);
      console.error(`Error details:`, error.response?.data || 'No response data');
      throw error;
    }
  }, []); // No dependencies
  calculateRouteRef.current = calculateRoute;

  // Format Distance/Duration Helpers
  const formatDistance = (distanceInMeters) => {
    const distanceInKm = distanceInMeters / 1000;
    if (distanceInKm < 1) return `${Math.round(distanceInMeters)} m`;
    if (distanceInKm < 10) return `${distanceInKm.toFixed(1)} km`;
      return `${Math.round(distanceInKm)} km`;
  };
  formatDistanceRef.current = formatDistance;

  const formatDuration = (durationInSeconds) => {
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    if (hours > 0) return `${hours} h ${minutes} min`;
      return `${minutes} min`;
  };
  formatDurationRef.current = formatDuration;

  // Calculate Signal Score Helper
  const calculateSignalScore = (towers) => {
    if (!towers || towers.length === 0) return 0;
    const avgSignal = towers.reduce((sum, t) => sum + (t.averageSignal || -100), 0) / towers.length;
    const normSignal = Math.max(0, Math.min(5, (avgSignal + 120) / 14)); // Normalize -120 to -50 -> 0 to 5
    const countFactor = Math.min(1, towers.length / 20); // Weight by tower count (up to 20)
    return (normSignal * 0.7) + (5 * countFactor * 0.3); // 70% signal, 30% count
  };
  calculateSignalScoreRef.current = calculateSignalScore;

  // Find Towers Along Route Function (Requirement 4 Algorithm)
  const findTowersAlongRoute = useCallback((towersToFilter, routeGeometry, maxDistance = 1000) => {
    if (!map || !towersToFilter || towersToFilter.length === 0 || !routeGeometry?.coordinates || routeGeometry.coordinates.length < 2) {
        return [];
    }
    console.log(`Finding towers along route from ${towersToFilter.length} candidates within ${maxDistance}m...`);
    
    const routeCoords = routeGeometry.coordinates; // Expecting GeoJSON [lng, lat] format
    const towersWithDistance = [];

    // Precompute route segments to avoid repeated calculation
    const routeSegments = [];
    for (let i = 0; i < routeCoords.length - 1; i++) {
      routeSegments.push({
        start: L.latLng(routeCoords[i][1], routeCoords[i][0]),
        end: L.latLng(routeCoords[i+1][1], routeCoords[i+1][0])
      });
    }

    // Helper function to calculate distance from point to line segment
    const distanceToSegment = (point, lineStart, lineEnd) => {
      const dx = lineEnd.lng - lineStart.lng;
      const dy = lineEnd.lat - lineStart.lat;
      const len2 = dx * dx + dy * dy;

      if (len2 === 0) return point.distanceTo(lineStart);

      // Calculate projection of point onto line
      const t = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / len2;

      if (t < 0) return point.distanceTo(lineStart);
      if (t > 1) return point.distanceTo(lineEnd);

      // Point is on line segment
      const projection = L.latLng(
        lineStart.lat + t * dy,
        lineStart.lng + t * dx
      );
      return point.distanceTo(projection);
    };

    // Create a simplified route for faster initial filtering
    // This reduces the number of detailed distance calculations needed
    const routeBounds = L.latLngBounds();
    routeSegments.forEach(segment => {
      routeBounds.extend(segment.start);
      routeBounds.extend(segment.end);
    });
    
    // Expand bounds by maxDistance
    const expandedBounds = L.latLngBounds(
      L.latLng(routeBounds.getSouth() - maxDistance/111000, routeBounds.getWest() - maxDistance/111000),
      L.latLng(routeBounds.getNorth() + maxDistance/111000, routeBounds.getEast() + maxDistance/111000)
    );
    
    // First quick filter by bounding box
    const preFilteredTowers = towersToFilter.filter(tower => {
      if (!tower.lat || !tower.lon) return false;
      const towerPoint = L.latLng(tower.lat, tower.lon);
      return expandedBounds.contains(towerPoint);
    });
    
    console.log(`Quick spatial filter: ${preFilteredTowers.length}/${towersToFilter.length} towers in route bounding box`);

    // Now do more precise distance calculation on smaller set
    preFilteredTowers.forEach(tower => {
      if (tower.lat && tower.lon) {
        const towerPoint = L.latLng(tower.lat, tower.lon);
        try {
          let minDistance = Infinity;

          // Calculate distance to each line segment
          for (const segment of routeSegments) {
            const distance = distanceToSegment(towerPoint, segment.start, segment.end);
            if (distance < minDistance) {
              minDistance = distance;
              // Early exit if we found a very close distance
              if (minDistance <= 100) break;
            }
          }

          if (minDistance <= maxDistance) {
            towersWithDistance.push({ ...tower, distanceToRoute: minDistance });
          }
        } catch (e) {
          console.warn(`Error calculating distance for tower: ${tower.id || 'unknown'}`, e);
        }
      }
    });

    towersWithDistance.sort((a, b) => a.distanceToRoute - b.distanceToRoute);

    // Smart filtering for large result sets
    if (towersWithDistance.length > 100) {
        console.log(`Applying smart filter: ${towersWithDistance.length} towers found.`);
        // Very close towers (always keep these)
        const veryClose = towersWithDistance.filter(t => t.distanceToRoute <= 200);
        
        // Mid-distance towers (keep some proportion)
        const midDistance = towersWithDistance.filter(t => t.distanceToRoute > 200 && t.distanceToRoute <= 600);
        const midStep = Math.max(1, Math.floor(midDistance.length / Math.min(midDistance.length, 40)));
        const sampledMid = midDistance.filter((_, i) => i % midStep === 0);
        
        // Far towers (keep fewer)
        const farDistance = towersWithDistance.filter(t => t.distanceToRoute > 600 && t.distanceToRoute <= maxDistance);
        const farStep = Math.max(1, Math.floor(farDistance.length / Math.min(farDistance.length, 30)));
        const sampledFar = farDistance.filter((_, i) => i % farStep === 0);
        
        const filteredTowers = [...veryClose, ...sampledMid, ...sampledFar];
        
        if (filteredTowers.length < 20 && towersWithDistance.length >= 20) {
            return towersWithDistance.slice(0, 100);
        }
        
        console.log(`Smart filter applied, ${filteredTowers.length} towers selected.`);
        return filteredTowers;
    }

    console.log(`Found ${towersWithDistance.length} towers within ${maxDistance}m of the route.`);
    return towersWithDistance;
  }, [map]); // Dependency: map
  findTowersAlongRouteRef.current = findTowersAlongRoute;

  // Extract Directions Helper
  const extractDirections = (routeData, routeTypeArg) => {
    if (!routeData?.routes?.[0]) return null;
    const route = routeData.routes[0];
    const legs = route.legs || [];
    const distanceM = route.distance;
    const durationS = route.duration;
    const ascendM = route.ascend || 0;
    const descendM = route.descend || 0;
    
    let formattedSteps = [];
    
    // Helper function to capitalize first letter
    const capitalize = (str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    };
    
    // Helper function to get a proper street name
    const getStreetName = (name) => {
      return name || '';
    };
    
    // GraphHopper sign to maneuver type mapping
    const signToManeuverType = (sign) => {
      switch(sign) {
        case -98: return 'uturn';      // U-turn without knowledge if left or right
        case -8: return 'uturn-left';  // Left U-turn
        case -7: return 'keep-left';   // Keep left
        case -6: return 'exit-roundabout'; // Leave roundabout
        case -3: return 'sharp-left';  // Turn sharp left
        case -2: return 'left';        // Turn left
        case -1: return 'slight-left'; // Turn slight left
        case 0: return 'straight';     // Continue on street
        case 1: return 'slight-right'; // Turn slight right
        case 2: return 'right';        // Turn right
        case 3: return 'sharp-right';  // Turn sharp right
        case 4: return 'destination';  // Finish instruction
        case 5: return 'via';          // Via point
        case 6: return 'roundabout';   // Enter roundabout
        case 7: return 'keep-right';   // Keep right
        case 8: return 'uturn-right';  // Right U-turn
        default: return 'straight';
      }
    };
    
    // Process each leg and its steps
    legs.forEach((leg, legIndex) => {
      const steps = leg.steps || [];
      
      // Add starting point for first leg
      if (legIndex === 0 && steps.length > 0) {
        formattedSteps.push({
          type: 'start',
          instruction: 'Start from ' + (originValue || 'origin'),
          distanceFormatted: '',
          coordinates: steps[0]?.geometry?.coordinates?.[0] || null
        });
      }
      
      // Process each step
      steps.forEach((step, stepIndex) => {
        // Skip steps with no maneuver
        if (!step.maneuver) return;
        
        // Get maneuver details
        const maneuver = step.maneuver || {};
        const signCode = maneuver.type || 0;
        let type = signToManeuverType(signCode);
        let modifier = maneuver.modifier || '';
        
        // Build a better instruction
        let instruction = '';
        const name = getStreetName(step.name);
        const distance = formatDistanceRef.current?.(step.distance) || '';
        
        // Use the text from GraphHopper if available, otherwise build our own
        if (step.instruction_text && step.instruction_text.trim() !== '') {
          instruction = step.instruction_text;
        } else {
          // Format the instruction based on maneuver type
          if (type === 'straight' || type === 'continue') {
            instruction = name ? `Continue on ${name}` : `Continue straight`;
          } else if (['right', 'left', 'slight-right', 'slight-left', 'sharp-right', 'sharp-left'].includes(type)) {
            instruction = name 
              ? `${capitalize(type)} onto ${name}` 
              : `${capitalize(type)}`;
          } else if (type === 'roundabout') {
            const exit = maneuver.exit_number || '1st';
            instruction = name 
              ? `At the roundabout, take the ${exit} exit onto ${name}` 
              : `At the roundabout, take the ${exit} exit`;
          } else if (type === 'exit-roundabout') {
            instruction = name 
              ? `Exit the roundabout onto ${name}` 
              : `Exit the roundabout`;
          } else if (type === 'keep-left' || type === 'keep-right') {
            instruction = name 
              ? `${capitalize(type.replace('-', ' '))} onto ${name}` 
              : `${capitalize(type.replace('-', ' '))}`;
          } else if (type === 'destination') {
            instruction = `Arrive at ${destinationValue || 'destination'}`;
          } else if (type === 'uturn' || type === 'uturn-left' || type === 'uturn-right') {
            instruction = name 
              ? `Make a U-turn onto ${name}` 
              : `Make a U-turn`;
          } else if (type === 'via') {
            instruction = `Pass via point`;
          } else {
            // Use a generic instruction for other types
            instruction = name 
              ? `${capitalize(type.replace('-', ' '))} onto ${name}`.trim()
              : `${capitalize(type.replace('-', ' '))}`.trim();
          }
        }
        
        // Ensure instruction starts with a capital letter
        instruction = capitalize(instruction);
        
        // Add road details if available
        let roadInfo = '';
        if (step.road_class) {
          roadInfo += `${capitalize(step.road_class)} `;
        }
        if (step.max_speed) {
          roadInfo += `(max ${step.max_speed} km/h) `;
        }
        
        // Add elevation info if available for significant climbs/descents
        let elevationInfo = '';
        if (step.ascend > 10 || step.descend > 10) {
          if (step.ascend > 10) {
            elevationInfo += `↗️ ${Math.round(step.ascend)}m `;
          }
          if (step.descend > 10) {
            elevationInfo += `↘️ ${Math.round(step.descend)}m `;
          }
        }
        
        formattedSteps.push({
          type: type,
          instruction: instruction,
          distanceFormatted: distance,
          coordinates: step.geometry?.coordinates?.[0] || null,
          streetName: name,
          roadInfo: roadInfo.trim(),
          elevationInfo: elevationInfo.trim(),
          signCode: signCode,
          exitNumber: maneuver.exit_number,
          turnAngle: maneuver.turn_angle,
          // Store the entire segment coordinates for highlighting
          segmentCoordinates: step.geometry?.coordinates || []
        });
      });
      
      // Add destination point for last leg if needed
      if (legIndex === legs.length - 1) {
        // Check if the last formatted step is already a destination
        const lastFormattedStep = formattedSteps[formattedSteps.length - 1];
        
        // Only add a destination step if the last one isn't already a destination
        if (lastFormattedStep && lastFormattedStep.type !== 'destination') {
          const lastStep = steps[steps.length - 1];
          const lastCoord = lastStep?.geometry?.coordinates?.[lastStep.geometry.coordinates.length - 1];
          
          formattedSteps.push({
            type: 'destination',
            instruction: 'Arrive at ' + (destinationValue || 'destination'),
            distanceFormatted: '',
            coordinates: lastCoord || null
          });
        }
      }
    });
    
    // Ensure we have at least basic start/end steps if no other steps
    if (formattedSteps.length === 0) {
      if (route.geometry?.coordinates?.length >= 2) {
        formattedSteps = [
          {
            type: 'start',
            instruction: 'Start from ' + (originValue || 'origin'),
            distanceFormatted: '',
            coordinates: route.geometry.coordinates[0]
          },
          {
            type: 'destination',
            instruction: 'Arrive at ' + (destinationValue || 'destination'),
            distanceFormatted: formatDistanceRef.current?.(distanceM) || '',
            coordinates: route.geometry.coordinates[route.geometry.coordinates.length - 1]
          }
        ];
      }
    }

    return {
      distanceFormatted: formatDistanceRef.current?.(distanceM) || '',
      durationFormatted: formatDurationRef.current?.(durationS) || '',
      ascendFormatted: ascendM > 0 ? `${Math.round(ascendM)}m ↗️` : '',
      descendFormatted: descendM > 0 ? `${Math.round(descendM)}m ↘️` : '',
      steps: formattedSteps,
      isGraphHopperRoute: true,
      optimizationType: routeTypeArg || route.properties?.optimizationType || 'balanced',
      origin: originValue,
      destination: destinationValue
    };
  };
  extractDirectionsRef.current = extractDirections;

  // Display Route Function (Requirement 2)
  const displayRoute = useCallback((routeData, routeType) => {
    if (!map || !routeData?.routes?.[0]?.geometry?.coordinates) {
      console.error("displayRoute: Map not ready or no valid route geometry provided.");
        return;
    }

    // Clear previous route display first
    clearRouteDisplayRef.current?.();

    try {
        const route = routeData.routes[0];
      const routeCoordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // To LatLng
        
        // Create and add the route line
        const routeLine = L.polyline(routeCoordinates, {
        color: getRouteLineColorRef.current?.(routeType) || '#4285F4',
        weight: 5, opacity: 0.8
        }).addTo(map);

      routeControlRef.current = routeLine; // Store ref to the route layer

        map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

      // Update route info panel state
      const distanceM = route.distance;
      const durationS = route.duration;
      // Signal score calculation will happen based on towers filtered later
        setRouteInfo({
        distance: distanceM,
        duration: durationS,
        // signalQuality: calculated later
            routeType: routeType,
        // towerCount: calculated later
      });

        // Extract and set directions
      const directions = extractDirectionsRef.current?.(routeData);
        if (directions) {
            setRouteDirections(directions);
            setShowDirections(true);
        setIsDirectionsMinimized(false); // Ensure directions are visible
        // Removed setIsDirectionsCollapsed(false);
      }

      // Trigger tower display update AFTER route is drawn
      // The useEffect hook watching showCellTowers will handle this
      if (showCellTowers) {
         displayTowersRef.current?.(); // Manually trigger update if needed, or rely on effect
      }


    } catch (error) {
        console.error("Error displaying route:", error);
        toast.error("Error displaying route");
    }
  }, [map, showCellTowers]); // Dependencies: map, showCellTowers state
  displayRouteRef.current = displayRoute;

  // --- Tower Display Logic (Replaces previous useEffect) ---
  // This function decides WHAT towers to show based on current state
  const displayTowers = useCallback(() => {
      if (!map) return;

      // Always clear previous tower layer
      if (cellTowerLayerRef.current) {
          map.removeLayer(cellTowerLayerRef.current);
          cellTowerLayerRef.current = null;
      }

      // Only display if toggled on
      if (!showCellTowers) {
          setRouteTowers([]); // Clear route-specific towers when hidden
          return;
      }
          
      // Use a layerGroup for better performance
      const towerLayer = L.layerGroup();
      let towersToDisplay = [];
      const currentRouteLayer = routeControlRef.current;
      
      // Create geometry only if we have a route
      const currentRouteGeometry = currentRouteLayer ? {
          type: "LineString", 
          coordinates: currentRouteLayer.getLatLngs().map(ll => [ll.lng, ll.lat])
      } : null;

      // Limit the number of towers to display for performance
      const MAX_DISPLAY_TOWERS = 500;

      if (currentRouteLayer && currentRouteGeometry) {
          // --- Display Towers Along Route ---
          console.log("Displaying towers along the current route...");
          
          // Check if we already have route-specific towers cached
          let routeSpecificTowers = routeTowers;
          
          // If no cached route towers or empty, recalculate
          if (!routeSpecificTowers || routeSpecificTowers.length === 0) {
              routeSpecificTowers = findTowersAlongRouteRef.current?.(allTowers.current, currentRouteGeometry, 500) || [];
              setRouteTowers(routeSpecificTowers); // Cache for future use
          }
          
          towersToDisplay = routeSpecificTowers;
          
          // Update routeInfo with signal score
          const signalQuality = calculateSignalScoreRef.current?.(towersToDisplay) || 0;
          setRouteInfo(prev => prev ? { 
              ...prev, 
              signalQuality: signalQuality, 
              towerCount: towersToDisplay.length 
          } : null);
      } else {
          // --- Initial Display (Before Route) or No Route ---
          console.log("Displaying all fetched towers (no route active)...");
          towersToDisplay = allTowers.current || [];
          setRouteTowers([]); // No route-specific towers
          
          // Clear route-specific info
          setRouteInfo(prev => prev ? { 
              ...prev, 
              signalQuality: undefined, 
              towerCount: undefined 
          } : null);
      }

      // Limit number of towers displayed for performance
      let displayLimit = Math.min(towersToDisplay.length, MAX_DISPLAY_TOWERS);
      
      if (towersToDisplay.length > MAX_DISPLAY_TOWERS) {
          console.log(`Limiting tower display to ${MAX_DISPLAY_TOWERS} out of ${towersToDisplay.length} total towers`);
          // For large sets, prioritize by signal strength and distance to route
          towersToDisplay.sort((a, b) => {
              // If along route, prioritize by distance to route first
              if (a.distanceToRoute && b.distanceToRoute) {
                  return a.distanceToRoute - b.distanceToRoute;
              }
              // Otherwise by signal strength (stronger first)
              return (b.averageSignal || -100) - (a.averageSignal || -100);
          });
          
          towersToDisplay = towersToDisplay.slice(0, MAX_DISPLAY_TOWERS);
      }

      // Use a more efficient tower rendering approach - batch creation
      console.log(`Rendering ${towersToDisplay.length} towers on the map`);
      
      // Create markers in batches for better performance
      const BATCH_SIZE = 50;
      const processBatch = (startIdx) => {
          const endIdx = Math.min(startIdx + BATCH_SIZE, towersToDisplay.length);
          
          for (let i = startIdx; i < endIdx; i++) {
              const tower = towersToDisplay[i];
              if (!tower.lat || !tower.lon) continue;
              
              // Calculate signal class
              const signalStrength = tower.averageSignal || -100;
              let signalClass = 'weak';
              if (signalStrength > -70) signalClass = 'strong';
              else if (signalStrength > -90) signalClass = 'medium';

              const isAlongRoute = !!currentRouteLayer && tower.distanceToRoute !== undefined;
              const iconHtml = `<div class="cell-tower-marker ${signalClass} ${isAlongRoute ? 'along-route' : ''}"></div>`;
              const icon = L.divIcon({ 
                  html: iconHtml, 
                  className: '', 
                  iconSize: [12, 12], 
                  iconAnchor: [6, 6] 
              });

              const marker = L.marker([tower.lat, tower.lon], { icon });
              
              // Add popup with tower info for better user experience
              marker.bindPopup(`
                  <div class="tower-popup">
                      <div class="tower-popup-header">
                          <strong>${tower.radio || 'Unknown'} Tower</strong>
                          <span class="signal-badge ${signalClass}">${tower.averageSignal || 'Unknown'} dBm</span>
                      </div>
                      <div class="tower-popup-content">
                          <div><strong>Network:</strong> MCC ${tower.mcc || '?'} / MNC ${tower.net || '?'}</div>
                          <div><strong>Cell:</strong> ${tower.area || '?'}-${tower.cell || '?'}</div>
                          <div><strong>Range:</strong> ${tower.range ? (tower.range + 'm') : 'Unknown'}</div>
                          ${tower.samples ? `<div><strong>Samples:</strong> ${tower.samples}</div>` : ''}
                          ${tower.distanceToRoute ? `<div><strong>Distance to route:</strong> ${Math.round(tower.distanceToRoute)}m</div>` : ''}
                          <div><strong>Last updated:</strong> ${tower.updated ? formatDateRef.current(new Date(tower.updated * 1000).toISOString()) : 'Unknown'}</div>
                      </div>
                  </div>
              `);
              
              towerLayer.addLayer(marker);
          }
          
          // Process next batch if needed
          if (endIdx < towersToDisplay.length) {
              setTimeout(() => processBatch(endIdx), 0);
          }
      };
      
      // Start processing the first batch
      processBatch(0);
      
      // Add the layer to the map
      towerLayer.addTo(map);
      cellTowerLayerRef.current = towerLayer;

  }, [map, showCellTowers, routeTowers, routeControlRef.current]); // Add explicit dependencies
  displayTowersRef.current = displayTowers;

  // Effect to trigger tower display when relevant state changes
  useEffect(() => {
      displayTowersRef.current?.();
  }, [showCellTowers, map, allTowers.current, routeControlRef.current]); // Trigger on toggle, map init, tower data change, route change


  // Toggle Cell Towers Visibility
  const toggleCellTowers = useCallback(() => {
    setShowCellTowers(prev => !prev);
    // The useEffect above will handle the display update
  }, []);
  toggleCellTowersRef.current = toggleCellTowers;

  // Process All Routes Helper (Stores computed routes)
  const processAllRoutes = useCallback((routes, allTowersData) => {
    console.log("Processing computed routes:", routes);
    if (!routes || routes.length === 0) {
      console.error("No routes to process"); return;
    }

    const processedRoutes = routes.map(route => ({
        ...route, // Contains route object from backend { route: { routes, waypoints, distance, duration }, towers: [] }
        type: route.type || 'unknown', // Ensure type is present
        signalScore: calculateSignalScoreRef.current?.(route.towers || []) || 0
    }));

    const validRoutes = {
      fastest: processedRoutes.find(r => r.type === 'fastest'),
      cell_coverage: processedRoutes.find(r => r.type === 'cell_coverage'),
      balanced: processedRoutes.find(r => r.type === 'balanced')
    };
    
    console.log("Valid routes by type:", {
      fastest: validRoutes.fastest ? 'found' : 'not found',
      cell_coverage: validRoutes.cell_coverage ? 'found' : 'not found',
      balanced: validRoutes.balanced ? 'found' : 'not found'
    });
    
    // Store route data (containing geometry etc.)
    setComputedRoutes({
      fastest: validRoutes.fastest?.route || null,
      cell_coverage: validRoutes.cell_coverage?.route || null,
      balanced: validRoutes.balanced?.route || null,
      allRoutes: processedRoutes.map(r => r.route) // Store just the route data part
    });

    // Store associated towers (less critical now with frontend filtering)
    setComputedRouteTowers({
        fastest: validRoutes.fastest?.towers || [],
        cell_coverage: validRoutes.cell_coverage?.towers || [],
        balanced: validRoutes.balanced?.towers || []
    });
    
    setAllRoutesComputed(true);
    setRoutesAreLoading(false);
    setIsLoadingRoute(false);
    setCalculationAnimation(null); // Stop animation

  }, []); // Dependency: calculateSignalScoreRef
  processAllRoutesRef.current = processAllRoutes;

  // Calculate All Route Types Function
  const calculateAllRouteTypes = async () => {
    console.log("CALCULATE: Starting route calculation with:", currentRoutePoints);
    
    // Critical validation - ensure we have valid route points
    if (!currentRoutePoints?.start?.lat || !currentRoutePoints?.start?.lng || 
        !currentRoutePoints?.end?.lat || !currentRoutePoints?.end?.lng) {
      console.error("CALCULATE: Cannot calculate routes - missing route points");
      setRoutesAreLoading(false);
      setIsLoadingRoute(false);
      window._routeCalcStartTime = null;
      return;
    }
    
    // Note: We're intentionally NOT checking routesAreLoading here to avoid getting stuck
    console.log("CALCULATE: Proceeding with route calculation regardless of previous state");
    
    // Ensure we have a calculation start time
    if (!window._routeCalcStartTime) {
      window._routeCalcStartTime = Date.now();
    }
    
    // Set loading flags - regardless of previous state
    setRoutesAreLoading(true);
    setIsLoadingRoute(true);
    setAllRoutesComputed(false);
    
    // No caching - always calculate fresh routes
    try {
      console.time('routeCalculation');
      console.log("CALCULATE: Requesting fastest route from backend");
      
      // Request fastest route first
      const fastestRouteResult = await calculateRouteRef.current?.(
        currentRoutePoints.start.lat,
        currentRoutePoints.start.lng,
        currentRoutePoints.end.lat,
        currentRoutePoints.end.lng,
        'fastest',
        'osrm',
        0
      );
      
      if (!fastestRouteResult?.route) {
        throw new Error('Failed to calculate fastest route');
      }
      
      console.log("CALCULATE: Got fastest route successfully");
      
      // Determine if custom routing or OSRM alternatives
      const isCustomRoutingEnabled = fastestRouteResult.route.custom_route !== undefined;
      console.log(`CALCULATE: Using ${isCustomRoutingEnabled ? 'custom routing' : 'OSRM alternatives'}`);
      
      let fastestRouteData, cellCoverageRouteData, balancedRouteData;
      let fastestTowers, cellCoverageTowers, balancedTowers;
      
      if (isCustomRoutingEnabled) {
        // CUSTOM ROUTING MODE
        fastestRouteData = fastestRouteResult.route;
        fastestTowers = fastestRouteResult.towers;
        
        // Update UI with fastest route immediately for responsive feedback
        setComputedRoutes(prev => ({ ...prev, fastest: fastestRouteData }));
        setComputedRouteTowers(prev => ({ ...prev, fastest: fastestTowers }));
        
        if (routeType === 'fastest') {
          displayRouteRef.current?.(fastestRouteData, 'fastest');
        }
        
        console.log("CALCULATE: Requesting cell coverage and balanced routes in parallel");
        
        // Calculate other route types in parallel
        const [cellCoverageResult, balancedResult] = await Promise.all([
          calculateRouteRef.current?.(
            currentRoutePoints.start.lat,
            currentRoutePoints.start.lng,
            currentRoutePoints.end.lat,
            currentRoutePoints.end.lng,
            'cell_coverage',
            'custom',
            0.8
          ).catch(err => {
            console.error("Error calculating cell coverage route:", err);
            return null;
          }),
          
          calculateRouteRef.current?.(
            currentRoutePoints.start.lat,
            currentRoutePoints.start.lng,
            currentRoutePoints.end.lat,
            currentRoutePoints.end.lng,
            'balanced',
            'custom',
            0.5
          ).catch(err => {
            console.error("Error calculating balanced route:", err);
            return null;
          })
        ]);
        
        // Process cell coverage route if available
        if (cellCoverageResult?.route) {
          cellCoverageRouteData = cellCoverageResult.route;
          cellCoverageTowers = cellCoverageResult.towers;
          
          setComputedRoutes(prev => ({ ...prev, cell_coverage: cellCoverageRouteData }));
          setComputedRouteTowers(prev => ({ ...prev, cell_coverage: cellCoverageTowers }));
          
          if (routeType === 'cell_coverage') {
            displayRouteRef.current?.(cellCoverageRouteData, 'cell_coverage');
          }
        } else {
          // Fallback to fastest if cell coverage calculation failed
          cellCoverageRouteData = fastestRouteData;
          cellCoverageTowers = fastestTowers;
          console.warn("Cell coverage route calculation failed, using fastest route as fallback");
        }
        
        // Process balanced route if available
        if (balancedResult?.route) {
          balancedRouteData = balancedResult.route;
          balancedTowers = balancedResult.towers;
          
          setComputedRoutes(prev => ({ ...prev, balanced: balancedRouteData }));
          setComputedRouteTowers(prev => ({ ...prev, balanced: balancedTowers }));
          
          if (routeType === 'balanced') {
            displayRouteRef.current?.(balancedRouteData, 'balanced');
          }
        } else {
          // Fallback to fastest if balanced calculation failed
          balancedRouteData = fastestRouteData;
          balancedTowers = fastestTowers;
          console.warn("Balanced route calculation failed, using fastest route as fallback");
        }
      } else {
        // OSRM ALTERNATIVES MODE
        console.log("CALCULATE: Processing OSRM alternatives");
        
        const routes = fastestRouteResult.route.routes || [];
        console.log(`CALCULATE: OSRM returned ${routes.length} alternative routes`);
        
        if (routes.length === 0) {
          throw new Error('No routes returned from OSRM');
        }
        
        // Calculate towers along each alternative route
        console.log("CALCULATE: Finding towers along each alternative route");
        const routesWithTowers = await Promise.all(routes.map(async (route, index) => {
          const geometry = route.geometry || {};
          const towers = findTowersAlongRouteRef.current?.(allTowers.current, geometry, 1000) || [];
          const signalScore = calculateSignalScoreRef.current?.(towers);
          
          return {
            route: route,
            index: index,
            towers: towers,
            signalScore: signalScore || 0,
            distance: route.distance,
            duration: route.duration,
            balancedScore: (signalScore || 0) * 0.5 + (1 - (route.duration / (routes[0].duration * 1.5))) * 0.5
          };
        }));
        
        // Select best routes for each type
        const fastestRoute = routes[0];
        fastestTowers = routesWithTowers[0].towers;
        
        // Find best cell coverage route
        const cellCoverageIndex = routesWithTowers.reduce(
          (maxIndex, route, index) => route.signalScore > routesWithTowers[maxIndex].signalScore ? index : maxIndex,
          0
        );
        const cellCoverageRoute = routes[cellCoverageIndex];
        cellCoverageTowers = routesWithTowers[cellCoverageIndex].towers;
        
        // Find best balanced route
        const balancedIndex = routesWithTowers.reduce(
          (maxIndex, route, index) => route.balancedScore > routesWithTowers[maxIndex].balancedScore ? index : maxIndex,
          0
        );
        const balancedRoute = routes[balancedIndex];
        balancedTowers = routesWithTowers[balancedIndex].towers;
        
        console.log(`CALCULATE: Selected routes - Fastest: 0, Cell coverage: ${cellCoverageIndex}, Balanced: ${balancedIndex}`);
        
        // Create route data in consistent format
        const createRouteData = (route, towers) => ({
          routes: [route],
          waypoints: fastestRouteResult.route.waypoints,
          distance: route.distance,
          duration: route.duration,
          towers: towers
        });
        
        // Create final route data objects
        fastestRouteData = createRouteData(fastestRoute, fastestTowers);
        cellCoverageRouteData = createRouteData(cellCoverageRoute, cellCoverageTowers);
        balancedRouteData = createRouteData(balancedRoute, balancedTowers);
        
        // Update state all at once
        setComputedRoutes({
          fastest: fastestRouteData,
          cell_coverage: cellCoverageRouteData,
          balanced: balancedRouteData
        });
        
        setComputedRouteTowers({
          fastest: fastestTowers,
          cell_coverage: cellCoverageTowers,
          balanced: balancedTowers
        });
        
        // Display route matching current selection
        if (routeType === 'fastest') {
          displayRouteRef.current?.(fastestRouteData, 'fastest');
        } else if (routeType === 'cell_coverage') {
          displayRouteRef.current?.(cellCoverageRouteData, 'cell_coverage');
        } else if (routeType === 'balanced') {
          displayRouteRef.current?.(balancedRouteData, 'balanced');
        }
      }
      
      console.timeEnd('routeCalculation');
      console.log("CALCULATE: All routes calculated successfully");
      
      // Create final route data for state updates
      const finalComputedRoutes = {
        fastest: fastestRouteData,
        cell_coverage: cellCoverageRouteData,
        balanced: balancedRouteData
      };
      
      // Update array of routes
      const newAllRoutes = [
        finalComputedRoutes.fastest,
        finalComputedRoutes.cell_coverage,
        finalComputedRoutes.balanced
      ];
      
      setAllRoutes(newAllRoutes);
      
      // No caching - just update state
      setAllRoutesComputed(true);
      setRoutesAreLoading(false);
      setIsLoadingRoute(false);
      window._routeCalcStartTime = null;
      
      console.log("CALCULATE: Route calculation process complete");
    } catch (error) {
      console.error('CALCULATE ERROR:', error);
      
      // Reset all states even on error
      setAllRoutesComputed(true); // Mark as completed
      setRoutesAreLoading(false);
      setIsLoadingRoute(false);
      window._routeCalcStartTime = null;
      
      // Show error to user
      toast.error("Error calculating routes. Please try again.", { position: "top-center" });
      console.log("CALCULATE: Process terminated with errors");
    }
  };
  calculateAllRouteTypesRef.current = calculateAllRouteTypes;

  // Handle Locate Function
  const handleLocate = async () => {
    if (!map) return;
    
    setIsLocating(true);
    toast.loading('Getting your location...', { id: 'locate-toast' });

    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          const latlng = L.latLng(latitude, longitude);
          
          try {
            // Direct call to MapTiler API for reverse geocoding
            const response = await fetch(
              `https://api.maptiler.com/geocoding/${longitude},${latitude}.json?key=${mapTilerKey}`
            );
            const data = await response.json();
            
            let placeName;
            if (data?.features && data.features.length > 0) {
              // Get the most relevant result (first one)
              const place = data.features[0];
              placeName = place.place_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            } else {
              placeName = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            }
            
            // Update origin field with the place name
            setOriginValue(placeName);
            
            // Update origin marker and route point
            updateMarkerRef.current?.(latlng, true);
            setCurrentRoutePoints(prev => ({ ...prev, start: { lat: latitude, lng: longitude } }));
            
            // Update suggestions with current location
            if (data?.features && data.features.length > 0) {
              setOriginSuggestions([data.features[0]]);
            } else {
              // Create a synthetic suggestion for coordinates
              const syntheticSuggestion = {
                id: "current-location",
                place_name: placeName,
                center: [longitude, latitude],
                place_type: ["current-location"],
                text: "Current Location"
              };
              setOriginSuggestions([syntheticSuggestion]);
            }
            
            // Check if destination is already set
            if (currentRoutePoints?.end?.lat && currentRoutePoints?.end?.lng) {
              // Both points are now set - update map view to show both markers
              const destLL = L.latLng(currentRoutePoints.end.lat, currentRoutePoints.end.lng);
              
              // Clear any existing route and calculations
              clearRouteDisplayRef.current?.();
              setAllRoutesComputed(false);
              setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null });
              setComputedRouteTowers({ fastest: null, cell_coverage: null, balanced: null });
              setRoutesAreLoading(false);
              setIsLoadingRoute(false);
              setCalculationAnimation(null);
              
              // Fit map to both points
              const bounds = L.latLngBounds([latlng, destLL]);
              map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
              
              // Fetch towers between waypoints
              console.log("Fetching towers between waypoints after locate...");
              const waypointPadding = 0.02;
              const initialBounds = {
                min_lat: Math.min(latitude, currentRoutePoints.end.lat) - waypointPadding,
                min_lng: Math.min(longitude, currentRoutePoints.end.lng) - waypointPadding,
                max_lat: Math.max(latitude, currentRoutePoints.end.lat) + waypointPadding,
                max_lng: Math.max(longitude, currentRoutePoints.end.lng) + waypointPadding
              };
              await fetchCellTowersRef.current?.(initialBounds);
              
              // Show route type selection if not skipping
              if (!skipRouteTypeSelection) {
                setShowRouteTypeSelection(true);
              }
              
              // Trigger route calculation
              updateMapViewRef.current?.(latlng, destLL);
              setSearchExpanded(false);
              
              toast.success('Location found! Calculating routes...', { id: 'locate-toast' });
            } else {
              // Only origin is set, just fly to it
              map.flyTo(latlng, Math.max(map.getZoom(), 14));
              toast.success('Location found! Enter a destination to calculate routes.', { id: 'locate-toast' });
            }
          } catch (error) {
            console.error('Reverse geocoding failed:', error);
            // Fallback to coordinates
            setOriginValue(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            updateMarkerRef.current?.(latlng, true);
            setCurrentRoutePoints(prev => ({ ...prev, start: { lat: latitude, lng: longitude } }));
            
            // Update suggestions with current location coordinates
            const syntheticSuggestion = {
              id: "current-location",
              place_name: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
              center: [longitude, latitude],
              place_type: ["current-location"],
              text: "Current Location"
            };
            setOriginSuggestions([syntheticSuggestion]);
            
            // Check if destination is already set
            if (currentRoutePoints?.end?.lat && currentRoutePoints?.end?.lng) {
              // Both points are now set - handle as above
              const destLL = L.latLng(currentRoutePoints.end.lat, currentRoutePoints.end.lng);
              
              // Clear any existing route and calculations
              clearRouteDisplayRef.current?.();
              setAllRoutesComputed(false);
              setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null });
              setComputedRouteTowers({ fastest: null, cell_coverage: null, balanced: null });
              setRoutesAreLoading(false);
              setIsLoadingRoute(false);
              setCalculationAnimation(null);
              
              // Fit map to both points
              const bounds = L.latLngBounds([latlng, destLL]);
              map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
              
              // Fetch towers between waypoints
              console.log("Fetching towers between waypoints after locate (fallback)...");
              const waypointPadding = 0.02;
              const initialBounds = {
                min_lat: Math.min(latitude, currentRoutePoints.end.lat) - waypointPadding,
                min_lng: Math.min(longitude, currentRoutePoints.end.lng) - waypointPadding,
                max_lat: Math.max(latitude, currentRoutePoints.end.lat) + waypointPadding,
                max_lng: Math.max(longitude, currentRoutePoints.end.lng) + waypointPadding
              };
              await fetchCellTowersRef.current?.(initialBounds);
              
              // Show route type selection if not skipping
              if (!skipRouteTypeSelection) {
                setShowRouteTypeSelection(true);
              }
              
              // Trigger route calculation
              updateMapViewRef.current?.(latlng, destLL);
              setSearchExpanded(false);
              
              toast.success('Location coordinates found! Calculating routes...', { id: 'locate-toast' });
            } else {
              map.flyTo(latlng, Math.max(map.getZoom(), 14));
              toast.success('Location coordinates found! Enter a destination to calculate routes.', { id: 'locate-toast' });
            }
          } finally {
            setIsLocating(false);
          }
        }, (error) => {
          console.error('Geolocation error:', error);
          toast.error('Could not get your location. Please check your browser settings.', { id: 'locate-toast' });
          setIsLocating(false);
        }, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      } else {
        toast.error('Geolocation is not supported by your browser.', { id: 'locate-toast' });
        setIsLocating(false);
      }
    } catch (error) {
      console.error('Location error:', error);
      toast.error('Could not get your location.', { id: 'locate-toast' });
      setIsLocating(false);
    }
  };
  handleLocateRef.current = handleLocate;

  // --- Other Helper Functions ---
  const hasValidRoutePoints = () => !!(currentRoutePoints?.start?.lat && currentRoutePoints?.start?.lng && currentRoutePoints?.end?.lat && currentRoutePoints?.end?.lng);
  hasValidRoutePointsRef.current = hasValidRoutePoints;

  const getRouteTypeIcon = (type) => ({ fastest: '⚡', cell_coverage: '📱', balanced: '⚖️' }[type] || '🚗');
  getRouteTypeIconRef.current = getRouteTypeIcon;

  const getDirectionIcon = (type) => {
    // Normalize the type for consistency
    const normalizedType = type?.toLowerCase() || '';
    
    // Emoji mapping for different direction types
    const iconMap = {
      // Basic movements
      'straight': '⬆️',
      'continue': '⬆️',
      
      // Left turns
      'left': '↰',
      'slight-left': '↖️',
      'sharp-left': '⬅️',
      
      // Right turns
      'right': '↱',
      'slight-right': '↗️',
      'sharp-right': '➡️',
      
      // Special movements
      'uturn': '⤵️',
      'uturn-left': '↩️',
      'uturn-right': '↪️',
      'arrive': '🏁',
      'destination': '📍',
      'depart': '🚩',
      'start': '🔵',
      
      // Roundabouts
      'roundabout': '🔄',
      'exit-roundabout': '⤴️',
      'rotary': '🔃',
      
      // Lane guidance
      'keep-left': '↖️',
      'keep-right': '↗️',
      
      // Complex movements
      'merge': '⤎',
      'fork': '⋔',
      'exit': '↴',
      'ramp': '⤴️',
      'enter': '↣',
      'end-of-road': '🛑',
      'via': '🔸',
      
      // Highway specific
      'highway': '🛣️',
      'motorway': '🛣️',
      'ferry': '⛴️',
      'bridge': '🌉',
      'tunnel': '🚇',
    };
    
    return iconMap[normalizedType] || '•';
  };
  getDirectionIconRef.current = getDirectionIcon;

  const highlightRouteSegment = (instruction, index, event) => {
    if (!map) return;
    
    // Stop event propagation if provided
    if (event) {
      event.stopPropagation();
    }
    
    // Always clear previous marker first
    clearActiveStepMarker();
    
    // If we're clicking the same step again, just clear it and return
    if (activeDirectionStep === index) {
      setActiveDirectionStep(null);
      return;
    }
    
    // Update the active step index
    setActiveDirectionStep(index);
    
    try {
      // Create a group to hold all the visualization elements
      const group = L.layerGroup();
      
      // If we have segment coordinates, draw the entire segment
      if (instruction.segmentCoordinates && instruction.segmentCoordinates.length > 1) {
        // Convert GeoJSON coordinates [lng, lat] to Leaflet coordinates [lat, lng]
        const latLngs = instruction.segmentCoordinates.map(coord => [coord[1], coord[0]]);
        
        // Draw the segment as a polyline
        const segmentLine = L.polyline(latLngs, {
          color: '#2A93EE',
          weight: 6, opacity: 0.8
        });
        
        group.addLayer(segmentLine);
        
        // Add markers at the start and end of the segment
        if (latLngs.length > 0) {
          // Start marker
          const startPoint = latLngs[0];
          const startMarker = L.circleMarker(startPoint, {
            radius: 8,
            color: '#2A93EE',
            weight: 3,
            opacity: 0.9,
            fillColor: '#fff',
            fillOpacity: 1
          });
          
          // Add icon for the start marker
          const startIconHtml = `<div class="step-marker-icon">${getDirectionIconRef.current?.(instruction.type) || '•'}</div>`;
          const startIcon = L.divIcon({ 
            html: startIconHtml, 
            className: 'step-marker-container', 
            iconSize: [24, 24], 
            iconAnchor: [12, 12] 
          });
          const startIconMarker = L.marker(startPoint, { icon: startIcon, interactive: false });
          
          group.addLayer(startMarker);
          group.addLayer(startIconMarker);
          
          // Calculate bounds to ensure we can see the entire segment
          const bounds = L.latLngBounds(latLngs);
          
          // Add to map and store reference
          group.addTo(map);
          setActiveStepMarker(group);
          
          // Fit the map to show the entire segment with padding
          map.fitBounds(bounds, { 
            padding: [50, 50],
            maxZoom: 18
          });
        }
      } else if (instruction.coordinates) {
        // Fall back to single point if no segment coordinates
        let lat, lng;
        if (Array.isArray(instruction.coordinates)) {
          if (Array.isArray(instruction.coordinates[0])) {
            [lng, lat] = instruction.coordinates[0];
          } else {
            lng = instruction.coordinates[0];
            lat = instruction.coordinates[1];
          }
        } else if (instruction.coordinates.lat && instruction.coordinates.lng) { 
          lat = instruction.coordinates.lat; 
          lng = instruction.coordinates.lng; 
        } else {
          return;
        }
        
        // Create a circle marker
        const hollowCircle = L.circleMarker([lat, lng], {
          radius: 12,
          color: '#2A93EE',
          weight: 3,
          opacity: 0.9,
          fill: false,
          className: 'hollow-step-marker'
        });
        
        // Add a centered icon in the middle of the circle
        const iconHtml = `<div class="step-marker-icon">${getDirectionIconRef.current?.(instruction.type) || '•'}</div>`;
        const icon = L.divIcon({ 
          html: iconHtml, 
          className: 'step-marker-container', 
          iconSize: [24, 24], 
          iconAnchor: [12, 12] 
        });
        const iconMarker = L.marker([lat, lng], { icon, interactive: false });
        
        // Add to group
        group.addLayer(hollowCircle);
        group.addLayer(iconMarker);
        
        // Add to map and store reference
        group.addTo(map);
        setActiveStepMarker(group);
        
        // Pan and zoom to the marker
        map.setView([lat, lng], Math.max(15, map.getZoom()));
      }
    } catch (error) { 
      console.error("Error highlighting route segment:", error); 
    }
  };
  highlightRouteSegmentRef.current = highlightRouteSegment;

  const clearActiveStepMarker = () => {
    if (activeStepMarker && map) {
      try {
        // To ensure we properly remove the marker
        map.removeLayer(activeStepMarker);
        
        // For layer groups, try to remove individual layers
        if (activeStepMarker.eachLayer) {
          activeStepMarker.eachLayer(layer => {
            if (map.hasLayer(layer)) {
              map.removeLayer(layer);
            }
          });
        }
      } catch (e) {
        console.error("Error removing active marker:", e);
      }
      
      setActiveStepMarker(null);
      setActiveDirectionStep(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  formatDateRef.current = formatDate;

  const toggleDirections = () => setIsDirectionsMinimized(prev => !prev);
  toggleDirectionsRef.current = toggleDirections;

  const cleanupAnimation = () => { /* Placeholder if needed */ };
  cleanupAnimationRef.current = cleanupAnimation;

  // Clear Route Display Function
  const clearRouteDisplay = useCallback(() => {
    if (routeControlRef.current && map) {
      map.removeLayer(routeControlRef.current);
          routeControlRef.current = null;
        }
    if (activeStepMarker && map) {
          map.removeLayer(activeStepMarker);
          setActiveStepMarker(null);
        }
    setRouteInfo(null);
    setRouteDirections(null);
    setShowDirections(false);
        setActiveDirectionStep(null);
    setRouteTowers([]); // Clear route-specific towers
    // Don't clear allTowers.current here
    // Trigger tower update to show only general towers if needed
    displayTowersRef.current?.();
  }, [map, activeStepMarker]); // Dependencies
    clearRouteDisplayRef.current = clearRouteDisplay;

  const getRouteLineColor = (type) => ({ fastest: '#4285F4', cell_coverage: '#0F9D58', balanced: '#F4B400' }[type] || '#4285F4');
  getRouteLineColorRef.current = getRouteLineColor;

  // --- Effects ---
  useEffect(() => { // Log route type changes
    console.log(`Current route type set to: ${routeType}`);
  }, [routeType]);

  useEffect(() => { // Log when all routes computed
    if (allRoutesComputed) {
      console.log('=== ALL ROUTES COMPUTED ===');
      // Log details...
    }
  }, [allRoutesComputed, computedRoutes]);

  useEffect(() => { // Cleanup animation on unmount
    return () => cleanupAnimationRef.current?.();
  }, []);

  useEffect(() => { // Fix directions panel scrolling
    if (directionsContentRef.current && showDirections && !isDirectionsMinimized && window.L) {
      L.DomEvent.disableScrollPropagation(directionsContentRef.current);
    }
  }, [directionsContentRef, showDirections, isDirectionsMinimized]);

  useEffect(() => {
    if (!map) return;
    
    const handleMapClick = (e) => {
      // Clear the step marker when clicking elsewhere on the map
      clearActiveStepMarker();
    };
    
    map.on('click', handleMapClick);
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, activeStepMarker]);

  useEffect(() => {
    if (isDirectionsMinimized || !showDirections) {
      clearActiveStepMarker();
    }
  }, [isDirectionsMinimized, showDirections]);

  // Add a direct document click handler to clear markers
  useEffect(() => {
    if (!document || !map) return;
    
    const documentClickHandler = (e) => {
      // If click wasn't within the directions panel or on a step
      if (!e.target.closest('.routing-directions-content') && 
          !e.target.closest('.instruction-item')) {
        clearActiveStepMarker();
      }
    };
    
    const mapClickHandler = () => {
      clearActiveStepMarker();
    };
    
    document.addEventListener('click', documentClickHandler);
    map.on('click', mapClickHandler);
    
    return () => {
      document.removeEventListener('click', documentClickHandler);
      map.off('click', mapClickHandler);
    };
  }, [map]);

  useEffect(() => {
    if (isDirectionsMinimized || !showDirections) {
      clearActiveStepMarker();
    }
  }, [isDirectionsMinimized, showDirections]);

  useEffect(() => { // Ensure directions panel state consistency
    if (showDirections && isDirectionsMinimized) setIsDirectionsMinimized(false);
  }, [showDirections]);

  // --- RouteTypeSelection Component (Inline) ---
  const RouteTypeSelection = () => {
    if (!showRouteTypeSelection) return null;
    // Check if *any* route calculation is still ongoing OR if the overall process isn't marked as complete
    const routesStillLoading = routesAreLoading || !allRoutesComputed;
    
    const handleRouteTypeSelect = (selectedType) => {
      // If routes are still loading or calculation incomplete
      if (routesStillLoading) {
        console.log(`Selected ${selectedType} route, but calculation still in progress. Selection saved.`);
        setRouteType(selectedType);
        
        // If skip selection is enabled, save preference
        if (skipRouteTypeSelection) {
          localStorage.setItem('preferredRouteType', selectedType);
        }
        
        // Hide the selection UI
        setShowRouteTypeSelection(false);
        
        // If we have valid route points, force a recalculation with the new route type
        if (currentRoutePoints?.start?.lat && currentRoutePoints?.start?.lng && 
            currentRoutePoints?.end?.lat && currentRoutePoints?.end?.lng) {
          
          // Make a local copy to avoid state race conditions
          const pointsToUse = {
            start: { ...currentRoutePoints.start },
            end: { ...currentRoutePoints.end }
          };
          
          // Wait a moment for state updates to complete
          setTimeout(() => {
            console.log(`Forcing calculation with selected type: ${selectedType}`);
            // Reset loading state if already calculating
            if (routesAreLoading) {
              setRoutesAreLoading(false);
              setIsLoadingRoute(false);
              window._routeCalcStartTime = null;
              
              // Short delay to ensure reset completes
              setTimeout(() => {
                setIsLoadingRoute(true);
                setRoutesAreLoading(true);
                window._routeCalcStartTime = Date.now();
                calculateRouteWithPoints(pointsToUse);
              }, 50);
            } else {
              // If not already calculating, start fresh
              setIsLoadingRoute(true);
              setRoutesAreLoading(true);
              window._routeCalcStartTime = Date.now();
              calculateRouteWithPoints(pointsToUse);
            }
          }, 100);
        } else {
          toast.error("Cannot recalculate - route points missing", { position: "top-center" });
        }
        return;
      }

      // If we get here, we have completed route data
      const selectedRouteData = computedRoutes[selectedType];

      if (!selectedRouteData) {
          console.error(`Error: handleRouteTypeSelect called for ${selectedType}, but route data is missing.`);
          toast.error(`Could not display ${selectedType} route. Data missing.`, { position: "top-center" }); 
          return; // Should not happen if button wasn't disabled
      }
      
      setRouteType(selectedType); // Update state immediately
      console.log(`Route type selected: ${selectedType}`);
      if (skipRouteTypeSelection) localStorage.setItem('preferredRouteType', selectedType);
      setShowRouteTypeSelection(false);
      
      console.log(`Displaying selected ${selectedType} route.`);
      displayRouteRef.current?.(selectedRouteData, selectedType); // Display it
    };
    
    const handleDontAskAgainChange = (e) => {
      const checked = e.target.checked;
      setSkipRouteTypeSelection(checked);
      localStorage.setItem('skipRouteTypeSelection', checked.toString());
      if (checked) {
        localStorage.setItem('preferredRouteType', routeType);
      }
    };
    
    // Render logic for the modal... (using refs for formatters)
    return (
      <div className="route-type-selection-overlay">
        <div className="route-type-selection-content">
          <h3>Choose Route Priority</h3>
          <p>Select your preferred route optimization strategy</p>
          
          {/* Descriptions */}
          <div className="route-options-info">
            <h5>About Route Options</h5>
            <ul>
              <li><strong>Fastest:</strong> Quickest route to your destination</li>
              <li><strong>Best Signal:</strong> Route with optimal cell tower coverage</li>
              <li><strong>Balanced:</strong> Balance of speed and cell coverage</li>
            </ul>
          </div>
          
          {/* Loading Indicator - Shows if ANY route is still loading */}
          {routesStillLoading && (
            <div className="route-loading-indicator">
                <p>
                  Calculating routes...
                  {/* More specific feedback (optional) */}
                  {!computedRoutes.fastest && " (Fastest pending)"}
                  {!computedRoutes.cell_coverage && " (Signal pending)"}
                  {!computedRoutes.balanced && " (Balanced pending)"}
              </p>
            </div>
          )}
          
          <div className="route-selection-options">
              {/* Fastest Option */}
            <button 
              className={`route-selection-option ${routeType === 'fastest' ? 'active' : ''} ${computedRoutes.fastest ? 'available' : 'disabled'}`}
              onClick={() => handleRouteTypeSelect('fastest')}
              disabled={!computedRoutes.fastest}
            >
              <div className="route-selection-icon">⚡</div>
              <div className="route-selection-label">Fastest</div>
              <div className="route-selection-desc">
                {computedRoutes.fastest ? (
                  `${formatDistanceRef.current?.(computedRoutes.fastest.distance) || ''}, ${formatDurationRef.current?.(computedRoutes.fastest.duration) || ''}`
                ) : (
                  <span className="calculating">Calculating...</span>
                )}
              </div>
            </button>
            
            {/* Cell Coverage Option */}
            <button 
              className={`route-selection-option ${routeType === 'cell_coverage' ? 'active' : ''} ${computedRoutes.cell_coverage ? 'available' : 'disabled'}`}
              onClick={() => handleRouteTypeSelect('cell_coverage')}
              disabled={!computedRoutes.cell_coverage}
            >
              <div className="route-selection-icon">📱</div>
              <div className="route-selection-label">Best Signal</div>
              <div className="route-selection-desc">
                {computedRoutes.cell_coverage ? (
                  `${formatDistanceRef.current?.(computedRoutes.cell_coverage.distance) || ''}, ${formatDurationRef.current?.(computedRoutes.cell_coverage.duration) || ''}`
                ) : (
                  <span className="calculating">Calculating...</span>
                )}
              </div>
            </button>
            
            {/* Balanced Option */}
            <button 
              className={`route-selection-option ${routeType === 'balanced' ? 'active' : ''} ${computedRoutes.balanced ? 'available' : 'disabled'}`}
              onClick={() => handleRouteTypeSelect('balanced')}
              disabled={!computedRoutes.balanced}
            >
              <div className="route-selection-icon">⚖️</div>
              <div className="route-selection-label">Balanced</div>
              <div className="route-selection-desc">
                {computedRoutes.balanced ? (
                  `${formatDistanceRef.current?.(computedRoutes.balanced.distance) || ''}, ${formatDurationRef.current?.(computedRoutes.balanced.duration) || ''}`
                ) : (
                  <span className="calculating">Calculating...</span>
                )}
              </div>
            </button>
          </div>
          
            {/* Don't ask again Checkbox */}
          <div className="route-selection-dont-ask">
            <label className="dont-ask-label">
                <input type="checkbox" checked={skipRouteTypeSelection} onChange={handleDontAskAgainChange} />
              <span className="dont-ask-text">Don't ask again, always use selected type</span>
            </label>
          </div>
          
            {/* Cancel Button */}
          <div className="route-selection-actions">
              <button className="route-selection-cancel" onClick={() => setShowRouteTypeSelection(false)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  // --- JSX Return ---
  return (
    <div className="app-container">
      <div id="map" ref={mapRef}>
        {/* Search Button */}
        <div className="search-button-container">
          <button className="search-button" onClick={() => toggleSearchRef.current?.()} aria-label={searchExpanded ? "Close search" : "Open search"}>
            <img src={searchExpanded ? CloseIcon : SearchIcon} alt={searchExpanded ? "Close" : "Search"} />
          </button>
        </div>
        
        {/* Auth Buttons */}
        <div className="auth-buttons">
          {user ? (
            <>
              <button className="user-button" onClick={() => toggleSavedRoutesRef.current?.()}>My Routes</button>
              <button className="logout-button" onClick={() => handleLogoutRef.current?.()}>Logout</button>
            </>
          ) : (
            <button className="login-button" onClick={() => toggleAuthFormRef.current?.()}>Login / Register</button>
          )}
        </div>
          
        {/* Map Controls */}
          <div className="map-controls">
          {/* Existing zoom controls */}
          {/* Add locate button */}
          <button 
            className={`map-control-button ${isLocating ? 'locating' : ''}`}
            onClick={() => handleLocateRef.current?.()}
            title="Use Current Location"
          >
            📍
          </button>
          {/* Route Type Selector */}
            <button
            className={`map-control-button route-type-button ${!hasValidRoutePointsRef.current?.() ? 'disabled' : ''}`}
            onClick={() => {
              if (!hasValidRoutePointsRef.current?.()) {
                toast.info("Set origin and destination first", { position: "top-center" }); 
                return;
              }
              
              // Always show selection when button is clicked
              setShowRouteTypeSelection(true);
              
              // Trigger background calculation if needed
              if (!allRoutesComputed && !routesAreLoading) {
                console.log("Triggering background calculation on type button click.");
                
                // Make a local copy of points to avoid race conditions
                if (currentRoutePoints?.start?.lat && currentRoutePoints?.start?.lng && 
                    currentRoutePoints?.end?.lat && currentRoutePoints?.end?.lng) {
                  
                  const pointsToUse = {
                    start: { ...currentRoutePoints.start },
                    end: { ...currentRoutePoints.end }
                  };
                  
                  setIsLoadingRoute(true);
                  setRoutesAreLoading(true);
                  window._routeCalcStartTime = Date.now();
                  
                  // Use setTimeout to ensure state updates
                  setTimeout(() => {
                    calculateRouteWithPoints(pointsToUse);
                  }, 50);
                }
              }
            }}
            title="Route Optimization Options"
          >
            {getRouteTypeIconRef.current?.(routeType) || '🚗'}
          </button>
          {/* Cell Tower Toggle */}
          <button 
            className={`map-control-button ${showCellTowers ? 'active' : ''}`}
            onClick={() => toggleCellTowersRef.current?.()}
              title={showCellTowers ? 'Hide Cell Towers' : 'Show Cell Towers'}
          >📡</button>
          </div>
        
        {/* Directions Panel (Minimized) */}
        {routeDirections && isDirectionsMinimized && (
          <div className="routing-directions-container minimized" onClick={() => toggleDirectionsRef.current?.()}>
             <div className="routing-directions-header"><div className="directions-toggle-icon">🗺️</div></div>
          </div>
        )}
        
        {/* Directions Panel (Full) */}
        {routeDirections && showDirections && !isDirectionsMinimized && (
          <div className="routing-directions-container" 
               onClick={e => e.stopPropagation()} 
               onMouseDown={e => e.stopPropagation()} 
               onTouchStart={e => e.stopPropagation()} 
               onWheel={preventMapInteraction}
               onMouseEnter={() => {
                 const mapContainer = document.querySelector('.mapboxgl-map');
                 if (mapContainer) mapContainer.style.pointerEvents = 'none';
               }}
               onMouseLeave={() => {
                 const mapContainer = document.querySelector('.mapboxgl-map');
                 if (mapContainer) mapContainer.style.pointerEvents = 'auto';
               }}>
            <div className="routing-directions-header">
              {/* Header content */}
              <div className="routing-directions-title">
                <div className="direction-endpoints">
                   <span className="direction-origin">{routeDirections.origin || originValue}</span> 
                   <span className="direction-separator">→</span> 
                   <span className="direction-destination">{routeDirections.destination || destinationValue}</span>
                </div>
              </div>
               <button className="routing-directions-close" onClick={() => setIsDirectionsMinimized(true)}>×</button>
            </div>
            <div className="routing-directions-content" 
                 ref={directionsContentRef} 
                 onClick={e => e.stopPropagation()} 
                 onMouseDown={e => e.stopPropagation()} 
                 onTouchStart={e => e.stopPropagation()} 
                 onWheel={preventMapInteraction}
                 onMouseEnter={() => {
                   const mapContainer = document.querySelector('.mapboxgl-map');
                   if (mapContainer) mapContainer.style.pointerEvents = 'none';
                 }}
                 onMouseLeave={() => {
                   const mapContainer = document.querySelector('.mapboxgl-map');
                   if (mapContainer) mapContainer.style.pointerEvents = 'auto';
                 }}>
              {/* Summary */}
              <div className="routing-summary">
                <div><strong>Distance:</strong> {routeDirections.distanceFormatted}</div>
                <div><strong>Duration:</strong> {routeDirections.durationFormatted}</div>
                <div><strong>Ascend:</strong> {routeDirections.ascendFormatted}</div>
                <div><strong>Descend:</strong> {routeDirections.descendFormatted}</div>
              </div>
               {/* Instructions List */}
              <ul className="instruction-list" onClick={(e) => clearActiveStepMarker()}>
                 {routeDirections.steps?.map((step, index) => (
                   <li key={index} 
                       className={`instruction-item ${activeDirectionStep === index ? 'active' : ''}`} 
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         highlightRouteSegmentRef.current?.(step, index, e); 
                       }}>
                     <div className={`instruction-icon icon-${step.type?.toLowerCase() || 'default'}`}>
                       {getDirectionIconRef.current?.(step.type) || '•'}
                     </div>
                     <div className="instruction-text">
                       <div className="instruction-direction">{step.instruction}</div>
                       <div className="instruction-distance">{step.distanceFormatted}</div>
                       <div className="instruction-road-info">{step.roadInfo}</div>
                       <div className="instruction-elevation-info">{step.elevationInfo}</div>
                     </div>
                   </li>
                 )) || <li className="instruction-item"><div className="instruction-text">No detailed directions available</div></li>}
              </ul>
            </div>
          </div>
        )}
        
        {/* Auth Form */}
        {showAuthForm && !user && (
          <div className="auth-form-container">
            <div className="auth-form">
              {/* Form content using refs for handlers */}
              <div className="auth-header">
                <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
                 <button className="close-button" onClick={() => toggleAuthFormRef.current?.()}>×</button>
              </div>
               {authError && <div className="auth-error">{authError}</div>}
               <form onSubmit={authMode === 'login' ? handleLoginRef.current : handleRegisterRef.current}>
                 {/* Inputs */}
                 {authMode === 'register' && <div className="form-group"><label htmlFor="username">Username</label><input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>}
                 <div className="form-group"><label htmlFor="email">Email</label><input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                 <div className="form-group"><label htmlFor="password">Password</label><input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                 {/* Actions & Switch */}
                 <div className="form-actions"><button type="submit" className="submit-button">{authMode === 'login' ? 'Login' : 'Register'}</button></div>
                <div className="auth-switch">
                   {authMode === 'login' ? <p>Don't have an account? <button type="button" onClick={() => setAuthMode('register')}>Register</button></p> : <p>Already have an account? <button type="button" onClick={() => setAuthMode('login')}>Login</button></p>}
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Saved Routes Panel */}
        {showSavedRoutes && user && (
          <div className="saved-routes-container">
            <div className="saved-routes">
              {/* Panel content using refs for handlers */}
              <div className="saved-routes-header">
                <h2>My Saved Routes</h2>
                 <button className="close-button" onClick={() => toggleSavedRoutesRef.current?.()}>×</button>
              </div>
               {savedRoutes.length === 0 ? <div className="no-routes"><p>You don't have any saved routes yet.</p></div> : (
                <div className="routes-list">
                  {savedRoutes.map((route, index) => (
                     <div key={index} className="route-item" onClick={() => loadSavedRouteRef.current?.(route)}>
                      <div className="route-details">
                        <div className="route-points">
                          <div className="route-origin">{route.origin.place_name || route.origin}</div>
                          <div className="route-destination">{route.destination.place_name || route.destination}</div>
                        </div>
                        <div className="route-meta">
                          <div className="route-type">{route.route_type || 'balanced'}</div>
                           <div className="route-date">{formatDateRef.current?.(route.created_at) || ''}</div>
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
          <div className="search-container">
            <div className="search-content">
              {/* Search inputs using refs for handlers */}
              <div className="search-header"><span>Where to?</span></div>
               {/* Origin Input */}
               <div className="search-form"><div className="input-group"><div className="input-container">
                 <input ref={originInputRef} type="text" placeholder="Origin" value={originValue} onChange={(e) => handleInputChangeRef.current?.(e, true)} onFocus={() => handleInputFocusRef.current?.(true)} onBlur={() => handleInputBlurRef.current?.(true)} />
                 {originValue && <button className="clear-input" onClick={() => handleClearInputRef.current?.(true)}>×</button>}
                 {showOriginSuggestions && originSuggestions.length > 0 && 
                  <div className="suggestions-dropdown origin-suggestions"
                       onWheel={preventMapInteraction}
                       onMouseEnter={() => {
                         const mapContainer = document.querySelector('.mapboxgl-map');
                         if (mapContainer) mapContainer.style.pointerEvents = 'none';
                       }}
                       onMouseLeave={() => {
                         const mapContainer = document.querySelector('.mapboxgl-map');
                         if (mapContainer) mapContainer.style.pointerEvents = 'auto';
                       }}>
                    {originSuggestions.map((s, i) => 
                      <div key={i} className="suggestion-item" 
                           onClick={() => handleSuggestionSelectRef.current?.(s, true)} 
                           onMouseDown={e => e.preventDefault()}>
                        {s.place_name}
                      </div>
                    )}
                  </div>
                 }
               </div></div></div>
               {/* Destination Input */}
               <div className="search-form"><div className="input-group"><div className="input-container">
                 <input type="text" placeholder="Destination" value={destinationValue} onChange={(e) => handleInputChangeRef.current?.(e, false)} onFocus={() => handleInputFocusRef.current?.(false)} onBlur={() => handleInputBlurRef.current?.(false)} />
                 {destinationValue && <button className="clear-input" onClick={() => handleClearInputRef.current?.(false)}>×</button>}
                 {showDestinationSuggestions && destinationSuggestions.length > 0 && 
                  <div className="suggestions-dropdown destination-suggestions"
                       onWheel={preventMapInteraction}
                       onMouseEnter={() => {
                         const mapContainer = document.querySelector('.mapboxgl-map');
                         if (mapContainer) mapContainer.style.pointerEvents = 'none';
                       }}
                       onMouseLeave={() => {
                         const mapContainer = document.querySelector('.mapboxgl-map');
                         if (mapContainer) mapContainer.style.pointerEvents = 'auto';
                       }}>
                    {destinationSuggestions.map((s, i) => 
                      <div key={i} className="suggestion-item" 
                           onClick={() => handleSuggestionSelectRef.current?.(s, false)} 
                           onMouseDown={e => e.preventDefault()}>
                        {s.place_name}
                      </div>
                    )}
                  </div>
                 }
               </div></div></div>

              {/* Cell Tower Toggle in Search */}
              <div className="cell-tower-toggle">
                <button className={`toggle-button ${showCellTowers ? 'active' : ''}`} onClick={() => toggleCellTowersRef.current?.()}>
                  <span className="toggle-icon">📡</span>
                  <span className="toggle-label">{showCellTowers ? 'Hide Cell Towers' : 'Show Cell Towers'}</span>
                </button>
                {/* Display count from allTowers ref */}
                <div className="tower-count">{allTowers.current.length > 0 ? `${allTowers.current.length} cell towers available` : 'No cell towers found'}</div>
              </div>
              
              {/* Loading Indicator */}
              {(isLoadingRoute || calculationAnimation) && (
                <div className="loading-indicator">
                  {calculationAnimation || 'Calculating route...'}
                  
                  {/* Add recalculation button if loading for more than 5 seconds */}
                  {window._routeCalcStartTime && (Date.now() - window._routeCalcStartTime > 5000) && (
                    <button 
                      className="recalculate-button"
                      onClick={() => {
                        // Reset calculation state completely
                        console.log("MANUAL RECALCULATION triggered by user");
                        window._routeCalcStartTime = null;
                        setRoutesAreLoading(false);
                        setIsLoadingRoute(false);
                        setAllRoutesComputed(false);
                        
                        // Ensure we have valid route points
                        if (currentRoutePoints?.start?.lat && currentRoutePoints?.start?.lng && 
                            currentRoutePoints?.end?.lat && currentRoutePoints?.end?.lng) {
                          
                          // Store points locally to avoid race conditions
                          const pointsToUse = {
                            start: { ...currentRoutePoints.start },
                            end: { ...currentRoutePoints.end }
                          };
                          
                          // Force recalculation with delay to ensure state updates
                          toast.info("Manually recalculating routes...", { position: "top-center" });
                          
                          setTimeout(() => {
                            // Set loading state and start calculation
                            setIsLoadingRoute(true);
                            setRoutesAreLoading(true);
                            window._routeCalcStartTime = Date.now();
                            
                            // Call calculation function directly with copied points
                            calculateRouteWithPoints(pointsToUse);
                          }, 100);
                        } else {
                          toast.error("Cannot recalculate - route points missing", { position: "top-center" });
                        }
                      }}
                    >
                      Recalculate
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Modals */}
        {showRouteTypeSelection && <RouteTypeSelection />}
        {optimizationNotice && <div className="optimization-notice">{optimizationNotice.message}</div>
        }
      </div>
      
    </div>
  );
}

export default App;