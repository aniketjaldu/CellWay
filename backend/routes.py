from flask import Blueprint, request, jsonify, session
import services
import models
from functools import wraps

api_bp = Blueprint('api', __name__)

# Authentication middleware
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

@api_bp.route('/register', methods=['POST'])
def register():
    """Endpoint for user registration"""
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not all([username, email, password]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    user, error = models.register_user(username, email, password)
    if error:
        return jsonify({'error': error}), 400
    
    # Set session
    session['user_id'] = user['_id']
    
    return jsonify({'success': True, 'user': user})

@api_bp.route('/login', methods=['POST'])
def login():
    """Endpoint for user login"""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not all([email, password]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    user, error = models.login_user(email, password)
    if error:
        return jsonify({'error': error}), 401
    
    # Set session
    session['user_id'] = user['_id']
    
    return jsonify({'success': True, 'user': user})

@api_bp.route('/logout', methods=['POST'])
def logout():
    """Endpoint for user logout"""
    session.pop('user_id', None)
    return jsonify({'success': True})

@api_bp.route('/user', methods=['GET'])
@login_required
def get_user():
    """Endpoint for getting the current user"""
    user_id = session.get('user_id')
    return jsonify({'user_id': user_id})

@api_bp.route('/geocode', methods=['GET'])
def geocode():
    """Endpoint for geocoding locations"""
    query = request.args.get('query', '')
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400
    
    # Get optional parameters
    autocomplete = request.args.get('autocomplete', 'false').lower() == 'true'
    proximity_lng = request.args.get('proximity_lng')
    proximity_lat = request.args.get('proximity_lat')
    
    # Convert to float if provided
    if proximity_lng and proximity_lat:
        try:
            proximity_lng = float(proximity_lng)
            proximity_lat = float(proximity_lat)
        except (ValueError, TypeError):
            # If conversion fails, don't use proximity
            proximity_lng = None
            proximity_lat = None
    
    result = services.geocode_location(
        query, 
        autocomplete=autocomplete,
        proximity_lng=proximity_lng, 
        proximity_lat=proximity_lat
    )
    return jsonify(result)

@api_bp.route('/reverse-geocode', methods=['GET'])
def reverse_geocode():
    """Endpoint for reverse geocoding"""
    try:
        lat = float(request.args.get('lat'))
        lng = float(request.args.get('lng'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid lat and lng parameters are required'}), 400
    
    result = services.reverse_geocode(lng, lat)
    return jsonify(result)

@api_bp.route('/route', methods=['GET'])
def get_route():
    """Endpoint for calculating routes"""
    try:
        # First try to get individual parameters
        try:
            # Extract and validate parameters with better error handling
            start_lat = request.args.get('start_lat')
            start_lng = request.args.get('start_lng')
            end_lat = request.args.get('end_lat')
            end_lng = request.args.get('end_lng')
            
            # Verify all required parameters are present
            if not all([start_lat, start_lng, end_lat, end_lng]):
                return jsonify({'error': 'Missing required parameters. Need start_lat, start_lng, end_lat, end_lng'}), 400
            
            # Convert to float with proper error handling
            try:
                start_lat = float(start_lat)
                start_lng = float(start_lng)
                end_lat = float(end_lat)
                end_lng = float(end_lng)
            except ValueError:
                return jsonify({'error': 'Coordinates must be valid numbers'}), 400
        except Exception as e:
            # If that fails, try to get OSRM-style waypoints parameter
            waypoints_param = request.args.get('waypoints')
            if not waypoints_param:
                return jsonify({'error': 'Missing coordinates parameters'}), 400
                
            # Parse waypoints in OSRM format: long1,lat1;long2,lat2
            waypoints = waypoints_param.split(';')
            if len(waypoints) < 2:
                return jsonify({'error': 'At least 2 waypoints required'}), 400
                
            start_coords = waypoints[0].split(',')
            end_coords = waypoints[1].split(',')
            
            if len(start_coords) < 2 or len(end_coords) < 2:
                return jsonify({'error': 'Invalid coordinate format'}), 400
                
            # OSRM provides lng,lat but our functions expect lat,lng
            try:
                start_lng, start_lat = float(start_coords[0]), float(start_coords[1])
                end_lng, end_lat = float(end_coords[0]), float(end_coords[1])
            except ValueError:
                return jsonify({'error': 'Coordinates must be valid numbers'}), 400
        
        # Validate coordinate ranges
        if not (-90 <= start_lat <= 90) or not (-90 <= end_lat <= 90):
            return jsonify({'error': 'Latitude must be between -90 and 90'}), 400
        if not (-180 <= start_lng <= 180) or not (-180 <= end_lng <= 180):
            return jsonify({'error': 'Longitude must be between -180 and 180'}), 400
        
        # Default to balanced route type if not specified
        route_type = request.args.get('route_type', 'balanced')
        
        # Get route based on the requested optimization type
        if route_type == 'cell_coverage':
            result = services.get_route_cell_coverage(start_lat, start_lng, end_lat, end_lng)
        elif route_type == 'fastest':
            result = services.get_route_fastest(start_lat, start_lng, end_lat, end_lng)
        else:  # balanced
            result = services.get_route_balanced(start_lat, start_lng, end_lat, end_lng)
        
        # If OSRM response has an error, handle it
        if 'code' in result and result['code'] != 'Ok':
            return jsonify({'error': result.get('message', 'Route calculation failed')}), 400
            
        # Set the content type to application/json explicitly 
        return jsonify(result), 200, {'Content-Type': 'application/json'}
        
    except (TypeError, ValueError) as e:
        print(f"Parameter error: {str(e)}")  # Log the error
        return jsonify({'error': f'Invalid parameters: {str(e)}'}), 400
    except Exception as e:
        print(f"Error in route calculation: {e}")  # Log the error for debugging
        print(f"Args: {request.args}")  # Log all request arguments
        return jsonify({'error': f'Route calculation failed: {str(e)}'}), 500

@api_bp.route('/save-route', methods=['POST'])
@login_required
def save_route():
    """Endpoint for saving routes"""
    data = request.json
    
    user_id = session.get('user_id')
    origin = data.get('origin')
    destination = data.get('destination')
    route_data = data.get('route_data')
    route_type = data.get('route_type', 'balanced')
    
    if not all([origin, destination, route_data]):
        return jsonify({'error': 'Missing required data'}), 400
    
    route_id = models.save_route(user_id, origin, destination, route_data, route_type)
    return jsonify({'success': True, 'route_id': str(route_id)})

@api_bp.route('/saved-routes', methods=['GET'])
@login_required
def get_saved_routes():
    """Endpoint for retrieving saved routes"""
    user_id = session.get('user_id')
    routes = models.get_saved_routes(user_id)
    return jsonify(routes)

@api_bp.route('/cell-coverage', methods=['GET'])
def get_cell_coverage():
    """Endpoint for getting cell tower coverage data for a bounding box"""
    try:
        min_lat = float(request.args.get('min_lat'))
        min_lng = float(request.args.get('min_lng'))
        max_lat = float(request.args.get('max_lat'))
        max_lng = float(request.args.get('max_lng'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid bounding box parameters are required'}), 400
    
    cell_data = services.get_cell_towers(min_lat, min_lng, max_lat, max_lng)
    return jsonify(cell_data)