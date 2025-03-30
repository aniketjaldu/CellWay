# backend/routes/routing_routes.py
"""
Handles route calculation and management endpoints:
- Calculating routes (fastest, cell coverage, balanced)
- Saving routes for logged-in users
- Retrieving saved routes for logged-in users
"""
from flask import Blueprint, request, jsonify, session
import logging
from services import routing_service # Go up to backend/, then down to services/
from models import route as route_model # Import the specific route model module
from .auth_routes import login_required # Import from sibling module within routes/

log = logging.getLogger(__name__)

routing_bp = Blueprint('routing', __name__)

@routing_bp.route('/routing/calculate', methods=['GET']) # Renamed from /route for clarity
def get_route():
    """Endpoint for calculating routes with different optimizations."""
    # Extract and validate coordinates
    start_lat_str = request.args.get('start_lat')
    start_lng_str = request.args.get('start_lng')
    end_lat_str = request.args.get('end_lat')
    end_lng_str = request.args.get('end_lng')

    if not all([start_lat_str, start_lng_str, end_lat_str, end_lng_str]):
        log.warning("Route request failed: Missing coordinate parameters")
        return jsonify({'error': 'Missing required coordinates (start_lat, start_lng, end_lat, end_lng)'}), 400

    try:
        start_lat = float(start_lat_str)
        start_lng = float(start_lng_str)
        end_lat = float(end_lat_str)
        end_lng = float(end_lng_str)
    except ValueError:
        log.warning("Route request failed: Invalid coordinate format. Received: start=(%s, %s), end=(%s, %s)",
                    start_lat_str, start_lng_str, end_lat_str, end_lng_str)
        return jsonify({'error': 'Coordinates must be valid numbers'}), 400

    # Get optimization type (defaults to balanced)
    route_type = request.args.get('route_type', 'balanced').lower()
    valid_route_types = ['fastest', 'cell_coverage', 'balanced']
    if route_type not in valid_route_types:
        log.warning("Route request with invalid route_type '%s', defaulting to 'balanced'", route_type)
        route_type = 'balanced'

    log.info(f"Calculating route from ({start_lat}, {start_lng}) to ({end_lat}, {end_lng}), type: {route_type}")

    try:
        # Call the appropriate service function based on route_type
        if route_type == 'cell_coverage':
            result = routing_service.get_route_cell_coverage(start_lat, start_lng, end_lat, end_lng)
        elif route_type == 'fastest':
            result = routing_service.get_route_fastest(start_lat, start_lng, end_lat, end_lng)
        else:  # balanced (default)
            result = routing_service.get_route_balanced(start_lat, start_lng, end_lat, end_lng)

        # Check for errors from the service (e.g., NoRoute, API key error)
        if 'code' in result and result['code'] != 'Ok':
            error_message = result.get('message', 'Route calculation failed')
            log.error("Route calculation service failed for type %s: %s", route_type, error_message)
            # Determine appropriate status code
            status_code = 400 # Bad request (e.g., NoRoute, points too far)
            if result['code'] == 'Error': # Internal server / config error
                status_code = 503 # Service Unavailable or 500 Internal Server Error
            elif result['code'] == 'PointNotFound':
                 status_code = 400 # Bad request (points not on road)
            elif result['code'] == 'NoRoute':
                 status_code = 400 # Bad request (no path between points)
            return jsonify({'error': error_message}), status_code

        # Success
        return jsonify(result) # 200 OK is default

    except Exception as e:
        # Catch unexpected errors during processing
        log.exception(f"Unexpected error in /routing/calculate endpoint: {e}") # Log full traceback
        return jsonify({'error': f'An unexpected error occurred during route calculation.'}), 500

# --- Saved Routes Endpoints ---
@routing_bp.route('/routing/save', methods=['POST']) # Renamed from /save-route
@login_required
def save_route():
    """Endpoint for saving routes for the logged-in user."""
    data = request.json
    user_id = session['user_id'] # Get from session via login_required

    origin = data.get('origin') # Expecting { place_name, lat, lng }
    destination = data.get('destination') # Expecting { place_name, lat, lng }
    route_data = data.get('route_data') # Expecting the raw route response object(s)
    route_type = data.get('route_type', 'balanced') # Active route type being saved
    route_image = data.get('route_image') # Optional base64 image
    route_geometry = data.get('route_geometry') # Optional pre-calculated geometry for display
    has_multiple_routes = data.get('has_multiple_routes', False) # Flag if multiple types were computed

    # Basic validation
    if not all([origin, destination, route_data, route_type]):
        log.warning("Save route request failed for user %s: Missing required data", user_id)
        return jsonify({'error': 'Missing required data (origin, destination, route_data, route_type)'}), 400
    if not isinstance(origin, dict) or not isinstance(destination, dict):
         log.warning("Save route request failed for user %s: Invalid origin/destination format", user_id)
         return jsonify({'error': 'Invalid origin/destination format'}), 400
    if 'lat' not in origin or 'lng' not in origin or 'lat' not in destination or 'lng' not in destination:
         log.warning("Save route request failed for user %s: Missing lat/lng in origin/destination", user_id)
         return jsonify({'error': 'Missing lat/lng in origin/destination'}), 400

    try:
        # Call the model function
        route_id_str, error = route_model.save_route(
            user_id=user_id,
            origin=origin,
            destination=destination,
            route_data=route_data,
            route_type=route_type,
            route_image=route_image,
            route_geometry=route_geometry,
            has_multiple_routes=has_multiple_routes
        )
        if error:
            log.error("Error saving route for user %s: %s", user_id, error)
            # Determine status code based on error type if possible, default 500
            return jsonify({'error': error}), 500

        log.info("Route saved successfully for user %s, route_id: %s", user_id, route_id_str)
        return jsonify({'success': True, 'route_id': route_id_str}), 201 # Use 201 Created

    except Exception as e: # Catch unexpected errors during model call
        log.exception("Unexpected error saving route for user %s: %s", user_id, e)
        return jsonify({'error': 'Failed to save route due to unexpected error'}), 500


@routing_bp.route('/routing/saved', methods=['GET']) # Renamed from /saved-routes
@login_required
def get_saved_routes():
    """Endpoint for retrieving saved routes for the logged-in user."""
    user_id = session['user_id'] # Get from session via login_required
    try:
        # Call the model function
        routes, error = route_model.get_saved_routes(user_id)
        if error:
             log.error("Error retrieving saved routes for user %s: %s", user_id, error)
             # Determine status code based on error type if possible, default 500
             return jsonify({'error': error}), 500

        log.info("Retrieved %d saved routes for user %s", len(routes), user_id)
        # Model function already converts IDs to strings
        return jsonify(routes)
    except Exception as e: # Catch unexpected errors
        log.exception("Unexpected error retrieving saved routes for user %s: %s", user_id, e)
        return jsonify({'error': 'Failed to retrieve saved routes due to unexpected error'}), 500