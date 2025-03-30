"""
Handles cell tower data related API endpoints.
"""
from flask import Blueprint, request, jsonify
import logging
# Assuming services are moved to backend.services package
from services import tower_service

log = logging.getLogger(__name__)

tower_bp = Blueprint('tower', __name__)

@tower_bp.route('/towers', methods=['GET'])
def get_towers():
    """Endpoint for getting cell tower data within a specified bounding box."""
    log.info(f"Received request args: {request.args}")
    min_lat_str = request.args.get('min_lat')
    min_lng_str = request.args.get('min_lng')
    max_lat_str = request.args.get('max_lat')
    max_lng_str = request.args.get('max_lng')

    if not all([min_lat_str, min_lng_str, max_lat_str, max_lng_str]):
            log.warning("Get towers request failed: Missing bounding box parameters.")
            return jsonify({'error': 'Missing required bounding box parameters (min_lat, min_lng, max_lat, max_lng)'}), 400

    try:
        min_lat = float(min_lat_str)
        min_lng = float(min_lng_str)
        max_lat = float(max_lat_str)
        max_lng = float(max_lng_str)
    except (ValueError, TypeError):
        log.warning("Get towers request failed: Invalid bounding box format. Received: %s", request.args)
        return jsonify({'error': 'Valid bounding box parameters are required (must be numbers)'}), 400

    try:
        cell_data = tower_service.get_cell_towers(min_lat, min_lng, max_lat, max_lng)
        log.info("Retrieved %d towers (source: %s) for bounds: (%f, %f) to (%f, %f)",
                    cell_data.get('total', 0), cell_data.get('source', 'N/A'),
                    min_lat, min_lng, max_lat, max_lng)
        return jsonify(cell_data)
    except Exception as e:
        log.exception("Error retrieving cell towers for bounds (%f, %f) to (%f, %f): %s",
                        min_lat, min_lng, max_lat, max_lng, e)
        return jsonify({'error': 'Failed to retrieve cell tower data'}), 500