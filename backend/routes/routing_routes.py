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
            return jsonify({"error": error_message}), status_code

        return jsonify(result)  # Return successful route calculation result

    except Exception as e:
        log.exception("Unexpected error during route calculation: %s", e)
        return jsonify(
            {"error": "An unexpected error occurred during route calculation."}
        ), 500  # 500 for internal server errors


@routing_bp.route("/routing/save", methods=["POST"])
@login_required
def save_route():
    """
    Endpoint for saving a route for the currently logged-in user. Requires authentication.

    Expected JSON request body:
        {
            "origin": { "place_name": "...", "lat": 0.0, "lng": 0.0 },
            "destination": { "place_name": "...", "lat": 0.0, "lng": 0.0 },
            "route_data": [{ ... }],  // Array of route objects (e.g., fastest, balanced, cell_coverage)
            "route_type": "balanced",  // Active route type at time of save
            "route_image": "data:image/png;base64,...",  // Optional: Base64 encoded image of the route
            "has_multiple_routes": true  // Optional: Indicates if multiple route types were calculated
        }

    Returns:
        jsonify: JSON response with success or error message.
                 Returns 201 status on successful route creation.
                 Returns 400 status for invalid request.
                 Returns 500 status for unexpected server errors or model errors.
    """
    user_id = session["user_id"]  # Get user ID from session (login_required ensures it exists)
    data = request.json  # Get JSON data from request

    # --- Extract and Validate Request Data ---
    # Required fields
    if not data:
        log.warning("Save route rejected: No JSON data in request.")
        return jsonify({"error": "No route data provided."}), 400

    origin = data.get("origin")
    destination = data.get("destination")
    route_data = data.get("route_data")

    # Validate required fields
    if not origin or not isinstance(origin, dict) or not all(key in origin for key in ["lat", "lng"]):
        log.warning("Save route rejected: Missing or invalid origin data.")
        return jsonify({"error": "Origin must include lat and lng coordinates."}), 400

    if not destination or not isinstance(destination, dict) or not all(key in destination for key in ["lat", "lng"]):
        log.warning("Save route rejected: Missing or invalid destination data.")
        return jsonify({"error": "Destination must include lat and lng coordinates."}), 400

    if not route_data:
        log.warning("Save route rejected: Missing route_data.")
        return jsonify({"error": "Route data is required."}), 400

    # Optional fields with defaults
    route_type = data.get("route_type", "balanced")  # Default to balanced if not specified
    route_image = data.get("route_image")  # Optional base64 image of route
    has_multiple_routes = data.get("has_multiple_routes", False)  # Default to false

    # Extract route geometry for easier display
    route_geometry = None
    if isinstance(route_data, dict) and route_data.get(route_type) and route_data[route_type].get("routes"):
        selected_route = route_data[route_type]["routes"][0]  # Assume first route of selected type
        if selected_route and "geometry" in selected_route:
            route_geometry = selected_route["geometry"]  # Extract geometry for more efficient display later

    # Check for the routing provider information
    routing_provider = "graphhopper"  # Default to GraphHopper for backwards compatibility
    if isinstance(route_data, dict) and route_data.get(route_type) and route_data[route_type].get("routing_provider"):
        routing_provider = route_data[route_type]["routing_provider"]

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
            routing_provider=routing_provider,  # Pass the routing provider
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