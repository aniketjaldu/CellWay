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
  const [routeControl, setRouteControl] = useState(null);
  const routeControlRef = useRef(null);
  
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

  // Add this near the top of the component with other ref definitions
  const allTowers = useRef([]); // Make sure it's initialized with an empty array

  // State for cell towers
  const [cellTowers, setCellTowers] = useState([]);
  const [showCellTowers, setShowCellTowers] = useState(false);
  const cellTowerLayerRef = useRef(null);
  const [routeTowers, setRouteTowers] = useState([]);

  // Define refs for functions with circular dependencies
  const clearRouteDisplayRef = useRef(null);

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
    allRoutes: [] // Add array to store all 10 routes
  });
  
  // Store cell towers for each route type
  const [computedRouteTowers, setComputedRouteTowers] = useState({
    fastest: [],
    cell_coverage: [],
    balanced: []
  });
  
  // Store route classifications
  const [routeClassifications, setRouteClassifications] = useState({
    fastest: -1,  // Index of route classified as fastest
    cell_coverage: -1, // Index of route classified as best signal
    balanced: -1 // Index of route classified as balanced
  });
  
  // Flag to track if all routes have been computed
  const [allRoutesComputed, setAllRoutesComputed] = useState(false);

  // Flag to track if routes are currently being loaded/calculated
  const [routesAreLoading, setRoutesAreLoading] = useState(false);

  // Add a state for route calculation animation
  const [calculationAnimation, setCalculationAnimation] = useState(null);
  
  // Add a state for optimization notice
  const [optimizationNotice, setOptimizationNotice] = useState(null);
  
  // Add state to track if we're recalculating routes
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Define markers state for route points
  const [markers, setMarkers] = useState(null);

  // Define route start and end points
  const [routeStartPoint, setRouteStartPoint] = useState(null);
  const [routeEndPoint, setRouteEndPoint] = useState(null);

  // Forward declare calculateAllRouteTypes function to avoid reference errors
  let calculateAllRouteTypes;

  // Load route preferences - load this first
  useEffect(() => {
    console.log("Loading route preferences...");
    
    // Check if we have a saved preferred route type
    const savedRouteType = localStorage.getItem('preferredRouteType');
    if (savedRouteType) {
      console.log(`Found saved route type preference: ${savedRouteType}`);
      setRouteType(savedRouteType);
    }
    
    // Don't load "Don't ask again" preference to keep checkbox unchecked by default
  }, []);

  // Check if user is authenticated
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.get('/user');
      if (response.data && response.data.user_id) {
        setUser({ id: response.data.user_id });
        fetchSavedRoutes();
      }
    } catch (error) {
      console.log('Not authenticated');
    }
  };

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

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    try {
      const response = await api.post('/login', { email, password });
      if (response.data.success) {
        setUser(response.data.user);
        setShowAuthForm(false);
        fetchSavedRoutes();
        
        // Clear form
        setEmail('');
        setPassword('');
      }
    } catch (error) {
      setAuthError(error.response?.data?.error || 'Login failed');
    }
  };

  // Handle registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    if (!username || !email || !password) {
      setAuthError('All fields are required');
      return;
    }
    
    try {
      const response = await api.post('/register', { username, email, password });
      if (response.data.success) {
        setUser(response.data.user);
        setShowAuthForm(false);
        
        // Clear form
        setUsername('');
        setEmail('');
        setPassword('');
      }
    } catch (error) {
      setAuthError(error.response?.data?.error || 'Registration failed');
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await api.post('/logout');
      setUser(null);
      setSavedRoutes([]);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Toggle auth form
  const toggleAuthForm = () => {
    setShowAuthForm(!showAuthForm);
    setAuthError('');
  };

  // Toggle saved routes
  const toggleSavedRoutes = () => {
    setShowSavedRoutes(!showSavedRoutes);
    if (!showSavedRoutes && user) {
      fetchSavedRoutes();
    }
  };

  // Load a saved route
  const loadSavedRoute = (route) => {
    if (!map) return;
    
    // Set route values
    setOriginValue(route.origin.place_name || route.origin);
    setDestinationValue(route.destination.place_name || route.destination);
    
    // Update markers
    const originLatLng = L.latLng(route.route_data.origin.lat, route.route_data.origin.lng);
    const destLatLng = L.latLng(route.route_data.destination.lat, route.route_data.destination.lng);
    
    updateMarker(originLatLng, true);
    updateMarker(destLatLng, false);
    
    // Create route
    updateMapView(originLatLng, destLatLng);
    
    // Close saved routes panel
    setShowSavedRoutes(false);
  };

  // Toggle search expansion
  const toggleSearch = () => {
    setSearchExpanded(!searchExpanded);
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    
    // Create map instance
    const mapInstance = L.map(mapRef.current).setView([42.336687, -71.095762], 13);
    
    // Add MapTiler tile layer
    L.tileLayer('https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=' + mapTilerKey, {
      attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
      tileSize: 512,
      zoomOffset: -1,
      minZoom: 3
    }).addTo(mapInstance);

    // Set map instance to state
    setMap(mapInstance);
    
    // Initialize currentRoutePoints to prevent null errors
    if (!currentRoutePoints) {
      setCurrentRoutePoints({
        start: null,
        end: null
      });
    }
    
    // Initialize allTowers if needed
    if (!allTowers || !allTowers.current) {
      console.log("Initializing allTowers in map useEffect");
      if (!allTowers) {
        // This shouldn't happen, but let's handle it anyway
        console.warn("allTowers ref is undefined - creating it");
        allTowers = { current: [] };
      } else {
        allTowers.current = [];
      }
    }
    
    // Force map to invalidate its size after mounting
    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 100);

    // Cleanup function
    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, []);

  // First define the primary marker update function
  const updateMarker = useCallback((latlng, isOrigin) => {
    if (!map) return null;
    
    let marker;
    if (isOrigin) {
      if (originMarker) {
        originMarker.setLatLng(latlng);
        marker = originMarker;
      } else {
        const icon = L.divIcon({
          html: `<div class="origin-marker"></div>`,
          className: '',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        
        marker = L.marker(latlng, { 
          icon: icon,
          title: "Origin" 
        }).addTo(map);
        
        setOriginMarker(marker);
      }
    } else {
      if (destinationMarker) {
        destinationMarker.setLatLng(latlng);
        marker = destinationMarker;
      } else {
        const icon = L.divIcon({
          html: `<div class="destination-marker"></div>`,
          className: '',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        
        marker = L.marker(latlng, { 
          icon: icon,
          title: "Destination" 
        }).addTo(map);
        
        setDestinationMarker(marker);
      }
    }
    return marker;
  }, [map, originMarker, destinationMarker]);

  // Function to fetch cell towers for a bounding box
  const fetchCellTowers = useCallback(async (bounds) => {
    if (!map) return;
    
    try {
      // Ensure the bounding box is large enough
      let { min_lat, min_lng, max_lat, max_lng } = bounds;
      
      // Add significant padding to increase the search area (at least 0.1 degrees ~ 10km)
      const padding = 0.1;
      min_lat = Math.min(min_lat, min_lat - padding);
      max_lat = Math.max(max_lat, max_lat + padding);
      min_lng = Math.min(min_lng, min_lng - padding);
      max_lng = Math.max(max_lng, max_lng + padding);
      
      console.log(`Fetching cell towers in area: ${min_lat},${min_lng},${max_lat},${max_lng}`);
      
      // Use axios instance instead of fetch
      const response = await api.get('/towers', {
        params: {
          min_lat,
          min_lng,
          max_lat,
          max_lng
        }
      });
      
      const data = response.data;
      const towers = data.towers || [];
      
      console.log(`Received ${towers.length} cell towers from the backend`);
      
      if (towers.length > 0) {
        setCellTowers(towers);
        // Store in the allTowers ref for later use
        allTowers.current = towers;
        // Auto-show towers when we generate them
        setShowCellTowers(true);
        return towers;
      } else {
        toast.warning("No cell towers found in this area", {
          position: "top-center",
          autoClose: 3000,
        });
      }
      
      return [];
    } catch (error) {
      console.error("Error fetching cell tower data:", error);
      toast.error("Error fetching cell tower data", {
        position: "top-center",
        autoClose: 3000,
      });
      return [];
    }
  }, [map]);

  // Handle input changes for origin/destination
  const handleInputChange = useCallback(async (e, isOrigin) => {
    const value = e.target.value;
    
    // Update the appropriate state
    if (isOrigin) {
      setOriginValue(value);
    } else {
      setDestinationValue(value);
    }
    
    // If input is empty, clear suggestions
    if (!value.trim()) {
      if (isOrigin) {
        setOriginSuggestions([]);
        setShowOriginSuggestions(false);
      } else {
        setDestinationSuggestions([]);
        setShowDestinationSuggestions(false);
      }
      return;
    }
    
    try {
      // Use the MapTiler geocoding API
      const response = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(value)}.json?key=${mapTilerKey}`
      );
      
      const data = await response.json();
      
      if (data && data.features) {
        // Update the appropriate suggestions state
        if (isOrigin) {
          setOriginSuggestions(data.features);
          setShowOriginSuggestions(true);
        } else {
          setDestinationSuggestions(data.features);
          setShowDestinationSuggestions(true);
        }
      }
    } catch (error) {
      console.error('Error fetching geocoding suggestions:', error);
    }
  }, [mapTilerKey]);

  // Handle input focus for origin/destination
  const handleInputFocus = useCallback((isOrigin) => {
    // Show appropriate suggestions if they exist
    if (isOrigin && originSuggestions.length > 0) {
      setShowOriginSuggestions(true);
    } else if (!isOrigin && destinationSuggestions.length > 0) {
      setShowDestinationSuggestions(true);
    }
  }, [originSuggestions, destinationSuggestions]);

  // Handle input blur for origin/destination
  const handleInputBlur = useCallback((isOrigin) => {
    // Delay hiding suggestions to allow click events to register
    setTimeout(() => {
      if (isOrigin) {
        setShowOriginSuggestions(false);
      } else {
        setShowDestinationSuggestions(false);
      }
    }, 200);
  }, []);

  // Handle suggestion selection for origin/destination
  const handleSuggestionSelect = useCallback((suggestion, isOrigin) => {
    if (!map) return;
    
    suggestionClickedRef.current = true; // Prevent blur from hiding suggestions

    const [lng, lat] = suggestion.center;
    const latlng = L.latLng(lat, lng);
    const placeName = suggestion.place_name;

    // Update marker using ref
    updateMarker(latlng, isOrigin);

    // Update input value and hide suggestions
    if (isOrigin) {
      setOriginValue(placeName);
      setShowOriginSuggestions(false);
      setCurrentRoutePoints(prev => ({ ...prev, start: { lat, lng } }));
    } else {
      setDestinationValue(placeName);
      setShowDestinationSuggestions(false);
      setCurrentRoutePoints(prev => ({ ...prev, end: { lat, lng } }));
    }

    // Check if both points are now set and trigger route calculation
    const otherMarker = isOrigin ? destinationMarker : originMarker;
    if (otherMarker) {
      const otherLatLng = otherMarker.getLatLng();
      const originLL = isOrigin ? latlng : otherLatLng;
      const destLL = isOrigin ? otherLatLng : latlng;
      
      // Fit both markers in the view
      const bounds = L.latLngBounds([originLL, destLL]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      
      // Trigger route calculation
      if (originLL && destLL) {
        // Show route optimization panel before route calculation
        setShowRouteTypeSelection(true);
        
        // Then update map view and trigger route calculation
        updateMapView(originLL, destLL);
        
        // Close search panel
        setSearchExpanded(false);
      }
    } else {
      // Just pan to the selected location if only one marker exists
      map.flyTo(latlng, Math.max(map.getZoom(), 14));
    }
  }, [map, destinationMarker, originMarker, updateMarker]);

  // Update map view (fit bounds) and trigger route calculation
  const updateMapView = useCallback((originLatLng, destLatLng) => {
    if (!map || !originLatLng || !destLatLng) return;

    console.log("Updating map view and triggering route calculation process...");

    // Fit map to bounds of both waypoints
    const bounds = L.latLngBounds([originLatLng, destLatLng]);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });

    // Store the exact points used for this calculation request
    const routePointsForCalc = {
      start: { lat: originLatLng.lat, lng: originLatLng.lng },
      end: { lat: destLatLng.lat, lng: destLatLng.lng }
    };
    setCurrentRoutePoints(routePointsForCalc);

    // Reset computation flags
    setAllRoutesComputed(false);
    setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null, allRoutes: [] });
    setComputedRouteTowers({ fastest: [], cell_coverage: [], balanced: [] });
    
    // Clear previous route display
    clearRouteDisplayRef.current?.();
    
    // Hide search panel since we're calculating routes now
    setSearchExpanded(false);

    setIsLoadingRoute(true);
    setRoutesAreLoading(true);

    // 1. Fetch cell towers for the new area
    console.log("Fetching cell towers for route area...");
    const padding = 0.1; // ~10km padding
    const towerBounds = {
      min_lat: Math.min(originLatLng.lat, destLatLng.lat) - padding,
      min_lng: Math.min(originLatLng.lng, destLatLng.lng) - padding,
      max_lat: Math.max(originLatLng.lat, destLatLng.lat) + padding,
      max_lng: Math.max(originLatLng.lng, destLatLng.lng) + padding
    };

    fetchCellTowers(towerBounds).then(fetchedTowers => {
      // Store for later use
      allTowers.current = fetchedTowers;
      
      // Calculate all routes
      calculateAllRouteTypes(routePointsForCalc);
    }).catch(error => {
      console.error("Error fetching cell towers:", error);
      
      // Continue with route calculation even if we couldn't get towers
      calculateAllRouteTypes(routePointsForCalc);
    });
  }, [map, clearRouteDisplayRef, fetchCellTowers, calculateAllRouteTypes]);

  // Function to calculate a route between two points
  const calculateRoute = useCallback(async (startLat, startLng, endLat, endLng, routeType, algorithm = 'osrm', weight = 0) => {
    // Ensure all coordinates are valid numbers
    const validStartLat = Number(parseFloat(startLat).toFixed(6));
    const validStartLng = Number(parseFloat(startLng).toFixed(6));
    const validEndLat = Number(parseFloat(endLat).toFixed(6));
    const validEndLng = Number(parseFloat(endLng).toFixed(6));
    
    // Check for NaN or invalid values
    if (isNaN(validStartLat) || isNaN(validStartLng) || isNaN(validEndLat) || isNaN(validEndLng)) {
      throw new Error(`Invalid coordinates: (${startLat}, ${startLng}) to (${endLat}, ${endLng})`);
    }
    
    console.log(`Calculating ${routeType} route from (${validStartLat}, ${validStartLng}) to (${validEndLat}, ${validEndLng})`);
    console.log(`Using algorithm: ${algorithm}, weight: ${weight}`);
    
    try {
      // Call the backend API to calculate the route
      const response = await api.get('/route', {
        params: {
          start_lat: validStartLat,
          start_lng: validStartLng,
          end_lat: validEndLat,
          end_lng: validEndLng,
          route_type: routeType,
          algorithm: algorithm,
          weight: weight
        }
      });
      
      const data = response.data;
      
      // Log the full response for debugging
      console.log(`API Response for ${routeType} route:`, data);
      
      // Check if the response has the expected data
      // The API returns 'routes' (array) not 'route' (object)
      if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
        console.log(`Route ${routeType} calculated successfully`);
        
        // Extract route data from the first route
        const route = data.routes[0];
        
        // Make sure the route has a geometry property
        if (!route.geometry) {
          console.error("Route missing geometry:", route);
          throw new Error(`${routeType} route is missing geometry data`);
        }
        
        // Format the route data to match what our app expects
        const routeData = {
          routes: data.routes,
          waypoints: data.waypoints,
          // Extract other metrics for display
          distance: route.distance,
          duration: route.duration
        };
        
        // Log route for debugging
        console.log(`Formatted ${routeType} route:`, routeData);
        
        return {
          route: routeData,
          towers: data.towers || []
        };
      } else {
        console.error(`Route ${routeType} calculation failed - Response data:`, data);
        throw new Error(`Failed to calculate ${routeType} route: No route data returned`);
      }
    } catch (error) {
      console.error(`Route calculation failed for ${routeType}:`, error);
      console.error(`Error details:`, error.response?.data || 'No response data');
      throw error;
    }
  }, []);

  // Helper function to format distance
  const formatDistance = (distanceInKm) => {
    if (distanceInKm < 1) {
      // Convert to meters for short distances
      return `${Math.round(distanceInKm * 1000)} m`;
    } else if (distanceInKm < 10) {
      // Use 1 decimal place for medium distances
      return `${distanceInKm.toFixed(1)} km`;
    } else {
      // Round to nearest km for long distances
      return `${Math.round(distanceInKm)} km`;
    }
  };

  // Helper function to format duration
  const formatDuration = (durationInSeconds) => {
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours} h ${minutes} min`;
    } else {
      return `${minutes} min`;
    }
  };

  // Calculate signal quality score based on tower proximity and signal strength
  const calculateSignalScore = (towers) => {
    if (!towers || towers.length === 0) return 0;
    
    // Calculate a score based on number of towers and average signal strength
    const averageSignal = towers.reduce((sum, tower) => sum + (tower.averageSignal || -100), 0) / towers.length;
    
    // Normalize signal strength from dBm (-120 to -50) to a 0-5 scale
    // -120 dBm (very weak) = 0, -50 dBm (very strong) = 5
    const normalizedSignal = Math.max(0, Math.min(5, ((averageSignal + 120) / 14)));
    
    // Weight by number of towers (more towers = better coverage)
    // Cap at 20 towers for max score contribution
    const towerCountFactor = Math.min(1, towers.length / 20);
    
    // Combined score (70% signal strength, 30% tower count)
    const score = (normalizedSignal * 0.7) + (5 * towerCountFactor * 0.3);
    
    return score;
  };

  // Find cell towers along a route within specified distance
  const findTowersAlongRoute = (towers, routeCoordinates, distanceInMeters = 500) => {
    if (!towers || !routeCoordinates || towers.length === 0 || routeCoordinates.length === 0) {
      return [];
    }
    
    // Helper function to calculate distance between two points in meters
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3; // Earth's radius in meters
      const φ1 = lat1 * Math.PI / 180;
      const φ2 = lat2 * Math.PI / 180;
      const Δφ = (lat2 - lat1) * Math.PI / 180;
      const Δλ = (lon2 - lon1) * Math.PI / 180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };
    
    // Calculate minimum distance from a point to a line segment
    const pointToLineDistance = (pointLat, pointLon, lineLat1, lineLon1, lineLat2, lineLon2) => {
      // Convert to Cartesian coordinates for simplicity
      const x = pointLat;
      const y = pointLon;
      const x1 = lineLat1;
      const y1 = lineLon1;
      const x2 = lineLat2;
      const y2 = lineLon2;
      
      // Calculate line length squared
      const lineLength2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
      if (lineLength2 === 0) {
        // Line segment is actually a point
        return calculateDistance(pointLat, pointLon, lineLat1, lineLon1);
      }
      
      // Calculate projection of point onto line
      const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lineLength2));
      const projX = x1 + t * (x2 - x1);
      const projY = y1 + t * (y2 - y1);
      
      // Calculate distance from point to projection
      return calculateDistance(pointLat, pointLon, projX, projY);
    };
    
    // Find towers close to the route
    const towersAlongRoute = towers.filter(tower => {
      // Check if tower is close to any segment of the route
      for (let i = 0; i < routeCoordinates.length - 1; i++) {
        const [lat1, lon1] = routeCoordinates[i];
        const [lat2, lon2] = routeCoordinates[i + 1];
        
        const distance = pointToLineDistance(
          tower.lat, tower.lon,
          lat1, lon1,
          lat2, lon2
        );
        
        if (distance <= distanceInMeters) {
          return true;
        }
      }
      return false;
    });
    
    return towersAlongRoute;
  };

  // Function to display a route on the map
  const displayRoute = useCallback((route, allTowersData, routeType) => {
    if (!map || !route) return;
    
    console.log(`Displaying ${routeType} route on map:`, route);
    console.log(`Route structure: routes=${!!route.routes}, geometry=${!!route.geometry}, legs=${!!route.legs}`);
    
    // Remove any existing route from the map
    if (routeControlRef.current) {
      // Check if it's a control (old code) or a layer (new code)
      if (typeof routeControlRef.current.removeFrom === 'function') {
        routeControlRef.current.removeFrom(map);
      } else if (typeof routeControlRef.current.remove === 'function') {
        map.removeLayer(routeControlRef.current);
      }
      routeControlRef.current = null;
      setRouteControl(null);
    }
    
    // Clear any active step marker
    if (activeStepMarker) {
      map.removeLayer(activeStepMarker);
      setActiveStepMarker(null);
    }
    
    // Reset active step
    setActiveDirectionStep(null);
    
    try {
      // Check if we have route data in the expected format
      // Handle both OSRM format (route.routes[0].geometry) and custom format (route.geometry)
      let routeGeometry;
      
      if (route.routes && route.routes[0] && route.routes[0].geometry) {
        // OSRM format
        routeGeometry = route.routes[0].geometry;
      } else if (route.geometry) {
        // Custom route format
        routeGeometry = route.geometry;
      } else {
        console.error("Invalid route data format:", route);
        throw new Error("Invalid route data format");
      }
      
      console.log("Route geometry found:", routeGeometry);
      
      // Create a new polyline for the route
      const routeCoordinates = routeGeometry.coordinates.map(coord => [coord[1], coord[0]]);
      
      // Validate coordinates
      if (!routeCoordinates || routeCoordinates.length < 2) {
        console.error("Invalid route coordinates:", routeCoordinates);
        throw new Error("Invalid route coordinates");
      }
      
      console.log(`Creating route with ${routeCoordinates.length} points`);
      console.log("First point:", routeCoordinates[0]);
      console.log("Last point:", routeCoordinates[routeCoordinates.length - 1]);
      
      // Instead of using L.Routing.control, draw the route directly as a polyline
      // This avoids making additional API calls to Mapbox that cause CORS errors
      if (routeControlRef.current) {
        // This is already handled above, but just to be sure
        map.removeLayer(routeControlRef.current);
      }
      
      // Create a polyline for the route
      const routeColor = routeType === 'fastest' ? '#4285F4' : 
                        routeType === 'cell_coverage' ? '#0F9D58' : 
                        '#F4B400';
                        
      const routePolyline = L.polyline(routeCoordinates, {
        color: routeColor,
        opacity: 0.8,
        weight: 6,
        lineJoin: 'round'
      }).addTo(map);
      
      // Store the polyline in the ref for later cleanup
      routeControlRef.current = routePolyline;
      setRouteControl(routePolyline);
      
      // Find towers along the route
      let towersAlongRoute = [];
      if (allTowersData && allTowersData.length > 0) {
        // Use the findTowersAlongRoute function to get towers near the route
        towersAlongRoute = findTowersAlongRoute(allTowersData, routeCoordinates, 500);
        console.log(`Found ${towersAlongRoute.length} towers along the ${routeType} route`);
        
        // Store these towers for display
            setRouteTowers(towersAlongRoute);
      }
      
      // Create route information for display
      const routeInfo = {
        routeType: routeType,
        distance: route.distance,
        distanceFormatted: formatDistance(route.distance / 1000),
        duration: route.duration,
        durationFormatted: formatDuration(route.duration),
        calculatedSignalQuality: route.signalScore || calculateSignalScore(towersAlongRoute),
        towerCount: towersAlongRoute.length
      };
      
      // Set route info in state
      setRouteInfo(routeInfo);
      
      // Handle directions if available - check both formats
      const hasOsrmDirections = route.routes && route.routes[0] && route.routes[0].legs && 
                               route.routes[0].legs[0] && route.routes[0].legs[0].steps;
      const hasCustomDirections = route.legs && route.legs.length > 0 && route.legs[0].steps;
      
      if (hasOsrmDirections) {
        // OSRM format directions
        const directions = {
          distance: route.distance,
          distanceFormatted: formatDistance(route.distance / 1000),
          duration: route.duration,
          durationFormatted: formatDuration(route.duration),
          isCustomRoute: false,
          steps: route.routes[0].legs[0].steps.map(step => ({
            instruction: step.maneuver ? step.maneuver.instruction : "Continue on route",
            distance: step.distance,
            distanceFormatted: formatDistance(step.distance / 1000),
            duration: step.duration,
            durationFormatted: formatDuration(step.duration),
            type: step.maneuver ? step.maneuver.type : "unknown",
            coordinates: step.geometry ? step.geometry.coordinates : null
          }))
        };
        
        // Set route directions in state
        setRouteDirections(directions);
        
        // Show directions panel
        setShowDirections(true);
        setIsDirectionsMinimized(false);
      } else if (hasCustomDirections) {
        // Custom route format directions
        const directions = {
          distance: route.distance,
          distanceFormatted: formatDistance(route.distance / 1000),
          duration: route.duration,
          durationFormatted: formatDuration(route.duration),
          isCustomRoute: true,
          steps: route.legs[0].steps.map(step => ({
            instruction: step.instruction || "Continue on route",
            distance: step.distance,
            distanceFormatted: formatDistance(step.distance / 1000),
            duration: step.duration || 0,
            durationFormatted: formatDuration(step.duration || 0),
            type: step.type || "unknown",
            bearing: step.bearing || 0,
            coordinates: routeGeometry.coordinates // Use route coordinates since custom steps might not have geometry
          }))
        };
        
        // Set route directions in state
        setRouteDirections(directions);
        
        // Show directions panel
        setShowDirections(true);
        setIsDirectionsMinimized(false);
      } else {
        console.warn("Route data missing legs/steps information for directions");
        
        // For custom routes, try to generate basic directions
        if (route.custom_route) {
          console.log("Generating basic directions for custom route");
          
          // Create a simple direction object with basic information
          const directions = {
            distance: route.distance,
            distanceFormatted: formatDistance(route.distance / 1000),
            duration: route.duration,
            durationFormatted: formatDuration(route.duration),
            isCustomRoute: true,
            steps: [
              {
                instruction: "Start route",
                distance: 0,
                distanceFormatted: "0 km",
                duration: 0,
                durationFormatted: "0 min",
                type: "depart",
                coordinates: routeGeometry.coordinates.slice(0, Math.min(10, routeGeometry.coordinates.length))
              },
              {
                instruction: "Follow the route displayed on map",
                distance: route.distance,
                distanceFormatted: formatDistance(route.distance / 1000),
                duration: route.duration,
                durationFormatted: formatDuration(route.duration),
                type: "continue",
                coordinates: routeGeometry.coordinates
              },
              {
                instruction: "Arrive at destination",
                distance: 0,
                distanceFormatted: "0 km",
                duration: 0,
                durationFormatted: "0 min",
                type: "arrive",
                coordinates: routeGeometry.coordinates.slice(Math.max(0, routeGeometry.coordinates.length - 10))
              }
            ]
          };
          
          // Set basic directions
          setRouteDirections(directions);
          setShowDirections(true);
          setIsDirectionsMinimized(false);
        } else {
          setShowDirections(false);
        }
      }
      
      // Clear any calculation animation
      if (calculationAnimation && calculationAnimation.cleanup) {
        calculationAnimation.cleanup();
        setCalculationAnimation(null);
      }
      
      // Set loading to false
      setIsLoadingRoute(false);
      
    } catch (error) {
      console.error(`Error displaying ${routeType} route:`, error);
      setIsLoadingRoute(false);
      
      // Clear calculation animation on error
      if (calculationAnimation && calculationAnimation.cleanup) {
        calculationAnimation.cleanup();
        setCalculationAnimation(null);
      }
      
      toast.error("Error displaying route. Please try again.", {
        position: "top-center",
        autoClose: 3000,
      });
    }
  }, [map, activeStepMarker, findTowersAlongRoute, calculateSignalScore, calculationAnimation]);

  // Function to toggle cell tower visibility
  const toggleCellTowers = useCallback(() => {
    console.log("Toggling cell tower visibility");
    
    // Make sure allTowers is initialized
    if (!allTowers || !allTowers.current) {
      console.log("Initializing allTowers in toggleCellTowers");
      if (!allTowers) {
        // This is a serious issue, but we'll try to recover
        console.warn("allTowers ref is undefined in toggleCellTowers");
        allTowers = { current: [] };
      } else {
        allTowers.current = [];
      }
    }
    
    // Simply toggle cell tower visibility without trying to calculate routes
    setShowCellTowers(prev => !prev);
    
    // If no cell towers are loaded yet, try to fetch them first
    // But don't do any route-related calculations
    if (cellTowers.length === 0 && map) {
      try {
        const bounds = map.getBounds();
        
        // Only fetch if we have valid bounds
        if (bounds) {
          // Extract coordinates with proper validation
          const south = typeof bounds.getSouth === 'function' ? bounds.getSouth() : null;
          const west = typeof bounds.getWest === 'function' ? bounds.getWest() : null; 
          const north = typeof bounds.getNorth === 'function' ? bounds.getNorth() : null;
          const east = typeof bounds.getEast === 'function' ? bounds.getEast() : null;
       
          // Check if any coordinates are invalid
          if (south === null || west === null || north === null || east === null ||
              isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) {
            console.error("Invalid map bounds");
            return;
          }
          
          console.log("Fetching cell towers for the current map view");
          console.log(`Bounds: ${south}, ${west}, ${north}, ${east}`);
    
    // Step 1: Fetch cell towers first
    fetchCellTowers({
            min_lat: south,
            min_lng: west,
            max_lat: north,
            max_lng: east
    }).then(towers => {
      // Store all towers for the area
      setCellTowers(towers);
       
            // Store in allTowers ref for calculations
            allTowers.current = towers || [];
            
            // Immediately capture the current route points to prevent race conditions
            // but only if they exist
            if (routeStartPoint && routeEndPoint) {
              const capturedRoutePoints = {
                start: { ...routeStartPoint },
                end: { ...routeEndPoint }
              };
              
              // Update our state to be consistent with what we captured
              setCurrentRoutePoints(capturedRoutePoints);
      
      // If "Don't ask again" is enabled, directly calculate all routes
      if (skipRouteTypeSelection) {
                // Set loading state
                setIsLoadingRoute(true);
                
                // Use a small delay to ensure state updates
                setTimeout(() => {
                  // Pass our captured points directly to calculateAllRouteTypes
                  console.log("Calculating routes with explicitly captured points:", capturedRoutePoints);
                  calculateAllRouteTypes(capturedRoutePoints);
                }, 50);
      } else {
        // Show route selection dialog if not skipping
        setShowRouteTypeSelection(true);
                setIsLoadingRoute(false);
              }
            } else {
              // No route points set yet - just complete fetch without calculating route
              console.log("No route points set yet, skipping route calculation after cell tower fetch");
      }
    }).catch(error => {
      setIsLoadingRoute(false);
      console.error('Error fetching cell towers:', error);
            
            // Initialize allTowers even on error
            allTowers.current = [];
            
            // Clean up animation on error
            cleanupAnimation();
      
      // Show error message
      toast.error('Error fetching cell tower data. Please try again.', {
        position: "top-center",
        autoClose: 5000,
      });
    });
        } else {
          console.error("Map bounds not available");
        }
      } catch (error) {
        console.error("Error getting map bounds:", error);
      }
    }
  }, [map, cellTowers.length, fetchCellTowers]);

  // Ensure processAllRoutes is defined BEFORE calculateAllRouteTypes to fix function order
  const processAllRoutes = useCallback((routes, towers, allTowersData) => {
    console.log("Processing routes:", routes);
    
    // Ensure we have routes to process
    if (!routes || routes.length === 0) {
      console.error("No routes to process");
      return;
    }
    
    // First store all routes as a global reference for immediate access
    window.cachedRoutes = {
      allRoutes: routes,
      fastest: routes.find(r => r.type === 'fastest'),
      cell_coverage: routes.find(r => r.type === 'cell_coverage'), 
      balanced: routes.find(r => r.type === 'balanced')
    };
    
    // Explicitly set the route type on each route to ensure consistency
    const processedRoutes = routes.map(route => {
      // If route type is missing, infer it based on route properties
      if (!route.type) {
        if (route.cell_coverage_score > 0.8) {
          route.type = 'cell_coverage';
        } else if (route.distance < routes.reduce((min, r) => Math.min(min, r.distance), Infinity) * 1.1) {
          route.type = 'fastest';
        } else {
          route.type = 'balanced';
        }
      }
      return route;
    });
    
    console.log("Processed routes with explicit types:", processedRoutes.map(r => r.type));
    
    // Organize routes by type
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
    
    // Update cached routes with processed routes
    window.cachedRoutes = {
      allRoutes: processedRoutes,
      fastest: validRoutes.fastest || null,
      cell_coverage: validRoutes.cell_coverage || null,
      balanced: validRoutes.balanced || null
    };
    
    // Store the organized routes in the state
    setComputedRoutes({
      fastest: validRoutes.fastest || null,
      cell_coverage: validRoutes.cell_coverage || null,
      balanced: validRoutes.balanced || null,
      allRoutes: processedRoutes
    });
    
    // If towers are provided, store them
    if (towers && towers.length > 0) {
      setRouteTowers(towers);
    }
    
    setAllRoutesComputed(true);
    setRoutesAreLoading(false);
  }, []);

  // Then define calculateAllRouteTypes implementation 
  calculateAllRouteTypes = useCallback(async (explicitRoutePoints = null) => {
    // Log function call for debugging
    console.log("calculateAllRouteTypes called", explicitRoutePoints ? "with explicit points" : "with state points");
    
    // Use explicit route points if provided, otherwise use state
    const routePointsToUse = explicitRoutePoints || currentRoutePoints;
    
    // CRITICAL SAFETY CHECK: Refuse to proceed if route points are invalid
    if (!routePointsToUse || 
        !routePointsToUse.start || 
        !routePointsToUse.end ||
        typeof routePointsToUse.start.lat !== 'number' || 
        typeof routePointsToUse.start.lng !== 'number' ||
        typeof routePointsToUse.end.lat !== 'number' || 
        typeof routePointsToUse.end.lng !== 'number') {
      
      // Create a more specific error message
      let errorMessage = "Please set both origin and destination first";
      
      console.error("Cannot calculate routes: No valid route points", routePointsToUse);
      toast.error(errorMessage, {
        position: "top-center",
        autoClose: 3000,
      });
      setIsLoadingRoute(false);
      setRoutesAreLoading(false);
      setCalculationAnimation(null);
      return;
    }
    
    // Initialize allTowers if it doesn't exist
    if (!allTowers || !allTowers.current) {
      console.log("Initializing allTowers reference");
      if (!allTowers) {
        // Create the ref object if it doesn't exist
        allTowers = { current: [] };
        } else {
        // Just initialize the current property
        allTowers.current = [];
      }
    }
    
    console.log("Using route points:", routePointsToUse);
    
    // Safety check - wrap the entire function in a try/catch to prevent any errors from propagating
    try {
      // Clone the points to prevent any issues with state updates during calculation
      const start = {
        lat: routePointsToUse.start.lat,
        lng: routePointsToUse.start.lng
      };
      
      const end = {
        lat: routePointsToUse.end.lat,
        lng: routePointsToUse.end.lng
      };
      
      console.log("CALCULATING 3 DISTINCT ROUTES");
      console.log(`From: ${start.lat},${start.lng} to ${end.lat},${end.lng}`);
      
      // Define our route types with their algorithms and weights
      const routeTypes = [
        { type: 'fastest', algorithm: 'osrm', weight: 0 },
        { type: 'cell_coverage', algorithm: 'custom', weight: 0.8 },
        { type: 'balanced', algorithm: 'custom', weight: 0.5 }
      ];
      
      // Check if we already have these routes in cache
      const cacheKey = `${start.lat.toFixed(6)},${start.lng.toFixed(6)}-${end.lat.toFixed(6)},${end.lng.toFixed(6)}`;
      const cachedResult = routeCache[cacheKey];
      
      if (cachedResult) {
        console.log("Using cached routes");
        setComputedRoutes(cachedResult.routes);
        setComputedRouteTowers(cachedResult.towers);
        // Initialize allTowers if not already done
        if (!allTowers.current) {
          allTowers.current = [];
        }
        
        // Remember that we have the routes computed
        setAllRoutesComputed(true);
        
        // Find the route that matches the current selected type
        const selectedRoute = cachedResult.routes[routeType];
        if (selectedRoute) {
          displayRoute(selectedRoute, allTowers.current, routeType);
        }
        
        setIsLoadingRoute(false);
        setRoutesAreLoading(false);
        return;
      }
      
      setIsLoadingRoute(true);
      setRoutesAreLoading(true);
      setCalculationAnimation("Computing all routes...");
      setAllRoutesComputed(false);
      
      // Ensure allTowers is initialized
      if (!allTowers.current) {
        allTowers.current = [];
      }
      
      // Array to hold the routes and towers for each route
      const allRoutes = [];
      const allRouteTowers = [];
      
      // Calculate each route type with its specific parameters
      for (let i = 0; i < routeTypes.length; i++) {
        const routeConfig = routeTypes[i];
        setCalculationAnimation(`Computing ${routeConfig.type} route...`);
        
        console.log(`Calculating route type: ${routeConfig.type}, algorithm: ${routeConfig.algorithm}, weight: ${routeConfig.weight}`);
        
        try {
          const result = await calculateRoute(
            start.lat, 
            start.lng, 
            end.lat, 
            end.lng,
            routeConfig.type,
            routeConfig.algorithm,
            routeConfig.weight
          );
          
          if (result && result.route) {
            // Ensure the route has the type explicitly set as a top-level property
            const route = {
              ...result.route,
              type: routeConfig.type,
              algorithm: routeConfig.algorithm,
              weight: routeConfig.weight,
              signalScore: calculateSignalScore(result.towers || [])
            };
            
            // Log to make sure we're setting the type correctly
            console.log(`Successfully created ${routeConfig.type} route with type property:`, route.type);
            
            allRoutes.push(route);
            allRouteTowers.push(result.towers || []);
            
            // Display this route immediately if it matches the user's selected type
            if (routeConfig.type === routeType) {
              console.log(`Displaying ${routeConfig.type} route immediately as it matches selected route type`);
              // Display this route right away
              displayRoute(route, result.towers || [], routeConfig.type);
              
              // Update the route state to indicate this type is calculated
              setComputedRoutes(prev => ({
                ...prev,
                [routeConfig.type]: route
              }));
              
              // Update towers for this route
              setComputedRouteTowers(prev => ({
                ...prev,
                [routeConfig.type]: result.towers || []
              }));
              
              // Show loading is done for this route specifically
              setIsLoadingRoute(false);
            }
          }
    } catch (error) {
          console.error(`Error calculating ${routeConfig.type} route:`, error);
        }
      }
      
      // Debug the routes after calculation
      console.log(`Computed ${allRoutes.length} routes successfully:`);
      allRoutes.forEach(route => {
        console.log(`- Route type: ${route.type}, has geometry: ${!!(route.routes && route.routes[0] && route.routes[0].geometry)}`);
      });
      
      // Process all routes and compute metrics
      if (allRoutes.length > 0) {
        // First, store routes in cache
        processAllRoutes(allRoutes, allRouteTowers, allTowers.current);
        
        console.log(`Setting all routes computed, found ${allRoutes.length} routes`);
        setAllRoutesComputed(true);
        
        // If the selected route hasn't been displayed yet, display it now
        // This handles situations where routes were calculated out of order
        const selectedType = routeType;
        const selectedRoute = allRoutes.find(route => route.type === selectedType);
        
        // Only display if we haven't already displayed this route
        if (selectedRoute && !computedRoutes[selectedType]) {
          console.log(`Displaying ${selectedType} route after all routes computed`);
          displayRoute(selectedRoute, allTowers.current, selectedType);
        }
        
        // Reset loading state
        setIsLoadingRoute(false);
        setRoutesAreLoading(false);
        setCalculationAnimation(null);
        
        // Add the routes to our cache for faster future lookups
        setRouteCache(prev => {
          // Create the cache entry
          const cacheEntry = {
            routes: {
              fastest: allRoutes.find(r => r.type === 'fastest'),
              cell_coverage: allRoutes.find(r => r.type === 'cell_coverage'),
              balanced: allRoutes.find(r => r.type === 'balanced'),
              allRoutes: allRoutes
            },
            towers: {
              fastest: allRouteTowers[allRoutes.findIndex(r => r.type === 'fastest')] || [],
              cell_coverage: allRouteTowers[allRoutes.findIndex(r => r.type === 'cell_coverage')] || [],
              balanced: allRouteTowers[allRoutes.findIndex(r => r.type === 'balanced')] || [],
            }
          };
          
          // Log the cache entry to verify route types
          console.log("Creating cache entry with routes:", {
            fastest: cacheEntry.routes.fastest ? 'found' : 'not found',
            cell_coverage: cacheEntry.routes.cell_coverage ? 'found' : 'not found',
            balanced: cacheEntry.routes.balanced ? 'found' : 'not found'
          });
          
          if (!cacheEntry.routes.cell_coverage) {
            console.warn("MISSING cell_coverage route in cache. Routes array:", 
              allRoutes.map(r => ({type: r.type, hasGeometry: !!(r.routes && r.routes[0] && r.routes[0].geometry)}))
            );
            
            // Fall back to balanced route if available
            if (cacheEntry.routes.balanced) {
              console.log("Using balanced route as fallback for cell_coverage");
              cacheEntry.routes.cell_coverage = cacheEntry.routes.balanced;
            }
            // Or fastest route if available
            else if (cacheEntry.routes.fastest) {
              console.log("Using fastest route as fallback for cell_coverage");
              cacheEntry.routes.cell_coverage = cacheEntry.routes.fastest;
            }
          }
          
          return {
            ...prev,
            [cacheKey]: cacheEntry
          };
        });
      } else {
        setIsLoadingRoute(false);
        setCalculationAnimation(null);
        setAllRoutesComputed(true); // Set this even if we couldn't calculate routes
        setRoutesAreLoading(false);
        toast.error("Could not calculate any routes", {
          position: "top-center",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error in calculateAllRouteTypes:", error);
      setIsLoadingRoute(false);
      setCalculationAnimation(null);
      setRoutesAreLoading(false);
      toast.error("Error calculating routes", {
        position: "top-center",
        autoClose: 3000,
      });
    }
  }, [currentRoutePoints, routeType, calculateRoute, processAllRoutes, routeCache, calculateSignalScore, allTowers, displayRoute]);

  useEffect(() => {
    console.log(`Current route type set to: ${routeType}`);
  }, [routeType]);

  // Log when all routes are computed
  useEffect(() => {
    if (allRoutesComputed) {
      // Clear calculation animation when routes are computed
      setCalculationAnimation(null);
      
      console.log('=== ALL ROUTES COMPUTED ===');
      
      // Log details about each route type
      if (computedRoutes.fastest) {
        const route = computedRoutes.fastest;
        console.log(`FASTEST: ${(route.distance/1000).toFixed(1)}km, ${(route.duration/60).toFixed(1)}min, Signal: ${route.signalScore?.toFixed(2) || 'N/A'}/5`);
      }
      
      if (computedRoutes.cell_coverage) {
        const route = computedRoutes.cell_coverage;
        console.log(`BEST SIGNAL: ${(route.distance/1000).toFixed(1)}km, ${(route.duration/60).toFixed(1)}min, Signal: ${route.signalScore?.toFixed(2) || 'N/A'}/5`);
      }
      
      if (computedRoutes.balanced) {
        const route = computedRoutes.balanced;
        console.log(`BALANCED: ${(route.distance/1000).toFixed(1)}km, ${(route.duration/60).toFixed(1)}min, Signal: ${route.signalScore?.toFixed(2) || 'N/A'}/5`);
      }
    }
  }, [allRoutesComputed, computedRoutes]);

  // Cleanup calculation animation when component unmounts
  useEffect(() => {
    return () => {
      if (calculationAnimation && calculationAnimation.cleanup) {
        calculationAnimation.cleanup();
      }
    };
  }, [calculationAnimation]);

  // Add a helper function to check if route points are valid
  const hasValidRoutePoints = () => {
    // First check if route points exist
    const hasPoints = !!(
      currentRoutePoints && 
      currentRoutePoints.start && 
      currentRoutePoints.start.lat && 
      currentRoutePoints.start.lng && 
      currentRoutePoints.end && 
      currentRoutePoints.end.lat && 
      currentRoutePoints.end.lng
    );
    
    // If we don't have points, don't bother checking towers
    if (!hasPoints) return false;
    
    // Make sure allTowers reference exists
    if (!allTowers || !allTowers.current) {
      // Initialize it if missing
      if (!allTowers) {
        console.warn("allTowers ref is undefined - creating it");
      } else if (!allTowers.current) {
        console.warn("allTowers.current is undefined - initializing it");
        allTowers.current = [];
      }
    }
    
    return hasPoints;
  };

  // Helper function to get icon for route types
  const getRouteTypeIcon = (type) => {
    switch (type) {
      case 'fastest':
        return '⚡'; // Lightning bolt for fastest
      case 'cell_coverage':
        return '📱'; // Phone icon for best coverage
      case 'balanced':
        return '⚖️'; // Balance scale for balanced
      default:
        return '🚗'; // Car as fallback
    }
  };

  // Helper function to get icon for direction steps
  const getDirectionIcon = (type) => {
    switch (type) {
      case 'turn':
      case 'left':
        return '↰';
      case 'right':
        return '↱';
      case 'straight':
        return '⬆️';
      case 'uturn':
        return '↩️';
      case 'arrive':
        return '🏁';
      case 'depart':
        return '🚩';
      case 'roundabout':
      case 'rotary':
        return '🔄';
      case 'merge':
        return '↘️';
      case 'fork':
        return '⑂';
      case 'exit':
        return '↴';
      default:
        return '•';
    }
  };

  // Helper function to highlight route segment
  const highlightRouteSegment = (instruction, index) => {
    // Clear any existing highlight
    if (activeStepMarker) {
      map.removeLayer(activeStepMarker);
    }
    
    // Set the active step
    setActiveDirectionStep(index);
    
    // Handle both old and new direction formats
    const coords = instruction.coordinates || [];
    const instructionType = instruction.type || 'unknown';
    
    // Skip if no coordinates available
    if (!coords || coords.length === 0) {
      console.log("No coordinates available for this instruction");
      return;
    }
    
    // Create a marker for the step start position
    try {
      // The first coordinate may be formatted differently in the two formats
      let lat, lng;
      if (Array.isArray(coords[0])) {
        // For the new format [lng, lat] or [lon, lat]
        [lng, lat] = coords[0];
      } else if (coords[0] && coords[0].lat && coords[0].lng) {
        // For potential object format {lat, lng}
        lat = coords[0].lat;
        lng = coords[0].lng;
      } else {
        console.warn("Could not parse coordinates:", coords[0]);
        return;
      }
      
      // Create a highlighted marker
        const icon = L.divIcon({
        html: `<div class="step-marker">${getDirectionIcon(instructionType)}</div>`,
          className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      setActiveStepMarker(marker);
      
      // Pan to the marker
      map.panTo([lat, lng]);
    } catch (error) {
      console.error("Error highlighting route segment:", error);
    }
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper to toggle directions collapsed state
  const toggleDirectionsCollapse = () => {
    setIsDirectionsCollapsed(!isDirectionsCollapsed);
  };

  // Helper to toggle directions minimized state
  const toggleDirections = () => {
    setIsDirectionsMinimized(!isDirectionsMinimized);
  };

  // Helper to clean up calculation animation
  const cleanupAnimation = () => {
    if (calculationAnimation && calculationAnimation.cleanup) {
      calculationAnimation.cleanup();
      setCalculationAnimation(null);
    }
  };

  // Define the clearRouteDisplay function
  const clearRouteDisplay = useCallback(() => {
    if (routeControlRef.current && map) {
      map.removeLayer(routeControlRef.current);
          routeControlRef.current = null;
      setRouteControl(null);
        }
        
    if (activeStepMarker && map) {
          map.removeLayer(activeStepMarker);
          setActiveStepMarker(null);
        }
        
    setRouteInfo(null);
    setRouteDirections(null);
    setShowDirections(false);
        setActiveDirectionStep(null);
    setRouteTowers([]);
  }, [map, activeStepMarker]);

  // Store the function in the ref
  useEffect(() => {
    clearRouteDisplayRef.current = clearRouteDisplay;
  }, [clearRouteDisplay]);

  // Fix for directions panel scrolling
  useEffect(() => {
    if (directionsContentRef.current && showDirections && !isDirectionsMinimized && window.L) {
      // Disable scroll propagation to prevent map zoom when scrolling directions
      window.L.DomEvent.disableScrollPropagation(directionsContentRef.current);
      console.log("Applied scroll propagation fix to directions panel");
    }
  }, [directionsContentRef, showDirections, isDirectionsMinimized]);

  // RouteTypeSelection component
  const RouteTypeSelection = () => {
    // Only render if showRouteTypeSelection is true
    if (!showRouteTypeSelection) return null;
    
    // Check if routes are still being calculated
    const routesStillLoading = routesAreLoading || !allRoutesComputed;
    
    const handleRouteTypeSelect = (selectedType) => {
      // Save the selected route type
      setRouteType(selectedType);
      console.log(`Route type selected: ${selectedType}`);
      
      // Store preference in localStorage if "Don't ask again" is checked
      if (skipRouteTypeSelection) {
        localStorage.setItem('preferredRouteType', selectedType);
      }
      
      // Close the modal
        setShowRouteTypeSelection(false);
        
      // Only attempt to display a route if we have routes computed
      if (allRoutesComputed) {
        // Set loading state
        setIsLoadingRoute(true);
        
        // Use a short timeout to ensure we have the latest state
        setTimeout(() => {
          // Try to get the route from various sources
          let selectedRoute = computedRoutes[selectedType];
          console.log(`Looking for ${selectedType} route in computedRoutes:`, selectedRoute ? 'found' : 'not found');
          
          // If not found, try to find it in the allRoutes array
          if (!selectedRoute && computedRoutes.allRoutes && computedRoutes.allRoutes.length > 0) {
            console.log("Available types in allRoutes:", computedRoutes.allRoutes.map(r => r.type));
            selectedRoute = computedRoutes.allRoutes.find(r => r.type === selectedType);
          }
          
          // If found, display the route
          if (selectedRoute) {
            // Make sure we have valid towers
            let towersToUse = computedRouteTowers[selectedType] || allTowers.current || [];
            
            // Display the route with appropriate towers
            displayRoute(selectedRoute, towersToUse, selectedType);
            setIsLoadingRoute(false);
        } else {
            console.error(`Could not find route data for ${selectedType}`);
            
            // Try to calculate if not in calculation mode already
            if (!routesStillLoading && hasValidRoutePoints()) {
              console.log("Triggering calculation for selected route type.");
              calculateAllRouteTypes(currentRoutePoints);
            } else {
              setIsLoadingRoute(false);
            }
          }
        }, 200);
      }
    };
    
    const handleDontAskAgainChange = (e) => {
      const checked = e.target.checked;
      setSkipRouteTypeSelection(checked);
      localStorage.setItem('skipRouteTypeSelection', checked.toString());
    };
    
    return (
      <div className="route-type-selection-overlay">
        <div className="route-type-selection-content">
          <h3>Choose Route Priority</h3>
          <p>Select your preferred route optimization strategy</p>
          
          <div className="route-options-info">
            <h5>About Route Options</h5>
            <ul>
              <li><strong>Fastest:</strong> Quickest route to your destination</li>
              <li><strong>Best Signal:</strong> Route with optimal cell tower coverage</li>
              <li><strong>Balanced:</strong> Balance of speed and cell coverage</li>
            </ul>
          </div>
          
          {routesStillLoading && (
            <div className="route-loading-indicator">
              <p>Calculating routes...
                {computedRoutes.fastest && " Fastest route available"}
                {computedRoutes.cell_coverage && " Cell coverage route available"}
                {computedRoutes.balanced && " Balanced route available"}
              </p>
            </div>
          )}
          
          <div className="route-selection-options">
            <button 
              className={`route-selection-option ${routeType === 'fastest' ? 'active' : ''} ${computedRoutes.fastest ? 'available' : ''}`}
              onClick={() => handleRouteTypeSelect('fastest')}
            >
              <div className="route-selection-icon">⚡</div>
              <div className="route-selection-label">Fastest</div>
              <div className="route-selection-desc">
                {computedRoutes.fastest && 
                 `${formatDistance(computedRoutes.fastest.distance/1000)}, 
                  ${formatDuration(computedRoutes.fastest.duration)}`}
                {!computedRoutes.fastest && routesStillLoading && <span className="calculating">Calculating...</span>}
              </div>
            </button>
            
            <button 
              className={`route-selection-option ${routeType === 'cell_coverage' ? 'active' : ''} ${computedRoutes.cell_coverage ? 'available' : ''}`}
              onClick={() => handleRouteTypeSelect('cell_coverage')}
            >
              <div className="route-selection-icon">📱</div>
              <div className="route-selection-label">Best Signal</div>
              <div className="route-selection-desc">
                {computedRoutes.cell_coverage && 
                 `${formatDistance(computedRoutes.cell_coverage.distance/1000)}, 
                  ${formatDuration(computedRoutes.cell_coverage.duration)}`}
                {!computedRoutes.cell_coverage && routesStillLoading && <span className="calculating">Calculating...</span>}
              </div>
            </button>
            
            <button 
              className={`route-selection-option ${routeType === 'balanced' ? 'active' : ''} ${computedRoutes.balanced ? 'available' : ''}`}
              onClick={() => handleRouteTypeSelect('balanced')}
            >
              <div className="route-selection-icon">⚖️</div>
              <div className="route-selection-label">Balanced</div>
              <div className="route-selection-desc">
                {computedRoutes.balanced && 
                 `${formatDistance(computedRoutes.balanced.distance/1000)}, 
                  ${formatDuration(computedRoutes.balanced.duration)}`}
                {!computedRoutes.balanced && routesStillLoading && <span className="calculating">Calculating...</span>}
              </div>
            </button>
          </div>
          
          <div className="route-selection-dont-ask">
            <label className="dont-ask-label">
              <input
                type="checkbox"
                checked={skipRouteTypeSelection}
                onChange={handleDontAskAgainChange}
              />
              <span className="dont-ask-text">Don't ask again, always use selected type</span>
            </label>
          </div>
          
          <div className="route-selection-actions">
            <button 
              className="route-selection-cancel" 
              onClick={() => setShowRouteTypeSelection(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (showDirections && isDirectionsMinimized) {
      setIsDirectionsMinimized(false);
    }
  }, [showDirections, isDirectionsMinimized]);

  // Effect to disable scroll propagation on directions panel
  useEffect(() => {
    if (directionsContentRef.current && showDirections && !isDirectionsMinimized) {
      // Disable scroll propagation on the directions panel
      L.DomEvent.disableScrollPropagation(directionsContentRef.current);
    }
  }, [directionsContentRef, showDirections, isDirectionsMinimized]);

  return (
    <div className="app-container">
      <div id="map" ref={mapRef}>
        {/* Search button in top middle */}
        <div className="search-button-container">
          <button 
            className="search-button" 
            onClick={toggleSearch}
            aria-label={searchExpanded ? "Close search" : "Open search"}
          >
            {searchExpanded ? (
              <img src={CloseIcon} alt="Close" />
            ) : (
              <img src={SearchIcon} alt="Search" />
            )}
          </button>
        </div>
        
        {/* Authentication/User buttons in bottom left */}
        <div className="auth-buttons">
          {user ? (
            <>
              <button 
                className="user-button"
                onClick={toggleSavedRoutes}
              >
                My Routes
              </button>
              <button 
                className="logout-button"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <button 
              className="login-button"
              onClick={toggleAuthForm}
            >
              Login / Register
            </button>
          )}
        </div>
          
        {/* Map Controls */}
          <div className="map-controls">
          {/* Route Type Selector Button - always visible */}
            <button
              className={`map-control-button route-type-button ${!hasValidRoutePoints() ? 'disabled' : ''}`}
            onClick={() => {
                console.log("Route type button clicked");
                
                // Check if we have valid route points first
                if (!hasValidRoutePoints()) {
                  console.warn("Cannot select route type: No valid route points");
                  toast.info("Set origin and destination first", {
                    position: "top-center",
                    autoClose: 3000,
                  });
                  return;
                }
                
                // Always show the selection dialog
                setShowRouteTypeSelection(true);
                
                // If routes aren't computed yet, trigger calculation in background
                if (!allRoutesComputed && !routesAreLoading) {
                    console.log("Triggering background calculation on type button click.");
                    setIsLoadingRoute(true); // Show general loader briefly
                    setRoutesAreLoading(true);
                    calculateAllRouteTypes(currentRoutePoints);
              }
            }}
            title="Route Optimization Options"
          >
            {getRouteTypeIcon(routeType)}
          </button>
          
          {/* Cell Tower Toggle Button */}
          <button 
            className={`map-control-button ${showCellTowers ? 'active' : ''}`}
              onClick={toggleCellTowers}
              title={showCellTowers ? 'Hide Cell Towers' : 'Show Cell Towers'}
            >
              📡
            </button>
          </div>
        
        {/* Routing directions panel (minimized version) */}
        {routeDirections && isDirectionsMinimized && (
          <div className="routing-directions-container minimized" onClick={toggleDirections}>
            <div className="routing-directions-header">
              <div className="directions-toggle-icon">🗺️</div>
            </div>
          </div>
        )}
        
        {/* Routing directions panel (full version) */}
        {routeDirections && showDirections && !isDirectionsMinimized && (
          <div 
            className={`routing-directions-container ${isDirectionsCollapsed ? 'collapsed' : ''}`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="routing-directions-header">
              <div className="routing-directions-title">
                <div className="direction-endpoints">
                  <span className="direction-origin">{originValue}</span>
                  <span className="direction-separator">→</span>
                  <span className="direction-destination">{destinationValue}</span>
                </div>
              </div>
              <button 
                className="routing-directions-close" 
                onClick={() => setIsDirectionsMinimized(true)}
              >×</button>
            </div>
            
            {!isDirectionsCollapsed && (
              <div 
                className="routing-directions-content"
                ref={directionsContentRef}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onWheel={(e) => {
                  e.stopPropagation();
                  // Don't prevent default here - let natural scrolling happen
                }}
              >
                <div className="routing-summary">
                  <div><strong>Distance:</strong> {routeDirections.distanceFormatted}</div>
                  <div><strong>Duration:</strong> {routeDirections.durationFormatted}</div>
                  {routeDirections.isCustomRoute && <div className="custom-route-badge">Custom Route</div>}
                </div>
                <ul className="instruction-list">
                  {routeDirections.steps ? (
                    // New format with steps
                    routeDirections.steps.map((step, index) => (
                      <li 
                        key={index} 
                        className={`instruction-item ${activeDirectionStep === index ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          highlightRouteSegment(step, index);
                        }}
                      >
                        <div className="instruction-icon">{getDirectionIcon(step.type)}</div>
                        <div className="instruction-text">
                          <div className="instruction-direction">{step.instruction}</div>
                          <div className="instruction-distance">{step.distanceFormatted}</div>
                        </div>
                      </li>
                    ))
                  ) : routeDirections.instructions ? (
                    // Legacy format with instructions
                    routeDirections.instructions.map((instruction, index) => (
                    <li 
                      key={index} 
                      className={`instruction-item ${activeDirectionStep === index ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        highlightRouteSegment(instruction, index);
                      }}
                    >
                      <div className="instruction-icon">{getDirectionIcon(instruction.type)}</div>
                      <div className="instruction-text">
                        <div className="instruction-direction">{instruction.text}</div>
                        <div className="instruction-distance">{instruction.distanceFormatted}</div>
                      </div>
                    </li>
                    ))
                  ) : (
                    <li className="instruction-item">
                      <div className="instruction-text">No detailed directions available</div>
                    </li>
                  )}
                </ul>
              </div>
            )}
            
            <div 
              className="routing-directions-collapse" 
              onClick={(e) => {
                e.stopPropagation();
                toggleDirectionsCollapse();
              }}
            >
              <div className="collapse-arrow">
                {isDirectionsCollapsed ? '▼' : '▲'}
              </div>
            </div>
          </div>
        )}
        
        {/* Authentication Form */}
        {showAuthForm && !user && (
          <div className="auth-form-container">
            <div className="auth-form">
              <div className="auth-header">
                <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
                <button 
                  className="close-button"
                  onClick={toggleAuthForm}
                >×</button>
              </div>
              
              {authError && (
                <div className="auth-error">
                  {authError}
                </div>
              )}
              
              <form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
                {authMode === 'register' && (
                  <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input 
                      type="text" 
                      id="username" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input 
                    type="email" 
                    id="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input 
                    type="password" 
                    id="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="submit-button">
                    {authMode === 'login' ? 'Login' : 'Register'}
                  </button>
                </div>
                
                <div className="auth-switch">
                  {authMode === 'login' ? (
                    <p>Don't have an account? <button type="button" onClick={() => setAuthMode('register')}>Register</button></p>
                  ) : (
                    <p>Already have an account? <button type="button" onClick={() => setAuthMode('login')}>Login</button></p>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Saved Routes Panel */}
        {showSavedRoutes && user && (
          <div className="saved-routes-container">
            <div className="saved-routes">
              <div className="saved-routes-header">
                <h2>My Saved Routes</h2>
                <button 
                  className="close-button"
                  onClick={toggleSavedRoutes}
                >×</button>
              </div>
              
              {savedRoutes.length === 0 ? (
                <div className="no-routes">
                  <p>You don't have any saved routes yet.</p>
                </div>
              ) : (
                <div className="routes-list">
                  {savedRoutes.map((route, index) => (
                    <div key={index} className="route-item" onClick={() => loadSavedRoute(route)}>
                      <div className="route-details">
                        <div className="route-points">
                          <div className="route-origin">{route.origin.place_name || route.origin}</div>
                          <div className="route-destination">{route.destination.place_name || route.destination}</div>
                        </div>
                        <div className="route-meta">
                          <div className="route-type">{route.route_type || 'balanced'}</div>
                          <div className="route-date">{formatDate(route.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {searchExpanded && (
          <div className="search-container">
            <div className="search-content">
              <div className="search-header">
                <span>Where to?</span>
              </div>
              
              <div className="search-form">
                <div className="input-group">
                  <div className="input-container">
                    <input
                      ref={originInputRef}
                      type="text"
                      placeholder="Origin"
                      value={originValue}
                      onChange={(e) => handleInputChange(e, true)}
                      onFocus={() => handleInputFocus(true)}
                      onBlur={() => handleInputBlur(true)}
                    />
                    {/* Origin suggestions dropdown - moved inside input container */}
              {showOriginSuggestions && originSuggestions.length > 0 && (
                <div className="suggestions-dropdown origin-suggestions">
                  {originSuggestions.map((suggestion, index) => (
                    <div 
                      key={index} 
                      className="suggestion-item"
                      onClick={() => handleSuggestionSelect(suggestion, true)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {suggestion.place_name}
                    </div>
                  ))}
                </div>
              )}
                  </div>
                </div>
              </div>
              
              <div className="search-form">
                <div className="input-group">
                  <div className="input-container">
                    <input
                      type="text"
                      placeholder="Destination"
                      value={destinationValue}
                      onChange={(e) => handleInputChange(e, false)}
                      onFocus={() => handleInputFocus(false)}
                      onBlur={() => handleInputBlur(false)}
                    />
                    {/* Destination suggestions dropdown - moved inside input container */}
              {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                <div className="suggestions-dropdown destination-suggestions">
                  {destinationSuggestions.map((suggestion, index) => (
                    <div 
                      key={index} 
                      className="suggestion-item"
                      onClick={() => handleSuggestionSelect(suggestion, false)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {suggestion.place_name}
                    </div>
                  ))}
                </div>
              )}
                  </div>
                </div>
              </div>
              
              {/* Enhanced Cell Tower Toggle Button */}
              <div className="cell-tower-toggle">
                <button 
                  className={`toggle-button ${showCellTowers ? 'active' : ''}`}
                  onClick={toggleCellTowers}
                >
                  <span className="toggle-icon">📡</span>
                  <span className="toggle-label">{showCellTowers ? 'Hide Cell Towers' : 'Show Cell Towers'}</span>
                </button>
                <div className="tower-count">
                  {cellTowers.length > 0 ? `${cellTowers.length} cell towers available` : 'No cell towers found'}
                </div>
              </div>
              
              {routeInfo && (
                <div className="route-info">
                  {routeInfo.routeType === 'fastest' && (
                  <div className="route-detail">
                      <span className="route-icon">🚀</span>
                      <span>Fastest Route</span>
                  </div>
                  )}
                  {(routeInfo.routeType === 'cell_coverage' || routeInfo.routeType === 'balanced') && (
                    <div className="route-detail">
                      <span className="route-icon">📱</span>
                      <span className="signal-strength">
                        {Array(5).fill().map((_, i) => (
                          <span 
                            key={i} 
                            className={`signal-bar ${i < Math.min(5, Math.max(1, Math.round(routeInfo.calculatedSignalQuality || 3))) ? 'active' : ''}`}
                          />
                        ))}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {isLoadingRoute && (
                <div className="loading-indicator">
                  Calculating route...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Route Type Selection Modal */}
      <RouteTypeSelection />
      
      {/* Route Optimization Notice */}
      {optimizationNotice && (
        <div className="optimization-notice">
          {optimizationNotice.message}
        </div>
      )}
    </div>
  );
}

export default App;