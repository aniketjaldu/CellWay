from flask import Blueprint, request, jsonify
import services
import models

api_bp = Blueprint('api', __name__)

@api_bp.route('/geocode', methods=['GET'])
def geocode():
    """Endpoint for geocoding locations"""
    query = request.args.get('query', '')
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400
    
    result = services.geocode_location(query)
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
        start_lat = float(request.args.get('start_lat'))
        start_lng = float(request.args.get('start_lng'))
        end_lat = float(request.args.get('end_lat'))
        end_lng = float(request.args.get('end_lng'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid coordinate parameters are required'}), 400
    
    result = services.get_route(start_lat, start_lng, end_lat, end_lng)
    return jsonify(result)

@api_bp.route('/save-route', methods=['POST'])
def save_route():
    """Endpoint for saving routes"""
    data = request.json
    
    # Dummy user_id for now
    user_id = data.get('user_id', 'anonymous')
    origin = data.get('origin')
    destination = data.get('destination')
    route_data = data.get('route_data')
    
    if not all([origin, destination, route_data]):
        return jsonify({'error': 'Missing required data'}), 400
    
    route_id = models.save_route(user_id, origin, destination, route_data)
    return jsonify({'success': True, 'route_id': str(route_id)})

@api_bp.route('/saved-routes', methods=['GET'])
def get_saved_routes():
    """Endpoint for retrieving saved routes"""

    # Dummy user_id for now
    user_id = request.args.get('user_id', 'anonymous')
    
    routes = models.get_saved_routes(user_id)
    return jsonify(routes) 