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
  const [routeType, setRouteType] = useState('balanced');

  // Saved routes
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  
  // API key
  const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY;

  // State for cell towers
  const [cellTowers, setCellTowers] = useState([]);
  const [showCellTowers, setShowCellTowers] = useState(false);
  const cellTowerLayerRef = useRef(null);
  const [routeTowers, setRouteTowers] = useState([]);

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
      
      console.log(`Generating mock cell towers in area: ${min_lat},${min_lng},${max_lat},${max_lng}`);
      
      // Skip OpenCellID API and directly use mock data
      const towers = generateMockCellTowers(min_lat, min_lng, max_lat, max_lng);
      
      console.log(`Generated ${towers.length} mock cell towers in the area`);
      
      if (towers.length > 0) {
        setCellTowers(towers);
        // Auto-show towers when we generate them
        setShowCellTowers(true);
        return towers;
      } else {
        toast.error("Failed to generate mock cell towers", {
          position: "top-center",
          autoClose: 3000,
        });
      }
      
      return [];
    } catch (error) {
      console.error("Error generating mock cell tower data:", error);
      toast.error("Error generating mock cell tower data", {
        position: "top-center",
        autoClose: 3000,
      });
      return [];
    }
  }, [map]);

  // Modify the mock generation to create more towers for better coverage
  const generateMockCellTowers = (min_lat, min_lng, max_lat, max_lng) => {
    const towers = [];
    const latRange = max_lat - min_lat;
    const lngRange = max_lng - min_lng;
    
    // Generate between 20-40 random towers for better coverage
    const numTowers = Math.floor(Math.random() * 20) + 20;
    
    for (let i = 0; i < numTowers; i++) {
      // Random position within bounds
      const lat = min_lat + Math.random() * latRange;
      const lng = min_lng + Math.random() * lngRange;
      
      // Random signal strength (between -110 and -60 dBm)
      const signalStrength = Math.floor(Math.random() * 50) - 110;
      
      // Cell types
      const radioTypes = ['GSM', 'UMTS', 'LTE', '5G'];
      const radio = radioTypes[Math.floor(Math.random() * radioTypes.length)];
      
      towers.push({
        lat: lat,
        lon: lng,
        radio: radio,
        mcc: 310, // US mobile country code
        net: Math.floor(Math.random() * 1000),
        area: Math.floor(Math.random() * 10000),
        cell: Math.floor(Math.random() * 100000),
        unit: 0,
        range: Math.floor(Math.random() * 5000) + 1000, // 1-6km range
        samples: Math.floor(Math.random() * 100) + 1,
        averageSignal: signalStrength,
        updated: Date.now() / 1000
      });
    }
    
    return towers;
  };

  // Function to toggle cell tower visibility
  const toggleCellTowers = useCallback(() => {
    // If no cell towers are loaded yet, try to fetch them first
    if (cellTowers.length === 0 && map) {
      const bounds = map.getBounds();
      fetchCellTowers({
        min_lat: bounds.getSouth(),
        min_lng: bounds.getWest(),
        max_lat: bounds.getNorth(),
        max_lng: bounds.getEast()
      });
    }
    setShowCellTowers(prev => !prev);
  }, [map, cellTowers.length, fetchCellTowers]);

  // Helper function to calculate distance from a point to a linestring
  const distanceToLineString = (point, lineString) => {
    // Convert point to [lat, lng] format
    const pointLatLng = [point.lat, point.lon];
    
    let minDistance = Infinity;
    
    // Iterate through each segment of the lineString
    for (let i = 0; i < lineString.length - 1; i++) {
      const start = lineString[i];
      const end = lineString[i + 1];
      
      // Calculate distance from point to this segment
      const distance = distanceToSegment(pointLatLng, start, end);
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
  };

  // Helper to calculate distance from point to segment
  const distanceToSegment = (point, start, end) => {
    // Convert to radians for haversine calculations
    const toRad = (degree) => degree * Math.PI / 180;
    
    const lat1 = toRad(point[0]);
    const lon1 = toRad(point[1]);
    const lat2 = toRad(start[0]);
    const lon2 = toRad(start[1]);
    const lat3 = toRad(end[0]);
    const lon3 = toRad(end[1]);
    
    // Earth radius in meters
    const R = 6371000;
    
    // Haversine formula to calculate distance between two points
    const haversine = (lat1, lon1, lat2, lon2) => {
      const dLat = lat2 - lat1;
      const dLon = lon2 - lon1;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };
    
    // Distance between the points
    const d12 = haversine(lat1, lon1, lat2, lon2);
    const d13 = haversine(lat1, lon1, lat3, lon3);
    const d23 = haversine(lat2, lon2, lat3, lon3);
    
    // Check if the projection falls outside the segment
    if (d12*d12 > d23*d23 + d13*d13) return d13;
    if (d13*d13 > d23*d23 + d12*d12) return d12;
    
    // Calculate the perpendicular distance using the Heron's formula
    const s = (d12 + d13 + d23) / 2;
    const area = Math.sqrt(s * (s - d12) * (s - d13) * (s - d23));
    return 2 * area / d23;
  };

  // Find cell towers along the route
  const findTowersAlongRoute = (towers, routeCoordinates, maxDistance = 500) => {
    if (!towers || !routeCoordinates || routeCoordinates.length === 0) {
      return [];
    }
    
    // Find towers within maxDistance meters of any point on the route
    const alongRoute = towers.map(tower => {
      const distance = distanceToLineString(tower, routeCoordinates);
      return {
        ...tower,
        distanceToRoute: distance,
        isAlongRoute: distance <= maxDistance
      };
    });
    
    // Filter for towers along the route
    const routeTowers = alongRoute.filter(tower => tower.isAlongRoute);
    console.log(`Found ${routeTowers.length} towers along the route within ${maxDistance}m`);
    
    return routeTowers;
  };

  // Calculate signal quality score for a route based on cell towers
  const calculateSignalScore = (routeCoordinates, towers) => {
    if (!routeCoordinates || routeCoordinates.length === 0 || !towers || towers.length === 0) {
      return 0; // Default score
    }
    
    // Find towers along the route
    const routeTowers = findTowersAlongRoute(towers, routeCoordinates, 1000);
    
    if (routeTowers.length === 0) {
      return 0; // No towers along route
    }
    
    // Calculate weighted signal quality
    // -60 dBm is excellent (~5), -100 dBm is poor (~1)
    let totalSignal = 0;
    
    routeTowers.forEach(tower => {
      const signal = tower.averageSignal;
      // Convert dBm to a 0-1 score (higher is better)
      const signalScore = Math.min(1, Math.max(0, (signal + 120) / 60));
      // Weight by inverse distance to route
      const weight = Math.max(0.1, 1 - (tower.distanceToRoute / 1000));
      totalSignal += signalScore * weight;
    });
    
    // Normalize by number of towers for a 0-5 scale
    return (totalSignal / routeTowers.length) * 5;
  };

  // Display cell towers when showCellTowers changes
  useEffect(() => {
    if (!map) return;
    
    // Remove existing cell tower layer if it exists
    if (cellTowerLayerRef.current) {
      map.removeLayer(cellTowerLayerRef.current);
      cellTowerLayerRef.current = null;
    }
    
    if (showCellTowers && cellTowers.length > 0) {
      console.log(`Displaying ${cellTowers.length} cell towers on map`);
      
      // Create a new feature group for cell towers
      const towerLayer = L.featureGroup().addTo(map);
      
      // Add cell towers to the map
      cellTowers.forEach(tower => {
        // Determine tower strength class based on signal
        let strengthClass = 'medium';
        const signal = tower.averageSignal;
        
        if (signal > -70) {
          strengthClass = 'strong';
        } else if (signal < -90) {
          strengthClass = 'weak';
        }
        
        // Check if tower is along the route
        const isAlongRoute = routeTowers.some(
          routeTower => routeTower.lat === tower.lat && routeTower.lon === tower.lon
        );
        
        // Create custom marker for cell tower
        const icon = L.divIcon({
          html: `<div class="cell-tower-marker ${strengthClass} ${isAlongRoute ? 'along-route' : ''}"></div>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        
        // Create marker and add to layer
        const marker = L.marker([tower.lat, tower.lon], { 
          icon: icon,
          title: `Cell Tower (${tower.radio})${isAlongRoute ? ' - Along Route' : ''}`
        }).addTo(towerLayer);
        
        // Add popup with tower info
        const signalStrength = Math.min(5, Math.max(1, Math.round((tower.averageSignal + 120) / 14)));
        const signalBars = Array(5).fill().map((_, i) => 
          `<span class="signal-bar ${i < signalStrength ? 'active' : ''}"></span>`
        ).join('');
        
        marker.bindPopup(`
          <div class="cell-tower-popup">
            <strong>Cell Tower (${tower.radio})${isAlongRoute ? ' - Along Route' : ''}</strong><br>
            MCC: ${tower.mcc}, MNC: ${tower.net}<br>
            LAC: ${tower.area}, CID: ${tower.cell}<br>
            <div class="signal">
              Signal: ${tower.averageSignal} dBm
              <div class="signal-bars">${signalBars}</div>
            </div>
            Range: ${tower.range}m<br>
            Samples: ${tower.samples}
            ${isAlongRoute ? `<br><span class="tower-route-distance">Distance to route: ${Math.round(tower.distanceToRoute || 0)}m</span>` : ''}
          </div>
        `);
      });
      
      // Store the layer reference
      cellTowerLayerRef.current = towerLayer;
    }
  }, [map, showCellTowers, cellTowers, routeTowers]);

  // Format distance to show as meters if under 1km
  const formatDistance = (distanceInKm) => {
    const distance = parseFloat(distanceInKm);
    if (distance < 1) {
      // Convert to meters and round
      return `${Math.round(distance * 1000)} m`;
    } else {
      // Keep one decimal place for km
      return `${distance.toFixed(1)} km`;
    }
  };

  // Format duration to show as hours and minutes if ≥ 60 minutes
  const formatDuration = (durationInMinutes) => {
    const duration = parseInt(durationInMinutes);
    if (duration >= 60) {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
    } else {
      return `${duration} min`;
    }
  };

  // Extract directions from route and include coordinates
  const extractDirections = (route) => {
    if (!route || !route.legs || route.legs.length === 0) {
      return null;
    }
    
    const distanceInKm = (route.distance / 1000).toFixed(1);
    const durationInMinutes = Math.round(route.duration / 60);
    
    const directions = {
      distance: distanceInKm,
      distanceFormatted: formatDistance(distanceInKm),
      duration: durationInMinutes,
      durationFormatted: formatDuration(durationInMinutes),
      instructions: []
    };
    
    // Extract turn-by-turn directions with coordinates more efficiently
    let stepIndex = 0;
    route.legs.forEach(leg => {
      if (leg.steps) {
        leg.steps.forEach(step => {
          // Get coordinates for this step (first coordinate of the step)
          const coordinates = step.geometry?.coordinates?.[0] || null;
          
          // Get step text direction - simplified approach
          let directionText = step.instruction || '';
          if (!directionText.trim()) {
            directionText = step.name ? `Continue on ${step.name}` : 'Continue straight';
          }
          
          // Remove HTML tags and clean up the text in one pass
          directionText = directionText
            .replace(/<[^>]*>|&nbsp;/g, ' ')
            .replace(/\s\s+/g, ' ')
            .trim();
          
          // Calculate step distance
          const stepDistanceInKm = (step.distance / 1000).toFixed(1);
          
          directions.instructions.push({
            text: directionText,
            distance: stepDistanceInKm,
            distanceFormatted: formatDistance(stepDistanceInKm),
            type: step.maneuver?.type || "continue",
            coordinates: coordinates ? [coordinates[1], coordinates[0]] : null,
            index: stepIndex++
          });
        });
      }
    });
    
    return directions;
  };

  // Update createRoute to also set route directions and reset step marker
  const createRoute = useCallback((start, end) => {
    if (!map) return;
    
    // Close the search bar when route calculation starts
    setSearchExpanded(false);
    
    // Show loading state
    setIsLoadingRoute(true);
    
    // Remove existing route if there is one
    if (routeControl) {
      routeControl.remove();
      setRouteControl(null);
      routeControlRef.current = null;
    }
    
    // Remove any active step marker
    if (activeStepMarker) {
      map.removeLayer(activeStepMarker);
    }
    
    // Reset active step
    setActiveDirectionStep(null);

    // Create cache key from coordinates and route type
    const cacheKey = `${start.lat},${start.lng}-${end.lat},${end.lng}-${routeType}`;
    
    // Check if we have this route cached
    if (routeCache[cacheKey]) {
      console.log("Using cached route");
      const cachedData = routeCache[cacheKey];
      
      // Display the cached route immediately
      displayRoute(cachedData);
      setIsLoadingRoute(false);
      return;
    }

    // Make direct API call to backend for routing
    api.get('/route', {
      params: {
        start_lat: start.lat,
        start_lng: start.lng,
        end_lat: end.lat,
        end_lng: end.lng,
        route_type: routeType
      }
    })
    .then(response => {
      setIsLoadingRoute(false);
      
      const data = response.data;
      
      // Check if the response contains routes
      if (data && data.routes && data.routes.length > 0) {
        // Cache the route data for future use
        setRouteCache(prevCache => ({
          ...prevCache,
          [cacheKey]: data
        }));
        
        // Display the route (using two-phase approach)
        displayRoute(data);
      } else if (data && data.code === 'Error') {
        // Handle error from backend
        console.error("Route calculation error:", data.message);
        // Show user-friendly error message
        toast.error(`Route calculation failed: ${data.message}`, {
          position: "top-center",
          autoClose: 5000,
        });
      } else {
        console.error("No routes returned from the server");
        toast.error("No routes found. Please try different locations.", {
          position: "top-center",
          autoClose: 5000,
        });
      }
    })
    .catch(error => {
      setIsLoadingRoute(false);
      console.error("Route calculation failed:", error);
      
      // Show user-friendly error message
      let errorMessage = "Unable to calculate route. Please try again.";
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const data = error.response.data;
        errorMessage = data.error || errorMessage;
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = "No response from server. Please check your connection.";
      }
      
      toast.error(errorMessage, {
        position: "top-center",
        autoClose: 5000,
      });
    });
  }, [map, routeControl, routeType, activeStepMarker, routeCache]);

  // Add a new function to display routes in two phases
  const displayRoute = useCallback((data) => {
    const route = data.routes[0]; // Use first route
    
    // PHASE 1: Immediately display the route line (fast)
    // -------------------------------
    // Draw the route on the map immediately
    const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
    
    // Create a polyline with style based on route type
    const routeStyle = getRouteLineStyle(routeType);
    const routeLine = L.polyline(coordinates, routeStyle);
    
    // Create a new featureGroup to hold the route
    const newRouteControl = L.featureGroup([routeLine]).addTo(map);
    
    // Store the route control
    setRouteControl(newRouteControl);
    routeControlRef.current = newRouteControl;
    
    // Set minimal route info immediately
    const distance = (route.distance / 1000).toFixed(1); // Convert to km
    const timeMinutes = Math.round(route.duration / 60); // Convert to minutes
    
    // Set basic route info
    setRouteInfo({
      distance: distance,
      distanceFormatted: formatDistance(distance),
      time: timeMinutes,
      durationFormatted: formatDuration(timeMinutes),
      routeType: routeType,
      // Default signal quality until we calculate it
      signalQuality: 3
    });
    
    // PHASE 2: Load detailed information asynchronously (non-blocking)
    // -------------------------------
    setTimeout(() => {
      // Extract and set directions
      const directions = extractDirections(route);
      setRouteDirections(directions);
      setShowDirections(true);
      setIsDirectionsMinimized(false);
      setIsDirectionsCollapsed(false);
      
      // Save the route if user is logged in (do this in the background)
      if (user) {
        saveRoute({
          origin: {
            lat: route.geometry.coordinates[0][1],
            lng: route.geometry.coordinates[0][0],
            place_name: originValue
          },
          destination: {
            lat: route.geometry.coordinates[route.geometry.coordinates.length-1][1],
            lng: route.geometry.coordinates[route.geometry.coordinates.length-1][0],
            place_name: destinationValue
          },
          summary: {
            distance: distance,
            time: timeMinutes,
            signalQuality: 3
          }
        });
      }
      
      // Calculate bounding box for cell tower fetch
      if (coordinates.length > 0) {
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        
        coordinates.forEach(coord => {
          const [lat, lng] = coord;
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        });
        
        // Use a generous padding for cell tower search (0.2 degrees ~ 20km)
        const padding = 0.2;
        minLat -= padding;
        maxLat += padding;
        minLng -= padding;
        maxLng += padding;
        
        // Fetch cell towers for this area without blocking route display
        fetchCellTowers({
          min_lat: minLat,
          min_lng: minLng,
          max_lat: maxLat,
          max_lng: maxLng
        }).then(towers => {
          if (towers && towers.length > 0) {
            // Find towers along the route
            const towersAlongRoute = findTowersAlongRoute(towers, coordinates);
            setRouteTowers(towersAlongRoute);
            
            // Calculate signal quality
            if (routeType === 'cell_coverage' || routeType === 'balanced') {
              // Update route info with calculated signal quality
              const signalScore = calculateSignalScore(coordinates, towers);
              console.log(`Route signal quality score: ${signalScore.toFixed(2)}/5`);
              
              // Update route info with this calculated score
              setRouteInfo(prevInfo => ({
                ...prevInfo,
                calculatedSignalQuality: signalScore,
                routeTowers: towersAlongRoute.length
              }));
            }
          }
        });
      }
    }, 10); // Small delay to let the UI render the route first
  }, [map, routeType, originValue, destinationValue, user, formatDistance, formatDuration, fetchCellTowers]);

  // Helper function to get route line style based on route type
  const getRouteLineStyle = (type) => {
    switch(type) {
      case 'fastest':
        return {
          color: 'rgba(255, 152, 0, 0.8)',
          weight: 6,
          opacity: 0.8
        };
      case 'cell_coverage':
        return {
          color: 'rgba(76, 175, 80, 0.8)',
          weight: 6,
          opacity: 0.8,
          dashArray: '5, 10' // Dashed line for cell coverage
        };
      default: // balanced
        return {
          color: 'rgba(18, 129, 232, 0.8)',
          weight: 6,
          opacity: 0.8
        };
    }
  };

  // Then define updateMapView which depends on createRoute and updateMarker
  const updateMapView = useCallback((start = null, end = null) => {
    if (!map) return;
    
    // Use provided coordinates or get from markers
    const startLatLng = start || (originMarker ? originMarker.getLatLng() : null);
    const endLatLng = end || (destinationMarker ? destinationMarker.getLatLng() : null);
    
    if (startLatLng && endLatLng) {
      // Create a bounds object and extend it with both points
      const bounds = L.latLngBounds([startLatLng, endLatLng]);
      
      // Fit the map to these bounds with some padding
      map.fitBounds(bounds, { padding: [50, 50] });
      
      // Create a route between the points
      createRoute(startLatLng, endLatLng);
    } else if (startLatLng) {
      map.setView(startLatLng, 13);
    } else if (endLatLng) {
      map.setView(endLatLng, 13);
    }
  }, [map, originMarker, destinationMarker, createRoute]);

  // Get autocomplete suggestions
  const getSuggestions = useCallback(async (query, isOrigin) => {
    if (!query) {
      isOrigin ? setOriginSuggestions([]) : setDestinationSuggestions([]);
      return;
    }
    
    try {
      // Get current map center for proximity bias if map is available
      const mapCenter = map ? map.getCenter() : null;
      
      const response = await api.get(`/geocode`, {
        params: {
          query: query,
          autocomplete: true,
          proximity_lng: mapCenter ? mapCenter.lng : null,
          proximity_lat: mapCenter ? mapCenter.lat : null
        }
      });
      
      const data = response.data;
      
      if (data.features && data.features.length > 0) {
        if (isOrigin) {
          setOriginSuggestions(data.features);
          // Ensure suggestions are shown
          setShowOriginSuggestions(true);
        } else {
          setDestinationSuggestions(data.features);
          // Ensure suggestions are shown
          setShowDestinationSuggestions(true);
        }
      } else {
        isOrigin ? setOriginSuggestions([]) : setDestinationSuggestions([]);
      }
    } catch (error) {
      console.error("Error getting suggestions:", error);
      isOrigin ? setOriginSuggestions([]) : setDestinationSuggestions([]);
    }
  }, [map]);

  // Reference for suggestion click tracking
  const suggestionClickedRef = useRef(false);
    
  // Handle focus events for suggestion boxes
  const handleInputFocus = useCallback((isOrigin) => {
    if (isOrigin) {
      if (originValue && originValue.length > 1 && originSuggestions.length === 0) {
        // Refetch suggestions if we have a query but no suggestions
        getSuggestions(originValue, true);
      }
      setShowOriginSuggestions(true);
    } else {
      if (destinationValue && destinationValue.length > 1 && destinationSuggestions.length === 0) {
        // Refetch suggestions if we have a query but no suggestions
        getSuggestions(destinationValue, false);
      }
      setShowDestinationSuggestions(true);
    }
  }, [originValue, destinationValue, originSuggestions, destinationSuggestions, getSuggestions]);

  // Handle blur events for suggestion boxes
  const handleInputBlur = useCallback((isOrigin) => {
    // Using setTimeout allows us to check if a suggestion was clicked
    // before hiding the suggestions panel
    setTimeout(() => {
      if (!suggestionClickedRef.current) {
        if (isOrigin) {
          setShowOriginSuggestions(false);
        } else {
          setShowDestinationSuggestions(false);
        }
      }
      // Reset the click tracker
      suggestionClickedRef.current = false;
    }, 150);
  }, []);

  // Handle selection of a suggestion
  const handleSuggestionSelect = useCallback((suggestion, isOrigin) => {
    // Mark that a suggestion was clicked to prevent hiding on blur
    suggestionClickedRef.current = true;
    
    const [lng, lat] = suggestion.center;
    const latlng = L.latLng(lat, lng);
    
    if (isOrigin) {
      setOriginValue(suggestion.place_name);
      // Create/update origin marker
      updateMarker(latlng, true);
      setShowOriginSuggestions(false);
      
      // Update map view with the new coordinates
      updateMapView(latlng, destinationMarker?.getLatLng());
    } else {
      setDestinationValue(suggestion.place_name);
      // Create/update destination marker
      updateMarker(latlng, false);
      setShowDestinationSuggestions(false);
      
      // Update map view with the new coordinates
      updateMapView(originMarker?.getLatLng(), latlng);
    }
  }, [map, updateMarker, updateMapView, originMarker, destinationMarker]);

  // Handle input change with debounce for autocomplete
  const handleInputChange = useCallback((e, isOrigin) => {
    const value = e.target.value;
    
    if (isOrigin) {
      setOriginValue(value);
      if (value.length > 0) {
        setShowOriginSuggestions(true);
      } else {
        setOriginSuggestions([]);
        setShowOriginSuggestions(false);
      }
    } else {
      setDestinationValue(value);
      if (value.length > 0) {
        setShowDestinationSuggestions(true);
      } else {
        setDestinationSuggestions([]);
        setShowDestinationSuggestions(false);
      }
    }
    
    // Clear any existing timer
    if (window.debounceTimer) {
      clearTimeout(window.debounceTimer);
    }
    
    // Debounce the API call to avoid too many requests
    window.debounceTimer = setTimeout(() => {
      if (value.length > 1) { // Only search if there are at least 2 characters
        getSuggestions(value, isOrigin);
      }
    }, 300);
  }, [getSuggestions]);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Save a route to the backend
  const saveRoute = async (routeData) => {
    if (!user) return;

    try {
      await api.post('/save-route', {
        origin: {
          lat: routeData.origin.lat,
          lng: routeData.origin.lng,
          place_name: routeData.origin.place_name
        },
        destination: {
          lat: routeData.destination.lat,
          lng: routeData.destination.lng,
          place_name: routeData.destination.place_name
        },
        route_data: {
          origin: {
            lat: routeData.origin.lat,
            lng: routeData.origin.lng
          },
          destination: {
            lat: routeData.destination.lat,
            lng: routeData.destination.lng
          },
          summary: routeData.summary
        },
        route_type: routeType
      });

      // Refresh the saved routes list
      fetchSavedRoutes();
    } catch (error) {
      console.error("Error saving route:", error);
    }
  };

  // Handle route type change
  const handleRouteTypeChange = useCallback((newRouteType) => {
    setRouteType(newRouteType);
    
    // Recalculate the route with the new type if we have both markers
    if (originMarker && destinationMarker) {
      updateMapView(originMarker.getLatLng(), destinationMarker.getLatLng());
    }
  }, [originMarker, destinationMarker, updateMapView]);

  // Function to toggle directions panel
  const toggleDirections = () => {
    if (isDirectionsMinimized) {
      // Un-minimize and show the full panel
      setIsDirectionsMinimized(false);
      setShowDirections(true);
      setIsDirectionsCollapsed(false);
    } else {
      // Minimize to icon
      setIsDirectionsMinimized(true);
      setShowDirections(false);
    }
  };

  // Function to toggle directions panel collapse state
  const toggleDirectionsCollapse = () => {
    const newCollapsedState = !isDirectionsCollapsed;
    setIsDirectionsCollapsed(newCollapsedState);
    
    // If collapsing, also minimize to icon
    if (newCollapsedState) {
      setIsDirectionsMinimized(true);
      setShowDirections(false);
    }
  };

  // Function to highlight a specific route segment when clicking on directions
  const highlightRouteSegment = (instruction, index) => {
    setActiveDirectionStep(index);
    
    // Remove previous step marker if exists
    if (activeStepMarker) {
      map.removeLayer(activeStepMarker);
    }
    
    // If we have coordinates for the step, pan the map to that location and add a marker
    if (instruction.coordinates && map) {
      map.panTo(L.latLng(instruction.coordinates[0], instruction.coordinates[1]));
      
      // Create a custom marker for the step
      const icon = L.divIcon({
        html: `<div class="step-highlight-marker"></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      
      // Add the marker to the map
      const marker = L.marker(
        L.latLng(instruction.coordinates[0], instruction.coordinates[1]), 
        { icon: icon, zIndexOffset: 1000 }
      ).addTo(map);
      
      // Store the marker reference to remove it later
      setActiveStepMarker(marker);
    }
  };

  // Get icon for direction type
  const getDirectionIcon = (type) => {
    switch(type) {
      case 'turn':
        return '↪️';
      case 'continue':
        return '⬆️';
      case 'arrive':
        return '🏁';
      case 'depart':
        return '🚗';
      default:
        return '➡️';
    }
  };

  // Function to prevent map scroll when over directions panel
  useEffect(() => {
    if (!directionsContentRef.current) return;

    const handleWheel = (e) => {
      e.stopPropagation();
    };

    const directionsContent = directionsContentRef.current;
    directionsContent.addEventListener('wheel', handleWheel, { passive: false });
    directionsContent.addEventListener('DOMMouseScroll', handleWheel, { passive: false }); // For Firefox
    directionsContent.addEventListener('mousewheel', handleWheel, { passive: false }); // For older browsers
    directionsContent.addEventListener('touchmove', handleWheel, { passive: false }); // For mobile

    return () => {
      directionsContent.removeEventListener('wheel', handleWheel);
      directionsContent.removeEventListener('DOMMouseScroll', handleWheel);
      directionsContent.removeEventListener('mousewheel', handleWheel);
      directionsContent.removeEventListener('touchmove', handleWheel);
    };
  }, [directionsContentRef.current]);

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
          
        {/* Cell tower toggle button in bottom right */}
        {map && (
          <div className="map-controls">
            <button
              className={`map-control-button cell-tower-button ${showCellTowers ? 'active' : ''}`}
              onClick={toggleCellTowers}
              title={showCellTowers ? 'Hide Cell Towers' : 'Show Cell Towers'}
            >
              📡
            </button>
          </div>
        )}
        
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
          <div className={`routing-directions-container ${isDirectionsCollapsed ? 'collapsed' : ''}`}>
            <div className="routing-directions-header">
              <div className="routing-directions-title">
                <div className="direction-endpoints">
                  <span className="direction-origin">{originValue}</span>
                  <span className="direction-separator">→</span>
                  <span className="direction-destination">{destinationValue}</span>
                </div>
              </div>
              <button className="routing-directions-close" onClick={() => setIsDirectionsMinimized(true)}>×</button>
            </div>
            
            {!isDirectionsCollapsed && (
              <div 
                ref={directionsContentRef}
                className="routing-directions-content"
                onScroll={(e) => e.stopPropagation()}
              >
                <div className="routing-summary">
                  <div><strong>Distance:</strong> {routeDirections.distanceFormatted}</div>
                  <div><strong>Duration:</strong> {routeDirections.durationFormatted}</div>
                </div>
                <ul className="instruction-list">
                  {routeDirections.instructions.map((instruction, index) => (
                    <li 
                      key={index} 
                      className={`instruction-item ${activeDirectionStep === index ? 'active' : ''}`}
                      onClick={() => highlightRouteSegment(instruction, index)}
                    >
                      <div className="instruction-icon">{getDirectionIcon(instruction.type)}</div>
                      <div className="instruction-text">
                        <div className="instruction-direction">{instruction.text}</div>
                        <div className="instruction-distance">{instruction.distanceFormatted}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="routing-directions-collapse" onClick={toggleDirectionsCollapse}>
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
                  </div>
                </div>
              </div>
              
              {/* Origin suggestions dropdown */}
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
                  </div>
                </div>
              </div>
              
              {/* Destination suggestions dropdown */}
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
              
              {/* Route Type Selection */}
              <div className="route-type-selection">
                <h4>Route Optimization:</h4>
                <div className="route-type-options">
                  <div 
                    className={`route-type-option ${routeType === 'fastest' ? 'selected' : ''}`}
                    onClick={() => handleRouteTypeChange('fastest')}
                  >
                    <span className="route-type-icon">⚡</span>
                    <span className="route-type-label">Fastest</span>
                  </div>
                  <div 
                    className={`route-type-option ${routeType === 'cell_coverage' ? 'selected' : ''}`}
                    onClick={() => handleRouteTypeChange('cell_coverage')}
                  >
                    <span className="route-type-icon">📱</span>
                    <span className="route-type-label">Best Signal</span>
                  </div>
                  <div 
                    className={`route-type-option ${routeType === 'balanced' ? 'selected' : ''}`}
                    onClick={() => handleRouteTypeChange('balanced')}
                  >
                    <span className="route-type-icon">⚖️</span>
                    <span className="route-type-label">Balanced</span>
                  </div>
                </div>
              </div>
              
              {/* Route Type Info Tooltip */}
              <div className="route-type-tooltip">
                <span className="info-icon">ℹ️</span>
                <div className="tooltip-content">
                  <h5>Route Optimization Options:</h5>
                  <ul>
                    <li><strong>Fastest:</strong> Optimizes for the quickest travel time.</li>
                    <li><strong>Best Signal:</strong> Prioritizes routes with strong cell coverage using simulated data.</li>
                    <li><strong>Balanced:</strong> Combines both speed and cell signal strength for a compromise solution.</li>
                  </ul>
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
                  <div className="route-detail">
                    <span className="route-icon">🚗</span>
                    <span>{routeInfo.distanceFormatted}</span>
                  </div>
                  <div className="route-detail">
                    <span className="route-icon">⏱️</span>
                    <span>{routeInfo.durationFormatted}</span>
                  </div>
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
    </div>
  );
}

export default App;