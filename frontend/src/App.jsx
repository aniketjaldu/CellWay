import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import L from 'leaflet'; // Import Leaflet if needed for types or direct use

// Hooks
import { useAuth } from './hooks/useAuth';
import { useMap } from './hooks/useMap';
import { useRouting } from './hooks/useRouting';
import { useTowers } from './hooks/useTowers';
import { useMapInteraction } from './hooks/useMapInteraction';

// Components
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
import ResetPasswordForm from './components/Auth/ResetPasswordForm';

// Base Styles
import './App.css';

function App() {
  // --- UI State ---
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(true);
  const [showRouteTypeModal, setShowRouteTypeModal] = useState(false);
  const [skipRouteTypeSelection, setSkipRouteTypeSelection] = useState(() => {
      return localStorage.getItem('skipRouteTypeSelection') === 'true';
  });

  // --- Search State (Managed Here, Passed to SearchPanel) ---
  // This could also be moved into a dedicated useSearch hook
  const [originValue, setOriginValue] = useState('');
  const [destinationValue, setDestinationValue] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY; // Needed for geocoding
  
  // --- Refs ---
  const mapContainerRef = useRef(null); // Ref for the map div

  // --- State Management via Hooks ---
  const { user, login, register, logout, forgotPassword } = useAuth();
  const mapHookUtils = useMap(mapContainerRef, setOriginValue, setDestinationValue); // Pass the ref to the hook
  const { map, mapIsReady, updateMarker, displayRouteLine, clearRouteLine, displayLayerGroup, clearLayerGroup, flyTo, fitBounds, 
    setOriginValue: setOriginValueFromMapUtils, 
    setDestinationValue: setDestinationValueFromMapUtils } = mapHookUtils;

  const routingHookUtils = useRouting(map, user, {
    map, mapIsReady, updateMarker, displayRouteLine, clearRouteLine, displayLayerGroup, clearLayerGroup, flyTo, fitBounds,
    setOriginValue: setOriginValue,
    setDestinationValue: setDestinationValue,
  });
  const {
    routeType, setRouteType, currentRoutePoints, setCurrentRoutePoints, routeInfo,
    routesAreLoading, allRoutesComputed, computedRoutes, routeDirections, showDirectionsPanel,
    isDirectionsMinimized, activeDirectionStep, routeOriginDisplay, routeDestinationDisplay,
    savedRoutes, isLoadingSavedRoutes, setRouteDisplayNames, calculateAllRouteTypes,
    clearRoutingState, setActiveDirectionStep, toggleDirectionsMinimized, saveCurrentRoute,
    fetchSavedRoutes, loadSavedRoute: originalLoadSavedRoute
  } = routingHookUtils;

  // console.log("[App.jsx] RouteInfo before useTowers:", routeInfo);
  const routeGeometryForTowers = routeInfo?.routes?.[0]?.geometry;
  // console.log("[App.jsx] Route Geometry for useTowers:", routeGeometryForTowers);

  const {
    towersToDisplay, showTowers, toggleShowTowers, fetchTowersInBounds,
    allFetchedTowersCount, towerDataSource, isLoading: towersLoading,
  } = useTowers(map, routeGeometryForTowers); // Pass map and current route geometry

  const { isLocating, locateUser, preventMapInteraction } = useMapInteraction(map, handleLocationFound);

  // --- Effects ---
  // Effect to load initial route type preference
  useEffect(() => {
    const savedRouteType = localStorage.getItem('preferredRouteType');
    if (savedRouteType && ['fastest', 'cell_coverage', 'balanced'].includes(savedRouteType)) {
      setRouteType(savedRouteType); // Use setter from hook
    }
  }, [setRouteType]);

  // Effect to handle map clicks for clearing highlights (if map exists)
  useEffect(() => {
    if (!map) return;
    const handleMapClick = () => {
      setActiveDirectionStep(null); // Reset step index
      clearLayerGroup?.('highlight'); // Clear visual highlight using map util
    };
    map.on('click', handleMapClick);
    return () => { map.off('click', handleMapClick); };
  }, [map, setActiveDirectionStep, clearLayerGroup]);

  // App.jsx -> useEffect for moveend
  useEffect(() => {
    if (!map) return;

    map.on('moveend', () => {});

    return () => {
      map.off('moveend', () => {});
    };
  }, [map]);

  // --- Callbacks for Components ---

  const handleLoadSavedRoute = useCallback(async (route) => {
    if (!map) return;

    // Call the original load logic from the hook
    await originalLoadSavedRoute(route); // Assuming originalLoadSavedRoute is async or returns a promise

    // Wait a moment for map view potentially settling after fitBounds inside originalLoadSavedRoute
    await new Promise(resolve => setTimeout(resolve, 150)); // Adjust delay if needed

    // Now that fetchTowersInBounds is defined, call it
    if (fetchTowersInBounds) {
         try {
            const currentMapBounds = map.getBounds();
            if (currentMapBounds) {
                const apiBounds = {
                    min_lat: currentMapBounds.getSouthWest().lat,
                    min_lng: currentMapBounds.getSouthWest().lng,
                    max_lat: currentMapBounds.getNorthEast().lat,
                    max_lng: currentMapBounds.getNorthEast().lng,
                };
                // console.log("[App handleLoadSavedRoute] Triggering fetchTowersInBounds for bounds:", apiBounds);
                await fetchTowersInBounds(apiBounds); // Await if needed
            } else {
                 console.warn("[App handleLoadSavedRoute] Map bounds not available after loading route.");
            }
        } catch (error) {
             console.error("[App handleLoadSavedRoute] Error fetching towers:", error);
        }
    } else {
        console.warn("[App handleLoadSavedRoute] fetchTowersInBounds is not available.");
    }

}, [map, originalLoadSavedRoute, fetchTowersInBounds]); 

  // Geocoding (Direct MapTiler Call)
  const handleInputChange = useCallback(async (e, isOrigin) => {
    const value = e.target.value;
    const setValue = isOrigin ? setOriginValue : setDestinationValue;
    const setSuggestions = isOrigin ? setOriginSuggestions : setDestinationSuggestions;
    const setShowSuggestionsFn = isOrigin ? setShowOriginSuggestions : setShowDestinationSuggestions;

    // console.log(`[handleInputChange] isOrigin: ${isOrigin}, value: ${value}`);
    setValue(value);
    if (!value.trim() || !mapTilerKey) {
      setSuggestions([]); setShowSuggestionsFn(false); 
      // console.log(`[handleInputChange] No value or no mapTilerKey, suggestions cleared, showSuggestions set to false`); return;
    }
    try {
      const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(value)}.json?key=${mapTilerKey}&autocomplete=true&limit=5`);
      if (!response.ok) throw new Error(`Geocoding API error: ${response.statusText}`);
      const data = await response.json();
      setSuggestions(data?.features || []); setShowSuggestionsFn(true);
    } catch (error) {
      console.error('Error fetching geocoding suggestions:', error);
      setSuggestions([]); setShowSuggestionsFn(false);
    }
  }, [mapTilerKey]);

  const handleInputFocus = useCallback(async (isOrigin) => {
    // console.log(`[handleInputFocus] isOrigin: ${isOrigin} - Function called`);
    const suggestions = isOrigin ? originSuggestions : destinationSuggestions;
    const setShow = isOrigin ? setShowOriginSuggestions : setShowDestinationSuggestions;
    const inputValue = isOrigin ? originValue : destinationValue;

    if (inputValue) { // If input has a value (e.g., loaded route name)
      // Programmatically trigger suggestion fetch for the current value
      // console.log(`[handleInputFocus] Input has value: ${inputValue}, isOrigin: ${isOrigin} - Calling handleInputChange`);
      const mockEvent = { target: { value: inputValue } }; // Create a mock event
      await handleInputChange(mockEvent, isOrigin); // Call handleInputChange
      setShow(true); // Ensure suggestions dropdown is shown
      // console.log(`[handleInputFocus] After handleInputChange, showSuggestions set to true (isOrigin: ${isOrigin}), showOriginSuggestions: ${showOriginSuggestions}, showDestinationSuggestions: ${showDestinationSuggestions}`);
    } else if (suggestions.length > 0) { // Fallback to original logic if input is empty but suggestions exist
      setShow(true);
      // console.log(`[handleInputFocus] After handleInputChange, showSuggestions set to true (isOrigin: ${isOrigin}), showOriginSuggestions: ${showOriginSuggestions}, showDestinationSuggestions: ${showDestinationSuggestions}`);
    } else {
        setShow(true); // if no value but want to show empty suggestion, setShow(true) always
        // console.log(`[handleInputFocus] Input empty and no existing suggestions, showSuggestions set to true (isOrigin: ${isOrigin}), showOriginSuggestions: ${showOriginSuggestions}, showDestinationSuggestions: ${showDestinationSuggestions}`);
    }
  }, [originSuggestions, destinationSuggestions, originValue, destinationValue, handleInputChange, showOriginSuggestions, showDestinationSuggestions]);

  const handleInputBlur = useCallback((isOrigin) => {
    // Blur handled internally in SearchPanel now to manage suggestion click race condition
    if (isOrigin) setShowOriginSuggestions(false);
    else setShowDestinationSuggestions(false);
  }, []);

  const handleClearInput = useCallback((isOrigin) => {
    if (isOrigin) {
      setOriginValue(''); setOriginSuggestions([]); setShowOriginSuggestions(false);
      updateMarker?.(null, true); // Use map util
      setCurrentRoutePoints(prev => ({ ...prev, start: null }));
    } else {
      setDestinationValue(''); setDestinationSuggestions([]); setShowDestinationSuggestions(false);
      updateMarker?.(null, false); // Use map util
      setCurrentRoutePoints(prev => ({ ...prev, end: null }));
    }
    clearRoutingState(); // Clear route if either point is removed
  }, [updateMarker, setCurrentRoutePoints, clearRoutingState]);

  // Handle Suggestion Selection & Trigger Routing
  const handleSuggestionSelect = useCallback(async (suggestion, isOrigin) => {
    if (!map || !suggestion?.center) return;

    const [lng, lat] = suggestion.center;
    const latlng = L.latLng(lat, lng);
    const placeName = suggestion.place_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    // Update local state for inputs
    if (isOrigin) { setOriginValue(placeName); setShowOriginSuggestions(false); }
    else { setDestinationValue(placeName); setShowDestinationSuggestions(false); }

    // Update marker via map hook
    updateMarker?.(latlng, isOrigin);

    // Update route points via routing hook
    const newPoint = { lat, lng };
    const updatedPoints = isOrigin
      ? { start: newPoint, end: currentRoutePoints?.end }
      : { start: currentRoutePoints?.start, end: newPoint };
    setCurrentRoutePoints(updatedPoints);
    setRouteDisplayNames( // Update display names in routing hook
        isOrigin ? placeName : routeOriginDisplay,
        isOrigin ? routeDestinationDisplay : placeName
    );


    // --- Trigger Route Calculation if Both Points Are Set ---
    if (updatedPoints.start?.lat && updatedPoints.end?.lat) {
      const originLL = L.latLng(updatedPoints.start.lat, updatedPoints.start.lng);
      const destLL = L.latLng(updatedPoints.end.lat, updatedPoints.end.lng);

      fitBounds?.([originLL, destLL]); // Fit map via map util

      // Fetch towers around waypoints first
      const waypointPadding = 0.02;
      const initialBounds = { 
        min_lat: Math.min(originLL.lat, destLL.lat) - waypointPadding,
        min_lng: Math.min(originLL.lng, destLL.lng) - waypointPadding,
        max_lat: Math.max(originLL.lat, destLL.lat) + waypointPadding,
        max_lng: Math.max(originLL.lng, destLL.lng) + waypointPadding
      };
      // console.log("[App.jsx handleSuggestionSelect] Calculated initialBounds:", initialBounds);
      await fetchTowersInBounds(initialBounds); // Await tower fetch

      // Decide whether to show route type selection popup
      if (!skipRouteTypeSelection) {
        setShowRouteTypeModal(true);
        // Trigger calculation in background while modal is shown
        calculateAllRouteTypes(updatedPoints,
            isOrigin ? placeName : originValue, // Pass correct names
            isOrigin ? destinationValue : placeName
        );
      } else {
        // Calculate and immediately display preferred route type
        calculateAllRouteTypes(updatedPoints,
            isOrigin ? placeName : originValue,
            isOrigin ? destinationValue : placeName
        );
      }
      setShowSearchPanel(false); // Collapse search panel
    } else {
      flyTo?.(latlng, Math.max(map?.getZoom() || 14, 14)); // Fly to single point
    }
  }, [map, currentRoutePoints, updateMarker, setCurrentRoutePoints, fitBounds, flyTo, fetchTowersInBounds, skipRouteTypeSelection, calculateAllRouteTypes, setRouteDisplayNames, originValue, destinationValue]); // Added origin/dest values

  // Handle location found from useMapInteraction
  function handleLocationFound({ lat, lng, name, latlng }) {
    setOriginValue(name); // Update search input state
    updateMarker?.(latlng, true); // Update marker via map hook
    const newPoint = { lat, lng };
    const updatedPoints = { start: newPoint, end: currentRoutePoints?.end };
    setCurrentRoutePoints(updatedPoints); // Update routing hook state
    setRouteDisplayNames(name, routeDestinationDisplay); // Update display names

    if (updatedPoints.start?.lat && updatedPoints.end?.lat) {
      const destLL = L.latLng(updatedPoints.end.lat, updatedPoints.end.lng);
      fitBounds?.([latlng, destLL]);
      // Fetch towers etc. (similar logic as handleSuggestionSelect)
      const waypointPadding = 0.02;
      const initialBounds = {
          min_lat: Math.min(latlng.lat, destLL.lat) - waypointPadding,
          min_lng: Math.min(latlng.lng, destLL.lng) - waypointPadding,
          max_lat: Math.max(latlng.lat, destLL.lat) + waypointPadding,
          max_lng: Math.max(latlng.lng, destLL.lng) + waypointPadding
      };
      // console.log("[App.jsx handleLocationFound] Calculated initialBounds:", initialBounds)
      fetchTowersInBounds(initialBounds).then(() => {
          if (!skipRouteTypeSelection) {
            setShowRouteTypeModal(true);
            calculateAllRouteTypes(updatedPoints, name, destinationValue);
          } else {
            calculateAllRouteTypes(updatedPoints, name, destinationValue);
          }
      });
      setShowSearchPanel(false);
    } else {
      flyTo?.(latlng, Math.max(map?.getZoom() || 14, 14));
    }
  }

  // Handle route type selection from modal
  const handleRouteTypeSelect = useCallback((selectedType) => {
    setRouteType(selectedType); // Update preference via hook
    setShowRouteTypeModal(false); // Close modal
    // displayRoute is handled internally by setRouteType effect if needed
  }, [setRouteType]);

  // Handle skip preference change
  const handleSkipPreferenceChange = useCallback((shouldSkip) => {
    setSkipRouteTypeSelection(shouldSkip);
    localStorage.setItem('skipRouteTypeSelection', shouldSkip.toString());
    if (shouldSkip) { // Save current selection as preference if checking the box
      localStorage.setItem('preferredRouteType', routeType);
    }
  }, [routeType]);

  // Handle clicking a direction step
  const handleStepClick = useCallback((step, index) => {
      setActiveDirectionStep(index); // Update index state via hook
      // Highlighting logic moved to RouteHighlight component
  }, [setActiveDirectionStep]);

  // --- Map Interaction Prevention ---
  // Store cleanup function for overlays
  const interactionCleanupRef = useRef(null);
  const handleOverlayEnter = useCallback(() => {
      interactionCleanupRef.current = preventMapInteraction();
  }, [preventMapInteraction]);
  const handleOverlayLeave = useCallback(() => {
      interactionCleanupRef.current?.(); // Call cleanup function
      interactionCleanupRef.current = null;
  }, []);


  // console.log("Show Towers State:", showTowers);

  const handleSaveRouteClick = useCallback(() => {
    if (!mapContainerRef.current) {
      console.error("Save Route Error: Map container ref is not available.");
      toast.error("Cannot save route: Map container element not found.");
      return;
    }
    // Call the hook's function, passing the actual DOM element
    saveCurrentRoute(mapContainerRef.current);
  }, [saveCurrentRoute, mapContainerRef]);

  const openAuthModal = (mode) => {
    setAuthMode(mode);
    setShowAuthForm(true);
}

  // --- Render Logic ---
  return (
    <div className="app-container">
      <Toaster position="bottom-center" toastOptions={{ duration: 3000, /* ... */ }} />

      {/* Map Container - Renders the map div */}
      <MapContainer ref={mapContainerRef} className={showAuthForm || showSavedRoutes ? 'map-interactions-disabled' : ''}>
          {/* Render map-specific overlays here using map instance from hook */}
          {(() => { // Use an Immediately Invoked Function Expression (IIFE) for logging

              // Log the state variables right before the conditional check
              // console.log("[MapContainer Children Render Check]", {
              //     mapIsReady: mapIsReady,       // Is the map hook ready?
              //     mapExists: !!map,             // Does the map instance exist?
              //     showTowersState: showTowers,  // Is the toggle state true?
              //     towersAvailable: towersToDisplay.length // How many towers are ready?
              // });

              // Check conditions for rendering TowerMarkers
              const shouldRenderTowers = mapIsReady && map && showTowers;
              if (shouldRenderTowers) {
                  // console.log("--> Rendering TowerMarkers component.");
                  // Pass the necessary props
                  return <TowerMarkers map={map} towers={towersToDisplay} />;
              } else {
                  // console.log("--> NOT Rendering TowerMarkers component.");
                  // Optionally log which condition failed if needed for more detail
                  // if (!mapIsReady) console.log("   Reason: mapIsReady is false");
                  // if (!map) console.log("   Reason: map instance is null");
                  // if (!showTowers) console.log("   Reason: showTowers state is false");
              }

              // Check conditions for rendering RouteHighlight (add logs similarly if needed)
              const shouldRenderHighlight = mapIsReady && map && activeDirectionStep !== null && routeDirections?.steps[activeDirectionStep];
              if (shouldRenderHighlight) {
                  // console.log("--> Rendering RouteHighlight component for step:", activeDirectionStep);
                   return (
                       <RouteHighlight
                           map={map}
                           instruction={routeDirections.steps[activeDirectionStep]}
                           type={routeDirections.steps[activeDirectionStep].type}
                           // clearHighlight={clearLayerGroup} // clearHighlight might be handled internally now
                       />
                   );
              } else {
                   // console.log("--> NOT Rendering RouteHighlight component.");
              }

              return null; // Return null if neither component should render
          })()}
      </MapContainer>


      {/* Search Panel */}
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
        onToggleCellTowers={toggleShowTowers}
        allFetchedTowersCount={allFetchedTowersCount}
        routesAreLoading={routesAreLoading}
        // Map interaction prevention
        onMouseEnter={handleOverlayEnter}
        onMouseLeave={handleOverlayLeave}
        onTouchStart={handleOverlayEnter} // Use same handlers for touch
        onTouchEnd={handleOverlayLeave}
      />

      {/* Auth Buttons */}
      <AuthButtons
        user={user}
        onLoginClick={() => { openAuthModal('login'); }}
        onRegisterClick={() => { openAuthModal('register'); }}
        onLogoutClick={logout}
        onMyRoutesClick={() => setShowSavedRoutes(true)}
      />

      {/* Map Controls */}
      <MapControls
        isLocating={isLocating}
        onLocate={locateUser}
        isTowersVisible={showTowers}
        onToggleTowers={toggleShowTowers}
        currentRouteType={routeType}
        onSelectRouteType={() => {
            if (!currentRoutePoints.start || !currentRoutePoints.end) {
                toast.info("Please set Origin and Destination first.", { id: 'rt-select-no-points'}); return;
            }
            setShowRouteTypeModal(true);
            // Ensure calculations are triggered if modal is opened and routes aren't ready
            if (!allRoutesComputed && !routesAreLoading) {
                calculateAllRouteTypes(currentRoutePoints, originValue, destinationValue);
            }
        }}
        isRouteActive={!!routeInfo}
      />

      {/* Directions Panel */}
      <DirectionsPanel
        isVisible={showDirectionsPanel}
        isMinimized={isDirectionsMinimized}
        directions={routeDirections}
        originName={routeOriginDisplay}
        destinationName={routeDestinationDisplay}
        activeStepIndex={activeDirectionStep}
        onStepClick={handleStepClick}
        onToggleMinimize={toggleDirectionsMinimized}
        onClose={clearRoutingState} // Close button clears the route
        onSave={handleSaveRouteClick}
        canSave={!!user} // Only allow save if logged in
        // Map interaction prevention
        onMouseEnter={handleOverlayEnter}
        onMouseLeave={handleOverlayLeave}
        onTouchStart={handleOverlayEnter}
        onTouchEnd={handleOverlayLeave}
      />

      {/* Modals */}
      {showAuthForm && (
        <AuthForm
          mode={authMode}
          onClose={() => setShowAuthForm(false)}
          onLogin={login}
          onRegister={register}
          onForgotPassword={forgotPassword}
          onChangeMode={setAuthMode}
        />
      )}

      {showSavedRoutes && user && (
         <SavedRoutesPanel
            isVisible={showSavedRoutes}
            onClose={() => setShowSavedRoutes(false)}
            onLoadRoute={handleLoadSavedRoute}
            // Map interaction prevention
            onMouseEnter={handleOverlayEnter}
            onMouseLeave={handleOverlayLeave}
            onTouchStart={handleOverlayEnter}
            onTouchEnd={handleOverlayLeave}
         />
      )}

      {showRouteTypeModal && (
         <RouteTypeSelectionModal
            isVisible={showRouteTypeModal}
            onClose={() => setShowRouteTypeModal(false)}
            onSelectType={handleRouteTypeSelect}
            currentType={routeType}
            computedRoutes={computedRoutes}
            isLoading={routesAreLoading || !allRoutesComputed}
            initialSkipPreference={skipRouteTypeSelection}
            onSkipPreferenceChange={handleSkipPreferenceChange}
            // No map interaction props needed as overlay handles it
         />
      )}
      {/* --- Define Routes for Pages/Overlays --- */}
      <Routes>
          {/* Define the root path - renders nothing extra as main UI is outside */}
          <Route path="/" element={null} />

          {/* Define the reset password path */}
          <Route
              path="/reset-password"
              element={<ResetPasswordForm />}
          />

          {/* Optional: Define a catch-all for unknown routes */}
          {/* <Route path="*" element={<NotFoundComponent />} /> */}
        </Routes>

    </div>
  );
}

export default App;