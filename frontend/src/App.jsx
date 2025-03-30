import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom'; // Use Routes and Route for page/overlay routing
import { Toaster } from 'react-hot-toast'; // Library for displaying notifications
import L from 'leaflet'; // Leaflet library (needed for L.LatLng)

// --- Hooks ---
// Custom hooks for managing different application states and logic
import { useAuth } from './hooks/useAuth';
import { useMap } from './hooks/useMap';
import { useRouting } from './hooks/useRouting';
import { useTowers } from './hooks/useTowers';
import { useMapInteraction } from './hooks/useMapInteraction';
import * as api from './services/api'; // API service functions

// --- Components ---
// UI components for different parts of the application
import MapContainer from './components/Map/MapContainer';
import SearchPanel from './components/Search/SearchPanel';
import AuthButtons from './components/Auth/AuthButtons';
import AuthForm from './components/Auth/AuthForm';
import DirectionsPanel from './components/Directions/DirectionsPanel';
import SavedRoutesPanel from './components/SavedRoutes/SavedRoutesPanel';
import MapControls from './components/Map/MapControls';
import RouteTypeSelectionModal from './components/Routing/RouteTypeSelectionModal';
import TowerMarkers from './components/Map/TowerMarkers';
import RouteHighlight from './components/Map/RouteHighlight';
import ResetPasswordForm from './components/Auth/ResetPasswordForm'; // Component for password reset page/overlay

// --- Base Styles ---
import './App.css'; // Main application styles


/**
 * App Component
 * 
 * The root component of the application. It orchestrates the state management
 * using custom hooks, renders the main UI layout (map, panels, modals),
 * and handles interactions between different parts of the application.
 */
function App() {
  // ==================================================
  //               State Management
  // ==================================================

  // --- UI Visibility State ---
  // Controls the visibility of modals and panels
  const [showAuthForm, setShowAuthForm] = useState(false); // Visibility of the Login/Register/Forgot Password modal
  const [authMode, setAuthMode] = useState('login'); // Mode of the AuthForm ('login', 'register', 'forgot')
  const [showSavedRoutes, setShowSavedRoutes] = useState(false); // Visibility of the Saved Routes panel
  const [showSearchPanel, setShowSearchPanel] = useState(true); // Visibility of the Origin/Destination Search panel
  const [showRouteTypeModal, setShowRouteTypeModal] = useState(false); // Visibility of the Route Type Selection modal
  // Persisted preference for skipping the route type modal
  const [skipRouteTypeSelection, setSkipRouteTypeSelection] = useState(() => {
    return localStorage.getItem('skipRouteTypeSelection') === 'true';
  });

  // --- Search Input State ---
  // Manages the values and suggestions for origin/destination inputs
  // Could potentially be moved into a dedicated `useSearch` hook for more complex scenarios.
  const [originValue, setOriginValue] = useState(''); // Current text value of the origin input
  const [destinationValue, setDestinationValue] = useState(''); // Current text value of the destination input
  const [originSuggestions, setOriginSuggestions] = useState([]); // Array of geocoding suggestions for origin
  const [destinationSuggestions, setDestinationSuggestions] = useState([]); // Array of geocoding suggestions for destination
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false); // Controls visibility of origin suggestions dropdown
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false); // Controls visibility of destination suggestions dropdown

  // --- Refs ---
  const mapContainerRef = useRef(null); // Ref attached to the MapContainer's div element


  // --- Custom Hooks Integration ---
  // Initialize and use custom hooks to manage different domains of state and logic

  // Authentication Hook
  const { user, login, register, logout, forgotPassword } = useAuth();

  // Map Hook (depends on mapContainerRef)
  const mapHookUtils = useMap(mapContainerRef); // Pass ref to hook
  const { map, mapIsReady, updateMarker, displayRouteLine, clearRouteLine, displayLayerGroup, clearLayerGroup, flyTo, fitBounds } = mapHookUtils;

  // Routing Hook (depends on map, user, mapUtils)
  const routingHookUtils = useRouting(map, user, { // Pass map instance, user, and map utilities
    displayRouteLine, clearRouteLine, fitBounds, updateMarker, clearLayerGroup,
    setOriginValue, // Pass setters to allow routing hook to update search inputs (e.g., on load saved route)
    setDestinationValue,
  });
  const {
    routeType, setRouteType, currentRoutePoints, setCurrentRoutePoints, routeInfo,
    routesAreLoading, allRoutesComputed, computedRoutes, routeDirections, showDirectionsPanel,
    isDirectionsMinimized, activeDirectionStep, routeOriginDisplay, routeDestinationDisplay,
    savedRoutes, isLoadingSavedRoutes, setRouteDisplayNames, calculateAllRouteTypes,
    clearRoutingState, setActiveDirectionStep, toggleDirectionsMinimized, saveCurrentRoute,
    fetchSavedRoutes, loadSavedRoute: originalLoadSavedRoute // Rename to avoid conflict in this scope
  } = routingHookUtils;

  // Tower Hook (depends on map and current route geometry)
  const routeGeometryForTowers = routeInfo?.routes?.[0]?.geometry; // Get geometry from current route info
  const {
    towersToDisplay, showTowers, toggleShowTowers, fetchTowersInBounds,
    allFetchedTowersCount, towerDataSource, isLoading: towersLoading,
  } = useTowers(map, routeGeometryForTowers);

  // Map Interaction Hook (depends on map)
  const { isLocating, locateUser, preventMapInteraction } = useMapInteraction(map, handleLocationFound); // Pass location found callback


  // ==================================================
  //               Effects
  // ==================================================

  // --- Effect: Load Initial Preferences ---
  // Loads saved route type preference from localStorage on initial mount
  useEffect(() => {
    const savedRouteType = localStorage.getItem('preferredRouteType');
    if (savedRouteType && ['fastest', 'cell_coverage', 'balanced'].includes(savedRouteType)) {
      setRouteType(savedRouteType); // Use setter from routing hook
    }
    // Load skip preference is handled by useState initializer
  }, [setRouteType]); // Dependency: setRouteType function from hook


  // --- Effect: Handle Map Clicks for Highlight Clearing ---
  // Clears the active direction step highlight when the user clicks anywhere on the map
  useEffect(() => {
    if (!map) return; // Only run if map is ready

    const handleMapClick = () => {
      setActiveDirectionStep(null); // Reset active step index in routing hook
      clearLayerGroup?.('highlight'); // Clear highlight layer using map util
    };

    map.on('click', handleMapClick); // Add click listener

    // Cleanup function: Remove listener when component unmounts or map changes
    return () => {
      if (map) {
        map.off('click', handleMapClick);
      }
    };
  }, [map, setActiveDirectionStep, clearLayerGroup]); // Dependencies


  // --- Effect: Fetch Towers on Map Movement (Placeholder/Example) ---
  // Example of how you *might* fetch towers when the map view changes.
  // Currently disabled as fetching is triggered manually or after route calculation.
  useEffect(() => {
    if (!map) return;

    const handleMoveEnd = () => {
      // TODO: Implement logic if towers should be fetched automatically on map move/zoom.
      // Consider debouncing this call to avoid excessive API requests.
      // Example:
      // const bounds = map.getBounds();
      // const apiBounds = { min_lat: bounds.getSouthWest().lat, ... };
      // fetchTowersInBounds(apiBounds);
    };

    map.on('moveend', handleMoveEnd); // Listen for map movement end

    // Cleanup function
    return () => {
      if (map) {
        map.off('moveend', handleMoveEnd);
      }
    };
  }, [map, fetchTowersInBounds]); // Dependencies


  // ==================================================
  //               Callback Functions
  // ==================================================

  // --- Load Saved Route Callback ---
  // Handles loading a saved route, including fetching towers for the new bounds.
  const handleLoadSavedRoute = useCallback(async (route) => {
    if (!map) {
      toast.error("Map not ready, cannot load route.");
      return;
    }

    // Call the original load logic from the routing hook
    await originalLoadSavedRoute(route); // Assuming this updates map view via fitBounds

    // Wait briefly for map view to potentially settle after fitBounds
    await new Promise(resolve => setTimeout(resolve, 200)); // Adjust delay if needed

    // Fetch towers for the new map bounds after loading the route
    if (fetchTowersInBounds) {
      try {
        const currentMapBounds = map.getBounds(); // Get the updated map bounds
        if (currentMapBounds) {
          const apiBounds = {
            min_lat: currentMapBounds.getSouthWest().lat,
            min_lng: currentMapBounds.getSouthWest().lng,
            max_lat: currentMapBounds.getNorthEast().lat,
            max_lng: currentMapBounds.getNorthEast().lng,
          };
          // console.log("[App handleLoadSavedRoute] Triggering fetchTowersInBounds for bounds:", apiBounds); // Debug log
          await fetchTowersInBounds(apiBounds); // Fetch towers for the visible area
        } else {
          console.warn("[App handleLoadSavedRoute] Map bounds not available after loading route.");
        }
      } catch (error) {
        console.error("[App handleLoadSavedRoute] Error fetching towers after loading saved route:", error);
        toast.error("Failed to fetch tower data for the loaded route area.");
      }
    } else {
      console.warn("[App handleLoadSavedRoute] fetchTowersInBounds function is not available.");
    }
  }, [map, originalLoadSavedRoute, fetchTowersInBounds]); // Dependencies


  // --- Geocoding Input Change Handler ---
  // Fetches geocoding suggestions from the backend API as the user types.
  const handleInputChange = useCallback(async (event, isOrigin) => {
    const value = event.target.value;
    const setValue = isOrigin ? setOriginValue : setDestinationValue;
    const setSuggestions = isOrigin ? setOriginSuggestions : setDestinationSuggestions;
    const setShowSuggestions = isOrigin ? setShowOriginSuggestions : setShowDestinationSuggestions;

    setValue(value); // Update input value state

    // Clear suggestions if input is empty
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Fetch suggestions from backend geocoding proxy
    try {
      const response = await api.geocodeQuery(value, true); // Call backend API
      // Assuming backend forwards MapTiler's response structure
      if (response.data?.features) {
        setSuggestions(response.data.features); // Update suggestions state
        setShowSuggestions(true); // Show suggestions dropdown
      } else {
        console.error('Backend geocoding did not return expected features:', response.data);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      // API interceptor might handle toast, but log specific error here
      console.error('Error fetching geocoding suggestions via backend:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []); // No external dependencies needed


  // --- Input Focus Handler ---
  // Shows suggestions when an input field gains focus, potentially re-fetching if needed.
  const handleInputFocus = useCallback(async (isOrigin) => {
    // console.log(`[handleInputFocus] isOrigin: ${isOrigin}`); // Debug log
    const setShow = isOrigin ? setShowOriginSuggestions : setShowDestinationSuggestions;
    const inputValue = isOrigin ? originValue : destinationValue;

    // If input has value, re-fetch suggestions to ensure they are up-to-date
    if (inputValue.trim()) {
      // console.log(`[handleInputFocus] Input has value: ${inputValue}, re-fetching suggestions.`); // Debug log
      const mockEvent = { target: { value: inputValue } }; // Create mock event for handleInputChange
      await handleInputChange(mockEvent, isOrigin); // Trigger suggestion fetch
    }
    setShow(true); // Always show the dropdown on focus (it might be empty initially)
  }, [originValue, destinationValue, handleInputChange]); // Dependencies


  // --- Input Blur Handler ---
  // Hides suggestions when an input field loses focus (handled with delay in SearchPanel).
  const handleInputBlur = useCallback((isOrigin) => {
    // Actual hiding with delay is managed within SearchPanel to handle suggestion clicks
    // This function primarily signals intent or could be used for validation on blur
    // For now, just log or leave empty if SearchPanel handles the hide.
    // console.log(`[handleInputBlur] isOrigin: ${isOrigin}`); // Debug log
    // Simplified: SearchPanel's internal handler with setTimeout manages hiding suggestions.
  }, []);


  // --- Clear Input Handler ---
  // Clears the specified input field, suggestions, map marker, and routing state.
  const handleClearInput = useCallback((isOrigin) => {
    if (isOrigin) {
      setOriginValue('');
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
      updateMarker?.(null, true); // Clear origin marker using map util
      setCurrentRoutePoints(prev => ({ ...prev, start: null })); // Clear start point in routing hook
    } else {
      setDestinationValue('');
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
      updateMarker?.(null, false); // Clear destination marker using map util
      setCurrentRoutePoints(prev => ({ ...prev, end: null })); // Clear end point in routing hook
    }
    clearRoutingState(); // Clear the entire route if either point is removed
  }, [updateMarker, setCurrentRoutePoints, clearRoutingState]); // Dependencies


  // --- Suggestion Selection Handler ---
  // Handles selecting a geocoding suggestion, updates state, and triggers route calculation.
  const handleSuggestionSelect = useCallback(async (suggestion, isOrigin) => {
    // --- Guard Clauses ---
    if (!map || !suggestion?.center) {
      console.warn("handleSuggestionSelect: Map not ready or suggestion invalid.", suggestion);
      return;
    }

    // --- Extract Data and Update State ---
    const [lng, lat] = suggestion.center; // Extract coordinates
    const latlng = L.latLng(lat, lng); // Create Leaflet LatLng
    const placeName = suggestion.place_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`; // Get place name or use coordinates

    // Update input value and hide suggestions
    if (isOrigin) {
      setOriginValue(placeName);
      setShowOriginSuggestions(false);
    } else {
      setDestinationValue(placeName);
      setShowDestinationSuggestions(false);
    }

    // Update map marker
    updateMarker?.(latlng, isOrigin);

    // Update routing state (points and display names)
    const newPoint = { lat, lng, place_name: placeName }; // Include place_name in point data
    const currentPoints = currentRoutePoints; // Get current points from state
    const updatedPoints = isOrigin
      ? { start: newPoint, end: currentPoints?.end }
      : { start: currentPoints?.start, end: newPoint };
    setCurrentRoutePoints(updatedPoints); // Update points in routing hook
    setRouteDisplayNames( // Update display names in routing hook
      isOrigin ? placeName : routeOriginDisplay,
      isOrigin ? routeDestinationDisplay : placeName
    );

    // --- Trigger Route Calculation and Tower Fetch ---
    if (updatedPoints.start?.lat && updatedPoints.end?.lat) { // Check if both points are now set
      const originLL = L.latLng(updatedPoints.start.lat, updatedPoints.start.lng);
      const destLL = L.latLng(updatedPoints.end.lat, updatedPoints.end.lng);

      fitBounds?.([originLL, destLL]); // Fit map to origin and destination

      // Fetch towers within the bounds of the two points (with padding) *before* calculating routes
      const waypointPadding = 0.02; // Degrees padding around points
      const initialBounds = {
        min_lat: Math.min(originLL.lat, destLL.lat) - waypointPadding,
        min_lng: Math.min(originLL.lng, destLL.lng) - waypointPadding,
        max_lat: Math.max(originLL.lat, destLL.lat) + waypointPadding,
        max_lng: Math.max(originLL.lng, destLL.lng) + waypointPadding
      };
      // console.log("[App handleSuggestionSelect] Fetching towers for initial bounds:", initialBounds); // Debug log
      await fetchTowersInBounds(initialBounds); // Await tower fetch before proceeding

      // Decide whether to show route type selection modal or calculate directly
      if (!skipRouteTypeSelection) {
        setShowRouteTypeModal(true); // Show the selection modal
        // Trigger calculation in the background while modal is shown
        calculateAllRouteTypes(updatedPoints,
          isOrigin ? placeName : routeOriginDisplay, // Pass correct display names
          isOrigin ? routeDestinationDisplay : placeName
        );
      } else {
        // Calculate and immediately display the preferred route type
        calculateAllRouteTypes(updatedPoints,
          isOrigin ? placeName : routeOriginDisplay,
          isOrigin ? routeDestinationDisplay : placeName
        );
      }
      setShowSearchPanel(false); // Collapse search panel after selecting both points
    } else {
      // If only one point is set, fly to that point
      flyTo?.(latlng, Math.max(map?.getZoom() || 14, 14)); // Fly to the selected point
    }
  }, [
    map, currentRoutePoints, updateMarker, setCurrentRoutePoints, fitBounds, flyTo, fetchTowersInBounds,
    skipRouteTypeSelection, calculateAllRouteTypes, setRouteDisplayNames, routeOriginDisplay, routeDestinationDisplay // Dependencies
  ]);


  // --- Location Found Handler ---
  // Callback for useMapInteraction when geolocation is successful.
  function handleLocationFound({ lat, lng, name, latlng }) {
    setOriginValue(name); // Update origin input value state
    updateMarker?.(latlng, true); // Update origin marker on map

    // Update routing state
    const newPoint = { lat, lng, place_name: name };
    const updatedPoints = { start: newPoint, end: currentRoutePoints?.end };
    setCurrentRoutePoints(updatedPoints);
    setRouteDisplayNames(name, routeDestinationDisplay); // Update display names

    // Check if destination is also set to trigger routing/tower fetch
    if (updatedPoints.start?.lat && updatedPoints.end?.lat) {
      const destLL = L.latLng(updatedPoints.end.lat, updatedPoints.end.lng);
      fitBounds?.([latlng, destLL]); // Fit map to both points

      // Fetch towers and calculate routes (similar logic to handleSuggestionSelect)
      const waypointPadding = 0.02;
      const initialBounds = {
        min_lat: Math.min(latlng.lat, destLL.lat) - waypointPadding,
        min_lng: Math.min(latlng.lng, destLL.lng) - waypointPadding,
        max_lat: Math.max(latlng.lat, destLL.lat) + waypointPadding,
        max_lng: Math.max(latlng.lng, destLL.lng) + waypointPadding
      };
      // console.log("[App handleLocationFound] Fetching towers for initial bounds:", initialBounds); // Debug log
      fetchTowersInBounds(initialBounds).then(() => { // Fetch towers first
        if (!skipRouteTypeSelection) { // Check preference
          setShowRouteTypeModal(true); // Show modal
          calculateAllRouteTypes(updatedPoints, name, routeDestinationDisplay); // Calculate in background
        } else {
          calculateAllRouteTypes(updatedPoints, name, routeDestinationDisplay); // Calculate and display preferred
        }
      });
      setShowSearchPanel(false); // Collapse search panel
    } else {
      // If only origin is set, fly to the user's location
      flyTo?.(latlng, Math.max(map?.getZoom() || 14, 14));
    }
  }


  // --- Route Type Selection Handler ---
  // Called when a route type is selected in the RouteTypeSelectionModal.
  const handleRouteTypeSelect = useCallback((selectedType) => {
    setRouteType(selectedType); // Update preferred route type via routing hook
    setShowRouteTypeModal(false); // Close the modal
    // The routing hook's displayRoute function will handle displaying the selected route
    // based on the updated routeType state and computedRoutes.
  }, [setRouteType]);


  // --- Skip Preference Change Handler ---
  // Called when the "Don't ask again" checkbox in the modal changes.
  const handleSkipPreferenceChange = useCallback((shouldSkip) => {
    setSkipRouteTypeSelection(shouldSkip); // Update local state
    localStorage.setItem('skipRouteTypeSelection', shouldSkip.toString()); // Persist preference
    // If user checks the box, save the *currently selected* route type as their preference
    if (shouldSkip) {
      localStorage.setItem('preferredRouteType', routeType);
    }
  }, [routeType]); // Dependency: routeType (to save the correct preference)


  // --- Direction Step Click Handler ---
  // Called when a step in the DirectionsPanel is clicked.
  const handleStepClick = useCallback((step, index) => {
    setActiveDirectionStep(index); // Update active step index via routing hook
    // Highlighting is handled by the RouteHighlight component based on activeDirectionStep state
  }, [setActiveDirectionStep]);


  // --- Map Interaction Prevention Handlers ---
  // These handlers disable/re-enable map interactions when mouse enters/leaves UI overlays.
  const interactionCleanupRef = useRef(null); // Ref to store the cleanup function returned by preventMapInteraction
  const handleOverlayEnter = useCallback(() => {
    // console.log("Overlay Enter - Disabling Map Interactions"); // Debug log
    interactionCleanupRef.current = preventMapInteraction(); // Disable interactions and store cleanup function
  }, [preventMapInteraction]);
  const handleOverlayLeave = useCallback(() => {
    // console.log("Overlay Leave - Enabling Map Interactions"); // Debug log
    interactionCleanupRef.current?.(); // Call the cleanup function to re-enable interactions
    interactionCleanupRef.current = null; // Clear the ref
  }, []);


  // --- Save Route Click Handler ---
  // Wraps the saveCurrentRoute function from the routing hook to pass the map container element.
  const handleSaveRouteClick = useCallback(() => {
    if (!mapContainerRef.current) { // Ensure map container ref is valid
      console.error("Save Route Error: Map container ref is not available.");
      toast.error("Cannot save route: Map container element not found.");
      return;
    }
    // Call the hook's function, passing the actual DOM element needed for html2canvas
    saveCurrentRoute(mapContainerRef.current);
  }, [saveCurrentRoute, mapContainerRef]); // Dependencies


  // --- Auth Modal Opener ---
  // Helper function to open the authentication modal in a specific mode.
  const openAuthModal = (mode) => {
    setAuthMode(mode); // Set mode ('login', 'register', 'forgot')
    setShowAuthForm(true); // Show the modal
  };


  // ==================================================
  //               Render Logic
  // ==================================================
  return (
    <div className="app-container">
      {/* --- Notifications --- */}
      <Toaster position="bottom-center" toastOptions={{ duration: 3000 }} />

      {/* --- Map Container and Overlays --- */}
      <MapContainer ref={mapContainerRef} className={showAuthForm || showSavedRoutes ? 'map-interactions-disabled' : ''}>
        {/* Render map-specific overlays (Towers, Highlights) only when map is ready */}
        {mapIsReady && map && (
          <>
            {/* --- Tower Markers --- */}
            {showTowers && <TowerMarkers map={map} towers={towersToDisplay} />}

            {/* --- Route Step Highlight --- */}
            {activeDirectionStep !== null && routeDirections?.steps?.[activeDirectionStep] && (
              <RouteHighlight
                map={map}
                instruction={routeDirections.steps[activeDirectionStep]}
                type={routeDirections.steps[activeDirectionStep].type}
              />
            )}
          </>
        )}
      </MapContainer>


      {/* --- UI Panels and Controls --- */}
      {/* Render UI elements that overlay the map */}

      {/* --- Search Panel --- */}
      <SearchPanel
        isVisible={showSearchPanel}
        onToggleSearch={() => setShowSearchPanel(prev => !prev)}
        originValue={originValue}
        destinationValue={destinationValue}
        originSuggestions={originSuggestions}
        destinationSuggestions={destinationSuggestions}
        showOriginSuggestions={showOriginSuggestions}
        showDestinationSuggestions={showDestinationSuggestions}
        onInputChange={handleInputChange}
        onInputFocus={handleInputFocus}
        onInputBlur={handleInputBlur} // Pass simplified blur handler
        onSuggestionSelect={handleSuggestionSelect}
        onClearInput={handleClearInput}
        // Pass tower info/toggle props
        showCellTowers={showTowers}
        onToggleCellTowers={toggleShowTowers} // Use internal wrapper
        allFetchedTowersCount={allFetchedTowersCount}
        routesAreLoading={routesAreLoading}
        // Map interaction prevention
        onMouseEnter={handleOverlayEnter}
        onMouseLeave={handleOverlayLeave}
        onTouchStart={handleOverlayEnter} // Use same handlers for touch
        onTouchEnd={handleOverlayLeave}
      />

      {/* --- Authentication Buttons --- */}
      <AuthButtons
        user={user}
        onLoginClick={() => openAuthModal('login')}
        onRegisterClick={() => openAuthModal('register')}
        onLogoutClick={logout}
        onMyRoutesClick={() => setShowSavedRoutes(true)}
      />

      {/* --- Map Controls --- */}
      <MapControls
        isLocating={isLocating}
        onLocate={locateUser}
        isTowersVisible={showTowers}
        onToggleTowers={toggleShowTowers}
        currentRouteType={routeType}
        onSelectRouteType={() => { // Show modal or error if no route
          if (!currentRoutePoints.start || !currentRoutePoints.end) {
            toast.info("Please set Origin and Destination first.", { id: 'rt-select-no-points' });
            return;
          }
          setShowRouteTypeModal(true);
          // Ensure calculations trigger if modal opens and routes aren't ready
          if (!allRoutesComputed && !routesAreLoading) {
            calculateAllRouteTypes(currentRoutePoints, routeOriginDisplay, routeDestinationDisplay);
          }
        }}
        isRouteActive={!!routeInfo} // Enable button only if a route is active
      />

      {/* --- Directions Panel --- */}
      <DirectionsPanel
        isVisible={showDirectionsPanel}
        isMinimized={isDirectionsMinimized}
        directions={routeDirections}
        originName={routeOriginDisplay}
        destinationName={routeDestinationDisplay}
        activeStepIndex={activeDirectionStep}
        onStepClick={handleStepClick}
        onToggleMinimize={toggleDirectionsMinimized}
        onClose={clearRoutingState} // Close button clears the current route
        onSave={handleSaveRouteClick} // Pass wrapped save handler
        canSave={!!user} // Enable save only if user is logged in
        // Map interaction prevention
        onMouseEnter={handleOverlayEnter}
        onMouseLeave={handleOverlayLeave}
        onTouchStart={handleOverlayEnter}
        onTouchEnd={handleOverlayLeave}
      />


      {/* --- Modals --- */}
      {/* Authentication Modal */}
      {showAuthForm && (
        <AuthForm
          mode={authMode}
          onClose={() => setShowAuthForm(false)}
          onLogin={login}
          onRegister={register}
          onForgotPassword={forgotPassword}
          onChangeMode={setAuthMode} // Allow switching between login/register/forgot within modal
        />
      )}

      {/* Saved Routes Modal */}
      {showSavedRoutes && user && ( // Only show if visible and user is logged in
        <SavedRoutesPanel
          isVisible={showSavedRoutes}
          onClose={() => setShowSavedRoutes(false)}
          onLoadRoute={handleLoadSavedRoute} // Pass wrapped load handler
          // Map interaction prevention
          onMouseEnter={handleOverlayEnter}
          onMouseLeave={handleOverlayLeave}
          onTouchStart={handleOverlayEnter}
          onTouchEnd={handleOverlayLeave}
        />
      )}

      {/* Route Type Selection Modal */}
      {showRouteTypeModal && (
        <RouteTypeSelectionModal
          isVisible={showRouteTypeModal}
          onClose={() => setShowRouteTypeModal(false)}
          onSelectType={handleRouteTypeSelect}
          currentType={routeType}
          computedRoutes={computedRoutes} // Pass all computed routes for display
          isLoading={routesAreLoading || !allRoutesComputed} // Show loading if calculating OR not all computed yet
          initialSkipPreference={skipRouteTypeSelection}
          onSkipPreferenceChange={handleSkipPreferenceChange}
          // Overlay prevents map interaction, no handlers needed here
        />
      )}


      {/* --- React Router Routes (for Pages/Overlays like Password Reset) --- */}
      <Routes>
        {/* Root path renders the main map UI defined above */}
        <Route path="/" element={null} />

        {/* Password Reset path renders the ResetPasswordForm as an overlay */}
        <Route
          path="/reset-password"
          element={<ResetPasswordForm />} // This component renders its own overlay
        />

        {/* Optional: Define a 404 Not Found component/route */}
        {/* <Route path="*" element={<NotFoundComponent />} /> */}
      </Routes>

    </div> // End app-container
  );
}

export default App;