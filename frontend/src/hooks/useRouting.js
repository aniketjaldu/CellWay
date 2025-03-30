import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import html2canvas from 'html2canvas';
import L from 'leaflet';
import * as api from '../services/api.js';
import { formatDistance, formatDuration, getRouteTypeIcon, getDirectionIcon, formatDate } from '../utils/formatting.js';
import { calculateSignalScore } from '../utils/geometry.js';

// --- JSDoc Type Definitions ---
/**
 * @typedef {object} Waypoint
 * @property {string} name
 * @property {number[]} location - [lng, lat]
 */
/**
 * @typedef {object} RouteStep
 * @property {string|number} type - Maneuver type
 * @property {string} instruction
 * @property {string} distanceFormatted
 * @property {number[]} [coordinates] - Start coordinate [lng, lat]
 * @property {string} [streetName]
 * @property {number[][]} [segmentCoordinates] - [[lng, lat], ...]
 */
/**
 * @typedef {object} RouteLeg
 * @property {RouteStep[]} steps
 */
/**
 * @typedef {object} RouteGeometry
 * @property {string} type - e.g., "LineString"
 * @property {number[][]} coordinates - [[lng, lat], ...]
 */
/**
 * @typedef {object} RouteObject
 * @property {RouteGeometry} geometry
 * @property {RouteLeg[]} legs
 * @property {number} distance
 * @property {number} duration
 * @property {number} [weight]
 * @property {string} [weight_name]
 * @property {number} [ascend]
 * @property {number} [descend]
 * @property {string} [profile_used]
 */
/**
 * @typedef {object} RouteApiResponse
 * @property {string} code - e.g., "Ok"
 * @property {RouteObject[]} routes
 * @property {Waypoint[]} waypoints
 * @property {TowerData[]} [towers]
 * @property {string} [optimization_type]
 * @property {string} [tower_data_source]
 * @property {string} [message] - Error message
 */
/**
 * @typedef {object} SavedRouteData Represents a route document from the database.
 * @property {string} _id
 * @property {string} user_id
 * @property {{place_name: string, lat: number, lng: number}} origin
 * @property {{place_name: string, lat: number, lng: number}} destination
 * @property {object.<string, RouteApiResponse>} route_data - Keys are route types ('fastest', etc.)
 * @property {string} route_type - The active type when saved
 * @property {string} [route_image]
 * @property {object} [route_geometry]
 * @property {boolean} [has_multiple_routes]
 * @property {string} [created_at] // Assuming ISO string date
 */
/** @typedef {object} TowerData */

// --- Helper: extractDirections ---
const extractDirections = (routeData, originName, destinationName) => {
    const route = routeData?.routes?.[0];
    const steps = route?.legs?.[0]?.steps;
    if (!route || !steps) { return null; }
    const signToManeuverType = (sign) => { const map = { '-98': 'uturn', '-8': 'uturn-left', '-7': 'keep-left', '-6': 'exit-roundabout', '-3': 'sharp-left', '-2': 'left', '-1': 'slight-left', '0': 'straight', '1': 'slight-right', '2': 'right', '3': 'sharp-right', '4': 'destination', '5': 'via', '6': 'roundabout', '7': 'keep-right', '8': 'uturn-right' }; return map[sign] || 'straight'; };
    let formattedSteps = [];
    const startName = originName || 'Origin';
    formattedSteps.push({ type: 'start', instruction: `Depart from ${startName}`, distanceFormatted: '', coordinates: steps[0]?.geometry?.coordinates?.[0] || route?.geometry?.coordinates?.[0] || null, segmentCoordinates: [] });
    steps.forEach((step) => { const maneuver = step.maneuver || {}; const type = signToManeuverType(maneuver.type); const name = step.name || ''; const distance = formatDistance(step.distance) || ''; let instruction = step.instruction_text || ''; if (!instruction) { if (type === 'straight') instruction = name ? `Continue on ${name}` : 'Continue straight'; else if (type.includes('left') || type.includes('right')) instruction = name ? `${type.replace('-', ' ')} onto ${name}` : type.replace('-', ' '); else if (type === 'roundabout') instruction = `Enter roundabout${name ? ` and take exit onto ${name}` : ''}`; else if (type === 'exit-roundabout') instruction = `Exit roundabout${name ? ` onto ${name}` : ''}`; else if (type === 'destination') instruction = `Arrive at ${destinationName || 'Destination'}`; else instruction = `${type}${name ? ` onto ${name}` : ''}`; instruction = instruction.charAt(0).toUpperCase() + instruction.slice(1); } formattedSteps.push({ type: type, instruction: instruction, distanceFormatted: distance, coordinates: step.geometry?.coordinates?.[0] || null, streetName: name, segmentCoordinates: step.geometry?.coordinates || [] }); });
    const endName = destinationName || 'Destination';
    const lastStep = formattedSteps[formattedSteps.length - 1];
    if (lastStep && lastStep.type !== 'destination') { const finalCoord = route.geometry?.coordinates?.[route.geometry.coordinates.length - 1]; formattedSteps.push({ type: 'destination', instruction: `Arrive at ${endName}`, distanceFormatted: '', coordinates: finalCoord || null, segmentCoordinates: finalCoord ? [finalCoord] : [] }); }
    return { distanceFormatted: formatDistance(route.distance) || 'N/A', durationFormatted: formatDuration(route.duration) || 'N/A', ascendFormatted: route.ascend > 0 ? `${Math.round(route.ascend)}m ↗️` : '', descendFormatted: route.descend > 0 ? `${Math.round(route.descend)}m ↘️` : '', steps: formattedSteps };
};

// --- Helper: getRouteLineColor ---
const getRouteLineColor = (type) => ({ fastest: '#4285F4', cell_coverage: '#0F9D58', balanced: '#F4B400' }[type] || '#666666');

/**
 * Custom hook for managing routing state, calculations, and interactions.
 * @param {L.Map | null} map
 * @param {{id: string} | null} user
 * @param {object | null} mapUtils - { displayRouteLine, clearRouteLine, fitBounds, updateMarker, clearLayerGroup, setOriginValue, setDestinationValue }
 * @returns {{ ... hook return values ... }}
 */
export const useRouting = (map, user, mapUtils) => {
  const { displayRouteLine, clearRouteLine, fitBounds, updateMarker, clearLayerGroup, setOriginValue, setDestinationValue } = mapUtils || {};

  const [routeType, setRouteTypeState] = useState('fastest');
  const [currentRoutePoints, setCurrentRoutePointsState] = useState({ start: null, end: null }); // {start: {lat, lng, place_name?}, end: {lat, lng, place_name?}}
  const [routeInfo, setRouteInfo] = useState(null);
  const [routesAreLoading, setRoutesAreLoading] = useState(false);
  const [allRoutesComputed, setAllRoutesComputed] = useState(false);
  const [computedRoutes, setComputedRoutes] = useState({ fastest: null, cell_coverage: null, balanced: null });
  /** @type {[object.<string, TowerData[]>, React.Dispatch<React.SetStateAction<object.<string, TowerData[]>>>]} */
  const [computedRouteTowers, setComputedRouteTowers] = useState({ fastest: [], cell_coverage: [], balanced: [] });
  const [routeDirections, setRouteDirections] = useState(null);
  const [showDirectionsPanel, setShowDirectionsPanel] = useState(false);
  const [isDirectionsMinimized, setIsDirectionsMinimized] = useState(false);
  const [activeDirectionStep, setActiveDirectionStepState] = useState(null);
  const [routeOriginDisplay, setRouteOriginDisplay] = useState('');
  const [routeDestinationDisplay, setRouteDestinationDisplay] = useState('');
  /** @type {[SavedRouteData[], React.Dispatch<React.SetStateAction<SavedRouteData[]>>]} */
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [isLoadingSavedRoutes, setIsLoadingSavedRoutes] = useState(false);
  const calculationAbortController = useRef(null);
  const routeLineLayerRef = useRef(null);

  const displayRoute = useCallback((routeData, displayedRouteType) => {
    if (!map || !displayRouteLine || !fitBounds) { console.error("displayRoute: Map or map utilities not available."); return; }
    const route = routeData?.routes?.[0];
    const geometry = route?.geometry?.coordinates;
    if (!route || !geometry) { console.error("displayRoute: No valid route/geometry for type:", displayedRouteType); clearRouteLine?.(); setRouteInfo(null); setRouteDirections(null); setShowDirectionsPanel(false); routeLineLayerRef.current = null; return; }
    try {
      const routeLatLngs = geometry.map(coord => L.latLng(coord[1], coord[0]));
      if (routeLatLngs.length < 2) throw new Error("Invalid route geometry");
      const routeLineLayer = displayRouteLine(routeLatLngs, { color: getRouteLineColor(displayedRouteType) });
      if (routeLineLayer) { fitBounds?.(routeLineLayer.getBounds()); routeLineLayerRef.current = routeLineLayer; }
      else { routeLineLayerRef.current = null; }
      const directions = extractDirections(routeData, routeOriginDisplay, routeDestinationDisplay);
      setRouteDirections(directions); setShowDirectionsPanel(!!directions); setIsDirectionsMinimized(false); setActiveDirectionStepState(null); clearLayerGroup?.('highlight');
      const towersForThisRoute = computedRouteTowers[displayedRouteType] || [];
      const signalQuality = calculateSignalScore(towersForThisRoute);
      setRouteInfo({ distance: route.distance, duration: route.duration, routeType: displayedRouteType, signalQuality: signalQuality, towerCount: towersForThisRoute.length, routes: routeData.routes });
    } catch (error) { console.error(`Error displaying route type ${displayedRouteType}:`, error); toast.error(`Error displaying ${displayedRouteType} route.`); clearRouteLine?.(); setRouteInfo(null); setRouteDirections(null); setShowDirectionsPanel(false); routeLineLayerRef.current = null; }
  }, [map, displayRouteLine, fitBounds, clearLayerGroup, routeOriginDisplay, routeDestinationDisplay, computedRouteTowers, clearRouteLine]); // Added clearRouteLine

  const setRouteType = useCallback((type) => {
    if (['fastest', 'cell_coverage', 'balanced'].includes(type)) {
      setRouteTypeState(type); localStorage.setItem('preferredRouteType', type);
      if (allRoutesComputed && computedRoutes[type]) { displayRoute(computedRoutes[type], type); }
      else if (allRoutesComputed && !computedRoutes[type]) { toast.error(`Route data for '${type}' is not available.`); }
    }
  }, [allRoutesComputed, computedRoutes, displayRoute]);

  const setCurrentRoutePoints = useCallback((points) => { setCurrentRoutePointsState(points); }, []);

  const clearRoutingState = useCallback(() => {
    calculationAbortController.current?.abort(); calculationAbortController.current = null;
    clearRouteLine?.(); clearLayerGroup?.('highlight');
    setCurrentRoutePointsState({ start: null, end: null }); setRouteInfo(null); setRoutesAreLoading(false);
    setAllRoutesComputed(false); setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null });
    setComputedRouteTowers({ fastest: [], cell_coverage: [], balanced: [] }); setRouteDirections(null);
    setShowDirectionsPanel(false); setIsDirectionsMinimized(false); setActiveDirectionStepState(null);
    setRouteOriginDisplay(''); setRouteDestinationDisplay(''); routeLineLayerRef.current = null;
  }, [clearRouteLine, clearLayerGroup]);

  const calculateAllRouteTypes = useCallback(async (points, originName, destName) => {
    if (!points?.start?.lat || !points?.end?.lat) { toast.error("Cannot calculate route: Origin or Destination missing."); return; }
    if (routesAreLoading) { console.warn("Route calculation already in progress."); return; }
    calculationAbortController.current?.abort(); calculationAbortController.current = new AbortController(); const { signal } = calculationAbortController.current;
    setRoutesAreLoading(true); setAllRoutesComputed(false); setComputedRoutes({ fastest: null, cell_coverage: null, balanced: null });
    setComputedRouteTowers({ fastest: [], cell_coverage: null, balanced: [] }); clearRouteLine?.(); setRouteDirections(null);
    setShowDirectionsPanel(false); setRouteOriginDisplay(originName || ''); setRouteDestinationDisplay(destName || ''); routeLineLayerRef.current = null;
    const { start, end } = points; const typesToCalculate = ['fastest', 'cell_coverage', 'balanced'];
    let calculationSuccess = false, firstSuccessfulRouteData = null, firstSuccessfulRouteType = null;
    try {
      const results = await Promise.all(typesToCalculate.map(type =>
        api.fetchRoute(start.lat, start.lng, end.lat, end.lng, type)
          .then(response => { if (response.data?.code === 'Ok' && response.data.routes?.[0]?.geometry) { return { type, data: response.data }; } else { throw new Error(response.data?.message || `Backend failed for ${type}`); } })
          .catch(error => { if (error.name === 'AbortError' || signal.aborted) { return { type, error: 'Aborted' }; } console.error(`Failed to calculate '${type}' route:`, error.message || error); toast.error(`Failed to calculate ${type} route.`, { id: `calc-err-${type}` }); return { type, error: error.message || 'Calculation failed' }; })
      ));
      if (signal.aborted) { setRoutesAreLoading(false); return; }
      const newComputedRoutes = {}; const newComputedRouteTowers = {};
      results.forEach(result => { if (result.data) { newComputedRoutes[result.type] = result.data; newComputedRouteTowers[result.type] = result.data.towers || []; calculationSuccess = true; if (!firstSuccessfulRouteData) { firstSuccessfulRouteData = result.data; firstSuccessfulRouteType = result.type; } } else { newComputedRoutes[result.type] = null; newComputedRouteTowers[result.type] = []; } });
      setComputedRoutes(newComputedRoutes); setComputedRouteTowers(newComputedRouteTowers);
      if (!calculationSuccess) throw new Error("All route calculations failed or were aborted.");
      const typeToDisplay = newComputedRoutes[routeType] ? routeType : firstSuccessfulRouteType;
      const routeDataToDisplay = newComputedRoutes[typeToDisplay];
      if (routeDataToDisplay) { displayRoute(routeDataToDisplay, typeToDisplay); } else { console.error("No routes available to display."); toast.error("Could not display any route."); }
    } catch (error) { if (error.name !== 'AbortError' && !signal.aborted) { console.error('Error during route calculation process:', error); toast.error(error.message || "An unexpected error occurred calculating routes."); } clearRouteLine?.(); routeLineLayerRef.current = null; }
    finally { if (!signal.aborted) { setRoutesAreLoading(false); setAllRoutesComputed(true); calculationAbortController.current = null; } }
   }, [routesAreLoading, routeType, clearRouteLine, displayRoute]);

  const setActiveDirectionStep = useCallback((index) => { setActiveDirectionStepState(index); }, []);

  const toggleDirectionsMinimized = useCallback(() => { setIsDirectionsMinimized(prev => !prev); }, []);

  const fetchSavedRoutes = useCallback(async () => {
    if (!user) return; setIsLoadingSavedRoutes(true);
    try { const response = await api.fetchSavedRoutes(); /** @type {SavedRouteData[]} */ const routes = (response.data || []).map(route => ({ ...route, _id: String(route._id), user_id: String(route.user_id) })); setSavedRoutes(routes); }
    catch (error) { console.error("Error fetching saved routes:", error); setSavedRoutes([]); }
    finally { setIsLoadingSavedRoutes(false); }
  }, [user]);

  useEffect(() => { if (user) { fetchSavedRoutes(); } else { setSavedRoutes([]); } }, [user, fetchSavedRoutes]);

  // --- Helper function to capture map area --- Moved outside saveCurrentRoute
  const captureMapArea = useCallback(async (mapContainerElement, lat, lng, zoom, icon) => {
      if (!map) throw new Error("Map instance not available for capture.");
      if (!mapContainerElement || !document.body.contains(mapContainerElement)) {
          throw new Error("Map container element not valid or not attached for capture.");
      }
      map.setView([lat, lng], zoom);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for view/tiles
      const marker = L.marker([lat, lng], { icon: icon, zIndexOffset: 2000 }).addTo(map);
      await new Promise(resolve => setTimeout(resolve, 100)); // Delay after adding marker
      if (!mapContainerElement || !document.body.contains(mapContainerElement)) {
          map.removeLayer(marker); throw new Error("Map container detached before capture.");
      }
      const canvas = await html2canvas(mapContainerElement, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (element) => { // More robust ignoreElements
            if (!(element instanceof Node)) {
                console.warn("ignoreElements: Received non-Node element:", element); // Log non-Node elements
                return false; // Default to not ignoring if not a Node
            }
            return element.closest('.leaflet-control-container');
        }
      });
      map.removeLayer(marker);
      return canvas;
  }, [map]); // Depends only on map instance

  // --- Save Current Route ---
  const saveCurrentRoute = useCallback(async (mapContainerElement) => {
    const currentType = routeInfo?.routeType;
    const currentFullRouteData = currentType ? computedRoutes[currentType] : null;
    const currentRouteObject = currentFullRouteData?.routes?.[0];
    if (!user) { toast.error("Please log in to save routes."); return; }
    if (!map) { toast.error("Map not available."); return; }
    if (!mapContainerElement || !document.body.contains(mapContainerElement)) {
      toast.error("Map container element not valid or not attached for capture.");
      return;
    }
    if (!currentRouteObject || !currentRoutePoints?.start || !currentRoutePoints?.end) {
      toast.error("No valid route to save."); return; }
    if (!routeOriginDisplay || !routeDestinationDisplay) {
      toast.error("Origin or Destination name missing.");
      return;
    }
    const saveToastId = toast.loading("Preparing route snapshot...", { id: 'save-route-start' });

    let originalCenter = null, originalZoom = null; const hiddenElementsInfo = [];

    const tempOriginIcon = L.divIcon({
      className: 'save-capture-marker origin',
      html: `<div style="background-color: #2A93EE; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5);"></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    const tempDestIcon = L.divIcon({
      className: 'save-capture-marker destination',
      html: `<div style="background-color: #EE2A2A; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5);"></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    try {
      originalCenter = map.getCenter(); originalZoom = map.getZoom();

      const selectorsToHide = ['.search-panel-container', '.search-button-container', '.auth-buttons-container', '.map-controls-container', '.directions-panel-container', '.leaflet-control-container'];
      document.querySelectorAll(selectorsToHide.join(', ')).forEach(el => {
        hiddenElementsInfo.push({
          element: el,
          originalDisplay: el.style.display
        });
        el.style.setProperty('display', 'none', 'important');
      });
      clearRouteLine?.();
      updateMarker?.(null, true); updateMarker?.(null, false);

      map.invalidateSize();
      await new Promise(resolve => setTimeout(resolve, 300));

      toast.loading("Capturing origin...", { id: saveToastId });
      const originCanvas = await captureMapArea(mapContainerElement, currentRoutePoints.start.lat, currentRoutePoints.start.lng, 21, tempOriginIcon);
      toast.loading("Capturing destination...", { id: saveToastId });
      const destCanvas = await captureMapArea(mapContainerElement, currentRoutePoints.end.lat, currentRoutePoints.end.lng, 21, tempDestIcon);

      if (originalCenter && originalZoom != null) {
         map.setView(originalCenter, originalZoom, {
          animate: false
        });
      }
      hiddenElementsInfo.forEach(({ element, originalDisplay }) => {
        element.style.display = originalDisplay || '';
      });
      const currentRouteObjectForRestore = currentFullRouteData?.routes?.[0];

      if (currentRouteObjectForRestore?.geometry?.coordinates) {
        const routeLatLngs = currentRouteObjectForRestore.geometry.coordinates.map(coord => L.latLng(coord[1], coord[0]));
        displayRouteLine?.(routeLatLngs, {
          color: getRouteLineColor(currentType)
        });
      }
      if (currentRoutePoints.start) updateMarker?.(L.latLng(currentRoutePoints.start.lat, currentRoutePoints.start.lng), true);
      if (currentRoutePoints.end) updateMarker?.(L.latLng(currentRoutePoints.end.lat, currentRoutePoints.end.lng), false);
      map.invalidateSize();
      await new Promise(resolve => setTimeout(resolve, 100));

      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = originCanvas.width * 2;
      combinedCanvas.height = originCanvas.height;

      const combinedCtx = combinedCanvas.getContext('2d');
      if (!combinedCtx) throw new Error("Failed to get 2D context.");

      combinedCtx.drawImage(originCanvas, 0, 0);
      combinedCtx.drawImage(destCanvas, originCanvas.width, 0);

      const routeImage = combinedCanvas.toDataURL('image/jpeg', 0.8);

      toast.loading("Saving route data...", { id: saveToastId });

      const allRouteData = {};
      const allRouteGeometry = {};
      let hasMultipleRoutes = false;

      Object.keys(computedRoutes).forEach(type => {
        if (computedRoutes[type]) {
          allRouteData[type] = computedRoutes[type];
          if (computedRoutes[type].routes?.[0]?.geometry?.coordinates) {
            allRouteGeometry[type] = {
              coordinates: computedRoutes[type].routes[0].geometry.coordinates
            };
          }
          if (Object.keys(allRouteData).length > 1) hasMultipleRoutes = true;
        }
      });

      const saveData = {
        origin: {
          place_name: routeOriginDisplay,
          lat: currentRoutePoints.start.lat,
          lng: currentRoutePoints.start.lng
        },
        destination: {
          place_name: routeDestinationDisplay,
          lat: currentRoutePoints.end.lat,
          lng: currentRoutePoints.end.lng
        },
        route_data: allRouteData,
        route_type: currentType,
        route_image: routeImage,
        route_geometry: allRouteGeometry,
        has_multiple_routes: hasMultipleRoutes
      };
      const response = await api.saveRoute(saveData);

      if (response.data?.success) {
        toast.success("Route saved successfully!", {
          id: saveToastId
        });
        fetchSavedRoutes();
      }else { throw new Error(response.data?.error || "Failed to save route."); }
    } catch (error) {
      console.error("Error during saveCurrentRoute:", error);
      toast.error(`Error saving route: ${error.message}`, { id: saveToastId });
      hiddenElementsInfo.forEach(({ element, originalDisplay }) => {
        element.style.display = originalDisplay || '';
      });
      if (map) {
        const currentRouteObjectOnError = currentFullRouteData?.routes?.[0];
        if (currentRouteObjectOnError?.geometry?.coordinates) {
          const routeLatLngs = currentRouteObjectOnError.geometry.coordinates.map(coord => L.latLng(coord[1], coord[0]));
          displayRouteLine?.(routeLatLngs, {
            color: getRouteLineColor(currentType)
          });
        }
        if (currentRoutePoints.start) updateMarker?.(L.latLng(currentRoutePoints.start.lat, currentRoutePoints.start.lng), true);
        if (currentRoutePoints.end) updateMarker?.(L.latLng(currentRoutePoints.end.lat, currentRoutePoints.end.lng), false);
        if (originalCenter && originalZoom != null) {
          map.setView(originalCenter, originalZoom, {
          animate: false
        });
      } map.invalidateSize();
    }
    }
  }, [ user, map, routeInfo, computedRoutes, currentRoutePoints, routeOriginDisplay, routeDestinationDisplay, fetchSavedRoutes, displayRouteLine, clearRouteLine, updateMarker, captureMapArea ]);

  const loadSavedRoute = useCallback(async (route) => {
    if (!map || !route?.origin?.lat || !route?.destination?.lat || !route?.route_data) {
      console.error("Cannot load saved route:", route);
      toast.error("Could not load the selected route.");
      return;
    }
    // console.log("loadSavedRoute: Loading route:", route._id);

    clearRoutingState();

    const originLL = L.latLng(route.origin.lat, route.origin.lng);
    const destLL = L.latLng(route.destination.lat, route.destination.lng);
    const originName = route.origin.place_name || `${route.origin.lat.toFixed(5)}, ${route.origin.lng.toFixed(5)}`;
    const destName = route.destination.place_name || `${route.destination.lat.toFixed(5)}, ${route.destination.lng.toFixed(5)}`;
    const savedActiveType = route.route_type || 'balanced';

    // console.log("loadSavedRoute: originName:", originName, "destName:", destName); 
    // console.log("loadSavedRoute: mapUtils:", mapUtils);
    // console.log("loadSavedRoute: mapUtils.setOriginValue:", mapUtils?.setOriginValue);
    // console.log("loadSavedRoute: mapUtils.setDestinationValue:", mapUtils?.setDestinationValue);


    // Update Search Bar Values
    setOriginValue?.(originName); // Or simply: setOriginValue?.(originName); now that we've destructured
    setDestinationValue?.(destName); // Or simply: setDestinationValue?.(destName);

    setCurrentRoutePointsState({ start: route.origin, end: route.destination }); 
    setRouteOriginDisplay(originName); 
    setRouteDestinationDisplay(destName);
    setRouteTypeState(savedActiveType);

    const newComputed = {
      fastest: null,
      cell_coverage: null,
      balanced: null
    };
    const newTowers = {
      fastest: [],
      cell_coverage: [],
      balanced: []
    };
    let availableTypes = 0;

    if (typeof route.route_data === 'object') {
      Object.keys(newComputed).forEach(type => {
        if (route.route_data[type]) {
          newComputed[type] = route.route_data[type];
          newTowers[type] = route.route_data[type].towers || []; availableTypes++;
        }
      });
    } else {
      newComputed[savedActiveType] = route.route_data;
      newTowers[savedActiveType] = route.route_data.towers || [];
      availableTypes = 1;
    }

    setComputedRoutes(newComputed);
    setComputedRouteTowers(newTowers);
    setAllRoutesComputed(true);
    setRoutesAreLoading(false);

    const routeToDisplay = newComputed[savedActiveType];
    if (routeToDisplay) {
      displayRoute(routeToDisplay, savedActiveType);
    } else {
      console.error("Data for saved active route type not found:", savedActiveType);
      toast.error("Could not display saved route data.");
    }
    fitBounds?.([originLL, destLL]);
    // **** ADD MARKERS FOR LOADED ROUTE ****
    updateMarker?.(originLL, true);
    updateMarker?.(destLL, false);

    await new Promise(resolve => setTimeout(resolve, 100));

    // **** END MARKER UPDATE ****
    if (availableTypes > 1) {
      toast.success(`Loaded route. Multiple options available.`, { duration: 4000 });
    } else {
      toast.success(`Loaded saved route (${savedActiveType}).`);
    }
  }, [map, updateMarker, clearRoutingState, displayRoute, fitBounds, setOriginValue, setDestinationValue, mapUtils]);

  return {
    routeType,
    currentRoutePoints,
    routeInfo,
    routesAreLoading,
    allRoutesComputed,
    computedRoutes,
    routeDirections,
    showDirectionsPanel,
    isDirectionsMinimized,
    activeDirectionStep,
    routeOriginDisplay,
    routeDestinationDisplay,
    savedRoutes,
    isLoadingSavedRoutes,
    setRouteType,
    setCurrentRoutePoints,
    setRouteDisplayNames: (origin, dest) => {
      setRouteOriginDisplay(origin);
      setRouteDestinationDisplay(dest);
    },
    calculateAllRouteTypes,
    clearRoutingState,
    setActiveDirectionStep,
    toggleDirectionsMinimized,
    saveCurrentRoute,
    fetchSavedRoutes,
    loadSavedRoute,
  };
};