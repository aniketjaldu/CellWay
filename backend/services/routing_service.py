"""
Service functions for route calculation, optimization, and cell coverage analysis.
Utilizes external routing APIs (e.g., GraphHopper) and cell tower data to provide
optimized routes based on speed, cell coverage, or a balance of both.
"""
import logging
import random

import requests

from config import Config  # Use absolute imports from package root
from services.tower_service import find_towers_along_route, get_cell_towers

# Initialize logger for this module
log = logging.getLogger(__name__)

# --- Constants ---
DEFAULT_ALTERNATIVES = 5  # Default number of route alternatives to request from GraphHopper
MAX_ALTERNATIVES = 10  # Maximum number of route alternatives allowed
GRAPHOPPER_TIMEOUT = 20  # Timeout in seconds for GraphHopper API requests
TOWER_SEARCH_BUFFER = 0.1  # Buffer in degrees around route points for cell tower search area
TOWER_PROXIMITY_METERS = 2500  # Maximum distance in meters for a tower to be considered "along" the route


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
        return {"code": "Error", "message": "Routing service request timed out."}

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
    # 1. Fetch route alternatives from GraphHopper API
    route_alternatives_response = _calculate_graphhopper_routes(start_lat, start_lng, end_lat, end_lng)

    if route_alternatives_response.get("code") != "Ok":
        log.error(f"Failed to get route alternatives for '{optimization_type}' optimization. Reason: {route_alternatives_response.get('message', 'Unknown error')}")
        return route_alternatives_response  # Return the error response from GraphHopper

    alternative_routes = route_alternatives_response.get("routes", [])
    waypoints = route_alternatives_response.get("waypoints", [])

    if not alternative_routes:  # Double check for empty routes even with 'Ok' code
        log.error("No route alternatives returned from routing service despite 'Ok' status. Route calculation failed.")
        return {"code": "NoRoute", "message": "No routes found between the specified points."}

    # 2. Fetch cell towers in the vicinity of the route
    min_latitude = min(start_lat, end_lat) - TOWER_SEARCH_BUFFER
    max_latitude = max(start_lat, end_lat) + TOWER_SEARCH_BUFFER
    min_longitude = min(start_lng, end_lng) - TOWER_SEARCH_BUFFER
    max_longitude = max(start_lng, end_lng) + TOWER_SEARCH_BUFFER

    cell_towers_data = get_cell_towers(min_latitude, min_longitude, max_latitude, max_longitude)
    all_cell_towers_in_area = cell_towers_data.get("towers", [])
    tower_data_source_info = cell_towers_data.get("source", "unknown")
    log.info(f"Fetched {len(all_cell_towers_in_area)} cell towers (source: {tower_data_source_info}) within the route area.")

    # 3. Select the optimized route based on the specified optimization_type
    optimized_route_selection = _select_optimized_routes(alternative_routes, all_cell_towers_in_area)
    selected_route_information = optimized_route_selection.get(optimization_type)

    if not selected_route_information or not selected_route_information.get("route"): # Fallback to fastest if selected type fails
        log.error(f"Could not determine a suitable route for '{optimization_type}'. Falling back to fastest route.")
        fastest_route_fallback = optimized_route_selection.get("fastest")
        if fastest_route_fallback and fastest_route_fallback.get("route"):
            selected_route_information = fastest_route_fallback # Use fastest as fallback
        else:
            return {"code": "NoRoute", "message": f"Could not determine any suitable route for '{optimization_type}'."} # If even fastest fails, return error

    # 4. Construct and return the final result object
    final_route = selected_route_information["route"]
    final_towers_along_route = selected_route_information["towers"]

    result = {
        "code": "Ok",
        "routes": [final_route],  # API expects 'routes' as a list
        "waypoints": waypoints,
        "towers": final_towers_along_route,  # Cell towers along the selected route
        "optimization_type": optimization_type,  # Indicate the type of route optimization
        "tower_data_source": tower_data_source_info,  # Source of cell tower data
    }
    log.info(
        f"Successfully calculated and selected '{optimization_type}' route. Distance: {final_route.get('distance', 0):.0f}m, Duration: {final_route.get('duration', 0):.0f}s, Towers along route: {len(final_towers_along_route)}"
    )
    return result


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