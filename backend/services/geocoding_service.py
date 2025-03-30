"""
Service functions for interacting with geocoding APIs (e.g., MapTiler).
"""
import requests
import logging
from config import Config # Use absolute import from package root

log = logging.getLogger(__name__)

def geocode_location(query, autocomplete=False, proximity=None):
    """
    Forward geocode using MapTiler API.

    Args:
        query (str): The address or place name to geocode.
        autocomplete (bool): Whether to enable autocomplete suggestions.
        proximity (tuple, optional): (lng, lat) to bias results. Defaults to None.

    Returns:
        dict: The JSON response from MapTiler API or an error dictionary.
    """
    if not Config.MAPTILER_KEY:
        log.error("MapTiler API key is missing for geocoding.")
        return {'error': 'Geocoding service configuration error'}

    base_url = f"https://api.maptiler.com/geocoding/{requests.utils.quote(query)}.json"
    params = {
        'key': Config.MAPTILER_KEY,
        'autocomplete': str(autocomplete).lower(),
        'limit': 5 # Limit suggestions
    }
    if proximity:
        # Ensure proximity is lng, lat format
        if isinstance(proximity, (list, tuple)) and len(proximity) == 2:
            params['proximity'] = f"{proximity[0]},{proximity[1]}" # lng,lat
        else:
            log.warning(f"Invalid proximity format received: {proximity}. Ignoring.")


    log.info(f"Performing forward geocoding for query: '{query}' with params: {params}")
    try:
        response = requests.get(base_url, params=params, timeout=10)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        return response.json()
    except requests.exceptions.Timeout:
        log.error(f"MapTiler geocoding request timed out for query: {query}")
        return {'error': 'Geocoding service timed out'}
    except requests.exceptions.RequestException as e:
        log.error(f"MapTiler geocoding request failed: {e}")
        # Provide more specific error if possible (e.g., 401 Unauthorized)
        status_code = e.response.status_code if e.response else None
        error_msg = f'Geocoding service request failed (Status: {status_code})' if status_code else 'Geocoding service request failed'
        return {'error': error_msg}
    except Exception as e:
        log.exception(f"Unexpected error during geocoding for query '{query}': {e}")
        return {'error': 'An unexpected error occurred during geocoding'}

def reverse_geocode(lng, lat):
    """
    Reverse geocode using MapTiler API.

    Args:
        lng (float): Longitude.
        lat (float): Latitude.

    Returns:
        dict: The JSON response from MapTiler API or an error dictionary.
    """
    if not Config.MAPTILER_KEY:
        log.error("MapTiler API key is missing for reverse geocoding.")
        return {'error': 'Reverse geocoding service configuration error'}

    # Validate coordinates
    if not isinstance(lng, (int, float)) or not isinstance(lat, (int, float)):
            log.error(f"Invalid coordinates for reverse geocoding: lng={lng}, lat={lat}")
            return {'error': 'Invalid coordinates provided'}

    base_url = f"https://api.maptiler.com/geocoding/{lng},{lat}.json"
    params = {'key': Config.MAPTILER_KEY}

    log.info(f"Performing reverse geocoding for coordinates: ({lng}, {lat})")
    try:
        response = requests.get(base_url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        log.error(f"MapTiler reverse geocoding request timed out for ({lng},{lat})")
        return {'error': 'Reverse geocoding service timed out'}
    except requests.exceptions.RequestException as e:
        log.error(f"MapTiler reverse geocoding request failed: {e}")
        status_code = e.response.status_code if e.response else None
        error_msg = f'Reverse geocoding service request failed (Status: {status_code})' if status_code else 'Reverse geocoding service request failed'
        return {'error': error_msg}
    except Exception as e:
        log.exception(f"Unexpected error during reverse geocoding for ({lng},{lat}): {e}")
        return {'error': 'An unexpected error occurred during reverse geocoding'}