"""
Service functions for fetching, processing, and managing cell tower data.
Provides functionalities to retrieve cell tower information from a CSV file
or generate mock data, and to find towers along a given route.
"""
import logging
import os
import random
import time

import pandas as pd

from utils.geometry import find_towers_near_route_shapely  # Use absolute imports from package root

# Initialize logger for this module
log = logging.getLogger(__name__)

# --- Constants ---
# Define file paths and limits
_SCRIPT_DIRECTORY = os.path.dirname(os.path.abspath(__file__))  # Directory where this script is located
_BACKEND_DIRECTORY = os.path.dirname(_SCRIPT_DIRECTORY)  # Parent directory (backend/)
_DATA_DIRECTORY = os.path.join(_BACKEND_DIRECTORY, "data")  # Data directory path
_CSV_FILE_PATH = os.path.join(_DATA_DIRECTORY, "cell_towers.csv")  # Path to cell tower CSV data file

MAX_TOWERS_FROM_CSV = 500  # Maximum number of cell towers to read from CSV for performance
MAX_TOWERS_ALONG_ROUTE = 200  # Maximum number of cell towers to return as being along a route


# --- Core Functions ---
def get_cell_towers(min_latitude: float, min_longitude: float, max_latitude: float, max_longitude: float) -> dict:
    """
    Retrieves cell tower data within a specified bounding box from a CSV file.

    If the CSV file is not found, is empty, or if there's an error reading it,
    this function falls back to generating mock cell tower data.

    Args:
        min_latitude (float): Minimum latitude of the bounding box.
        min_longitude (float): Minimum longitude of the bounding box.
        max_latitude (float): Maximum latitude of the bounding box.
        max_longitude (float): Maximum longitude of the bounding box.

    Returns:
        dict: A dictionary containing cell tower data and metadata.
              - 'towers' (list): List of cell tower dictionaries within the bounding box.
              - 'total' (int): Total number of towers returned.
              - 'source' (str): Source of the data, either 'CSV' or 'mock'.
    """
    log.info(f"Fetching cell towers within bounding box: ({min_latitude:.4f},{min_longitude:.4f}) to ({max_latitude:.4f},{max_longitude:.4f})")

    cell_towers = []  # Initialize empty list to store cell tower data
    data_source = "mock"  # Default data source is mock data, will be updated to "CSV" if CSV loading succeeds

    try:
        # --- CSV Data Loading and Filtering ---
        if not os.path.exists(_CSV_FILE_PATH):
            raise FileNotFoundError(f"Cell tower data CSV file not found at: {_CSV_FILE_PATH}")

        cell_towers_df = pd.read_csv(_CSV_FILE_PATH)  # Load cell tower data from CSV into a pandas DataFrame

        # Filter DataFrame to include only towers within the specified bounding box
        cell_towers_df_filtered = cell_towers_df[
            (cell_towers_df["lat"] >= min_latitude)
            & (cell_towers_df["lat"] <= max_latitude)
            & (cell_towers_df["lon"] >= min_longitude)
            & (cell_towers_df["lon"] <= max_longitude)
        ].copy()  # Use .copy() to avoid SettingWithCopyWarning

        total_towers_in_bounds = len(cell_towers_df_filtered)  # Count of towers found within the bounding box

        # Limit the number of towers processed if it exceeds MAX_TOWERS_FROM_CSV
        if total_towers_in_bounds > MAX_TOWERS_FROM_CSV:
            log.info(
                f"Found {total_towers_in_bounds} towers in CSV within bounds, sampling down to {MAX_TOWERS_FROM_CSV} for performance."
            )
            cell_towers_df_filtered = cell_towers_df_filtered.sample(
                n=MAX_TOWERS_FROM_CSV, random_state=42
            )  # Sample a subset of towers, using random_state for reproducibility

        cell_towers = cell_towers_df_filtered.to_dict(orient="records")  # Convert filtered DataFrame to a list of dictionaries
        data_source = "CSV"  # Update data source to CSV as loading was successful

        # --- Data Cleaning and Type Conversion ---
        for tower in cell_towers:
            # Ensure 'averageSignal' exists and has a realistic value if missing or invalid
            if "averageSignal" not in tower or pd.isna(tower["averageSignal"]) or tower["averageSignal"] == 0:
                tower["averageSignal"] = random.randint(-110, -70)  # Assign a random signal strength if missing/invalid

            tower["lat"] = float(tower["lat"])  # Ensure latitude is float
            tower["lon"] = float(tower["lon"])  # Ensure longitude is float

            # Safely convert potentially numeric fields to integers, setting to None on error
            for key in ["range", "samples", "updated"]:
                if key in tower and not pd.isna(tower[key]):
                    try:
                        tower[key] = int(tower[key])
                    except (ValueError, TypeError):
                        tower[key] = None  # Set to None if conversion fails

        log.info(
            f"Successfully processed {len(cell_towers)} cell towers (out of {total_towers_in_bounds} found in bounds) from CSV file: {_CSV_FILE_PATH}."
        )

    except FileNotFoundError as e:
        log.warning(f"{e} Generating mock cell tower data as fallback.")
        cell_towers = _generate_mock_towers(min_latitude, min_longitude, max_latitude, max_longitude)  # Fallback to mock data
    except pd.errors.EmptyDataError:
        log.warning(f"Cell tower CSV file at {_CSV_FILE_PATH} is empty. Generating mock cell tower data as fallback.")
        cell_towers = _generate_mock_towers(min_latitude, min_longitude, max_latitude, max_longitude)  # Fallback to mock data
    except Exception as e:
        log.exception(f"Unexpected error reading or processing cell tower CSV data: {e}. Falling back to mock data.")
        cell_towers = _generate_mock_towers(min_latitude, min_longitude, max_latitude, max_longitude)  # Fallback to mock data

    return {
        "towers": cell_towers,
        "total": len(cell_towers),
        "source": data_source,
    }  # Return cell tower data, total count, and source


def find_towers_along_route(route_coordinates: list[list[float]], area_towers: list[dict], max_distance_meters: int = 2500) -> list[dict]:
    """
    Finds cell towers from a given list that are located along a specified route.

    Uses a geometry-based approach (via Shapely library in `utils.geometry`) to identify towers within a buffer distance of the route.

    Args:
        route_coordinates (list[list[float]]): List of [longitude, latitude] coordinates defining the route path.
        area_towers (list[dict]): List of cell tower dictionaries to search within.
        max_distance_meters (int, optional): Maximum distance in meters from the route for a tower to be considered "along" the route. Defaults to 2500 meters.

    Returns:
        list[dict]: A list of cell tower dictionaries that are located along the route, sorted by distance to the route (closest first).
                     Limits the number of returned towers to MAX_TOWERS_ALONG_ROUTE.
    """
    if not route_coordinates or not area_towers:
        return []  # Return empty list if route or tower data is missing

    log.info(
        f"Finding cell towers along route with {len(route_coordinates)} coordinates, checking {len(area_towers)} towers, max distance: {max_distance_meters}m."
    )

    nearby_cell_towers = find_towers_near_route_shapely(
        route_coordinates, area_towers, max_distance_meters
    )  # Use Shapely-based function to find nearby towers

    num_nearby_towers = len(nearby_cell_towers)
    if num_nearby_towers > MAX_TOWERS_ALONG_ROUTE:
        log.info(
            f"Found {num_nearby_towers} cell towers along the route, sampling down to {MAX_TOWERS_ALONG_ROUTE}."
        )
        # Sample a subset of towers if the number exceeds the limit (prioritize closer towers or stronger signals in a more advanced sampling if needed)
        sample_indices = [int(i * (num_nearby_towers / MAX_TOWERS_ALONG_ROUTE)) for i in range(MAX_TOWERS_ALONG_ROUTE)]
        sampled_towers = [nearby_cell_towers[index] for index in sample_indices]
        log.info(f"Sampled down to {len(sampled_towers)} cell towers along the route.")
        return sampled_towers  # Return sampled subset of towers
    else:
        log.info(f"Found {num_nearby_towers} cell towers within {max_distance_meters}m of the route.")
        return nearby_cell_towers  # Return all nearby towers if within limit


# --- Helper Functions for Mock Data Generation ---
def _generate_mock_towers(min_latitude: float, min_longitude: float, max_latitude: float, max_longitude: float, num_towers: int | None = None) -> list[dict]:
    """
    Generates a list of mock cell tower data dictionaries within a specified bounding box.

    Used as a fallback when CSV data loading fails or for testing purposes.

    Args:
        min_latitude (float): Minimum latitude of the bounding box.
        min_longitude (float): Minimum longitude of the bounding box.
        max_latitude (float): Maximum latitude of the bounding box.
        max_longitude (float): Maximum longitude of the bounding box.
        num_towers (int, optional): Number of mock towers to generate. If None, a random number between 30 and 80 is used. Defaults to None.

    Returns:
        list[dict]: A list of mock cell tower data dictionaries.
    """
    if num_towers is None:
        num_towers = random.randint(30, 80)  # Generate a random number of towers if count is not specified

    mock_towers = []
    latitude_range = max_latitude - min_latitude
    longitude_range = max_longitude - min_longitude

    # Validate bounding box ranges to avoid errors
    if latitude_range <= 0 or longitude_range <= 0:
        log.warning(
            f"Invalid bounding box for mock data generation: latitude_range={latitude_range:.4f}, longitude_range={longitude_range:.4f}. Returning empty list."
        )
        return []  # Return empty list if bounding box is invalid

    radio_technologies = ["LTE", "LTE", "LTE", "5G", "5G", "UMTS", "GSM"]  # Weighted list favoring modern technologies

    for i in range(num_towers):
        latitude = min_latitude + random.random() * latitude_range  # Generate random latitude within bounds
        longitude = min_longitude + random.random() * longitude_range  # Generate random longitude within bounds
        signal_strength_dbm = random.randint(-115, -65)  # Realistic signal strength range in dBm
        radio_type = random.choice(radio_technologies)  # Randomly choose a radio technology
        range_meters = random.randint(500, 2000) if radio_type == "5G" else random.randint(1000, 5000)  # Plausible range based on radio type

        mock_towers.append(
            {
                "id": f"mock_{i}",  # Unique mock tower ID
                "lat": latitude,
                "lon": longitude,
                "radio": radio_type,
                "mcc": 310,  # Example US MCC
                "net": random.randint(10, 410),  # Example US MNC range
                "area": random.randint(1000, 60000),  # Example area code range
                "cell": random.randint(10000, 999999),  # Example cell ID range
                "range": range_meters,
                "averageSignal": signal_strength_dbm,
                "samples": random.randint(1, 50),  # Number of signal samples
                "updated": int(time.time()) - random.randint(3600, 86400 * 30),  # Last updated timestamp (recent but randomized)
            }
        )
    log.info(f"Generated {len(mock_towers)} mock cell towers within bounding box.")
    return mock_towers  # Return list of mock cell tower dictionaries