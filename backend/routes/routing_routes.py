"""
API endpoints for route calculation and saved route management:
- Route Calculation: Fastest, Cell Coverage, Balanced routes.
- Saved Routes: Saving and retrieving routes for authenticated users.
"""
import logging

from flask import Blueprint, jsonify, request, session

from .auth_routes import login_required  # Import from sibling module within routes/
from models import route as route_model  # Import the specific route model module
from services import routing_service  # Go up to backend/, then down to services/

# Initialize blueprint for routing routes
routing_bp = Blueprint("routing", __name__)

# Get logger for this module
log = logging.getLogger(__name__)


@routing_bp.route("/routing/calculate", methods=["GET"])  # Renamed from /route for clarity
def calculate_route():
    """
    Endpoint for calculating routes based on different optimization types.

    Accepts query parameters for start and end coordinates (latitude and longitude),
    and an optional 'route_type' parameter to specify the optimization (fastest, cell_coverage, balanced).

    Returns:
        jsonify: JSON response containing route data or an error message.
                 Returns 400 status for missing or invalid coordinate parameters, or invalid route_type.
                 Returns appropriate error status codes based on routing service responses (e.g., 400, 503).
                 Returns 500 status for unexpected server errors.
    """
    # Extract coordinate parameters from the request
    start_lat_str = request.args.get("start_lat")
    start_lng_str = request.args.get("start_lng")
    end_lat_str = request.args.get("end_lat")
    end_lng_str = request.args.get("end_lng")

    # Validate that all coordinate parameters are provided
    if not all([start_lat_str, start_lng_str, end_lat_str, end_lng_str]):
        log.warning("Route calculation request failed: Missing coordinate parameters.")
        return jsonify(
            {
                "error": "Missing required coordinates (start_lat, start_lng, end_lat, end_lng)"
            }
        ), 400

    # Convert coordinate strings to floats and handle potential ValueError
    try:
        start_lat = float(start_lat_str)
        start_lng = float(start_lng_str)
        end_lat = float(end_lat_str)
        end_lng = float(end_lng_str)
    except ValueError:
        log.warning(
            "Route calculation request failed: Invalid coordinate format. Received: start=(%s, %s), end=(%s, %s)",
            start_lat_str,
            start_lng_str,
            end_lat_str,
            end_lng_str,
        )
        return jsonify({"error": "Coordinates must be valid numbers"}), 400

    # Get route type from query parameters, default to 'balanced' if not provided or invalid
    route_type = request.args.get("route_type", "balanced").lower()
    valid_route_types = ["fastest", "cell_coverage", "balanced"]
    if route_type not in valid_route_types:
        log.warning(
            f"Route calculation request with invalid route_type '{route_type}', defaulting to 'balanced'."
        )
        route_type = "balanced"

    log.info(
        f"Calculating '{route_type}' route from ({start_lat}, {start_lng}) to ({end_lat}, {end_lng})."
    )

    try:
        # Call the appropriate routing service function based on route_type
        if route_type == "cell_coverage":
            result = routing_service.get_route_cell_coverage(start_lat, start_lng, end_lat, end_lng)
        elif route_type == "fastest":
            result = routing_service.get_route_fastest(start_lat, start_lng, end_lat, end_lng)
        else:  # balanced (default)
            result = routing_service.get_route_balanced(start_lat, start_lng, end_lat, end_lng)

        # Handle potential errors from the routing service
        if "code" in result and result["code"] != "Ok":
            error_message = result.get("message", "Route calculation failed")
            log.error(f"Routing service failed for '{route_type}' route: {error_message}")
            status_code = 400  # Default to 400 Bad Request
            error_code = result["code"]
            if error_code == "Error":  # Service internal error
                status_code = 503  # Service Unavailable
            elif error_code in ["PointNotFound", "NoRoute"]:  # Input related errors
                status_code = 400  # Bad Request
            elif error_code == "DistanceLimitExceeded":  # Distance limit error
                status_code = 400  # Bad Request
            return jsonify({"error": error_message}), status_code

        return jsonify(result)  # Return successful route calculation result

    except Exception as e:
        log.exception("Unexpected error during route calculation: %s", e)
        return jsonify(
            {"error": "An unexpected error occurred during route calculation."}
        ), 500  # 500 for internal server errors


@routing_bp.route("/routing/save", methods=["POST"])  # Renamed from /save-route
@login_required
def save_route():
    """
    Endpoint for saving a route for the logged-in user. Requires authentication.

    Expects JSON data in the request body containing route details:
    - 'origin' (dict): Origin location details {place_name, lat, lng}.
    - 'destination' (dict): Destination location details {place_name, lat, lng}.
    - 'route_data' (dict): Detailed route data object(s).
    - 'route_type' (str): Route optimization type ('balanced', 'fastest', etc.).
    - 'route_image' (str, optional): Base64 encoded image of the route map.
    - 'route_geometry' (dict, optional): Pre-calculated geometry for display.
    - 'has_multiple_routes' (bool, optional): Flag for multiple route types.

    Returns:
        jsonify: JSON response indicating success or error.
                 Returns 201 status on successful route saving with the new route ID.
                 Returns 400 status for missing or invalid request data.
                 Returns 500 status for unexpected server errors or model errors.
    """
    user_id = session["user_id"]  # Get user ID from session (login_required ensures it exists)
    data = request.json

    # Extract route details from JSON data
    origin = data.get("origin")
    destination = data.get("destination")
    route_data = data.get("route_data")
    route_type = data.get("route_type", "balanced")  # Default to 'balanced' if not provided
    route_image = data.get("route_image")
    route_geometry = data.get("route_geometry")
    has_multiple_routes = data.get("has_multiple_routes", False)  # Default to False if not provided

    # Validate that required data is present
    if not all([origin, destination, route_data, route_type]):
        log.warning(f"Save route request failed for user '{user_id}': Missing required data.")
        return jsonify(
            {
                "error": "Missing required data (origin, destination, route_data, route_type)"
            }
        ), 400
    if not isinstance(origin, dict) or not isinstance(destination, dict):
        log.warning(
            f"Save route request failed for user '{user_id}': Invalid origin/destination format."
        )
        return jsonify({"error": "Invalid origin/destination format"}), 400
    if not all(key in origin for key in ["lat", "lng"]) or not all(
        key in destination for key in ["lat", "lng"]
    ):
        log.warning(
            f"Save route request failed for user '{user_id}': Missing 'lat' or 'lng' in origin/destination."
        )
        return jsonify({"error": "Missing 'lat' or 'lng' in origin/destination"}), 400

    try:
        # Call the route model to save the route to the database
        route_id_str, error = route_model.save_route(
            user_id=user_id,
            origin=origin,
            destination=destination,
            route_data=route_data,
            route_type=route_type,
            route_image=route_image,
            route_geometry=route_geometry,
            has_multiple_routes=has_multiple_routes,
        )
        if error:
            log.error(f"Error saving route for user '{user_id}': {error}")
            return jsonify({"error": error}), 500  # 500 for model-related errors

        log.info(f"Route saved successfully for user '{user_id}', route_id: '{route_id_str}'.")
        return jsonify({"success": True, "route_id": route_id_str}), 201  # 201 Created

    except Exception as e:
        log.exception(f"Unexpected error saving route for user '{user_id}': {e}")
        return jsonify(
            {"error": "Failed to save route due to unexpected error"}
        ), 500  # 500 for general server errors


@routing_bp.route("/routing/saved", methods=["GET"])  # Renamed from /saved-routes
@login_required
def get_saved_routes():
    """
    Endpoint for retrieving saved routes for the logged-in user. Requires authentication.

    Returns:
        jsonify: JSON response containing a list of saved route objects or an error message.
                 Returns 200 status on successful retrieval of saved routes.
                 Returns 500 status for unexpected server errors or model errors.
    """
    user_id = session["user_id"]  # Get user ID from session (login_required ensures it exists)
    try:
        # Call the route model to retrieve saved routes from the database
        routes, error = route_model.get_saved_routes(user_id)
        if error:
            log.error(f"Error retrieving saved routes for user '{user_id}': {error}")
            return jsonify({"error": error}), 500  # 500 for model-related errors

        log.info(f"Retrieved {len(routes)} saved routes for user '{user_id}'.")
        return jsonify(routes)  # Return list of saved routes

    except Exception as e:
        log.exception(f"Unexpected error retrieving saved routes for user '{user_id}': {e}")
        return jsonify(
            {"error": "Failed to retrieve saved routes due to unexpected error"}
        ), 500  # 500 for general server errors