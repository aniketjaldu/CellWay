// App.jsx

import { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import SearchIcon from './assets/svg/search-icon.svg';
import CloseIcon from './assets/svg/close-icon.svg';
import axios from 'axios';
import { toast } from 'react-hot-toast';
// Assuming 'L' is globally available from Leaflet script/import
// import L from 'leaflet'; // Uncomment if you import Leaflet directly

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
  const toggleDirectionsCollapseRef = useRef(null);
  const toggleDirectionsRef = useRef(null);
  const cleanupAnimationRef = useRef(null);
  const clearRouteDisplayRef = useRef(null);
  const getRouteLineColorRef = useRef(null);
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
  const [isDirectionsCollapsed, setIsDirectionsCollapsed] = useState(false);
  const [isDirectionsMinimized, setIsDirectionsMinimized] = useState(false);
  const [activeDirectionStep, setActiveDirectionStep] = useState(null);
  const [activeStepMarker, setActiveStepMarker] = useState(null);

  // Add a reference for the directions panel content
  const directionsContentRef = useRef(null);

  // Add this near the top of the component to store cached routes
  const [routeCache, setRouteCache] = useState({});

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
      attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
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

  // Fetch Cell Towers Function (Requirement 1 & used by Route Calc)
  const fetchCellTowers = useCallback(async (bounds) => {
    if (!map) return []; // Return empty array if map not ready
    
    try {
      let { min_lat, min_lng, max_lat, max_lng } = bounds;
      console.log(`Fetching cell towers in area: ${min_lat},${min_lng},${max_lat},${max_lng}`);
      
      const response = await api.get('/towers', { params: { min_lat, min_lng, max_lat, max_lng } });
      const towers = response.data?.towers || [];
      console.log(`Received ${towers.length} cell towers from the backend`);
      
      if (towers.length > 0) {
        allTowers.current = towers; // Update the main tower store
        // setCellTowers(towers); // Update state if needed elsewhere, maybe not necessary
        // Don't automatically setShowCellTowers(true) here
        return towers; // Return fetched towers
      } else {
        allTowers.current = []; // Clear if none found
        // setCellTowers([]);
        toast.warning("No cell towers found in this area", { position: "top-center", autoClose: 3000 });
      }
      return [];
    } catch (error) {
      console.error("Error fetching cell tower data:", error);
      toast.error("Error fetching cell tower data", { position: "top-center", autoClose: 3000 });
      allTowers.current = []; // Clear on error
      // setCellTowers([]);
      return []; // Return empty array on error
    }
  }, [map]); // Dependency: map
  fetchCellTowersRef.current = fetchCellTowers;

  // Handle Input Change Function
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
      setShowCellTowers(true);

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
    setCurrentRoutePoints(routePointsForCalc);

    // Reset computation flags and previous route
    setAllRoutesComputed(false);
    setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null, allRoutes: [] });
    setComputedRouteTowers({ fastest: [], cell_coverage: [], balanced: [] });
    clearRouteDisplayRef.current?.(); // Clear previous route line etc.
    
    setSearchExpanded(false);
    setIsLoadingRoute(true);
    setRoutesAreLoading(true);

    // Fetch cell towers AGAIN for the potentially larger route calculation area
    console.log("Fetching towers for route calculation area...");
    const routePadding = 0.1; // Padding for route calculation
    const towerBounds = {
      min_lat: Math.min(originLatLng.lat, destLatLng.lat) - routePadding,
      min_lng: Math.min(originLatLng.lng, destLatLng.lng) - routePadding,
      max_lat: Math.max(originLatLng.lat, destLatLng.lat) + routePadding,
      max_lng: Math.max(originLatLng.lng, destLatLng.lng) + routePadding
    };

    // Fetch towers and THEN calculate routes
    fetchCellTowersRef.current?.(towerBounds).then(fetchedTowersForRoute => {
      // allTowers.current is updated inside fetchCellTowers
      console.log(`Using ${allTowers.current.length} towers for route calculation.`);
      calculateAllRouteTypesRef.current?.(routePointsForCalc);
    }).catch(error => {
      console.error("Error fetching towers for route calculation:", error);
      // Still try to calculate routes even if tower fetch failed
      calculateAllRouteTypesRef.current?.(routePointsForCalc);
    });
  }, [map]); // Dependencies
  updateMapViewRef.current = updateMapView;

  // Calculate Route Function (Calls Backend)
  const calculateRoute = useCallback(async (startLat, startLng, endLat, endLng, routeType, algorithm = 'osrm', weight = 0) => {
    const validCoords = [startLat, startLng, endLat, endLng].map(c => Number(parseFloat(c).toFixed(6)));
    if (validCoords.some(isNaN)) {
      throw new Error(`Invalid coordinates: (${startLat}, ${startLng}) to (${endLat}, ${endLng})`);
    }
    const [validStartLat, validStartLng, validEndLat, validEndLng] = validCoords;
    
    console.log(`Calculating ${routeType} route from (${validStartLat}, ${validStartLng}) to (${validEndLat}, ${validEndLng}) using ${algorithm}, weight: ${weight}`);
    try {
      const response = await api.get('/route', {
        params: { start_lat: validStartLat, start_lng: validStartLng, end_lat: validEndLat, end_lng: validEndLng, route_type: routeType, algorithm: algorithm, weight: weight }
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
          towers: data.towers || [] // Towers returned by custom backend route
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

    // Helper function to calculate distance from point to line segment
    const distanceToSegment = (point, lineStart, lineEnd) => {
      const dx = lineEnd.lng - lineStart.lng;
      const dy = lineEnd.lat - lineStart.lat;
      const len2 = dx * dx + dy * dy;

      if (len2 === 0) {
        // Line segment is actually a point
        return point.distanceTo(lineStart);
      }

      // Calculate projection of point onto line
      const t = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / len2;

      if (t < 0) {
        // Point is before line start
        return point.distanceTo(lineStart);
      }
      if (t > 1) {
        // Point is after line end
        return point.distanceTo(lineEnd);
      }

      // Point is on line segment
      const projection = L.latLng(
        lineStart.lat + t * dy,
        lineStart.lng + t * dx
      );
      return point.distanceTo(projection);
    };

    towersToFilter.forEach(tower => {
      if (tower.lat && tower.lon) { // Ensure tower has coordinates
        const towerPoint = L.latLng(tower.lat, tower.lon);
        try {
          let minDistance = Infinity;

          // Calculate distance to each line segment
          for (let i = 0; i < routeCoords.length - 1; i++) {
            const segmentStart = L.latLng(routeCoords[i][1], routeCoords[i][0]);
            const segmentEnd = L.latLng(routeCoords[i + 1][1], routeCoords[i + 1][0]);
            const distance = distanceToSegment(towerPoint, segmentStart, segmentEnd);
            minDistance = Math.min(minDistance, distance);
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

    // Optional: Smart filtering if too many towers are found (keep existing logic)
    if (towersWithDistance.length > 100) { // Increased threshold
        console.log(`Applying smart filter: ${towersWithDistance.length} towers found.`);
        const veryClose = towersWithDistance.filter(t => t.distanceToRoute <= 200); // Increased from 100 to 200
        const midDistance = towersWithDistance.filter(t => t.distanceToRoute > 200 && t.distanceToRoute <= 600); // Adjusted ranges
        const midStep = Math.max(1, Math.floor(midDistance.length / Math.min(midDistance.length, 30))); // Sample more
        const sampledMid = midDistance.filter((_, i) => i % midStep === 0);
        const farDistance = towersWithDistance.filter(t => t.distanceToRoute > 600 && t.distanceToRoute <= maxDistance); // Adjusted ranges
        const farStep = Math.max(1, Math.floor(farDistance.length / Math.min(farDistance.length, 20))); // Sample more
        const sampledFar = farDistance.filter((_, i) => i % farStep === 0);
        const filteredTowers = [...veryClose, ...sampledMid, ...sampledFar];
        
        if (filteredTowers.length < 20 && towersWithDistance.length >= 20) {
            console.log("Smart filter result too small, returning top 100 closest.");
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
  const extractDirections = (routeData) => {
    if (!routeData?.routes?.[0]) return null;
    const route = routeData.routes[0];
    const steps = route.legs?.[0]?.steps || [];
    const distanceM = route.distance;
    const durationS = route.duration;
    
    const formattedSteps = steps.map(step => ({
      type: step.maneuver?.type || 'straight',
      instruction: step.maneuver?.instruction || '',
      distanceFormatted: formatDistanceRef.current?.(step.distance) || '', // Use meters
      coordinates: step.maneuver?.location || step.geometry?.coordinates?.[0]
    }));

    return {
      distanceFormatted: formatDistanceRef.current?.(distanceM) || '',
      durationFormatted: formatDurationRef.current?.(durationS) || '',
      steps: formattedSteps,
      isCustomRoute: route.type !== 'fastest' // Or check for custom_route flag
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
        setIsDirectionsCollapsed(false);
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
          
      const towerLayer = L.layerGroup();
      let towersToDisplay = [];
      const currentRouteLayer = routeControlRef.current;
      const currentRouteGeometry = currentRouteLayer
          ? { type: "LineString", coordinates: currentRouteLayer.getLatLngs().map(ll => [ll.lng, ll.lat]) }
          : null;

      if (currentRouteLayer && currentRouteGeometry) {
          // --- Requirement 3: Display Towers Along Route ---
          console.log("Displaying towers along the current route...");
          towersToDisplay = findTowersAlongRouteRef.current?.(allTowers.current, currentRouteGeometry, 500) || [];
          setRouteTowers(towersToDisplay); // Update state for route-specific towers

          // Update routeInfo with signal score based on these towers
          const signalQuality = calculateSignalScoreRef.current?.(towersToDisplay) || 0;
          setRouteInfo(prev => prev ? { ...prev, signalQuality: signalQuality, towerCount: towersToDisplay.length } : null);

    } else {
          // --- Initial Display (Before Route) or No Route ---
          console.log("Displaying all fetched towers (no route active)...");
          towersToDisplay = allTowers.current || [];
          setRouteTowers([]); // No route-specific towers
          // Clear route-specific info
           setRouteInfo(prev => prev ? { ...prev, signalQuality: undefined, towerCount: undefined } : null);
      }

      console.log(`Adding ${towersToDisplay.length} towers to the map.`);
      towersToDisplay.forEach(tower => {
      const signalStrength = tower.averageSignal || -100;
      let signalClass = 'weak';
      if (signalStrength > -70) signalClass = 'strong';
      else if (signalStrength > -90) signalClass = 'medium';

          const isAlongRoute = !!currentRouteLayer; // Mark if they are along a route
          const iconHtml = `<div class="cell-tower-marker ${signalClass} ${isAlongRoute ? 'along-route' : ''}"></div>`;
          const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [12, 12], iconAnchor: [6, 6] });

          if (tower.lat && tower.lon) {
      const marker = L.marker([tower.lat, tower.lon], { icon });
      towerLayer.addLayer(marker);
          }
    });

    towerLayer.addTo(map);
    cellTowerLayerRef.current = towerLayer;

  }, [map, showCellTowers, allTowers, routeControlRef]); // Dependencies
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
    setCalculationAnimation(null); // Stop animation

  }, []); // Dependency: calculateSignalScoreRef
  processAllRoutesRef.current = processAllRoutes;

  // Calculate All Route Types Function
  const calculateAllRouteTypes = async () => {
    if (!hasValidRoutePoints()) return;
    
    setAllRoutesComputed(false);
    setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null });
    setComputedRouteTowers(prev => ({ ...prev, fastest: null, cell_coverage: null, balanced: null }));
    
    try {
      // First get the fastest route to use as fallback
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
      
      // Check if custom routing is enabled
      const isCustomRoutingEnabled = fastestRouteResult.route.custom_route !== undefined;
      
      if (isCustomRoutingEnabled) {
        // CASE 1: Custom routing is enabled - use separate API calls for each type
        console.log("Custom routing enabled, calculating specialized routes");
        
        // Update fastest route immediately
        setComputedRoutes(prev => ({ ...prev, fastest: fastestRouteResult.route }));
        setComputedRouteTowers(prev => ({ ...prev, fastest: fastestRouteResult.towers }));
        
        // If this is the current selection, display it
        if (routeType === 'fastest') {
          displayRoute(fastestRouteResult.route, 'fastest');
        }
        
        // Calculate cell coverage route
        const cellCoverageResult = await calculateRouteRef.current?.(
          currentRoutePoints.start.lat,
          currentRoutePoints.start.lng,
          currentRoutePoints.end.lat,
          currentRoutePoints.end.lng,
          'cell_coverage',
          'custom',
          0.8
        );
        
        if (cellCoverageResult?.route) {
          setComputedRoutes(prev => ({ ...prev, cell_coverage: cellCoverageResult.route }));
          setComputedRouteTowers(prev => ({ ...prev, cell_coverage: cellCoverageResult.towers }));
          
          if (routeType === 'cell_coverage') {
            displayRoute(cellCoverageResult.route, 'cell_coverage');
          }
        }
        
        // Calculate balanced route
        const balancedResult = await calculateRouteRef.current?.(
          currentRoutePoints.start.lat,
          currentRoutePoints.start.lng,
          currentRoutePoints.end.lat,
          currentRoutePoints.end.lng,
          'balanced',
          'custom',
          0.5
        );
        
        if (balancedResult?.route) {
          setComputedRoutes(prev => ({ ...prev, balanced: balancedResult.route }));
          setComputedRouteTowers(prev => ({ ...prev, balanced: balancedResult.towers }));
          
          if (routeType === 'balanced') {
            displayRoute(balancedResult.route, 'balanced');
          }
        }
      } else {
        // CASE 2: Custom routing is disabled - use a single OSRM call with alternatives
        console.log("Custom routing disabled, using OSRM alternatives and cell data to select optimal routes");
        
        // The OSRM route already has alternatives (should be in fastestRouteResult.route.routes)
        const routes = fastestRouteResult.route.routes || [];
        console.log(`OSRM returned ${routes.length} alternative routes`);
        
        if (routes.length === 0) {
          throw new Error('No routes returned from OSRM');
        }
        
        // Find towers along each alternative route
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
            // Calculate a balanced score (normalized)
            balancedScore: (signalScore || 0) * 0.5 + (1 - (route.duration / (routes[0].duration * 1.5))) * 0.5
          };
        }));
        
        console.log("Routes with analysis:", routesWithTowers.map(r => ({
          index: r.index,
          duration: r.duration,
          towers: r.towers.length,
          signalScore: r.signalScore,
          balancedScore: r.balancedScore
        })));
        
        // Select the best route for each type
        // For fastest, use the first route (OSRM already sorts by fastest)
        const fastestRoute = routes[0];
        const fastestTowers = routesWithTowers[0].towers;
        
        // For cell coverage, select the route with the highest signal score
        const cellCoverageIndex = routesWithTowers.reduce(
          (maxIndex, route, index) => route.signalScore > routesWithTowers[maxIndex].signalScore ? index : maxIndex, 
          0
        );
        const cellCoverageRoute = routes[cellCoverageIndex];
        const cellCoverageTowers = routesWithTowers[cellCoverageIndex].towers;
        
        // For balanced, select the route with the highest balanced score
        const balancedIndex = routesWithTowers.reduce(
          (maxIndex, route, index) => route.balancedScore > routesWithTowers[maxIndex].balancedScore ? index : maxIndex, 
          0
        );
        const balancedRoute = routes[balancedIndex];
        const balancedTowers = routesWithTowers[balancedIndex].towers;
        
        console.log(`Selected routes - Fastest: 0, Cell coverage: ${cellCoverageIndex}, Balanced: ${balancedIndex}`);
        
        // Create route data in the same format as expected from the API
        const createRouteData = (route, towers) => ({
          routes: [route],
          waypoints: fastestRouteResult.route.waypoints,
          distance: route.distance,
          duration: route.duration,
          towers: towers
        });
        
        // Update state with our selected routes
        const fastestRouteData = createRouteData(fastestRoute, fastestTowers);
        const cellCoverageRouteData = createRouteData(cellCoverageRoute, cellCoverageTowers);
        const balancedRouteData = createRouteData(balancedRoute, balancedTowers);
        
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
        
        // Display the route that matches the current selection
        if (routeType === 'fastest') {
          displayRoute(fastestRouteData, 'fastest');
        } else if (routeType === 'cell_coverage') {
          displayRoute(cellCoverageRouteData, 'cell_coverage');
        } else if (routeType === 'balanced') {
          displayRoute(balancedRouteData, 'balanced');
        }
      }
      
      // Update allRoutes array at the end
      setAllRoutes(prev => {
        const newRoutes = [...prev];
        newRoutes[0] = computedRoutes.fastest;
        newRoutes[1] = computedRoutes.cell_coverage;
        newRoutes[2] = computedRoutes.balanced;
        return newRoutes;
      });
      
      setAllRoutesComputed(true);
      
      // Cache the current state
      setRouteCache({
        routes: computedRoutes,
        towers: computedRouteTowers
      });
      
    } catch (error) {
      console.error('Error calculating routes:', error);
      setAllRoutesComputed(true);
    }
  };
  calculateAllRouteTypesRef.current = calculateAllRouteTypes;


  // --- Other Helper Functions ---
  const hasValidRoutePoints = () => !!(currentRoutePoints?.start?.lat && currentRoutePoints?.start?.lng && currentRoutePoints?.end?.lat && currentRoutePoints?.end?.lng);
  hasValidRoutePointsRef.current = hasValidRoutePoints;

  const getRouteTypeIcon = (type) => ({ fastest: '⚡', cell_coverage: '📱', balanced: '⚖️' }[type] || '🚗');
  getRouteTypeIconRef.current = getRouteTypeIcon;

  const getDirectionIcon = (type) => ({ turn: '↱', left: '↰', right: '↱', straight: '⬆️', uturn: '↩️', arrive: '🏁', depart: '🚩', roundabout: '🔄', rotary: '🔄', merge: '↘️', fork: '⑂', exit: '↴' }[type] || '•');
  getDirectionIconRef.current = getDirectionIcon;

  const highlightRouteSegment = (instruction, index) => {
    if (!map || !instruction?.coordinates?.[0]) return;
    if (activeStepMarker) map.removeLayer(activeStepMarker);
    setActiveDirectionStep(index);
    try {
      let lat, lng;
      if (Array.isArray(instruction.coordinates[0])) [lng, lat] = instruction.coordinates[0];
      else if (instruction.coordinates[0].lat && instruction.coordinates[0].lng) { lat = instruction.coordinates[0].lat; lng = instruction.coordinates[0].lng; }
      else return;

      const iconHtml = `<div class="step-marker">${getDirectionIconRef.current?.(instruction.type) || '•'}</div>`;
      const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      setActiveStepMarker(marker);
      map.panTo([lat, lng]);
    } catch (error) { console.error("Error highlighting route segment:", error); }
  };
  highlightRouteSegmentRef.current = highlightRouteSegment;

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  formatDateRef.current = formatDate;

  const toggleDirectionsCollapse = () => setIsDirectionsCollapsed(prev => !prev);
  toggleDirectionsCollapseRef.current = toggleDirectionsCollapse;

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

  useEffect(() => { // Ensure directions panel state consistency
    if (showDirections && isDirectionsMinimized) setIsDirectionsMinimized(false);
  }, [showDirections]);


  // --- RouteTypeSelection Component (Inline) ---
  const RouteTypeSelection = () => {
    if (!showRouteTypeSelection) return null;
    // Check if *any* route calculation is still ongoing OR if the overall process isn't marked as complete
    const routesStillLoading = routesAreLoading || !allRoutesComputed;
    
    const handleRouteTypeSelect = (selectedType) => {
      // This function assumes the button was clickable, meaning the route data exists
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
          {/* Route Type Selector */}
            <button
            className={`map-control-button route-type-button ${!hasValidRoutePointsRef.current?.() ? 'disabled' : ''}`}
            onClick={() => {
              if (!hasValidRoutePointsRef.current?.()) {
                toast.info("Set origin and destination first", { position: "top-center" }); return;
              }
              setShowRouteTypeSelection(true); // Always show selection when button is clicked
              // Trigger background calculation if needed
                if (!allRoutesComputed && !routesAreLoading) {
                    console.log("Triggering background calculation on type button click.");
                setIsLoadingRoute(true); setRoutesAreLoading(true);
                calculateAllRouteTypesRef.current?.();
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
          <div className={`routing-directions-container ${isDirectionsCollapsed ? 'collapsed' : ''}`} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <div className="routing-directions-header">
              {/* Header content */}
              <div className="routing-directions-title">
                <div className="direction-endpoints">
                   <span className="direction-origin">{originValue}</span> <span className="direction-separator">→</span> <span className="direction-destination">{destinationValue}</span>
                </div>
              </div>
               <button className="routing-directions-close" onClick={() => setIsDirectionsMinimized(true)}>×</button>
            </div>
            {!isDirectionsCollapsed && (
              <div className="routing-directions-content" ref={directionsContentRef} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
                {/* Summary */}
                <div className="routing-summary">
                  <div><strong>Distance:</strong> {routeDirections.distanceFormatted}</div>
                  <div><strong>Duration:</strong> {routeDirections.durationFormatted}</div>
                </div>
                 {/* Instructions List */}
                <ul className="instruction-list">
                   {routeDirections.steps?.map((step, index) => (
                     <li key={index} className={`instruction-item ${activeDirectionStep === index ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); highlightRouteSegmentRef.current?.(step, index); }}>
                       <div className="instruction-icon">{getDirectionIconRef.current?.(step.type) || '•'}</div>
                        <div className="instruction-text">
                          <div className="instruction-direction">{step.instruction}</div>
                          <div className="instruction-distance">{step.distanceFormatted}</div>
                        </div>
                      </li>
                   )) || <li className="instruction-item"><div className="instruction-text">No detailed directions available</div></li>}
                </ul>
              </div>
            )}
            {/* Collapse Toggle */}
            <div className="routing-directions-collapse" onClick={(e) => { e.stopPropagation(); toggleDirectionsCollapseRef.current?.(); }}>
               <div className="collapse-arrow">{isDirectionsCollapsed ? '▼' : '▲'}</div>
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
                 {showOriginSuggestions && originSuggestions.length > 0 && <div className="suggestions-dropdown origin-suggestions">{originSuggestions.map((s, i) => <div key={i} className="suggestion-item" onClick={() => handleSuggestionSelectRef.current?.(s, true)} onMouseDown={e => e.preventDefault()}>{s.place_name}</div>)}</div>}
               </div></div></div>
               {/* Destination Input */}
               <div className="search-form"><div className="input-group"><div className="input-container">
                 <input type="text" placeholder="Destination" value={destinationValue} onChange={(e) => handleInputChangeRef.current?.(e, false)} onFocus={() => handleInputFocusRef.current?.(false)} onBlur={() => handleInputBlurRef.current?.(false)} />
                 {showDestinationSuggestions && destinationSuggestions.length > 0 && <div className="suggestions-dropdown destination-suggestions">{destinationSuggestions.map((s, i) => <div key={i} className="suggestion-item" onClick={() => handleSuggestionSelectRef.current?.(s, false)} onMouseDown={e => e.preventDefault()}>{s.place_name}</div>)}</div>}
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
              
              {/* Route Info Display */}
              {routeInfo && (
                <div className="route-info">
                  {/* Display logic based on routeInfo state */}
                   {routeInfo.routeType === 'fastest' && <div className="route-detail"><span className="route-icon">🚀</span><span>Fastest Route</span></div>}
                   {(routeInfo.routeType === 'cell_coverage' || routeInfo.routeType === 'balanced') && routeInfo.signalQuality !== undefined && (
                  <div className="route-detail">
                       <span className="route-icon">📱</span>
                       <span className="signal-strength">{Array(5).fill().map((_, i) => <span key={i} className={`signal-bar ${i < Math.round(routeInfo.signalQuality) ? 'active' : ''}`} />)}</span>
                       <span>({routeInfo.towerCount} towers)</span>
                  </div>
                  )}
                   {/* Display Distance/Duration */}
                    <div className="route-detail">
                       <span className="route-icon">📏</span>
                       <span>{formatDistanceRef.current?.(routeInfo.distance)}</span>
                    </div>
                    <div className="route-detail">
                       <span className="route-icon">⏱️</span>
                       <span>{formatDurationRef.current?.(routeInfo.duration)}</span>
                   </div>
                </div>
              )}
              
              {/* Loading Indicator */}
              {(isLoadingRoute || calculationAnimation) && <div className="loading-indicator">{calculationAnimation || 'Calculating route...'}</div>}
            </div>
          </div>
        )}
      </div>
      
      {/* Modals */}
      <RouteTypeSelection />
      {optimizationNotice && <div className="optimization-notice">{optimizationNotice.message}</div>}
    </div>
  );
}

export default App;