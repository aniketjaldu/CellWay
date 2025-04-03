"""
Manages saved routes in MongoDB, including saving, retrieving, and enforcing limits.
Interacts with the 'routes' collection in the database.
"""

import datetime
import logging

from bson import ObjectId  # Import ObjectId for potential future database operations with ObjectIds

from .database import get_route_collection  # Relative import from database module

# Initialize logger for this module
log = logging.getLogger(__name__)

# Get the routes collection instance from the database module
routes_collection = get_route_collection()

# Define the maximum number of saved routes allowed per user
MAX_SAVED_ROUTES = 3


def save_route(
    user_id: str,
    origin: dict,
    destination: dict,
    route_data: dict,
    route_type: str = "balanced",
    route_image: str = None,
    route_geometry: dict = None,
    has_multiple_routes: bool = False,
    routing_provider: str = "graphhopper",  # Added routing provider parameter
) -> tuple[str, str | None]:
    """
    Saves a route for a user, enforcing a maximum limit on saved routes per user.

    If the user already has the maximum number of saved routes, the oldest route(s)
    will be deleted to make space for the new route.

    Args:
        user_id (str): The ID of the user saving the route.
        origin (dict): Dictionary containing origin place details (e.g., {'place_name': '...', 'lat': ..., 'lng': ...}).
        destination (dict): Dictionary containing destination place details (e.g., {'place_name': '...', 'lat': ..., 'lng': ...}).
        route_data (dict): Detailed route data object(s) to be saved.
        route_type (str): Type of route optimization ('fastest', 'balanced', etc.). Defaults to 'balanced'.
        route_image (str, optional): Base64 encoded image of the route map. Defaults to None.
        route_geometry (dict, optional): Pre-calculated geometry data for route display. Defaults to None.
        has_multiple_routes (bool): Flag indicating if multiple route types were computed. Defaults to False.
        routing_provider (str): The routing service that provided the route ('graphhopper', 'osrm'). Defaults to 'graphhopper'.

    Returns:
        tuple[str, str | None]: A tuple containing the new route's ID (as a string) and None on success,
                                 or (None, error_message) if saving fails.
    """
    try:
        user_identifier = user_id  # User ID is assumed to be a string

        # Count the current number of saved routes for the user
        current_route_count = routes_collection.count_documents({"user_id": user_identifier})

        # Enforce route limit: if limit is reached, delete the oldest routes
        if current_route_count >= MAX_SAVED_ROUTES:
            num_routes_to_delete = current_route_count - MAX_SAVED_ROUTES + 1
            oldest_routes_cursor = routes_collection.find(
                {"user_id": user_identifier},
                sort=[("created_at", 1)],  # Sort by creation date, oldest first
                limit=num_routes_to_delete,
            )
            ids_to_delete = [route["_id"] for route in oldest_routes_cursor]

            if ids_to_delete:
                delete_result = routes_collection.delete_many({"_id": {"$in": ids_to_delete}})
                log.info(
                    f"Removed {delete_result.deleted_count} oldest route(s) for user '{user_identifier}' "
                    f"to maintain the saved routes limit of {MAX_SAVED_ROUTES}."
                )

        # Construct the new route document
        new_route = {
            "user_id": user_identifier,
            "origin": origin,
            "destination": destination,
            "route_data": route_data,
            "route_type": route_type,
            "route_geometry": route_geometry,
            "has_multiple_routes": has_multiple_routes,
            "routing_provider": routing_provider,  # Save the routing provider
            "created_at": datetime.datetime.utcnow(),
        }
        if route_image:
            new_route["route_image"] = route_image  # Add route image if provided

        # Insert the new route into the collection
        insert_result = routes_collection.insert_one(new_route)
        new_route_id_str = str(insert_result.inserted_id)
        log.info(f"Successfully saved new route '{new_route_id_str}' for user '{user_identifier}' using {routing_provider}.")
        return new_route_id_str, None

    except Exception as e:
        log.exception(f"Error encountered while saving route for user '{user_id}': {e}")
        return None, "Failed to save route due to a server error."


def get_saved_routes(user_id: str) -> tuple[list[dict], str | None]:
    """
    Retrieves the most recently saved routes for a given user, up to the maximum limit (MAX_SAVED_ROUTES).

    Routes are returned sorted by creation date, newest first. The '_id' and 'user_id'
    fields in each route document are converted to strings for consistent data handling.

    Args:
        user_id (str): The ID of the user for whom to retrieve saved routes.

    Returns:
        tuple[list[dict], str | None]: A tuple containing a list of saved route dictionaries and None on success,
                                      or (None, error_message) if retrieval fails.
    """
    try:
        user_identifier = user_id  # User ID is assumed to be a string

        # Query for routes, sorted by creation date (newest first), up to the limit
        routes_cursor = routes_collection.find(
            {"user_id": user_identifier},
            sort=[("created_at", -1)],  # Sort by creation date, newest first
            limit=MAX_SAVED_ROUTES,
        )

        routes = []
        for route in routes_cursor:
            route["_id"] = str(route["_id"])  # Convert ObjectId to string for consistent handling
            if "user_id" in route:
                route["user_id"] = str(route["user_id"])  # Ensure user_id is also a string
            
            # Ensure routing_provider field exists, default to graphhopper for backward compatibility
            if "routing_provider" not in route:
                route["routing_provider"] = "graphhopper"  # Set default provider for routes saved before this feature
                
            routes.append(route)

        log.info(f"Retrieved {len(routes)} saved routes for user '{user_identifier}'.")
        return routes, None

    except Exception as e:
        log.exception(f"Error retrieving saved routes for user '{user_id}': {e}")
        return None, "Failed to retrieve saved routes due to a server error."
