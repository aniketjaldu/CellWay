"""
Handles geocoding related API endpoints:
- Forward geocoding (address to coordinates)
- Reverse geocoding (coordinates to address)
"""
from flask import Blueprint, request, jsonify
import logging
# Assuming services are moved to backend.services package
from services import geocoding_service

log = logging.getLogger(__name__)

geo_bp = Blueprint('geo', __name__)

@geo_bp.route('/geo/geocode', methods=['GET'])
def geocode():
    """Endpoint for forward geocoding locations (address to coordinates)."""
    query = request.args.get('query', '')
    if not query:
        log.warning("Geocode request failed: Query parameter is required")
        return jsonify({'error': 'Query parameter is required'}), 400

    # Get optional parameters
    autocomplete = request.args.get('autocomplete', 'false').lower() == 'true'
    proximity_lng_str = request.args.get('proximity_lng')
    proximity_lat_str = request.args.get('proximity_lat')

    # Convert proximity to float if provided
    proximity = None
    if proximity_lng_str and proximity_lat_str:
        try:
            proximity = (float(proximity_lng_str), float(proximity_lat_str))
        except (ValueError, TypeError):
            log.warning("Geocode request with invalid proximity values: lng=%s, lat=%s",
                        proximity_lng_str, proximity_lat_str)
            # If conversion fails, don't use proximity

    try:
        result = geocoding_service.geocode_location(
            query,
            autocomplete=autocomplete,
            proximity=proximity
        )
        # Check for errors returned by the service itself
        if isinstance(result, dict) and 'error' in result:
                # Use 503 if service failed, 400 for bad input (handled above)
                status_code = 503 if 'service' in result.get('error', '').lower() else 400
                return jsonify(result), status_code
        return jsonify(result)
    except Exception as e:
        log.exception(f"Unexpected error during geocoding for query '{query}': {e}")
        return jsonify({'error': 'An unexpected error occurred during geocoding'}), 500


@geo_bp.route('/geo/reverse-geocode', methods=['GET'])
def reverse_geocode():
    """Endpoint for reverse geocoding (coordinates to address)."""
    lat_str = request.args.get('lat')
    lng_str = request.args.get('lng')

    if not lat_str or not lng_str:
            log.warning("Reverse geocode request failed: Missing lat or lng parameters.")
            return jsonify({'error': 'lat and lng parameters are required'}), 400

    try:
        lat = float(lat_str)
        lng = float(lng_str)
    except (ValueError, TypeError):
        log.warning("Reverse geocode request failed: Invalid lat/lng format. Received: lat=%s, lng=%s",
                    lat_str, lng_str)
        return jsonify({'error': 'Valid lat and lng parameters are required (must be numbers)'}), 400

    try:
        result = geocoding_service.reverse_geocode(lng, lat)
            # Check for errors returned by the service itself
        if isinstance(result, dict) and 'error' in result:
                # Use 503 if service failed, 400 for bad input (handled above)
                status_code = 503 if 'service' in result.get('error', '').lower() else 400
                return jsonify(result), status_code
        return jsonify(result)
    except Exception as e:
        log.exception(f"Unexpected error during reverse geocoding for ({lng_str},{lat_str}): {e}")
        return jsonify({'error': 'An unexpected error occurred during reverse geocoding'}), 500