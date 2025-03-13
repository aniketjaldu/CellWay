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

  useEffect(() => {
    // Make sure Leaflet is loaded
    if (!mapRef.current || !window.L) return;
    
    // Create map instance
    const mapInstance = L.map(mapRef.current).setView([51.505, -0.09], 13);
    setMap(mapInstance);
    
    // Force map to invalidate its size after mounting to ensure proper rendering
    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 100);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);

    // Create custom CSS for pulsing blue circle
    const style = document.createElement('style');
    style.innerHTML = `
      .origin-marker {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: #2A93EE;
        box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
        animation: pulse 1.5s infinite;
      }
      
      .destination-marker {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: #EE2A2A;
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
    `;
    document.head.appendChild(style);

    // Add locate control with callback for when location is found
    const locateControl = L.control.locate({
      position: 'topleft',
      onLocationFound: (e) => {
        // When location is found, set as origin
        handleLocationFound(e);
      },
    }).addTo(mapInstance);

    // Add event listener for location found events
    mapInstance.on('locationfound', handleLocationFound);

    // Setup provider for geocoding searches
    const provider = new window.GeoSearch.OpenStreetMapProvider();

    // Cleanup function
    return () => {
      if (routeControl) {
        routeControl.removeFrom(mapInstance);
      }
      mapInstance.remove();
      document.head.removeChild(style);
    };
  }, []);

  // Handle when user's location is found
  const handleLocationFound = (e) => {
    if (!map) return;
    
    // Only update the origin input with the user's location
    // without setting a marker on the map
    
    // Get the address for the location and update the origin input
    reverseGeocode(e.latlng)
      .then(address => {
        setOriginValue(address);
        if (originInputRef.current) {
          originInputRef.current.value = address;
        }
      })
      .catch(error => console.error("Reverse geocoding failed:", error));
    
    // Note: We're not setting a marker or updating the map view here
  };

  // Reverse geocode a location to get an address
  const reverseGeocode = async (latlng) => {
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
    
    const provider = new window.GeoSearch.OpenStreetMapProvider();
    try {
      const results = await provider.search({ query });
      
      if (results.length > 0) {
        const { x, y, label } = results[0];
        const latlng = L.latLng(y, x);
        
        // Update the appropriate marker
        if (isOrigin) {
          if (originMarker) {
            originMarker.setLatLng(latlng);
          } else {
            const markerHtml = `<div class="origin-marker"></div>`;
            const icon = L.divIcon({
              html: markerHtml,
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
          setOriginValue(label);
        } else {
          if (destinationMarker) {
            destinationMarker.setLatLng(latlng);
          } else {
            const markerHtml = `<div class="destination-marker"></div>`;
            const icon = L.divIcon({
              html: markerHtml,
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
          setDestinationValue(label);
        }
        
        // Update map view to show both markers if they exist
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