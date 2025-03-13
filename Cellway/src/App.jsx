import { useEffect, useRef, useState } from 'react';
import './App.css';

function App() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [originMarker, setOriginMarker] = useState(null);
  const [destinationMarker, setDestinationMarker] = useState(null);
  const [originValue, setOriginValue] = useState('');
  const [destinationValue, setDestinationValue] = useState('');
  const [routeControl, setRouteControl] = useState(null);
  
  // Reference to the origin input element
  const originInputRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    
    // Create map instance
    const mapInstance = L.map(mapRef.current).setView([51.505, -0.09], 13);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);

    // Add custom CSS for markers
    const style = document.createElement('style');
    style.innerHTML = `
      .origin-marker {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: #2A93EE;
        border: 2px solid white;
        box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
        animation: pulse 1.5s infinite;
      }
      
      .destination-marker {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: #EE2A2A;
        border: 2px solid white;
        box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
      }
      
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(42, 147, 238, 0.7);
        }
        70% {
          box-shadow: 0 0 0 15px rgba(42, 147, 238, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(42, 147, 238, 0);
        }
      }
      
      .locate-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        font-size: 16px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);

    // Add locate button
    const locateButton = L.control({position: 'topleft'});
    locateButton.onAdd = function() {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      div.innerHTML = '<a class="locate-button" href="#" title="Show my location">📍</a>';
      
      L.DomEvent.on(div, 'click', function(e) {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
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
      document.head.removeChild(style);
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
        routeControl.removeFrom(map);
      }
    };
  }, [map, originMarker, destinationMarker]);

  // Create or update a marker
  const updateMarker = (latlng, isOrigin) => {
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
  };

  // Reverse geocode a location to get an address
  const reverseGeocode = async (latlng) => {
    if (!window.GeoSearch) return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    
    const provider = new window.GeoSearch.OpenStreetMapProvider();
    try {
      const results = await provider.search({
        query: `${latlng.lat}, ${latlng.lng}`
      });
      return results[0]?.label || `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    }
  };

  // Search for a location and set a marker
  const searchLocation = async (query, isOrigin) => {
    if (!map || !query) return;
    
    if (!window.GeoSearch) {
      console.error("GeoSearch not available");
      return;
    }
    
    const provider = new window.GeoSearch.OpenStreetMapProvider();
    try {
      const results = await provider.search({ query });
      
      if (results.length > 0) {
        const { x, y, label } = results[0];
        const latlng = L.latLng(y, x);
        
        // Update the appropriate value and marker
        if (isOrigin) {
          setOriginValue(label);
          updateMarker(latlng, true);
        } else {
          setDestinationValue(label);
          updateMarker(latlng, false);
        }
        
        // Update map view and create route if needed
        updateMapView();
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  // Update the map view to show both markers if they exist
  const updateMapView = () => {
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
  };
  
  // Create a route between two points
  const createRoute = (start, end) => {
    if (!map) return;
    
    // Remove existing route if there is one
    if (routeControl) {
      routeControl.removeFrom(map);
      setRouteControl(null);
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
    
    setRouteControl(newRouteControl);
  };

  // Handle form submission
  const handleSubmit = (e, isOrigin) => {
    e.preventDefault();
    const value = isOrigin ? originValue : destinationValue;
    searchLocation(value, isOrigin);
  };

  return (
    <div className="app-container">
      <div className="search-container">
        <form onSubmit={(e) => handleSubmit(e, true)}>
          <input
            ref={originInputRef}
            type="text"
            placeholder="Origin"
            value={originValue}
            onChange={(e) => setOriginValue(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        
        <form onSubmit={(e) => handleSubmit(e, false)}>
          <input
            type="text"
            placeholder="Destination"
            value={destinationValue}
            onChange={(e) => setDestinationValue(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </div>
      
      <div id="map" ref={mapRef}></div>
    </div>
  );
}

export default App;