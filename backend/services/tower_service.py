"""
Service functions for fetching and processing cell tower data.
"""
import os
import random
import time
import pandas as pd
import logging
# Use absolute imports from package root
from utils.geometry import find_towers_near_route_shapely

log = logging.getLogger(__name__)

# --- Constants ---
# Define path relative to the backend directory structure
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_SCRIPT_DIR) # Go up one level from services
_DATA_DIR = os.path.join(_BACKEND_DIR, 'data')
_CSV_PATH = os.path.join(_DATA_DIR, 'cell_towers.csv')

MAX_TOWERS_FROM_CSV = 500 # Limit towers read from CSV for performance
MAX_TOWERS_ALONG_ROUTE = 200 # Limit towers returned along a route

# --- Core Functions ---

def get_cell_towers(min_lat, min_lng, max_lat, max_lng):
    """
    Gets cell tower data for a bounding box, reading from a CSV file.
    Falls back to generating mock data if the file is not found or reading fails.

    Args:
        min_lat (float): Minimum latitude.
        min_lng (float): Minimum longitude.
        max_lat (float): Maximum latitude.
        max_lng (float): Maximum longitude.

    Returns:
        dict: {'towers': list_of_towers, 'total': count, 'source': 'CSV' or 'mock'}
    """
    log.info(f"Fetching cell towers in area: {min_lat},{min_lng} to {max_lat},{max_lng}")
    towers = []
    data_source = "mock" # Assume mock unless CSV succeeds

    try:
        if not os.path.exists(_CSV_PATH):
            raise FileNotFoundError(f"Cell tower data file not found at {_CSV_PATH}")

        # Read the CSV using pandas, consider chunking for very large files
        # For simplicity, reading whole file first, then filtering.
        df = pd.read_csv(_CSV_PATH)

        # Filter towers within the bounding box
        towers_df = df[
            (df['lat'] >= min_lat) & (df['lat'] <= max_lat) &
            (df['lon'] >= min_lng) & (df['lon'] <= max_lng)
        ].copy() # Use .copy() to avoid SettingWithCopyWarning

        total_found_in_bounds = len(towers_df)

        # Limit the number of towers read/processed from CSV
        if total_found_in_bounds > MAX_TOWERS_FROM_CSV:
            log.info(f"Found {total_found_in_bounds} towers in CSV, sampling down to {MAX_TOWERS_FROM_CSV}.")
            towers_df = towers_df.sample(n=MAX_TOWERS_FROM_CSV, random_state=42) # Use random_state for reproducibility

        # Convert DataFrame rows to list of dictionaries
        towers = towers_df.to_dict('records')

        # Ensure 'averageSignal' exists and has a plausible value if missing/zero/NaN
        for tower in towers:
            if 'averageSignal' not in tower or pd.isna(tower['averageSignal']) or tower['averageSignal'] == 0:
                # Assign random realistic signal if missing or invalid
                tower['averageSignal'] = random.randint(-110, -70)
            # Ensure lat/lon are floats
            tower['lat'] = float(tower['lat'])
            tower['lon'] = float(tower['lon'])
            # Convert other potentially numeric fields safely
            for key in ['range', 'samples', 'updated']:
                    if key in tower and not pd.isna(tower[key]):
                        try:
                            tower[key] = int(tower[key])
                        except (ValueError, TypeError):
                            tower[key] = None # Or some default

        data_source = "CSV"
        log.info(f"Successfully processed {len(towers)} towers (out of {total_found_in_bounds} found) from {_CSV_PATH}.")

    except FileNotFoundError as e:
        log.warning(f"{e}. Falling back to mock tower data.")
        towers = _generate_mock_towers(min_lat, min_lng, max_lat, max_lng)
    except pd.errors.EmptyDataError:
            log.warning(f"CSV file at {_CSV_PATH} is empty. Falling back to mock tower data.")
            towers = _generate_mock_towers(min_lat, min_lng, max_lat, max_lng)
    except Exception as e:
        log.exception(f"Error reading or processing cell tower CSV data: {e}. Falling back to mock tower data.")
        towers = _generate_mock_towers(min_lat, min_lng, max_lat, max_lng)

    return {
        'towers': towers,
        'total': len(towers), # Total returned/generated
        'source': data_source
    }

def find_towers_along_route(route_coords, towers_in_area, max_distance_meters=2500):
    """
    Wrapper function to find towers along a route using the chosen method (Shapely).

    Args:
        route_coords (list): List of [lng, lat] coordinates for the route.
        towers_in_area (list): List of tower dictionaries potentially near the route.
        max_distance_meters (int): Maximum distance from the route.

    Returns:
        list: Filtered and sorted list of towers along the route.
    """
    if not route_coords or not towers_in_area:
        return []

    log.info(f"Finding towers along route (coords: {len(route_coords)}, towers: {len(towers_in_area)}, dist: {max_distance_meters}m)")

    # Use the Shapely-based implementation from utils
    nearby_towers = find_towers_near_route_shapely(route_coords, towers_in_area, max_distance_meters)

    # Optional: Apply sampling/limit if the result is still too large
    if len(nearby_towers) > MAX_TOWERS_ALONG_ROUTE:
        log.info(f"Found {len(nearby_towers)} towers along route, sampling down to {MAX_TOWERS_ALONG_ROUTE}.")
        # Simple sampling: Keep a subset, perhaps prioritizing closer towers or stronger signals
        # Example: keep every Nth tower after sorting by position
        indices = [int(i * (len(nearby_towers) / MAX_TOWERS_ALONG_ROUTE)) for i in range(MAX_TOWERS_ALONG_ROUTE)]
        sampled_towers = [nearby_towers[i] for i in indices]
        log.info(f"Sampled down to {len(sampled_towers)} towers.")
        return sampled_towers
    else:
            log.info(f"Found {len(nearby_towers)} towers within {max_distance_meters}m of the route.")
            return nearby_towers


# --- Helper Functions ---

def _generate_mock_towers(min_lat, min_lng, max_lat, max_lng, num_towers=None):
    """Generates a list of mock cell towers within the bounding box."""
    if num_towers is None:
        num_towers = random.randint(30, 80) # Generate a reasonable number

    towers = []
    lat_range = max_lat - min_lat
    lng_range = max_lng - min_lng
    # Ensure ranges are positive, handle edge cases where min/max are swapped or equal
    if lat_range <= 0 or lng_range <= 0:
            log.warning(f"Invalid bounding box for mock data generation: lat_range={lat_range}, lng_range={lng_range}")
            return []

    radio_types = ['LTE', 'LTE', 'LTE', '5G', '5G', 'UMTS', 'GSM'] # Weighted towards modern tech

    for i in range(num_towers):
        lat = min_lat + random.random() * lat_range
        lng = min_lng + random.random() * lng_range
        signal_strength = random.randint(-115, -65) # Realistic signal range
        radio = random.choice(radio_types)
        # Assign plausible ranges based on tech (rough estimate)
        range_m = random.randint(500, 2000) if radio == '5G' else random.randint(1000, 5000)

        towers.append({
            'id': f'mock_{i}', # Add a unique mock ID
            'lat': lat, 'lon': lng, 'radio': radio,
            'mcc': 310, 'net': random.randint(10, 410), # Example US MNCs
            'area': random.randint(1000, 60000),
            'cell': random.randint(10000, 999999),
            'range': range_m,
            'averageSignal': signal_strength,
            'samples': random.randint(1, 50),
            'updated': int(time.time()) - random.randint(3600, 86400*30) # Updated recently
        })
    log.info(f"Generated {len(towers)} mock cell towers as fallback.")
    return towers
