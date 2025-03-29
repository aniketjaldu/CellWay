import requests
import math
import random
import os
import pandas as pd
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points
import time
import traceback
import logging
from config import Config # Assuming Config handles API keys and other settings

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions ---

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate the great circle distance between two points on earth in meters."""
    earth_radius = 6371000  # Earth radius in meters
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2]) # Convert degrees to radians
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.asin(math.sqrt(a))
    return earth_radius * c

def _parse_graphhopper_path(path_data, profile='car'):
    """Helper to parse a single path from GraphHopper response."""
    coordinates = []
    if 'points' in path_data and 'coordinates' in path_data['points']:
        coordinates = path_data['points']['coordinates']

    route = {
        'geometry': {
            'coordinates': coordinates,
            'type': 'LineString'
        },
        'legs': [],
        'distance': path_data.get('distance', 0),
        'duration': path_data.get('time', 0) / 1000,  # Convert ms to seconds
        'weight': path_data.get('weight', 0),
        'weight_name': 'routability',
        'ascend': path_data.get('ascend', 0),
        'descend': path_data.get('descend', 0),
        'profile_used': profile # Track profile if needed
    }

    if 'instructions' in path_data:
        leg = {'steps': []}
        for instruction in path_data['instructions']:
            interval = instruction.get('interval', [0, 0])
            segment_coordinates = []
            if interval and len(interval) == 2 and coordinates:
                # Ensure indices are within bounds
                start_idx = min(max(0, interval[0]), len(coordinates))
                end_idx = min(max(0, interval[1] + 1), len(coordinates))
                segment_coordinates = coordinates[start_idx:end_idx]

            step = {
                'name': instruction.get('street_name', ''),
                'distance': instruction.get('distance', 0),
                'duration': instruction.get('time', 0) / 1000,
                'geometry': {
                    'coordinates': segment_coordinates,
                    'type': 'LineString'
                },
                'maneuver': {
                    'type': instruction.get('sign', 0), # Use 'sign' as maneuver type code
                    'modifier': instruction.get('text', ''),
                    'exit_number': instruction.get('exit_number'),
                    'turn_angle': instruction.get('turn_angle')
                },
                'instruction_text': instruction.get('text', ''),
                'interval': interval
            }

            # Add road details if available
            if 'details' in path_data:
                for detail_type, details in path_data['details'].items():
                    for detail in details:
                         # Check if detail interval overlaps with step interval
                        if max(detail[0], interval[0]) < min(detail[1], interval[1]):
                            if detail_type not in step:
                                step[detail_type] = detail[2]

            leg['steps'].append(step)
        route['legs'].append(leg)

    return route


# --- Core Routing and Data Fetching Functions ---

def calculate_graphhopper_routes(start_lat, start_lng, end_lat, end_lng, alternatives=10):
    """
    Calculates multiple route alternatives using the GraphHopper API.

    Args:
        start_lat, start_lng: Starting coordinates (latitude, longitude).
        end_lat, end_lng: Ending coordinates (latitude, longitude).
        alternatives (int): Number of alternative routes to request (1-10).

    Returns:
        dict: A dictionary containing route information ('code', 'routes', 'waypoints')
              or an error message ('code', 'message').
    """
    logging.info(f"Calculating GraphHopper routes from ({start_lat}, {start_lng}) to ({end_lat}, {end_lng})")

    if not Config.GRAPHHOPPER_KEY:
        logging.error("GraphHopper API key is missing in configuration.")
        return {'code': 'Error', 'message': 'Server configuration error: Missing API key.'}

    try:
        url = "https://graphhopper.com/api/1/route"
        alternatives = min(max(1, alternatives), 10) # Clamp alternatives

        params = {
            'point': [f"{start_lat},{start_lng}", f"{end_lat},{end_lng}"],
            'profile': 'car',
            'algorithm': 'alternative_route',
            'alternative_route.max_paths': alternatives,
            'alternative_route.max_weight_factor': 1.8,
            'alternative_route.max_share_factor': 0.8,
            'instructions': 'true',
            'calc_points': 'true',
            'points_encoded': 'false', # Get coordinates as [[lng, lat], ...]
            'key': Config.GRAPHHOPPER_KEY,
            'locale': 'en',
            'details': ['street_name', 'time', 'distance', 'max_speed', 'road_class'] # Add useful details
        }

        response = requests.get(url, params=params, timeout=15) # Added timeout
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        data = response.json()

        if 'paths' not in data or not data['paths']:
            logging.warning("No routes returned from GraphHopper for the given points.")
            return {'code': 'NoRoute', 'message': 'No route found between the specified points.'}

        logging.info(f"GraphHopper returned {len(data['paths'])} alternative paths.")

        # Parse returned paths
        routes = [_parse_graphhopper_path(path) for path in data['paths']]

        # Create waypoints (standard format)
        waypoints = [
            {'name': 'Origin', 'location': [start_lng, start_lat]},
            {'name': 'Destination', 'location': [end_lng, end_lat]}
        ]

        # Note: The original code had complex logic to add variations if fewer than
        # 'alternatives' were returned. This is removed for simplification, as
        # GraphHopper's alternatives should usually suffice or indicate limitations.
        # If needed, this logic could be added back carefully.

        return {
            'code': 'Ok',
            'routes': routes,
            'waypoints': waypoints
        }

    except requests.exceptions.RequestException as e:
        logging.error(f"GraphHopper API request failed: {e}")
        return {'code': 'Error', 'message': f'Failed to connect to routing service: {e}'}
    except Exception as e:
        logging.exception(f"Unexpected error calculating GraphHopper routes: {e}")
        return {'code': 'Error', 'message': f'An unexpected error occurred during route calculation: {e}'}


def select_optimized_routes(routes, towers):
    """
    Selects the best routes from alternatives based on optimization criteria.

    Args:
        routes (list): List of route alternatives (from calculate_graphhopper_routes).
        towers (list): List of cell towers in the relevant area.

    Returns:
        dict: Contains the selected 'fastest', 'cell_coverage', and 'balanced' routes,
              each with associated towers found along the route.
    """
    if not routes:
        logging.warning("select_optimized_routes called with no routes.")
        return {
            'fastest': {'route': None, 'towers': []},
            'cell_coverage': {'route': None, 'towers': []},
            'balanced': {'route': None, 'towers': []}
        }

    # Process each route: find towers along it and calculate scores
    routes_with_scores = []
    for i, route in enumerate(routes):
        towers_along = find_towers_along_route(route, towers)
        avg_signal = sum(t.get('averageSignal', -120) for t in towers_along) / len(towers_along) if towers_along else -120 # Use -120 default if no towers

        routes_with_scores.append({
            'route': route,
            'towers': towers_along,
            'tower_count': len(towers_along),
            'avg_signal': avg_signal,
            'duration': route.get('duration', float('inf')),
            'index': i # Keep track of original index
        })

    # --- Scoring and Sorting ---
    # Fastest: Sort by duration (ascending)
    routes_by_duration = sorted(routes_with_scores, key=lambda x: x['duration'])

    # Cell Coverage: Sort by average signal (descending), then tower count (descending)
    routes_by_signal = sorted(routes_with_scores, key=lambda x: (-x['avg_signal'], -x['tower_count']))

    # Balanced: Calculate normalized scores and sort
    min_duration = routes_by_duration[0]['duration'] if routes_by_duration else 0
    max_duration = routes_by_duration[-1]['duration'] if routes_by_duration else 1
    duration_range = max(1, max_duration - min_duration) # Avoid division by zero

    min_signal = routes_by_signal[-1]['avg_signal'] if routes_by_signal else -120
    max_signal = routes_by_signal[0]['avg_signal'] if routes_by_signal else -50
    signal_range = max(1, max_signal - min_signal) # Avoid division by zero

    for r in routes_with_scores:
        # Normalize duration (lower is better -> score closer to 1)
        norm_duration = 1.0 - max(0, min(1, (r['duration'] - min_duration) / duration_range))
        # Normalize signal (higher is better -> score closer to 1)
        norm_signal = max(0, min(1, (r['avg_signal'] - min_signal) / signal_range))
        # Balanced score (example: 50% duration, 50% signal)
        r['balanced_score'] = (norm_duration * 0.5) + (norm_signal * 0.5)

    routes_by_balanced = sorted(routes_with_scores, key=lambda x: -x['balanced_score'])

    # --- Selection (with basic diversity attempt) ---
    selected = {}
    selected['fastest'] = routes_by_duration[0] if routes_by_duration else None
    selected['cell_coverage'] = routes_by_signal[0] if routes_by_signal else selected['fastest'] # Fallback
    selected['balanced'] = routes_by_balanced[0] if routes_by_balanced else selected['fastest'] # Fallback

    # Attempt diversity if enough options and overlap exists
    if len(routes_with_scores) >= 3:
        indices_used = {selected[k]['index'] for k in selected if selected[k]}

        if len(indices_used) < 3: # Needs diversification
            # Try finding alternative for balanced if it matches fastest/cell
            if selected['balanced'] and selected['balanced']['index'] == selected['fastest']['index']:
                for alt in routes_by_balanced[1:]:
                    if alt['index'] != selected['fastest']['index'] and alt['index'] != selected['cell_coverage']['index']:
                        selected['balanced'] = alt
                        break
            elif selected['balanced'] and selected['balanced']['index'] == selected['cell_coverage']['index']:
                 for alt in routes_by_balanced[1:]:
                    if alt['index'] != selected['fastest']['index'] and alt['index'] != selected['cell_coverage']['index']:
                        selected['balanced'] = alt
                        break

            # Try finding alternative for cell_coverage if it matches fastest
            if selected['cell_coverage'] and selected['cell_coverage']['index'] == selected['fastest']['index']:
                 for alt in routes_by_signal[1:]:
                    if alt['index'] != selected['fastest']['index'] and alt['index'] != selected['balanced']['index']:
                        selected['cell_coverage'] = alt
                        break

    # Log final selection indices for debugging if needed
    # logging.info(f"Selected route indices - Fastest: {selected['fastest']['index'] if selected['fastest'] else 'N/A'}, "
    #              f"Cell: {selected['cell_coverage']['index'] if selected['cell_coverage'] else 'N/A'}, "
    #              f"Balanced: {selected['balanced']['index'] if selected['balanced'] else 'N/A'}")

    # Return final selection
    return {
        'fastest': {'route': selected['fastest']['route'], 'towers': selected['fastest']['towers']} if selected['fastest'] else {'route': None, 'towers': []},
        'cell_coverage': {'route': selected['cell_coverage']['route'], 'towers': selected['cell_coverage']['towers']} if selected['cell_coverage'] else {'route': None, 'towers': []},
        'balanced': {'route': selected['balanced']['route'], 'towers': selected['balanced']['towers']} if selected['balanced'] else {'route': None, 'towers': []},
    }

def find_towers_along_route(route, towers, max_distance_meters=2500):
    """
    Finds cell towers from a list that are within a specified distance of a route.
    Uses Shapely for efficient geometric operations.

    Args:
        route (dict): A route object containing geometry (LineString coordinates).
        towers (list): A list of tower dictionaries, each needing 'lat' and 'lon'.
        max_distance_meters (int): Maximum distance in meters from the route.

    Returns:
        list: A list of tower dictionaries that are along the route, sorted by
              their projected position along the route. Includes 'distanceToRoute'
              and 'positionAlongRoute' (0.0 to 1.0).
    """
    if not route or 'geometry' not in route or 'coordinates' not in route['geometry'] or not towers:
        return []

    route_coords = route['geometry']['coordinates']
    if len(route_coords) < 2:
        return []

    try:
        # Create Shapely LineString from route coordinates [lng, lat]
        route_line = LineString(route_coords)
        # Pre-calculate bounds for faster filtering (optional, Shapely handles it)
        # min_lon, min_lat, max_lon, max_lat = route_line.bounds

        nearby_towers = []
        # Approximation: Convert max_distance_meters to degrees (latitude varies, use estimate)
        max_dist_degrees = max_distance_meters / 111000

        for tower in towers:
            if 'lat' in tower and 'lon' in tower:
                try:
                    tower_point = Point(tower['lon'], tower['lat'])

                    # Optional: Quick bounding box check before precise distance
                    # if not (min_lon - max_dist_degrees <= tower['lon'] <= max_lon + max_dist_degrees and \
                    #         min_lat - max_dist_degrees <= tower['lat'] <= max_lat + max_dist_degrees):
                    #     continue

                    # Calculate the minimum distance from the tower to the route line
                    # Shapely's distance is in the units of the coordinates (degrees here)
                    distance_degrees = route_line.distance(tower_point)

                    # Convert distance from degrees to meters (approximation)
                    # More accurate would be to use haversine on nearest points, but this is faster
                    distance_meters = distance_degrees * 111000 # Approx meters per degree

                    if distance_meters <= max_distance_meters:
                        tower_copy = tower.copy()
                        tower_copy['distanceToRoute'] = distance_meters

                        # Find the nearest point on the route to the tower
                        nearest_route_point = nearest_points(route_line, tower_point)[0]
                        # Calculate the normalized distance along the route (0.0 at start, 1.0 at end)
                        position = route_line.project(nearest_route_point, normalized=True)
                        tower_copy['positionAlongRoute'] = position

                        nearby_towers.append(tower_copy)
                except Exception as geo_err:
                     logging.warning(f"Could not process tower geometry: {tower}. Error: {geo_err}")


        # Sort towers by their position along the route
        nearby_towers.sort(key=lambda t: t.get('positionAlongRoute', 0))

        # Optional: Add sampling logic if nearby_towers count is very high (e.g., > 200)
        # The original sampling logic was complex; simplified here. Consider adding back if needed.
        MAX_TOWERS_TO_RETURN = 200 # Example limit
        if len(nearby_towers) > MAX_TOWERS_TO_RETURN:
            logging.info(f"Found {len(nearby_towers)} towers along route, sampling down to {MAX_TOWERS_TO_RETURN}.")
            # Simple sampling: Keep a subset, perhaps prioritizing closer towers or stronger signals
            # Example: keep every Nth tower, or sort by distance/signal and take top N
            indices = [int(i * (len(nearby_towers) / MAX_TOWERS_TO_RETURN)) for i in range(MAX_TOWERS_TO_RETURN)]
            nearby_towers = [nearby_towers[i] for i in indices]

        # logging.info(f"Found {len(nearby_towers)} towers within {max_distance_meters}m of the route.")
        return nearby_towers

    except ImportError:
        logging.error("Shapely library not found. Cannot perform geometric operations for find_towers_along_route.")
        return [] # Return empty if Shapely is missing
    except Exception as e:
        logging.exception(f"Error in find_towers_along_route: {e}")
        return []


def get_cell_towers(min_lat, min_lng, max_lat, max_lng):
    """
    Gets cell tower data for a bounding box, reading from a CSV file.
    Falls back to generating mock data if the file is not found or reading fails.

    Args:
        min_lat, min_lng, max_lat, max_lng: Bounding box coordinates.

    Returns:
        dict: {'towers': list_of_towers, 'total': count}
    """
    logging.info(f"Fetching cell towers in area: {min_lat},{min_lng} to {max_lat},{max_lng}")
    towers = []
    data_source = "mock" # Assume mock unless CSV succeeds

    try:
        # Correct path relative to this services.py file
        script_dir = os.path.dirname(__file__)
        csv_path = os.path.join(script_dir, 'data', 'cell_towers.csv')

        if not os.path.exists(csv_path):
             raise FileNotFoundError(f"Cell tower data file not found at {csv_path}")

        # Read the CSV using pandas
        df = pd.read_csv(csv_path)

        # Filter towers within the bounding box
        towers_df = df[
            (df['lat'] >= min_lat) & (df['lat'] <= max_lat) &
            (df['lon'] >= min_lng) & (df['lon'] <= max_lng)
        ]

        # Limit the number of towers for performance (e.g., sample 500 if > 500 found)
        MAX_TOWERS_FROM_CSV = 500
        if len(towers_df) > MAX_TOWERS_FROM_CSV:
            logging.info(f"Found {len(towers_df)} towers in CSV, sampling down to {MAX_TOWERS_FROM_CSV}.")
            towers_df = towers_df.sample(n=MAX_TOWERS_FROM_CSV, random_state=42) # Use random_state for reproducibility if needed

        # Convert DataFrame rows to list of dictionaries
        towers = towers_df.to_dict('records')

        # Ensure 'averageSignal' exists and has a plausible value if missing/zero
        for tower in towers:
            if 'averageSignal' not in tower or pd.isna(tower['averageSignal']) or tower['averageSignal'] == 0:
                tower['averageSignal'] = random.randint(-110, -70) # Assign random realistic signal

        data_source = "CSV"
        logging.info(f"Successfully read {len(towers)} towers from {csv_path}.")

    except FileNotFoundError as e:
         logging.warning(f"{e}. Falling back to mock tower data.")
    except Exception as e:
        logging.exception(f"Error reading cell tower CSV data: {e}. Falling back to mock tower data.")

    # --- Fallback to Mock Data Generation ---
    if data_source == "mock":
        num_towers = random.randint(30, 80) # Generate a reasonable number of mock towers
        lat_range = max_lat - min_lat
        lng_range = max_lng - min_lng
        radio_types = ['LTE', 'LTE', 'LTE', '5G', '5G', 'UMTS', 'GSM'] # Weighted towards modern tech

        for _ in range(num_towers):
            lat = min_lat + random.random() * lat_range
            lng = min_lng + random.random() * lng_range
            signal_strength = random.randint(-115, -65) # Realistic signal range
            radio = random.choice(radio_types)
            # Assign plausible ranges based on tech (rough estimate)
            range_m = random.randint(500, 2000) if radio == '5G' else random.randint(1000, 5000)

            towers.append({
                'lat': lat, 'lon': lng, 'radio': radio,
                'mcc': 310, 'net': random.randint(10, 410), # Example US MNCs
                'area': random.randint(1000, 60000),
                'cell': random.randint(10000, 999999),
                'range': range_m,
                'averageSignal': signal_strength,
                'samples': random.randint(1, 50),
                'updated': int(time.time()) - random.randint(3600, 86400*30) # Updated recently
            })
        logging.info(f"Generated {len(towers)} mock cell towers as fallback.")

    return {
        'towers': towers,
        'total': len(towers),
        'source': data_source
    }

# --- Unified Route Calculation Helper ---

def _get_optimized_route(start_lat, start_lng, end_lat, end_lng, optimization_type):
    """Internal helper to calculate routes and select the specified optimization type."""

    # 1. Get all alternatives from GraphHopper
    all_routes_response = calculate_graphhopper_routes(start_lat, start_lng, end_lat, end_lng)

    if all_routes_response.get('code') != 'Ok' or not all_routes_response.get('routes'):
        logging.error(f"Failed to get route alternatives for optimization '{optimization_type}'. Reason: {all_routes_response.get('message', 'No routes found')}")
        return all_routes_response # Return error/empty response

    routes_list = all_routes_response.get('routes', [])
    waypoints = all_routes_response.get('waypoints', [])

    # 2. Get cell towers covering the potential route areas
    # Define a bounding box encompassing start and end points with a buffer
    buffer = 0.1 # Degrees buffer (approx 11km), adjust as needed
    min_lat = min(start_lat, end_lat) - buffer
    max_lat = max(start_lat, end_lat) + buffer
    min_lng = min(start_lng, end_lng) - buffer
    max_lng = max(start_lng, end_lng) + buffer

    towers_data = get_cell_towers(min_lat, min_lng, max_lat, max_lng)
    all_towers_in_area = towers_data.get('towers', [])

    # 3. Select the best route based on the desired optimization
    optimized_selection = select_optimized_routes(routes_list, all_towers_in_area)

    selected_route_info = optimized_selection.get(optimization_type)

    if not selected_route_info or not selected_route_info.get('route'):
         # Fallback logic: If the specific type isn't found (shouldn't happen with fallback in select_optimized_routes)
        logging.warning(f"Could not find specific route for type '{optimization_type}', falling back to fastest.")
        selected_route_info = optimized_selection.get('fastest')
        if not selected_route_info or not selected_route_info.get('route'):
             # If even fastest failed
            logging.error("No valid routes could be selected after optimization.")
            return {'code': 'NoRoute', 'message': 'Could not determine a suitable route.'}


    # 4. Format the result
    result = {
        'code': 'Ok',
        'routes': [selected_route_info['route']], # Return only the selected route in the list
        'waypoints': waypoints,
        'towers': selected_route_info.get('towers', []), # Towers specifically along the selected route
        'optimization_type': optimization_type,
        'tower_data_source': towers_data.get('source', 'unknown') # Add source info
    }

    return result


# --- Public Route Endpoints ---

def get_route_fastest(start_lat, start_lng, end_lat, end_lng):
    """Gets the fastest route calculated by GraphHopper."""
    return _get_optimized_route(start_lat, start_lng, end_lat, end_lng, 'fastest')

def get_route_cell_coverage(start_lat, start_lng, end_lat, end_lng):
    """Gets the route optimized for best cell coverage."""
    return _get_optimized_route(start_lat, start_lng, end_lat, end_lng, 'cell_coverage')

def get_route_balanced(start_lat, start_lng, end_lat, end_lng):
    """Gets a route balancing speed and cell coverage."""
    return _get_optimized_route(start_lat, start_lng, end_lat, end_lng, 'balanced')


# --- Geocoding Functions (Example using MapTiler API) ---
# Note: Frontend seems to call MapTiler directly. These are kept for completeness
#       based on the original routes.py but might be unused by the provided App.jsx.

def geocode_location(query, autocomplete=False, proximity=None):
    """Forward geocode using MapTiler API."""
    if not Config.MAPTILER_KEY:
        logging.error("MapTiler API key is missing for geocoding.")
        return {'error': 'Server configuration error'}

    base_url = f"https://api.maptiler.com/geocoding/{requests.utils.quote(query)}.json"
    params = {
        'key': Config.MAPTILER_KEY,
        'autocomplete': str(autocomplete).lower(),
        'limit': 5 # Limit suggestions
    }
    if proximity:
        params['proximity'] = f"{proximity[0]},{proximity[1]}" # lng,lat

    try:
        response = requests.get(base_url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logging.error(f"MapTiler geocoding request failed: {e}")
        return {'error': 'Geocoding service request failed'}
    except Exception as e:
        logging.exception(f"Error during geocoding for query '{query}': {e}")
        return {'error': 'An unexpected error occurred during geocoding'}

def reverse_geocode(lng, lat):
    """Reverse geocode using MapTiler API."""
    if not Config.MAPTILER_KEY:
        logging.error("MapTiler API key is missing for reverse geocoding.")
        return {'error': 'Server configuration error'}

    base_url = f"https://api.maptiler.com/geocoding/{lng},{lat}.json"
    params = {'key': Config.MAPTILER_KEY}

    try:
        response = requests.get(base_url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logging.error(f"MapTiler reverse geocoding request failed: {e}")
        return {'error': 'Reverse geocoding service request failed'}
    except Exception as e:
        logging.exception(f"Error during reverse geocoding for ({lng},{lat}): {e}")
        return {'error': 'An unexpected error occurred during reverse geocoding'}