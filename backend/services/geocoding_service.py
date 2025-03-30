"""
Service functions for interacting with geocoding APIs, specifically MapTiler.
Provides functionalities for forward and reverse geocoding.
"""
import logging

import requests

from config import Config  # Use absolute import from package root

# Initialize logger for this module
log = logging.getLogger(__name__)


def geocode_location(query: str, autocomplete: bool = True, proximity: tuple[float, float] | None = None) -> dict:
    """
    Forward geocode a location using the MapTiler API. Converts an address or place name to geographic coordinates.

    Args:
        query (str): The address or place name to geocode.
        autocomplete (bool, optional): Enable autocomplete suggestions. Defaults to True.
        proximity (tuple[float, float], optional): Tuple containing (longitude, latitude) to bias results towards. Defaults to None.

    Returns:
        dict: A dictionary containing the JSON response from the MapTiler API.
              Returns an error dictionary if the API key is missing, the request times out, or any other error occurs.
              Error dictionaries have an 'error' key with a descriptive error message.
    """
    if not Config.MAPTILER_KEY:
        log.error("MapTiler API key is missing for forward geocoding. Check your application configuration.")
        return {"error": "Geocoding service configuration error: API key missing"}

    base_url = f"https://api.maptiler.com/geocoding/{requests.utils.quote(query)}.json"
    params = {
        "key": Config.MAPTILER_KEY,
        "autocomplete": str(autocomplete).lower(),
        "limit": 5,  # Limit the number of autocomplete suggestions
    }

    if proximity:
        if isinstance(proximity, (list, tuple)) and len(proximity) == 2:
            lng, lat = proximity  # Unpack longitude and latitude
            params["proximity"] = f"{lng},{lat}"  # Format as "longitude,latitude"
        else:
            log.warning(f"Invalid proximity format received: {proximity}. Proximity biasing will be ignored.")

    log.info(f"Forward geocoding request to MapTiler for query: '{query}' with parameters: {params}")

    try:
        response = requests.get(base_url, params=params, timeout=10)
        response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx status codes)
        return response.json()  # Parse and return JSON response

    except requests.exceptions.Timeout:
        log.error(f"MapTiler forward geocoding request timed out for query: '{query}'.")
        return {"error": "Geocoding service timed out"}

    except requests.exceptions.RequestException as e:
        status_code = e.response.status_code if e.response else None
        error_message = (
            f"Geocoding service request failed (Status: {status_code})."
            if status_code
            else "Geocoding service request failed."
        )
        log.error(f"MapTiler forward geocoding request failed for query '{query}': {e}")
        return {"error": error_message}

    except Exception as e:
        log.exception(f"Unexpected error during forward geocoding for query '{query}': {e}")
        return {"error": "An unexpected error occurred during geocoding"}


def reverse_geocode(lng: float, lat: float) -> dict:
    """
    Reverse geocode coordinates using the MapTiler API. Converts geographic coordinates to an address or place name.

    Args:
        lng (float): Longitude of the location.
        lat (float): Latitude of the location.

    Returns:
        dict: A dictionary containing the JSON response from the MapTiler API.
              Returns an error dictionary if the API key is missing, request times out, or any other error occurs.
              Error dictionaries have an 'error' key with a descriptive error message.
    """
    if not Config.MAPTILER_KEY:
        log.error("MapTiler API key is missing for reverse geocoding. Check your application configuration.")
        return {"error": "Reverse geocoding service configuration error: API key missing"}

    if not isinstance(lng, (int, float)) or not isinstance(lat, (int, float)):
        log.error(f"Invalid coordinates provided for reverse geocoding: longitude={lng}, latitude={lat}. Coordinates must be numbers.")
        return {"error": "Invalid coordinates provided"}

    base_url = f"https://api.maptiler.com/geocoding/{lng},{lat}.json"  # URL format is lng,lat
    params = {"key": Config.MAPTILER_KEY}

    log.info(f"Reverse geocoding request to MapTiler for coordinates: (longitude={lng}, latitude={lat}).")

    try:
        response = requests.get(base_url, params=params, timeout=10)
        response.raise_for_status()  # Raise HTTPError for bad responses
        return response.json()  # Parse and return JSON response

    except requests.exceptions.Timeout:
        log.error(f"MapTiler reverse geocoding request timed out for coordinates (longitude={lng}, latitude={lat}).")
        return {"error": "Reverse geocoding service timed out"}

    except requests.exceptions.RequestException as e:
        status_code = e.response.status_code if e.response else None
        error_message = (
            f"Reverse geocoding service request failed (Status: {status_code})."
            if status_code
            else "Reverse geocoding service request failed."
        )
        log.error(f"MapTiler reverse geocoding request failed for coordinates (longitude={lng}, latitude={lat}): {e}")
        return {"error": error_message}

    except Exception as e:
        log.exception(f"Unexpected error during reverse geocoding for coordinates (longitude={lng}, latitude={lat}): {e}")
        return {"error": "An unexpected error occurred during reverse geocoding"}