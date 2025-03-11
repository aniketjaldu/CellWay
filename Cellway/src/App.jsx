import { useEffect, useRef } from 'react';
import './App.css';

function App() {
  const mapRef = useRef(null);

  useEffect(() => {
    // Make sure Leaflet is loaded
    if (!mapRef.current || !window.L) return;
    
    // Create map instance
    const map = L.map(mapRef.current).setView([51.505, -0.09], 13);
    
    // Force map to invalidate its size after mounting to ensure proper rendering
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add locate control
    L.control.locate({
      position: 'topleft',
    }).addTo(map);

    // Add geocoder control
    L.Control.geocoder({
      position: 'topright'
    }).addTo(map);

    // Add geosearch provider
    const provider = new window.GeoSearch.OpenStreetMapProvider();
    const searchControl = new window.GeoSearch.GeoSearchControl({
      provider: provider,
      style: 'bar',
      showMarker: true,
      showPopup: false,
      autoClose: true
    });
    map.addControl(searchControl);

    // Cleanup function
    return () => {
      map.remove();
    };
  }, []);

  return (
    <div id="map" ref={mapRef}></div>
  );
}

export default App;