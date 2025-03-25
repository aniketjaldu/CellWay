import { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import SearchIcon from './assets/svg/search-icon.svg';
import CloseIcon from './assets/svg/close-icon.svg';

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
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  
  // Routing state
  const [routeControl, setRouteControl] = useState(null);
  const routeControlRef = useRef(null);
  
  // Input reference
  const originInputRef = useRef(null);
  
  // API key
  const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY;

  // Toggle search expansion
  const toggleSearch = () => {
    setSearchExpanded(!searchExpanded);
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    
    // Create map instance
    const mapInstance = L.map(mapRef.current).setView([51.505, -0.09], 13);
    
    // Add MapTiler tile layer
    L.tileLayer('https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=' + mapTilerKey, {
      attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
      tileSize: 512,
      zoomOffset: -1,
      minZoom: 3
    }).addTo(mapInstance);

    // Add locate button
    const locateButton = L.control({position: 'topleft'});
    locateButton.onAdd = function() {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      div.innerHTML = '<a class="locate-button" href="#" title="Show my location">📍</a>';
      
      L.DomEvent.on(div, 'click', function(e) {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        
        // Remove existing route when locate is clicked
        if (routeControlRef.current) {
          routeControlRef.current.remove();
          routeControlRef.current = null;
          setRouteControl(null);
          setRouteInfo(null);
        }
        
        mapInstance.locate({setView: true, maxZoom: 16});
      });
      
      return div;
    };
    locateButton.addTo(mapInstance);

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

  // Set up event listeners for the map
  useEffect(() => {
    if (!map) return;
    
    // Handle location found event
    const handleLocationFound = (e) => {
      const latlng = e.latlng;
      
      // Get address for the location
      reverseGeocode(latlng)
        .then(address => {
          // Update origin value
          setOriginValue(address);
          
          // Create or update origin marker
          updateMarker(latlng, true);
          
          // Automatically search with this location
          if (destinationMarker) {
            // If we have both markers, fit bounds to show both
            const bounds = L.latLngBounds([
              latlng,
              destinationMarker.getLatLng()
            ]);
            map.fitBounds(bounds, { padding: [50, 50] });
            
            if (routeControl) {
              routeControl.remove();
            }

            // Create route
            createRoute(latlng, destinationMarker.getLatLng());
          } else {
            // Just center on the origin
            map.setView(latlng, 15);
          }
        })
        .catch(error => console.error("Reverse geocoding failed:", error));
    };
    
    // Add event listener for location found
    map.on('locationfound', handleLocationFound);
    
    // Cleanup event listeners
    return () => {
      map.off('locationfound', handleLocationFound);
      
      if (routeControl) {
        routeControl.remove();
      }
    };
  }, [map, originMarker, destinationMarker, routeControl]);

  // Create or update a marker
  const updateMarker = useCallback((latlng, isOrigin) => {
    if (!map) return;
    
    if (isOrigin) {
      if (originMarker) {
        originMarker.setLatLng(latlng);
      } else {
        const icon = L.divIcon({
          html: `<div class="origin-marker"></div>`,
          className: '',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        
        const marker = L.marker(latlng, { 
          icon: icon,
          title: "Origin" 
        }).addTo(map);
        
        setOriginMarker(marker);
      }
    } else {
      if (destinationMarker) {
        destinationMarker.setLatLng(latlng);
      } else {
        const icon = L.divIcon({
          html: `<div class="destination-marker"></div>`,
          className: '',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        
        const marker = L.marker(latlng, { 
          icon: icon,
          title: "Destination" 
        }).addTo(map);
        
        setDestinationMarker(marker);
      }
    }
  }, [map, originMarker, destinationMarker]);

  // Reverse geocode a location to get an address
  const reverseGeocode = async (latlng) => {
    try {
      const response = await fetch(
        `https://api.maptiler.com/geocoding/${latlng.lng},${latlng.lat}.json?key=${mapTilerKey}`
      );
      
      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        return data.features[0].place_name || `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
      }
      
      return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    }
  };

  // Search for a location and set a marker
  const searchLocation = useCallback(async (query, isOrigin) => {
    if (!map || !query) return;
    
    try {
      // Use backend API instead of direct API call
      const response = await fetch(`http://localhost:5000/api/geocode?query=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const [lng, lat] = feature.center;
        const latlng = L.latLng(lat, lng);
        
        // Update the appropriate value and marker
        if (isOrigin) {
          setOriginValue(feature.place_name);
          updateMarker(latlng, true);
          setShowOriginSuggestions(false);
        } else {
          setDestinationValue(feature.place_name);
          updateMarker(latlng, false);
          setShowDestinationSuggestions(false);
        }
        
        // Update map view and create route if needed
        updateMapView();
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
  }, [map, originMarker, destinationMarker, setOriginMarker, setDestinationMarker, setOriginValue, setDestinationValue]);

  // Get autocomplete suggestions
  const getSuggestions = useCallback(async (query, isOrigin) => {
    if (!query || query.length < 2) {
      isOrigin ? setOriginSuggestions([]) : setDestinationSuggestions([]);
      return;
    }
    
    try {
      const response = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${mapTilerKey}&autocomplete=true`
      );
      
      if (!response.ok) {
        throw new Error('Autocomplete failed');
      }
      
      const data = await response.json();
      
      if (data.features) {
        isOrigin 
          ? setOriginSuggestions(data.features) 
          : setDestinationSuggestions(data.features);
      }
    } catch (error) {
      console.error("Autocomplete error:", error);
    }
  }, []);

  // Handle input change with debounce for autocomplete
  const handleInputChange = useCallback((e, isOrigin) => {
    const value = e.target.value;
    
    if (isOrigin) {
      setOriginValue(value);
      setShowOriginSuggestions(true);
    } else {
      setDestinationValue(value);
      setShowDestinationSuggestions(true);
    }
    
    // Debounce the API call
    const debounceTimer = setTimeout(() => {
      getSuggestions(value, isOrigin);
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [getSuggestions]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion, isOrigin) => {
    const [lng, lat] = suggestion.center;
    const latlng = L.latLng(lat, lng);
    
    if (isOrigin) {
      setOriginValue(suggestion.place_name);
      updateMarker(latlng, true);
      setShowOriginSuggestions(false);
    } else {
      setDestinationValue(suggestion.place_name);
      updateMarker(latlng, false);
      setShowDestinationSuggestions(false);
    }
    
    updateMapView();
  }, [updateMarker]);

  // Update the map view to show both markers if they exist
  const updateMapView = useCallback(() => {
    if (!map) return;
    
    if (originMarker && destinationMarker) {
      // Create a bounds object and extend it with both markers
      const bounds = L.latLngBounds([
        originMarker.getLatLng(),
        destinationMarker.getLatLng()
      ]);
      
      // Fit the map to these bounds with some padding
      map.fitBounds(bounds, { padding: [50, 50] });
      
      // Create a route between the markers
      createRoute(originMarker.getLatLng(), destinationMarker.getLatLng());
    } else if (originMarker) {
      map.setView(originMarker.getLatLng(), 13);
    } else if (destinationMarker) {
      map.setView(destinationMarker.getLatLng(), 13);
    }
  }, [map, originMarker, destinationMarker]);
  
  // Create a route between two points
  const createRoute = useCallback((start, end) => {
    if (!map) return;
    
    // Show loading state
    setIsLoadingRoute(true);
    setRouteInfo(null);
    
    // Remove existing route if there is one
    if (routeControl) {
      routeControl.remove();
      setRouteControl(null);
      routeControlRef.current = null;
    }
    
    // Create new route
    const newRouteControl = L.Routing.control({
      waypoints: [
        L.latLng(start.lat, start.lng),
        L.latLng(end.lat, end.lng)
      ],
      routeWhileDragging: true,
      showAlternatives: true,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false,
      createMarker: function() { return null; },
      lineOptions: {
        styles: [
          {color: '#2A93EE', opacity: 0.8, weight: 6}
        ]
      },
      altLineOptions: {
        styles: [
          {color: 'black', opacity: 0.15, weight: 9},
          {color: 'white', opacity: 0.8, weight: 6},
          {color: 'blue', opacity: 0.5, weight: 2}
        ]
      }
    }).addTo(map);
    
    // Listen for route found event
    newRouteControl.on('routesfound', function(e) {
      setIsLoadingRoute(false);
      
      if (e.routes && e.routes.length > 0) {
        const route = e.routes[0];
        const distance = (route.summary.totalDistance / 1000).toFixed(1);
        const timeMinutes = Math.round(route.summary.totalTime / 60);
        
        setRouteInfo({
          distance: distance,
          time: timeMinutes
        });
      }
    });
    
    setRouteControl(newRouteControl);
    routeControlRef.current = newRouteControl;
  }, [map, routeControl]);

  // Handle form submission
  const handleSubmit = useCallback((e, isOrigin) => {
    e.preventDefault();
    const value = isOrigin ? originValue : destinationValue;
    searchLocation(value, isOrigin);
  }, [originValue, destinationValue, searchLocation]);

  return (
    <div className="app-container">
      <div id="map" ref={mapRef}>
        <div className="button-container">
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
                      onFocus={() => setShowOriginSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowOriginSuggestions(false), 200)}
                    />
                  </div>
                </div>
              </div>
              
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
                      onFocus={() => setShowDestinationSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowDestinationSuggestions(false), 200)}
                    />
                  </div>
                </div>
              </div>
              
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
              
              {routeInfo && (
                <div className="route-info">
                  <div className="route-detail">
                    <span className="route-icon">🚗</span>
                    <span>{routeInfo.distance} km</span>
                  </div>
                  <div className="route-detail">
                    <span className="route-icon">⏱️</span>
                    <span>{routeInfo.time} min</span>
                  </div>
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