"""
Contains functions for managing saved routes
interacting with the routes collection.
"""
import datetime
import logging
from bson import ObjectId # Import ObjectId for database operations

# Import collection from the database module using relative import
from .database import get_routes_collection

log = logging.getLogger(__name__)
routes_collection = get_routes_collection() # Get the collection instance

# Define the maximum number of routes to keep per user
MAX_SAVED_ROUTES = 3

def save_route(user_id, origin, destination, route_data, route_type="balanced",
               route_image=None, route_geometry=None, has_multiple_routes=False):
    """
    Saves a route for a specific user, enforcing a limit on the number of saved routes.

    Args:
        user_id (str): The string ID of the user saving the route.
        origin (dict): Origin info { place_name, lat, lng }.
        destination (dict): Destination info { place_name, lat, lng }.
        route_data (dict): The detailed route data object(s).
        route_type (str): The optimization type ('fastest', 'balanced', etc.).
        route_image (str, optional): Base64 encoded image of the route map.
        route_geometry (dict, optional): Pre-calculated geometry for display.
        has_multiple_routes (bool): Flag if multiple route types were computed.

    Returns:
        tuple: (route_id_str, None) on success, or (None, error_message) on failure.
    """
    try:
        # Convert user_id string to ObjectId if stored as such, otherwise keep as string
        # Assuming user_id is passed as string from session and stored as string in routes
        user_identifier = user_id

        # Count existing routes for the user
        current_route_count = routes_collection.count_documents({'user_id': user_identifier})

        # If the user is at or above the limit, remove the oldest route(s)
        if current_route_count >= MAX_SAVED_ROUTES:
            num_to_delete = current_route_count - MAX_SAVED_ROUTES + 1
            # Find the oldest routes, sorted by creation date (ascending)
            routes_to_delete_cursor = routes_collection.find(
                {'user_id': user_identifier},
                sort=[('created_at', 1)], # Oldest first
                limit=num_to_delete
            )
            ids_to_delete = [route['_id'] for route in routes_to_delete_cursor]

            if ids_to_delete:
                delete_result = routes_collection.delete_many({'_id': {'$in': ids_to_delete}})
                log.info(f"Removed {delete_result.deleted_count} oldest route(s) for user '{user_identifier}' to maintain limit.")

        # Create the new route document
        new_route = {
            'user_id': user_identifier, # Store user ID
            'origin': origin,
            'destination': destination,
            'route_data': route_data, # Store the potentially complex route object(s)
            'route_type': route_type, # Store the active type when saved
            'route_geometry': route_geometry, # Store optional geometry
            'has_multiple_routes': has_multiple_routes, # Store flag
            'created_at': datetime.datetime.utcnow()
        }

        if route_image:
            new_route['route_image'] = route_image

        result = routes_collection.insert_one(new_route)
        new_route_id_str = str(result.inserted_id)
        log.info(f"Saved new route '{new_route_id_str}' for user '{user_identifier}'.")
        return new_route_id_str, None

    except Exception as e:
        log.exception(f"Error saving route for user '{user_id}': {e}")
        return None, "Failed to save route due to a server error."

def get_saved_routes(user_id):
    """
    Retrieves the most recently saved routes for a specific user (up to MAX_SAVED_ROUTES).

    Args:
        user_id (str): The string ID of the user.

    Returns:
        tuple: (routes_list, None) on success, or (None, error_message) on failure.
               Each route's '_id' and 'user_id' are converted to strings.
    """
    try:
        # Assuming user_id is passed as string and stored as string
        user_identifier = user_id

        routes_cursor = routes_collection.find(
            {'user_id': user_identifier},
            sort=[('created_at', -1)], # Newest first
            limit=MAX_SAVED_ROUTES
        )

        routes = []
        for route in routes_cursor:
            route['_id'] = str(route['_id'])
            # Ensure user_id is string if it exists in the doc (it should)
            if 'user_id' in route:
                route['user_id'] = str(route['user_id'])
            routes.append(route)

        log.info(f"Retrieved {len(routes)} saved routes for user '{user_identifier}'.")
        return routes, None

    except Exception as e:
        log.exception(f"Error retrieving saved routes for user '{user_id}': {e}")
        return None, "Failed to retrieve saved routes due to a server error."