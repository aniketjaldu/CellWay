"""
Service functions for route calculation, optimization, and cell coverage analysis.
Utilizes external routing APIs (e.g., GraphHopper, OSRM) and cell tower data to provide
optimized routes based on speed, cell coverage, or a balance of both.
"""
import logging
import random
from math import radians, cos, sin, asin, sqrt

import requests

from config import Config  # Use absolute imports from package root
from services.tower_service import find_towers_along_route, get_cell_towers

# Initialize logger for this module
log = logging.getLogger(__name__)

# --- Constants ---
DEFAULT_ALTERNATIVES = 5  # Default number of route alternatives to request from GraphHopper
MAX_ALTERNATIVES = 10  # Maximum number of route alternatives allowed
GRAPHOPPER_TIMEOUT = 120  # Timeout in seconds for GraphHopper API requests
OSRM_TIMEOUT = 60  # Timeout in seconds for OSRM API requests
TOWER_SEARCH_BUFFER = 0.1  # Buffer in degrees around route points for cell tower search area
TOWER_PROXIMITY_METERS = 2500  # Maximum distance in meters for a tower to be considered "along" the route
# Estimated "long route" threshold in km - routes longer than this will be checked for potential fallback
LONG_ROUTE_THRESHOLD_KM = 400  # GraphHopper free tier is typically limited to ~500km


# --- Utility Functions ---
def _haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points on the earth (in kilometers).
    Uses the Haversine formula.
    """
    # Convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    # Radius of earth in kilometers is 6371
    km = 6371 * c
    return km


# --- Private Helper Functions ---
def _parse_graphhopper_path(path_data: dict, profile: str = "car") -> dict | None:
    """
    Parses a single path (route) from a GraphHopper API response into a standardized route dictionary format.

    Args:
        path_data (dict): A single 'path' object from the GraphHopper JSON response.
        profile (str, optional): The routing profile used (e.g., 'car', 'bike', 'foot'). Defaults to 'car'.

    Returns:
        dict | None: A standardized route dictionary if parsing is successful, None otherwise (e.g., missing coordinates).
                     The dictionary includes route geometry, legs with steps/instructions, distance, duration, and other relevant details.
    """
    coordinates = []
    # Extract coordinates, assuming 'points_encoded=false' was requested to get decoded coordinates
    if "points" in path_data and "coordinates" in path_data["points"]:
        coordinates = path_data["points"]["coordinates"]  # GraphHopper coordinates are [longitude, latitude]
    else:
        log.warning("GraphHopper path data is missing 'points' coordinates. Cannot parse route geometry.")
        return None  # Indicate parsing failure due to missing coordinates

    route = {
        "geometry": {"coordinates": coordinates, "type": "LineString"},  # GeoJSON LineString geometry
        "legs": [],  # Will contain route legs (currently only one leg for point-to-point routes)
        "distance": path_data.get("distance", 0),  # Total route distance in meters
        "duration": path_data.get("time", 0) / 1000,  # Total route duration in seconds (GraphHopper returns milliseconds)
        "weight": path_data.get("weight", 0),  # Route weight (GraphHopper's internal optimization metric)
        "weight_name": "routability",  # Name of the weight metric (as per GraphHopper API documentation)
        "ascend": path_data.get("ascend", 0),  # Total ascent in meters along the route
        "descend": path_data.get("descend", 0),  # Total descent in meters along the route
        "profile_used": profile,  # Routing profile used for this route (e.g., 'car')
        "routing_provider": "graphhopper",  # Indicate which routing service provided this route
        # Add other relevant top-level route information here if needed
    }

    # Parse turn-by-turn instructions into route steps within a single leg
    if "instructions" in path_data and isinstance(path_data["instructions"], list):
        leg = {"steps": []}  # Initialize a leg to hold steps
        for instruction in path_data["instructions"]:
            interval = instruction.get("interval", [0, 0])  # Indices in the coordinates array for this step
            segment_coordinates = []
            if interval and len(interval) == 2 and coordinates:
                start_index = min(max(0, interval[0]), len(coordinates))  # Ensure start index is within bounds
                end_index = min(max(0, interval[1] + 1), len(coordinates))  # Ensure end index is within bounds (GraphHopper interval end is inclusive, Python slice exclusive)
                segment_coordinates = coordinates[start_index:end_index]  # Extract coordinates for this step's segment

            step = {
                "name": instruction.get("street_name", ""),  # Street name for the step
                "distance": instruction.get("distance", 0),  # Distance of the step in meters
                "duration": instruction.get("time", 0) / 1000,  # Duration of the step in seconds
                "geometry": {  # GeoJSON LineString geometry for the step
                    "coordinates": segment_coordinates,
                    "type": "LineString",
                },
                "maneuver": {  # Maneuver details for turn instructions
                    "type": instruction.get("sign", 0),  # GraphHopper turn instruction code (sign)
                    "modifier": instruction.get("text", ""),  # Text description of the maneuver
                    "exit_number": instruction.get("exit_number"),  # Exit number for roundabouts
                    "turn_angle": instruction.get("turn_angle"),  # Turn angle in degrees (optional)
                },
                "instruction_text": instruction.get("text", ""),  # Full text instruction
                "interval": interval,  # Original interval indices in the route coordinates
                # Could add road details parsed from 'details' if needed in the future (complex interval matching)
            }
            leg["steps"].append(step)  # Add step to the current leg
        route["legs"].append(leg)  # Add the leg to the route
    else:
        log.warning("GraphHopper path data is missing 'instructions'. Turn-by-turn navigation will not be available.")

    return route


def _parse_osrm_route(route_data: dict, profile: str = "car") -> dict | None:
    """
    Parses a route from an OSRM API response into a standardized route dictionary format.

    Args:
        route_data (dict): A route object from the OSRM JSON response.
        profile (str, optional): The routing profile used (e.g., 'car', 'bike', 'foot'). Defaults to 'car'.

    Returns:
        dict | None: A standardized route dictionary if parsing is successful, None otherwise.
                     The dictionary includes route geometry, legs with steps/instructions, distance, duration, and other relevant details.
    """
    if "geometry" not in route_data or "legs" not in route_data:
        log.warning("OSRM route data is missing required geometry or legs data.")
        return None

    # Extract coordinates from OSRM GeoJSON format
    coordinates = []
    if "coordinates" in route_data["geometry"]:
        coordinates = route_data["geometry"]["coordinates"]
    else:
        log.warning("OSRM geometry is missing coordinates. Cannot parse route.")
        return None

    route = {
        "geometry": {"coordinates": coordinates, "type": "LineString"},  # GeoJSON LineString geometry
        "legs": [],  # Will contain route legs
        "distance": route_data.get("distance", 0),  # Total route distance in meters
        "duration": route_data.get("duration", 0),  # Total route duration in seconds
        "weight": route_data.get("weight", 0),  # Route weight (OSRM's internal optimization metric)
        "weight_name": route_data.get("weight_name", "duration"),  # Name of the weight metric
        "routing_provider": "osrm",  # Indicate which routing service provided this route
        "profile_used": profile,  # Routing profile used for this route
    }

    # Process legs data
    for leg_data in route_data.get("legs", []):
        leg = {"steps": []}
        
        # Process steps
        for step_data in leg_data.get("steps", []):
            step = {
                "name": step_data.get("name", ""),
                "distance": step_data.get("distance", 0),
                "duration": step_data.get("duration", 0),
                "geometry": step_data.get("geometry", {"coordinates": [], "type": "LineString"}),
                "maneuver": step_data.get("maneuver", {}),
                "instruction_text": step_data.get("maneuver", {}).get("instruction", ""),
            }
            leg["steps"].append(step)
        
        route["legs"].append(leg)

    return route


def _calculate_graphhopper_routes(
    start_lat: float, start_lng: float, end_lat: float, end_lng: float, alternatives: int = DEFAULT_ALTERNATIVES
) -> dict:
    """
    Internal function to calculate multiple route alternatives using the GraphHopper API.

    Fetches route options between given coordinates, requesting a specified number of alternative routes.

    Args:
        start_lat (float): Latitude of the starting point.
        start_lng (float): Longitude of the starting point.
        end_lat (float): Latitude of the destination point.
        end_lng (float): Longitude of the destination point.
        alternatives (int, optional): Number of alternative routes to request from GraphHopper.
                                     Clamped between 1 and MAX_ALTERNATIVES. Defaults to DEFAULT_ALTERNATIVES.

    Returns:
        dict: A dictionary containing routing information.
              On success, includes 'code': 'Ok', 'routes' (list of parsed route dictionaries), and 'waypoints'.
              On failure, includes 'code': 'Error' or specific error code (e.g., 'PointNotFound', 'NoRoute'), and 'message' with error details.
    """
    log.info(
        f"Requesting {alternatives} GraphHopper route alternatives from ({start_lat:.6f}, {start_lng:.6f}) to ({end_lat:.6f}, {end_lng:.6f})."
    )

    if not Config.GRAPHHOPPER_KEY:
        log.error("GraphHopper API key is not configured. Route calculation cannot proceed.")
        return {"code": "Error", "message": "Routing service configuration error: API key missing."}

    # Check if this is potentially a long route that might exceed GraphHopper limits
    route_distance_km = _haversine_distance(start_lat, start_lng, end_lat, end_lng)
    if route_distance_km > LONG_ROUTE_THRESHOLD_KM:
        log.warning(f"Long route detected ({route_distance_km:.1f} km). GraphHopper may have difficulty with routes over {LONG_ROUTE_THRESHOLD_KM} km.")

    try:
        url = "https://graphhopper.com/api/1/route"
        num_alternatives = min(max(1, alternatives), MAX_ALTERNATIVES)  # Clamp alternatives to a valid range

        params = {
            "point": [f"{start_lat},{start_lng}", f"{end_lat},{end_lng}"],  # Start and end coordinates
            "profile": "car",  # Routing profile (currently car, could be parameterized)
            "algorithm": "alternative_route",  # Use alternative route algorithm
            "alternative_route.max_paths": num_alternatives,  # Number of alternatives to request
            "alternative_route.max_weight_factor": 1.8,  # Max weight factor for alternatives (diversity control)
            "alternative_route.max_share_factor": 0.8,  # Max share factor for alternatives (overlap control)
            "instructions": "true",  # Include turn-by-turn instructions in response
            "calc_points": "true",  # Include path geometry points in response
            "points_encoded": "false",  # Request coordinates in decoded format (longitude, latitude arrays)
            "key": Config.GRAPHHOPPER_KEY,  # API key for GraphHopper
            "locale": "en",  # Locale for instructions (English)
            "details": ["street_name", "time", "distance", "max_speed", "road_class"],  # Request route details
        }

        response = requests.get(url, params=params, timeout=GRAPHOPPER_TIMEOUT)
        response.raise_for_status()  # Raise HTTPError for 4xx/5xx responses
        data = response.json()  # Parse JSON response from GraphHopper

        # Check if GraphHopper returned any paths
        if "paths" not in data or not data["paths"]:
            error_message = data.get("message", "No route found")
            if "Cannot find point" in error_message:
                log.warning(f"GraphHopper: Point snapping failed. {error_message}")
                return {
                    "code": "PointNotFound",
                    "message": f"Could not find a valid road near the specified start or end point. {error_message}",
                }
            elif "Connection between locations not found" in error_message:
                log.warning(f"GraphHopper: No route found between locations. {error_message}")
                return {"code": "NoRoute", "message": "No route found between the specified start and end points."}
            else:
                log.warning(f"GraphHopper returned no paths. Response message: {error_message}")
                return {"code": "NoRoute", "message": "No route found."}

        log.info(f"GraphHopper API returned {len(data['paths'])} route alternatives.")

        parsed_routes = []
        for path in data["paths"]:
            parsed_route = _parse_graphhopper_path(path)  # Parse each path using helper function
            if parsed_route:
                parsed_routes.append(parsed_route)  # Add parsed route to the list

        if not parsed_routes:
            log.error("Failed to parse any route data from GraphHopper response.")
            return {"code": "Error", "message": "Failed to process route data received from routing service."}

        # Extract and format waypoints (start and end points)
        origin_coords = data.get("snapped_waypoints", {}).get("coordinates", [[start_lng, start_lat]])[0]  # Use snapped waypoints if available, otherwise original
        destination_coords = data.get("snapped_waypoints", {}).get("coordinates", [[end_lng, end_lat]])[-1]

        waypoints = [
            {"name": "Origin", "location": [origin_coords[0], origin_coords[1]]},  # [lng, lat]
            {"name": "Destination", "location": [destination_coords[0], destination_coords[1]]},  # [lng, lat]
        ]

        return {"code": "Ok", "routes": parsed_routes, "waypoints": waypoints}

    except requests.exceptions.Timeout:
        log.error("GraphHopper API request timed out after %s seconds.", GRAPHOPPER_TIMEOUT)
        return {"code": "Timeout", "message": "Routing service request timed out."}

    except requests.exceptions.RequestException as e:
        status_code = e.response.status_code if e.response else None
        error_message = "Routing service request failed"
        if status_code == 401:
            error_message = "Routing service authentication failed (Invalid API Key?)."
        elif status_code == 400:
            error_message = f"Invalid request to routing service: {e.response.json().get('message', 'Bad Request')}"
        elif status_code == 429:
            error_message = "Routing service rate limit exceeded. Please try again later."
        elif status_code >= 500:
            error_message = "Routing service is currently unavailable or encountered an internal error."

        log.error(f"GraphHopper API request failed: {e}. Status Code: {status_code}. Error Message: {error_message}")
        return {"code": "Error", "message": error_message}

    except Exception as e:
        log.exception("Unexpected error during GraphHopper route calculation: %s", e)
        return {"code": "Error", "message": "An unexpected error occurred during route calculation."}


def _calculate_osrm_route(
    start_lat: float, start_lng: float, end_lat: float, end_lng: float
) -> dict:
    """
    Calculate a route using the OSRM API as a fallback when GraphHopper fails.
    
    Args:
        start_lat (float): Latitude of the starting point.
        start_lng (float): Longitude of the starting point.
        end_lat (float): Latitude of the destination point.
        end_lng (float): Longitude of the destination point.
    
    Returns:
        dict: A dictionary containing routing information.
              On success, includes 'code': 'Ok', 'routes' (list of parsed route dictionaries), and 'waypoints'.
              On failure, includes 'code': 'Error' and 'message' with error details.
    """
    log.info(
        f"Using OSRM fallback routing service from ({start_lat:.6f}, {start_lng:.6f}) to ({end_lat:.6f}, {end_lng:.6f})."
    )
    
    try:
        # OSRM expects coordinates as lng,lat (opposite of most APIs)
        base_url = Config.OSRM_BASE_URL
        url = f"{base_url}/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}"
        
        params = {
            "overview": "full",  # Get full route geometry
            "geometries": "geojson",  # Return GeoJSON geometry format
            "steps": "true",     # Include step-by-step instructions
            "annotations": "true"  # Include additional route details
        }
        
        response = requests.get(url, params=params, timeout=OSRM_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        
        if data.get("code") != "Ok" or not data.get("routes"):
            error_message = data.get("message", "OSRM could not find a route")
            log.warning(f"OSRM routing failed: {error_message}")
            return {"code": "NoRoute", "message": error_message}
        
        parsed_routes = []
        for route in data["routes"]:
            parsed_route = _parse_osrm_route(route)
            if parsed_route:
                parsed_routes.append(parsed_route)
        
        if not parsed_routes:
            log.error("Failed to parse any route data from OSRM response.")
            return {"code": "Error", "message": "Failed to process route data from fallback routing service."}
        
        # Extract waypoints
        waypoints = []
        for waypoint in data.get("waypoints", []):
            waypoints.append({
                "name": waypoint.get("name", ""),
                "location": waypoint.get("location", [0, 0])  # [lng, lat]
            })
        
        return {"code": "Ok", "routes": parsed_routes, "waypoints": waypoints}
    
    except requests.exceptions.Timeout:
        log.error("OSRM API request timed out after %s seconds.", OSRM_TIMEOUT)
        return {"code": "Error", "message": "Fallback routing service request timed out."}
    
    except requests.exceptions.RequestException as e:
        log.error(f"OSRM API request failed: {e}")
        return {"code": "Error", "message": "Fallback routing service request failed."}
    
    except Exception as e:
        log.exception("Unexpected error during OSRM route calculation: %s", e)
        return {"code": "Error", "message": "An unexpected error occurred during fallback route calculation."}


def _calculate_route_with_fallback(
    start_lat: float, start_lng: float, end_lat: float, end_lng: float, alternatives: int = DEFAULT_ALTERNATIVES
) -> dict:
    """
    Calculates a route first using GraphHopper, falling back to OSRM if GraphHopper fails.
    This is particularly useful for long routes that might exceed GraphHopper's limits.
    
    Args:
        start_lat (float): Latitude of the starting point.
        start_lng (float): Longitude of the starting point.
        end_lat (float): Latitude of the destination point.
        end_lng (float): Longitude of the destination point.
        alternatives (int, optional): Number of route alternatives to try to get. Defaults to DEFAULT_ALTERNATIVES.
        
    Returns:
        dict: A dictionary containing routing information with results from either GraphHopper or OSRM.
    """
    # First try GraphHopper
    graphhopper_result = _calculate_graphhopper_routes(
        start_lat, start_lng, end_lat, end_lng, alternatives
    )
    
    # If GraphHopper succeeded, return its result
    if graphhopper_result.get("code") == "Ok":
        log.info("Successfully calculated route using GraphHopper.")
        return graphhopper_result
    
    # Check for specific failure conditions where we should try OSRM
    failure_code = graphhopper_result.get("code")
    
    # Determine if we should try the fallback
    should_try_fallback = (
        failure_code == "Timeout" or  # Timeout likely indicates a long, complex route
        failure_code == "Error" or    # General errors might be due to route complexity
        (
            # Check if this is potentially a long route that exceeds GraphHopper limits
            _haversine_distance(start_lat, start_lng, end_lat, end_lng) > LONG_ROUTE_THRESHOLD_KM
        )
    )
    
    if should_try_fallback:
        log.info(f"GraphHopper routing failed with code '{failure_code}'. Attempting fallback to OSRM.")
        osrm_result = _calculate_osrm_route(start_lat, start_lng, end_lat, end_lng)
        
        if osrm_result.get("code") == "Ok":
            log.info("Successfully calculated route using OSRM fallback.")
            return osrm_result
        else:
            log.error("Both GraphHopper and OSRM fallback failed to calculate a route.")
    
    # If fallback wasn't tried or also failed, return the original GraphHopper error
    return graphhopper_result


# --- Update the optimized route function to use the fallback routing mechanism ---
def _get_optimized_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float, optimization_type: str) -> dict:
    """
    Internal function orchestrating the route optimization process.

    Calculates route alternatives, retrieves cell tower data, selects the best route based on the specified optimization type,
    and formats the final response.

    Args:
        start_lat (float): Latitude of the starting point.
        start_lng (float): Longitude of the starting point.
        end_lat (float): Latitude of the destination point.
        end_lng (float): Longitude of the destination point.
        optimization_type (str): Route optimization type ('fastest', 'cell_coverage', 'balanced').

    Returns:
        dict: A dictionary containing the optimized route information.
              On success, includes 'code': 'Ok', 'routes' (list containing the selected route), 'waypoints', 'towers' (towers along the route),
              'optimization_type', and 'tower_data_source'.
              On failure, returns an error dictionary with 'code' and 'message' indicating the error.
    """
    # 1. Fetch route alternatives, using fallback if necessary
    route_alternatives_response = _calculate_route_with_fallback(start_lat, start_lng, end_lat, end_lng)

    if route_alternatives_response.get("code") != "Ok":
        log.error(f"Failed to get route alternatives for '{optimization_type}' optimization. Reason: {route_alternatives_response.get('message', 'Unknown error')}")
        return route_alternatives_response  # Return the error response

    alternative_routes = route_alternatives_response.get("routes", [])
    waypoints = route_alternatives_response.get("waypoints", [])
    
    # Check if we're using a fallback routing provider
    routing_provider = "graphhopper"  # Default
    if alternative_routes and alternative_routes[0].get("routing_provider"):
        routing_provider = alternative_routes[0].get("routing_provider")
        
    # 2. Get cell tower data for the route area
    # Rest of the function is the same - optimize route based on towers
    # ... existing optimization code ...
    
    # Add routing provider info to the response
    result = _select_optimized_routes(alternative_routes, [])  # Use the existing optimization function
    
    # 3. Get cell tower data for the route area
    bounds = _calculate_bounds_from_routes(alternative_routes)
    towers_in_area = get_cell_towers(bounds["min_lat"], bounds["min_lng"], bounds["max_lat"], bounds["max_lng"])

    # Find towers along each route
    for route in alternative_routes:
        if "geometry" in route and "coordinates" in route["geometry"]:
            route_coords = [(coord[1], coord[0]) for coord in route["geometry"]["coordinates"]]  # Convert from [lng, lat] to [lat, lng]
            route["towers"] = find_towers_along_route(route_coords, towers_in_area, TOWER_PROXIMITY_METERS)
        else:
            route["towers"] = []  # No geometry data, so no towers

    # 4. Select the optimized route based on the requested optimization type
    result = _select_optimized_routes(alternative_routes, towers_in_area)
    
    if result.get("code") != "Ok" or not result.get("routes"):
        log.error(f"Failed to select optimized route of type '{optimization_type}'.")
        return {"code": "Error", "message": "Failed to optimize route."}

    # Determine the optimized route from the result
    optimized_route = result["routes"][0]
    
    # Add the routing provider to the response
    result["routing_provider"] = routing_provider
    
    # 5. Format the response with the optimization type and tower data source
    result["optimization_type"] = optimization_type
    result["tower_data_source"] = "OpenCellId"  # Data source is currently fixed
    return result


def _select_optimized_routes(alternative_routes: list[dict], towers_in_area: list[dict]) -> dict:
    """
    Selects and ranks route alternatives based on optimization criteria: fastest, best cell coverage, and balanced.

    Scores each route based on duration and cell tower coverage, normalizes these scores, and selects the best route for each criterion.
    Attempts to select diverse routes to avoid returning the same route for different optimization types.

    Args:
        alternative_routes (list[dict]): List of parsed route dictionaries from `_calculate_graphhopper_routes`.
        towers_in_area (list[dict]): List of cell tower dictionaries in the relevant geographic area.

    Returns:
        dict: A dictionary containing the selected routes for each optimization type ('fastest', 'cell_coverage', 'balanced').
              Each optimization type maps to a dictionary with 'route' (the selected route dictionary) and 'towers' (list of towers along that route).
              Example: {'fastest': {'route': {...}, 'towers': [...]}, 'cell_coverage': {...}, 'balanced': {...}}
              If no routes are provided or selection fails, returns routes with 'route': None and 'towers': [].
    """
    if not alternative_routes:
        log.warning("_select_optimized_routes was called with no route alternatives. Returning default empty routes.")
        return {
            "fastest": {"route": None, "towers": []},
            "cell_coverage": {"route": None, "towers": []},
            "balanced": {"route": None, "towers": []},
        }

    routes_with_scores = []
    for index, route in enumerate(alternative_routes):
        route_coordinates = route.get("geometry", {}).get("coordinates", [])
        towers_along_route = find_towers_along_route(route_coordinates, towers_in_area, TOWER_PROXIMITY_METERS)  # Find towers along this specific route

        tower_count = len(towers_along_route)
        avg_signal_strength = -120  # Default weak signal if no towers are found
        if tower_count > 0:
            signal_sum = sum(tower.get("averageSignal", -120) for tower in towers_along_route)
            avg_signal_strength = signal_sum / tower_count

        duration = route.get("duration", float("inf"))  # Route duration, default to infinity if missing

        routes_with_scores.append(
            {
                "route": route,
                "towers": towers_along_route,
                "tower_count": tower_count,
                "avg_signal": avg_signal_strength,
                "duration": duration,
                "index": index,  # Keep original index for diversity considerations
            }
        )
        log.debug(
            f"Route {index}: Duration={duration:.0f}s, Towers={tower_count}, AvgSignal={avg_signal_strength:.1f}dBm"
        )

    if not routes_with_scores:  # Safety check, should not happen if alternative_routes was not empty
        return {
            "fastest": {"route": None, "towers": []},
            "cell_coverage": {"route": None, "towers": []},
            "balanced": {"route": None, "towers": []},
        }

    # --- Normalize scores for duration and signal strength (scale to 0-1, higher is better) ---
    min_duration = min(route_score["duration"] for route_score in routes_with_scores)
    max_duration = max(route_score["duration"] for route_score in routes_with_scores)
    duration_range = max(1, max_duration - min_duration)  # Avoid division by zero if all durations are the same

    min_signal = min(route_score["avg_signal"] for route_score in routes_with_scores)
    max_signal = max(route_score["avg_signal"] for route_score in routes_with_scores)
    signal_range = max(1, max_signal - min_signal)  # Avoid division by zero if all signals are the same

    for route_score in routes_with_scores:
        # Normalize duration (lower duration is better, so invert and scale)
        route_score["norm_duration"] = 1.0 - max(0, min(1, (route_score["duration"] - min_duration) / duration_range))
        # Normalize signal strength (higher signal is better)
        route_score["norm_signal"] = max(0, min(1, (route_score["avg_signal"] - min_signal) / signal_range))
        # Balanced score: weighted average of normalized duration and signal (adjust weights as needed)
        route_score["balanced_score"] = (route_score["norm_duration"] * 0.5) + (route_score["norm_signal"] * 0.5)
        log.debug(
            f"Route {route_score['index']} Normalized Scores: NormDur={route_score['norm_duration']:.2f}, NormSig={route_score['norm_signal']:.2f}, Balanced={route_score['balanced_score']:.2f}"
        )

    # --- Select best routes based on each optimization criteria (fastest, cell coverage, balanced) ---
    routes_sorted_by_duration = sorted(routes_with_scores, key=lambda x: x["duration"])  # Sort by duration (ascending) for fastest
    selected_fastest_route = routes_sorted_by_duration[0] if routes_sorted_by_duration else None

    routes_sorted_by_signal = sorted(
        routes_with_scores, key=lambda x: (-x["avg_signal"], -x["tower_count"])
    )  # Sort by signal (descending), then tower count (descending) for cell coverage
    selected_cell_route = routes_sorted_by_signal[0] if routes_sorted_by_signal else None

    routes_sorted_by_balanced = sorted(
        routes_with_scores, key=lambda x: -x["balanced_score"]
    )  # Sort by balanced score (descending) for balanced route
    selected_balanced_route = routes_sorted_by_balanced[0] if routes_sorted_by_balanced else None

    # --- Implement route diversity: ensure selected routes are different if possible ---
    selected_route_indices = set()  # Keep track of indices of already selected routes
    final_route_selection = {}

    # 1. Select fastest route
    final_route_selection["fastest"] = selected_fastest_route if selected_fastest_route else {"route": None, "towers": []}
    if selected_fastest_route:
        selected_route_indices.add(selected_fastest_route["index"])

    # 2. Select cell coverage route, ensure it's different from fastest if possible
    current_cell_route = selected_cell_route
    if current_cell_route and current_cell_route["index"] in selected_route_indices:
        for alternative_cell_route in routes_sorted_by_signal[1:]:  # Iterate through routes sorted by signal (excluding the best one)
            if alternative_cell_route["index"] not in selected_route_indices:
                current_cell_route = alternative_cell_route  # Use the next best signal route that is not already selected
                break  # Found a diverse route, break loop
    final_route_selection["cell_coverage"] = current_cell_route if current_cell_route else {"route": None, "towers": []}
    if current_cell_route:
        selected_route_indices.add(current_cell_route["index"])

    # 3. Select balanced route, ensure it's different from fastest and cell coverage if possible
    current_balanced_route = selected_balanced_route
    if current_balanced_route and current_balanced_route["index"] in selected_route_indices:
        for alternative_balanced_route in routes_sorted_by_balanced[1:]:  # Iterate through routes sorted by balanced score
            if alternative_balanced_route["index"] not in selected_route_indices:
                current_balanced_route = alternative_balanced_route  # Use the next best balanced route if not already selected
                break
    final_route_selection["balanced"] = current_balanced_route if current_balanced_route else {"route": None, "towers": []}


    log.info(
        f"Selected route indices - Fastest: {final_route_selection['fastest'].get('index', 'N/A')}, "
        f"Cell: {final_route_selection['cell_coverage'].get('index', 'N/A')}, "
        f"Balanced: {final_route_selection['balanced'].get('index', 'N/A')}"
    )

    return { # Structure the final output
        "fastest": {"route": final_route_selection["fastest"]["route"], "towers": final_route_selection["fastest"]["towers"]} if final_route_selection["fastest"]["route"] else {"route": None, "towers": []},
        "cell_coverage": {"route": final_route_selection["cell_coverage"]["route"], "towers": final_route_selection["cell_coverage"]["towers"]} if final_route_selection["cell_coverage"]["route"] else {"route": None, "towers": []},
        "balanced": {"route": final_route_selection["balanced"]["route"], "towers": final_route_selection["balanced"]["towers"]} if final_route_selection["balanced"]["route"] else {"route": None, "towers": []},
    }


# --- Public Service Functions ---
def get_route_fastest(start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> dict:
    """
    Public function to get the fastest route between given coordinates.

    Calls the internal `_get_optimized_route` function with 'fastest' optimization type.

    Args:
        start_lat (float): Latitude of the starting point.
        start_lng (float): Longitude of the starting point.
        end_lat (float): Latitude of the destination point.
        end_lng (float): Longitude of the destination point.

    Returns:
        dict: A dictionary containing the fastest route information (see `_get_optimized_route` return).
    """
    return _get_optimized_route(start_lat, start_lng, end_lat, end_lng, "fastest")


def get_route_cell_coverage(start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> dict:
    """
    Public function to get the route optimized for best cell coverage between given coordinates.

    Calls the internal `_get_optimized_route` function with 'cell_coverage' optimization type.

    Args:
        start_lat (float): Latitude of the starting point.
        start_lng (float): Longitude of the starting point.
        end_lat (float): Latitude of the destination point.
        end_lng (float): Longitude of the destination point.

    Returns:
        dict: A dictionary containing the cell coverage optimized route information (see `_get_optimized_route` return).
    """
    return _get_optimized_route(start_lat, start_lng, end_lat, end_lng, "cell_coverage")


def get_route_balanced(start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> dict:
    """
    Public function to get a balanced route between given coordinates, considering both speed and cell coverage.

    Calls the internal `_get_optimized_route` function with 'balanced' optimization type.

    Args:
        start_lat (float): Latitude of the starting point.
        start_lng (float): Longitude of the starting point.
        end_lat (float): Latitude of the destination point.
        end_lng (float): Longitude of the destination point.

    Returns:
        dict: A dictionary containing the balanced route information (see `_get_optimized_route` return).
    """
    return _get_optimized_route(start_lat, start_lng, end_lat, end_lng, "balanced")