from flask import Blueprint, request, jsonify, session
import services
import models
from functools import wraps
import logging # Added for logging

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

api_bp = Blueprint('api', __name__)

# --- Authentication Middleware ---
def login_required(f):
    """Decorator to ensure the user is logged in."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            logging.warning("Authentication required for endpoint: %s", request.path)
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- Authentication Endpoints ---
@api_bp.route('/register', methods=['POST'])
def register():
    """Endpoint for user registration."""
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        logging.warning("Registration attempt failed: Missing required fields")
        return jsonify({'error': 'Missing required fields'}), 400

    user, error = models.register_user(email, password)
    if error:
        logging.warning("Registration attempt failed for email %s: %s", email, error)
        return jsonify({'error': error}), 400

    # Set session upon successful registration
    session['user_id'] = user['_id']
    logging.info("User registered successfully: %s", email)
    
    # Omit sensitive data like password hash before returning
    user_info = {k: v for k, v in user.items() if k != 'password'}
    return jsonify({'success': True, 'user': user_info})

@api_bp.route('/login', methods=['POST'])
def login():
    """Endpoint for user login."""
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        logging.warning("Login attempt failed: Missing required fields")
        return jsonify({'error': 'Missing required fields'}), 400

    user, error = models.login_user(email, password)
    if error:
        logging.warning("Login attempt failed for email %s: %s", email, error)
        return jsonify({'error': error}), 401

    # Set session upon successful login
    session['user_id'] = user['_id']
    logging.info("User logged in successfully: %s", email)

    # Omit sensitive data like password hash before returning
    user_info = {k: v for k, v in user.items() if k != 'password'}
    return jsonify({'success': True, 'user': user_info})

@api_bp.route('/logout', methods=['POST'])
def logout():
    """Endpoint for user logout."""
    user_id = session.pop('user_id', None)
    if user_id:
        logging.info("User logged out: %s", user_id)
    else:
        logging.warning("Logout attempt without active session")
    return jsonify({'success': True})

@api_bp.route('/user', methods=['GET'])
@login_required
def get_user():
    """Endpoint for getting the current authenticated user's ID."""
    user_id = session.get('user_id')
    # Optionally fetch more user details from models if needed
    return jsonify({'user_id': user_id})

@api_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Endpoint for initiating password reset."""
    data = request.json
    email = data.get('email')

    if not email:
        logging.warning("Password reset attempt failed: Missing email")
        return jsonify({'error': 'Email is required'}), 400

    success, error = models.forgot_password(email)
    if not success:
        logging.warning("Password reset attempt failed for email %s: %s", email, error)
        return jsonify({'error': error}), 400

    # In a real application, an email would be sent here
    logging.info("Password reset initiated for email: %s", email)
    return jsonify({'success': True, 'message': 'Password reset email sent'})

# --- Geocoding Endpoints ---
@api_bp.route('/geocode', methods=['GET'])
def geocode():
    """Endpoint for forward geocoding locations (address to coordinates)."""
    query = request.args.get('query', '')
    if not query:
        logging.warning("Geocode request failed: Query parameter is required")
        return jsonify({'error': 'Query parameter is required'}), 400

    # Get optional parameters
    autocomplete = request.args.get('autocomplete', 'false').lower() == 'true'
    proximity_lng = request.args.get('proximity_lng')
    proximity_lat = request.args.get('proximity_lat')

    # Convert proximity to float if provided
    proximity = None
    if proximity_lng and proximity_lat:
        try:
            proximity = (float(proximity_lng), float(proximity_lat))
        except (ValueError, TypeError):
            logging.warning("Geocode request with invalid proximity values: lng=%s, lat=%s", proximity_lng, proximity_lat)
            # If conversion fails, don't use proximity

    result = services.geocode_location(
        query,
        autocomplete=autocomplete,
        proximity=proximity
    )
    return jsonify(result)

@api_bp.route('/reverse-geocode', methods=['GET'])
def reverse_geocode():
    """Endpoint for reverse geocoding (coordinates to address)."""
    try:
        lat = float(request.args.get('lat'))
        lng = float(request.args.get('lng'))
    except (TypeError, ValueError, AttributeError):
        logging.warning("Reverse geocode request failed: Valid lat and lng parameters are required. Received: lat=%s, lng=%s", request.args.get('lat'), request.args.get('lng'))
        return jsonify({'error': 'Valid lat and lng parameters are required'}), 400

    result = services.reverse_geocode(lng, lat)
    return jsonify(result)

# --- Routing Endpoints ---
@api_bp.route('/route', methods=['GET'])
def get_route():
    """Endpoint for calculating routes with different optimizations."""
    try:
        # Extract and validate coordinates
        start_lat_str = request.args.get('start_lat')
        start_lng_str = request.args.get('start_lng')
        end_lat_str = request.args.get('end_lat')
        end_lng_str = request.args.get('end_lng')

        if not all([start_lat_str, start_lng_str, end_lat_str, end_lng_str]):
            logging.warning("Route request failed: Missing coordinate parameters")
            return jsonify({'error': 'Missing required coordinates (start_lat, start_lng, end_lat, end_lng)'}), 400

        try:
            start_lat = float(start_lat_str)
            start_lng = float(start_lng_str)
            end_lat = float(end_lat_str)
            end_lng = float(end_lng_str)
        except ValueError:
            logging.warning("Route request failed: Invalid coordinate format. Received: start=(%s, %s), end=(%s, %s)", start_lat_str, start_lng_str, end_lat_str, end_lng_str)
            return jsonify({'error': 'Coordinates must be valid numbers'}), 400

        # Get optimization type (defaults to balanced)
        route_type = request.args.get('route_type', 'balanced').lower()
        valid_route_types = ['fastest', 'cell_coverage', 'balanced']
        if route_type not in valid_route_types:
            logging.warning("Route request with invalid route_type '%s', defaulting to 'balanced'", route_type)
            route_type = 'balanced'

        logging.info(f"Calculating route from ({start_lat}, {start_lng}) to ({end_lat}, {end_lng}), type: {route_type}")

        # Call the appropriate service function
        if route_type == 'cell_coverage':
            result = services.get_route_cell_coverage(start_lat, start_lng, end_lat, end_lng)
        elif route_type == 'fastest':
            result = services.get_route_fastest(start_lat, start_lng, end_lat, end_lng)
        else:  # balanced (default)
            result = services.get_route_balanced(start_lat, start_lng, end_lat, end_lng)

        # Check for errors from the service
        if 'code' in result and result['code'] != 'Ok':
            error_message = result.get('message', 'Route calculation failed')
            logging.error("Route calculation service failed for type %s: %s", route_type, error_message)
            return jsonify({'error': error_message}), 400 # Use 400 for known calc errors like NoRoute

        # Success
        return jsonify(result) # 200 OK is default

    except Exception as e:
        # Catch unexpected errors during processing
        logging.exception(f"Unexpected error in /route endpoint: {e}") # Log full traceback
        return jsonify({'error': f'An unexpected error occurred during route calculation.'}), 500

# --- Saved Routes Endpoints ---
@api_bp.route('/save-route', methods=['POST'])
@login_required
def save_route():
    """Endpoint for saving routes for the logged-in user."""
    data = request.json
    user_id = session['user_id'] # Get from session via login_required

    origin = data.get('origin')
    destination = data.get('destination')
    route_data = data.get('route_data')
    route_type = data.get('route_type', 'balanced') # Default if not provided
    route_image = data.get('route_image') # Get the route image if provided

    if not all([origin, destination, route_data]):
        logging.warning("Save route request failed for user %s: Missing required data", user_id)
        return jsonify({'error': 'Missing required data (origin, destination, route_data)'}), 400

    try:
        route_id = models.save_route(user_id, origin, destination, route_data, route_type, route_image)
        logging.info("Route saved successfully for user %s, route_id: %s", user_id, str(route_id))
        return jsonify({'success': True, 'route_id': str(route_id)})
    except Exception as e:
        logging.exception("Error saving route for user %s: %s", user_id, e)
        return jsonify({'error': 'Failed to save route'}), 500

@api_bp.route('/saved-routes', methods=['GET'])
@login_required
def get_saved_routes():
    """Endpoint for retrieving saved routes for the logged-in user."""
    user_id = session['user_id'] # Get from session via login_required
    try:
        routes = models.get_saved_routes(user_id)
        logging.info("Retrieved %d saved routes for user %s", len(routes), user_id)
        return jsonify(routes)
    except Exception as e:
        logging.exception("Error retrieving saved routes for user %s: %s", user_id, e)
        return jsonify({'error': 'Failed to retrieve saved routes'}), 500

# --- Cell Tower Endpoint ---
@api_bp.route('/towers', methods=['GET'])
def get_towers():
    """Endpoint for getting cell tower data within a specified bounding box."""
    try:
        min_lat = float(request.args.get('min_lat'))
        min_lng = float(request.args.get('min_lng'))
        max_lat = float(request.args.get('max_lat'))
        max_lng = float(request.args.get('max_lng'))
    except (TypeError, ValueError, AttributeError):
        logging.warning("Get towers request failed: Valid bounding box parameters required. Received: %s", request.args)
        return jsonify({'error': 'Valid bounding box parameters (min_lat, min_lng, max_lat, max_lng) are required'}), 400

    try:
        cell_data = services.get_cell_towers(min_lat, min_lng, max_lat, max_lng)
        logging.info("Retrieved %d towers for bounds: (%f, %f) to (%f, %f)",
                     cell_data.get('total', 0), min_lat, min_lng, max_lat, max_lng)
        return jsonify(cell_data)
    except Exception as e:
        logging.exception("Error retrieving cell towers for bounds (%f, %f) to (%f, %f): %s",
                          min_lat, min_lng, max_lat, max_lng, e)
        return jsonify({'error': 'Failed to retrieve cell tower data'}), 500