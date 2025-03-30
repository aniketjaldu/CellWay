"""
API endpoints for geocoding functionalities:
- Forward Geocoding: Address to geographic coordinates.
- Reverse Geocoding: Geographic coordinates to address.
"""
import logging

from flask import Blueprint, jsonify, request

from services import geocoding_service  # Assuming services package in backend

# Initialize blueprint for geocoding routes
geo_bp = Blueprint("geo", __name__)

# Get logger for this module
log = logging.getLogger(__name__)


@geo_bp.route("/geo/geocode", methods=["GET"])
def geocode():
    """
    Forward geocoding endpoint: Converts an address query to geographic coordinates.

    Accepts a 'query' parameter for the address string, and optional parameters:
    - 'autocomplete' (boolean): Enables autocomplete suggestions.
    - 'proximity_lng' (float): Longitude for proximity biasing.
    - 'proximity_lat' (float): Latitude for proximity biasing.

    Returns:
        jsonify: JSON response containing geocoding results or an error message.
                 Returns 400 status for missing query or invalid proximity values.
                 Returns 503 status if the geocoding service is unavailable.
                 Returns 500 status for unexpected server errors.
    """
    query = request.args.get("query", "")
    if not query:
        log.warning("Geocode request failed: Missing 'query' parameter.")
        return jsonify({"error": "'query' parameter is required"}), 400

    # Retrieve optional parameters from request arguments
    autocomplete_str = request.args.get("autocomplete", "true").lower()
    autocomplete = autocomplete_str == "true"  # Convert string to boolean
    proximity_lng_str = request.args.get("proximity_lng")
    proximity_lat_str = request.args.get("proximity_lat")

    proximity = None  # Initialize proximity to None
    if proximity_lng_str and proximity_lat_str:
        try:
            proximity = (float(proximity_lng_str), float(proximity_lat_str))  # Create proximity tuple (lng, lat)
        except ValueError:
            log.warning(
                "Geocode request failed: Invalid proximity values provided. lng=%s, lat=%s",
                proximity_lng_str,
                proximity_lat_str,
            )
            return jsonify({"error": "Invalid proximity coordinates (must be numbers)"}), 400

    try:
        result = geocoding_service.geocode_location(
            query, autocomplete=autocomplete, proximity=proximity
        )

        if isinstance(result, dict) and "error" in result:
            # Handle errors returned by the geocoding service
            error_message = result.get("error", "").lower()
            status_code = 503 if "service" in error_message else 400  # 503 for service issues, 400 for bad input from service
            log.warning(f"Geocoding service returned an error for query '{query}': {error_message}")
            return jsonify(result), status_code  # Return service error to client

        return jsonify(result)  # Return successful geocoding result

    except Exception as e:
        log.exception(f"Unexpected error during geocoding for query '{query}': {e}")
        return jsonify({"error": "An unexpected error occurred during geocoding"}), 500  # 500 for internal server errors


@geo_bp.route("/geo/reverse-geocode", methods=["GET"])
def reverse_geocode():
    """
    Reverse geocoding endpoint: Converts geographic coordinates to an address.

    Accepts 'lat' and 'lng' parameters representing latitude and longitude.

    Returns:
        jsonify: JSON response containing reverse geocoding results or an error message.
                 Returns 400 status for missing or invalid lat/lng parameters.
                 Returns 503 status if the geocoding service is unavailable.
                 Returns 500 status for unexpected server errors.
    """
    lat_str = request.args.get("lat")
    lng_str = request.args.get("lng")

    if not lat_str or not lng_str:
        log.warning("Reverse geocode request failed: Missing 'lat' or 'lng' parameters.")
        return jsonify({"error": "'lat' and 'lng' parameters are required"}), 400

    try:
        lat = float(lat_str)
        lng = float(lng_str)
    except ValueError:
        log.warning(
            "Reverse geocode request failed: Invalid 'lat' or 'lng' format. Received: lat=%s, lng=%s",
            lat_str,
            lng_str,
        )
        return jsonify(
            {"error": "Invalid 'lat' and 'lng' parameters (must be numbers)"}
        ), 400

    try:
        result = geocoding_service.reverse_geocode(lng, lat)  # Note: service might expect (lng, lat)

        if isinstance(result, dict) and "error" in result:
            # Handle errors returned by the geocoding service
            error_message = result.get("error", "").lower()
            status_code = 503 if "service" in error_message else 400  # 503 for service issues, 400 for bad input from service
            log.warning(f"Geocoding service returned an error for reverse geocode ({lng},{lat}): {error_message}")
            return jsonify(result), status_code  # Return service error to client

        return jsonify(result)  # Return successful reverse geocoding result

    except Exception as e:
        log.exception(f"Unexpected error during reverse geocoding for ({lng_str},{lat_str}): {e}")
        return jsonify(
            {"error": "An unexpected error occurred during reverse geocoding"}
        ), 500  # 500 for internal server errors