"""
API endpoints for retrieving cell tower data.
"""
import logging

from flask import Blueprint, jsonify, request

from services import tower_service  # Assuming services package in backend

# Initialize blueprint for cell tower routes
tower_bp = Blueprint("tower", __name__)

# Get logger for this module
log = logging.getLogger(__name__)


@tower_bp.route("/towers", methods=["GET"])
def get_towers():
    """
    Endpoint to retrieve cell tower data within a specified geographic bounding box.

    Accepts query parameters to define the bounding box:
    - 'min_lat' (float): Minimum latitude of the bounding box.
    - 'min_lng' (float): Minimum longitude of the bounding box.
    - 'max_lat' (float): Maximum latitude of the bounding box.
    - 'max_lng' (float): Maximum longitude of the bounding box.

    Returns:
        jsonify: JSON response containing cell tower data or an error message.
                 Returns 200 status with cell tower data on success.
                 Returns 400 status if bounding box parameters are missing or invalid.
                 Returns 500 status for unexpected server errors.
    """
    log.info(f"Received request to get cell towers with arguments: {request.args}")

    # Extract bounding box parameters from the request arguments
    min_lat_str = request.args.get("min_lat")
    min_lng_str = request.args.get("min_lng")
    max_lat_str = request.args.get("max_lat")
    max_lng_str = request.args.get("max_lng")

    # Validate that all bounding box parameters are provided
    if not all([min_lat_str, min_lng_str, max_lat_str, max_lng_str]):
        log.warning("Get towers request failed: Missing bounding box parameters.")
        return jsonify(
            {
                "error": "Missing required bounding box parameters (min_lat, min_lng, max_lat, max_lng)"
            }
        ), 400

    # Convert bounding box coordinate strings to floats, handling potential ValueErrors
    try:
        min_lat = float(min_lat_str)
        min_lng = float(min_lng_str)
        max_lat = float(max_lat_str)
        max_lng = float(max_lng_str)
    except ValueError:
        log.warning(
            "Get towers request failed: Invalid bounding box format. Received arguments: %s",
            request.args,
        )
        return jsonify(
            {
                "error": "Valid bounding box parameters are required (must be numbers)"
            }
        ), 400

    try:
        # Call the tower service to retrieve cell tower data within the bounding box
        cell_data = tower_service.get_cell_towers(min_lat, min_lng, max_lat, max_lng)
        retrieved_count = cell_data.get("total", 0)  # Safely get tower count
        data_source = cell_data.get("source", "N/A")  # Safely get data source

        log.info(
            f"Retrieved {retrieved_count} towers (source: {data_source}) for bounds: "
            f"({min_lat:.4f}, {min_lng:.4f}) to ({max_lat:.4f}, {max_lng:.4f})"  # Formatted floats
        )
        return jsonify(cell_data)  # Return cell tower data as JSON (status code 200 is default)

    except Exception as e:
        log.exception(
            "Error retrieving cell towers for bounds (%f, %f) to (%f, %f): %s",
            min_lat,
            min_lng,
            max_lat,
            max_lng,
            e,
        )
        return jsonify(
            {"error": "Failed to retrieve cell tower data"}
        ), 500  # 500 Internal Server Error