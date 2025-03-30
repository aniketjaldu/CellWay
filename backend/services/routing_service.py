"""
Service functions for calculating routes using external APIs (e.g., GraphHopper)
and applying optimization logic based on speed and cell coverage.
"""
import requests
import logging
import random
# Use absolute imports from package root
from config import Config
from services.tower_service import get_cell_towers, find_towers_along_route

log = logging.getLogger(__name__)

# --- Constants ---
DEFAULT_ALTERNATIVES = 5 # How many alternatives to request from GraphHopper
MAX_ALTERNATIVES = 10
GRAPHOPPER_TIMEOUT = 20 # Seconds
TOWER_SEARCH_BUFFER = 0.1 # Degrees buffer around route points for tower fetching
TOWER_PROXIMITY_METERS = 2500 # Max distance for a tower to be considered "along" the route

# --- Private Helper Functions ---

def _parse_graphhopper_path(path_data, profile='car'):
    """
    Helper to parse a single path from GraphHopper response into a standardized format.

    Args:
        path_data (dict): A single path object from the GraphHopper JSON response.
        profile (str): The routing profile used (e.g., 'car').

    Returns:
        dict: A standardized route dictionary.
    """
    coordinates = []
    # Ensure points are decoded correctly (points_encoded=false was requested)
    if 'points' in path_data and 'coordinates' in path_data['points']:
        # GraphHopper returns [lng, lat]
        coordinates = path_data['points']['coordinates']
    else:
            log.warning("GraphHopper path missing points coordinates.")
            # Cannot proceed without coordinates
            return None

    route = {
        'geometry': {
            'coordinates': coordinates, # [[lng, lat], ...]
            'type': 'LineString'
        },
        'legs': [], # Structure to hold steps/instructions
        'distance': path_data.get('distance', 0), # Meters
        'duration': path_data.get('time', 0) / 1000,  # Convert ms to seconds
        'weight': path_data.get('weight', 0), # GraphHopper's internal weight
        'weight_name': 'routability', # As per API docs (often time/distance based)
        'ascend': path_data.get('ascend', 0), # Meters
        'descend': path_data.get('descend', 0), # Meters
        'profile_used': profile,
        # Add other top-level info if needed, e.g., snapped_waypoints
    }

    # Parse instructions into steps within a single leg
    if 'instructions' in path_data and isinstance(path_data['instructions'], list):
        leg = {'steps': []}
        for instruction in path_data['instructions']:
            interval = instruction.get('interval', [0, 0]) # [start_index, end_index] in points array
            segment_coordinates = []
            if interval and len(interval) == 2 and coordinates:
                # Ensure indices are within bounds of the main coordinate list
                start_idx = min(max(0, interval[0]), len(coordinates))
                # GraphHopper interval end index is inclusive, Python slice is exclusive
                end_idx = min(max(0, interval[1] + 1), len(coordinates))
                segment_coordinates = coordinates[start_idx:end_idx]

            step = {
                'name': instruction.get('street_name', ''), # Road name for the step
                'distance': instruction.get('distance', 0), # Meters
                'duration': instruction.get('time', 0) / 1000, # Seconds
                'geometry': { # Geometry specific to this step/instruction
                    'coordinates': segment_coordinates,
                    'type': 'LineString'
                },
                'maneuver': {
                    # Use 'sign' as a primary indicator, fallback to text interpretation if needed
                    'type': instruction.get('sign', 0), # GraphHopper's turn instruction code
                    'modifier': instruction.get('text', ''), # Text description of maneuver
                    'exit_number': instruction.get('exit_number'), # For roundabouts/exits
                    'turn_angle': instruction.get('turn_angle') # Optional turn angle
                },
                'instruction_text': instruction.get('text', ''), # Full instruction text
                'interval': interval # Original interval indices
            }

            # Add road details if available from 'details' section of response
            # This requires matching intervals, which can be complex. Simplified for now.
            # Example: if 'details' exists, iterate through details like 'max_speed', 'road_class'
            # and check if the detail's interval overlaps with the step's interval.
            # if 'details' in path_data:
            #     for detail_type, details_list in path_data['details'].items():
            #         for detail_interval in details_list:
            #             # Check overlap: max(start1, start2) < min(end1, end2)
            #             if max(detail_interval[0], interval[0]) < min(detail_interval[1], interval[1]):
            #                 if detail_type not in step: # Add first matching detail
            #                     step[detail_type] = detail_interval[2] # The value of the detail

            leg['steps'].append(step)
        route['legs'].append(leg)
    else:
            log.warning("GraphHopper path missing instructions.")


    return route

def _calculate_graphhopper_routes(start_lat, start_lng, end_lat, end_lng, alternatives=DEFAULT_ALTERNATIVES):
    """
    Internal function to fetch multiple route alternatives from the GraphHopper API.

    Args:
        start_lat, start_lng: Starting coordinates.
        end_lat, end_lng: Ending coordinates.
        alternatives (int): Number of alternative routes to request.

    Returns:
        dict: A dictionary containing route information ('code', 'routes', 'waypoints')
                or an error message ('code', 'message').
                'routes' is a list of parsed route dictionaries.
    """
    log.info(f"Calculating GraphHopper routes from ({start_lat}, {start_lng}) to ({end_lat}, {end_lng}) requesting {alternatives} alternatives.")

    if not Config.GRAPHHOPPER_KEY:
        log.error("GraphHopper API key is missing in configuration.")
        return {'code': 'Error', 'message': 'Routing service configuration error.'}

    try:
        url = "https://graphhopper.com/api/1/route"
        num_alternatives = min(max(1, alternatives), MAX_ALTERNATIVES) # Clamp alternatives

        params = {
            'point': [f"{start_lat},{start_lng}", f"{end_lat},{end_lng}"],
            'profile': 'car', # Assuming car profile, could be parameterized
            'algorithm': 'alternative_route',
            'alternative_route.max_paths': num_alternatives,
            # Adjust factors to control diversity vs. optimality
            'alternative_route.max_weight_factor': 1.8, # Allow alternatives up to 1.8x weight of best
            'alternative_route.max_share_factor': 0.8, # Limit overlap between alternatives
            'instructions': 'true', # Get turn-by-turn instructions
            'calc_points': 'true', # Calculate path geometry points
            'points_encoded': 'false', # Get coordinates as [[lng, lat], ...] array
            'key': Config.GRAPHHOPPER_KEY,
            'locale': 'en', # Language for instructions
            'details': ['street_name', 'time', 'distance', 'max_speed', 'road_class'] # Request extra details
        }

        response = requests.get(url, params=params, timeout=GRAPHOPPER_TIMEOUT)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        data = response.json()

        # Check if GraphHopper returned paths
        if 'paths' not in data or not data['paths']:
            # Check for specific messages indicating no route possible
            if 'message' in data and 'Cannot find point' in data['message']:
                    log.warning(f"GraphHopper: Point snapping failed. {data['message']}")
                    return {'code': 'PointNotFound', 'message': f"Could not find road near start or end point. {data['message']}"}
            elif 'message' in data and 'Connection between locations not found' in data['message']:
                    log.warning(f"GraphHopper: No route found between points. {data['message']}")
                    return {'code': 'NoRoute', 'message': 'No route found between the specified points.'}
            else:
                    log.warning(f"GraphHopper returned no paths. Response: {data.get('message', 'No message')}")
                    return {'code': 'NoRoute', 'message': 'No route found.'}


        log.info(f"GraphHopper returned {len(data['paths'])} alternative paths.")

        # Parse returned paths using the helper function
        parsed_routes = []
        for path in data['paths']:
            parsed = _parse_graphhopper_path(path)
            if parsed: # Only add if parsing was successful
                parsed_routes.append(parsed)

        if not parsed_routes:
                log.error("Failed to parse any routes from GraphHopper response.")
                return {'code': 'Error', 'message': 'Failed to process route data.'}


        # Create waypoints in a standard format (useful for frontend)
        # GraphHopper response might contain snapped waypoints, prefer those if available
        origin_coords = data.get('snapped_waypoints', {}).get('coordinates', [[start_lng, start_lat]])[0]
        dest_coords = data.get('snapped_waypoints', {}).get('coordinates', [[end_lng, end_lat]])[-1]

        waypoints = [
            {'name': 'Origin', 'location': [origin_coords[0], origin_coords[1]]}, # lng, lat
            {'name': 'Destination', 'location': [dest_coords[0], dest_coords[1]]} # lng, lat
        ]

        return {
            'code': 'Ok',
            'routes': parsed_routes, # List of parsed route objects
            'waypoints': waypoints
        }

    except requests.exceptions.Timeout:
        log.error(f"GraphHopper API request timed out.")
        return {'code': 'Error', 'message': 'Routing service timed out.'}
    except requests.exceptions.RequestException as e:
        log.error(f"GraphHopper API request failed: {e}")
        status_code = e.response.status_code if e.response else None
        # Handle specific HTTP errors
        if status_code == 401:
                message = 'Routing service authentication failed (Invalid API Key?).'
        elif status_code == 400:
                message = f'Invalid request to routing service: {e.response.json().get("message", "Bad Request")}'
        elif status_code == 429:
                message = 'Routing service rate limit exceeded.'
        elif status_code >= 500:
                message = 'Routing service unavailable or encountered an internal error.'
        else:
                message = f'Failed to connect to routing service: {e}'
        return {'code': 'Error', 'message': message}
    except Exception as e:
        log.exception(f"Unexpected error calculating GraphHopper routes: {e}")
        return {'code': 'Error', 'message': f'An unexpected error occurred during route calculation.'}


def _select_optimized_routes(alternative_routes, towers_in_area):
    """
    Selects the best routes from alternatives based on optimization criteria
    (fastest, best cell coverage, balanced).

    Args:
        alternative_routes (list): List of parsed route alternatives from _calculate_graphhopper_routes.
        towers_in_area (list): List of cell towers in the relevant geographic area.

    Returns:
        dict: Contains the selected 'fastest', 'cell_coverage', and 'balanced' routes,
                each with associated towers found along that specific route.
                Example: {'fastest': {'route': {...}, 'towers': [...]}, ...}
                Returns empty dicts if no routes are provided.
    """
    if not alternative_routes:
        log.warning("_select_optimized_routes called with no routes.")
        return {
            'fastest': {'route': None, 'towers': []},
            'cell_coverage': {'route': None, 'towers': []},
            'balanced': {'route': None, 'towers': []}
        }

    # --- Score each route alternative ---
    routes_with_scores = []
    for i, route in enumerate(alternative_routes):
        # Find towers specifically along this route's geometry
        route_coords = route.get('geometry', {}).get('coordinates', [])
        towers_along = find_towers_along_route(route_coords, towers_in_area, TOWER_PROXIMITY_METERS)

        # Calculate metrics for scoring
        tower_count = len(towers_along)
        # Calculate average signal strength (use a default weak signal if no towers found)
        avg_signal = -120 # Default weak signal
        if tower_count > 0:
            signal_sum = sum(t.get('averageSignal', -120) for t in towers_along)
            avg_signal = signal_sum / tower_count

        # Get duration (handle potential missing data)
        duration = route.get('duration', float('inf'))

        routes_with_scores.append({
            'route': route,
            'towers': towers_along,
            'tower_count': tower_count,
            'avg_signal': avg_signal, # Higher (less negative) is better
            'duration': duration, # Lower is better
            'index': i # Keep track of original index for diversity
        })
        log.debug(f"Route {i}: Duration={duration:.0f}s, Towers={tower_count}, AvgSignal={avg_signal:.1f}dBm")


    # --- Normalize scores (0 to 1, higher is better) ---
    if not routes_with_scores: # Should not happen if alternative_routes is not empty, but safety check
            return {'fastest': {'route': None, 'towers': []}, 'cell_coverage': {'route': None, 'towers': []}, 'balanced': {'route': None, 'towers': []}}

    # Find min/max for normalization
    min_duration = min(r['duration'] for r in routes_with_scores)
    max_duration = max(r['duration'] for r in routes_with_scores)
    duration_range = max(1, max_duration - min_duration) # Avoid division by zero

    min_signal = min(r['avg_signal'] for r in routes_with_scores)
    max_signal = max(r['avg_signal'] for r in routes_with_scores)
    signal_range = max(1, max_signal - min_signal) # Avoid division by zero

    # Calculate normalized scores for each route
    for r in routes_with_scores:
        # Normalize duration (lower is better -> score closer to 1)
        r['norm_duration'] = 1.0 - max(0, min(1, (r['duration'] - min_duration) / duration_range))
        # Normalize signal (higher is better -> score closer to 1)
        r['norm_signal'] = max(0, min(1, (r['avg_signal'] - min_signal) / signal_range))
        # Balanced score (example: 50% duration, 50% signal) - adjust weights as needed
        r['balanced_score'] = (r['norm_duration'] * 0.5) + (r['norm_signal'] * 0.5)
        log.debug(f"Route {r['index']} Scores: NormDur={r['norm_duration']:.2f}, NormSig={r['norm_signal']:.2f}, Bal={r['balanced_score']:.2f}")


    # --- Select best routes based on criteria ---

    # Fastest: Sort by duration (ascending)
    routes_by_duration = sorted(routes_with_scores, key=lambda x: x['duration'])
    selected_fastest = routes_by_duration[0] if routes_by_duration else None

    # Cell Coverage: Sort by average signal (descending), then tower count (descending) as tie-breaker
    routes_by_signal = sorted(routes_with_scores, key=lambda x: (-x['avg_signal'], -x['tower_count']))
    selected_cell = routes_by_signal[0] if routes_by_signal else None

    # Balanced: Sort by balanced score (descending)
    routes_by_balanced = sorted(routes_with_scores, key=lambda x: -x['balanced_score'], reverse=True)
    selected_balanced = routes_by_balanced[0] if routes_by_balanced else None

    # --- Attempt Diversity (if multiple routes available and selections overlap) ---
    # Goal: Ensure fastest, cell, and balanced are different routes if possible.
    selected_indices = set()
    final_selection = {}

    # Prioritize fastest
    if selected_fastest:
        final_selection['fastest'] = selected_fastest
        selected_indices.add(selected_fastest['index'])
    else: # Should not happen if routes exist, but handle gracefully
            final_selection['fastest'] = {'route': None, 'towers': []}


    # Select cell coverage, try next best if it's same as fastest
    current_cell = selected_cell
    if current_cell:
        if current_cell['index'] in selected_indices:
            # Try the next best signal route
            for alt_cell in routes_by_signal[1:]:
                if alt_cell['index'] not in selected_indices:
                    current_cell = alt_cell
                    break
            # If all alternatives are already selected, stick with the original best signal
        final_selection['cell_coverage'] = current_cell
        selected_indices.add(current_cell['index'])
    else:
            final_selection['cell_coverage'] = {'route': None, 'towers': []}


    # Select balanced, try next best if it's same as fastest or cell
    current_balanced = selected_balanced
    if current_balanced:
        if current_balanced['index'] in selected_indices:
            # Try the next best balanced score route
            for alt_balanced in routes_by_balanced[1:]:
                if alt_balanced['index'] not in selected_indices:
                    current_balanced = alt_balanced
                    break
            # If all alternatives are already selected, stick with the original best balanced
        final_selection['balanced'] = current_balanced
        # No need to add to selected_indices here, just finalizing
    else:
            final_selection['balanced'] = {'route': None, 'towers': []}


    log.info(f"Selected route indices - Fastest: {final_selection['fastest'].get('index', 'N/A')}, "
                f"Cell: {final_selection['cell_coverage'].get('index', 'N/A')}, "
                f"Balanced: {final_selection['balanced'].get('index', 'N/A')}")

    # Return the final selection in the desired format
    return {
        'fastest': {'route': final_selection['fastest']['route'], 'towers': final_selection['fastest']['towers']} if final_selection['fastest']['route'] else {'route': None, 'towers': []},
        'cell_coverage': {'route': final_selection['cell_coverage']['route'], 'towers': final_selection['cell_coverage']['towers']} if final_selection['cell_coverage']['route'] else {'route': None, 'towers': []},
        'balanced': {'route': final_selection['balanced']['route'], 'towers': final_selection['balanced']['towers']} if final_selection['balanced']['route'] else {'route': None, 'towers': []},
    }


# --- Public Service Functions ---

def _get_optimized_route(start_lat, start_lng, end_lat, end_lng, optimization_type):
    """
    Internal helper to calculate route alternatives, fetch towers, select the
    route based on optimization_type, and format the response.

    Args:
        start_lat, start_lng: Start coordinates.
        end_lat, end_lng: End coordinates.
        optimization_type (str): 'fastest', 'cell_coverage', or 'balanced'.

    Returns:
        dict: Formatted response containing the selected route, waypoints,
                towers along the route, and metadata. Or an error dict.
    """
    # 1. Get route alternatives from GraphHopper
    all_routes_response = _calculate_graphhopper_routes(start_lat, start_lng, end_lat, end_lng)

    # Handle errors from GraphHopper call
    if all_routes_response.get('code') != 'Ok':
        log.error(f"Failed to get route alternatives for optimization '{optimization_type}'. Reason: {all_routes_response.get('message', 'Unknown error')}")
        # Pass the error response directly back
        return all_routes_response

    alternative_routes = all_routes_response.get('routes', [])
    waypoints = all_routes_response.get('waypoints', [])

    if not alternative_routes: # Should be caught by code != 'Ok', but double check
            log.error("No route alternatives returned despite 'Ok' code.")
            return {'code': 'NoRoute', 'message': 'No routes found between points.'}

    # 2. Get cell towers covering the potential route areas
    # Define a bounding box encompassing start and end points with a buffer
    min_lat = min(start_lat, end_lat) - TOWER_SEARCH_BUFFER
    max_lat = max(start_lat, end_lat) + TOWER_SEARCH_BUFFER
    min_lng = min(start_lng, end_lng) - TOWER_SEARCH_BUFFER
    max_lng = max(start_lng, end_lng) + TOWER_SEARCH_BUFFER

    towers_data = get_cell_towers(min_lat, min_lng, max_lat, max_lng)
    all_towers_in_area = towers_data.get('towers', [])
    tower_data_source = towers_data.get('source', 'unknown')
    log.info(f"Fetched {len(all_towers_in_area)} towers (source: {tower_data_source}) in the route vicinity.")


    # 3. Select the best route based on the desired optimization and towers
    optimized_selection = _select_optimized_routes(alternative_routes, all_towers_in_area)

    selected_route_info = optimized_selection.get(optimization_type)

    # Check if the selected type actually has a route (it should due to fallbacks in _select_optimized_routes)
    if not selected_route_info or not selected_route_info.get('route'):
        log.error(f"Could not determine a suitable route for type '{optimization_type}' even after optimization/selection.")
        # Attempt to return the absolute fastest if primary failed completely
        fastest_fallback = optimized_selection.get('fastest')
        if fastest_fallback and fastest_fallback.get('route'):
                log.warning(f"Falling back to absolute fastest route as '{optimization_type}' failed.")
                selected_route_info = fastest_fallback
        else:
                # If even fastest failed, return NoRoute
                return {'code': 'NoRoute', 'message': 'Could not determine any suitable route.'}


    # 4. Format the final result
    final_route_object = selected_route_info['route']
    final_towers_along_route = selected_route_info.get('towers', [])

    result = {
        'code': 'Ok',
        # The primary result structure expects 'routes' to be a list
        'routes': [final_route_object],
        'waypoints': waypoints,
        'towers': final_towers_along_route, # Towers specifically along the selected route
        'optimization_type': optimization_type, # Indicate which optimization was returned
        'tower_data_source': tower_data_source # Indicate where tower data came from
    }

    log.info(f"Successfully calculated and selected '{optimization_type}' route. "
                f"Distance: {final_route_object.get('distance', 0):.0f}m, "
                f"Duration: {final_route_object.get('duration', 0):.0f}s, "
                f"Towers Along: {len(final_towers_along_route)}")

    return result


# --- Public API Functions called by Routes ---

def get_route_fastest(start_lat, start_lng, end_lat, end_lng):
    """Gets the fastest route calculated by GraphHopper."""
    return _get_optimized_route(start_lat, start_lng, end_lat, end_lng, 'fastest')

def get_route_cell_coverage(start_lat, start_lng, end_lat, end_lng):
    """Gets the route optimized for best cell coverage."""
    return _get_optimized_route(start_lat, start_lng, end_lat, end_lng, 'cell_coverage')

def get_route_balanced(start_lat, start_lng, end_lat, end_lng):
    """Gets a route balancing speed and cell coverage."""
    return _get_optimized_route(start_lat, start_lng, end_lat, end_lng, 'balanced')