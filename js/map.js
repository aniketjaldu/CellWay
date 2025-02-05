// Initialize the map
var map = L.map('map').setView([51.505, -0.09], 13);
console.log('Map initialized');

// Add the tile layer
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Add the locate control
var locateControl = L.control.locate({
    setView: 'always',
    flyTo: true,
    maxZoom: 16,
    clickBehavior: {
        inView: 'setView',
        outOfView: 'setView',
        inViewNotFollowing: 'inView'
    },
    // Ensures no error message when user denies current location
    onLocationError(err, control) {
        void(0);
    }
}).addTo(map);
console.log('Locate control added');

// Add the geocoder control (for forward geocoding)
var control = L.Control.geocoder({
    position: 'topright',
    placeholder: 'Search for an address...',
    defaultMarkGeocode: false
}).addTo(map);
console.log('Geocoder control added');

// Track whether the user's current location has been found
var userLocationFound = false;

// Function to perform reverse geocoding using Nominatim API directly
function reverseGeocode(lat, lon, callback) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log('Reverse geocoding result:', data);
            callback(data);
        })
        .catch(error => {
            console.error('Error during reverse geocoding:', error);
        });
}

// Automatically search for the user's current location
map.on('locationfound', function(e) {
    console.log('Location found:', e.latlng); // Debugging
    userLocationFound = true; // Set the flag to true

    // Perform reverse geocoding using the direct API call
    reverseGeocode(e.latlng.lat, e.latlng.lng, function(result) {
        if (result && result.address) {
            console.log('Address:', result.display_name);

            // Manually update the search bar's input field
            var searchInput = document.querySelector('.leaflet-control-geocoder input');
            if (searchInput) {
                searchInput.value = result.display_name; // Set the input value
            }

            // Do not add a marker for the user's current location
        } else {
            console.log('No address found');
        }
    });
});

// Handle manual address search (geocoder control)
control.on('markgeocode', function(e) {
    console.log('Geocoding result:', e.geocode);

    // Only add a marker if the user's current location was not found
    if (!userLocationFound) {
        var bbox = e.geocode.bbox;
        var poly = L.polygon([
            bbox.getSouthEast(),
            bbox.getNorthEast(),
            bbox.getNorthWest(),
            bbox.getSouthWest()
        ]);
        map.fitBounds(poly.getBounds());
        L.marker(e.geocode.center).addTo(map)
            .bindPopup(e.geocode.name)
            .openPopup();
    }
});

// Log location errors
map.on('locationerror', function(e) {
    console.error('Location access denied or failed:', e.message); // Debugging
});

// Start locating the user
locateControl.start();
console.log('Locate control started');