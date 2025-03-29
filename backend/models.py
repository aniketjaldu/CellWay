from pymongo import MongoClient
from config import Config
import datetime
import bcrypt
import logging

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

client = MongoClient(Config.MONGODB_URI)
db = client['Cellway']

# --- Database Collections ---
users_collection = db.users
routes_collection = db.routes
# Removed unused locations_collection

# --- User Authentication Functions ---
def register_user(email, password):
    """
    Registers a new user in the database.

    Args:
        email (str): The user's email address (must be unique).
        password (str): The user's plain text password.

    Returns:
        tuple: (user_dict, None) on success, or (None, error_message) on failure.
               The user_dict excludes the password hash.
    """
    # Check if email already exists
    if users_collection.find_one({'email': email}):
        logging.warning(f"Registration failed: Email '{email}' already registered.")
        return None, "Email already registered"

    try:
        # Hash the password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        # Create user document
        user_doc = {
            'email': email,
            'password': hashed_password, # Store the hash, not plain text
            'created_at': datetime.datetime.utcnow(),
            'last_login': datetime.datetime.utcnow() # Set initial last_login
        }

        # Insert the user
        result = users_collection.insert_one(user_doc)

        # Prepare user info to return (excluding password)
        user_info = user_doc.copy()
        user_info['_id'] = str(result.inserted_id)
        del user_info['password'] # Never return the password hash

        logging.info(f"User registered successfully with email '{email}'.")
        return user_info, None

    except Exception as e:
        logging.exception(f"Error during registration for email '{email}': {e}")
        return None, "Registration failed due to a server error."

def login_user(email, password):
    """
    Logs in a user by verifying email and password.

    Args:
        email (str): The user's email address.
        password (str): The user's plain text password.

    Returns:
        tuple: (user_dict, None) on success, or (None, error_message) on failure.
               The user_dict excludes the password hash.
    """
    # Find the user by email
    user = users_collection.find_one({'email': email})
    if not user:
        logging.warning(f"Login failed: User not found for email '{email}'.")
        return None, "Invalid email or password"

    # Check password
    try:
        if bcrypt.checkpw(password.encode('utf-8'), user['password']):
            # Update last login time asynchronously if possible, otherwise synchronously
            users_collection.update_one(
                {'_id': user['_id']},
                {'$set': {'last_login': datetime.datetime.utcnow()}}
            )

            # Prepare user info to return (convert ObjectId, exclude password)
            user_info = user.copy()
            user_info['_id'] = str(user['_id'])
            del user_info['password'] # Never return the password hash

            logging.info(f"User '{email}' logged in successfully.")
            return user_info, None
        else:
            logging.warning(f"Login failed: Invalid password for email '{email}'.")
            return None, "Invalid email or password"
    except Exception as e:
        logging.exception(f"Error during login check for email '{email}': {e}")
        return None, "Login failed due to a server error."

def forgot_password(email):
    """
    Initiates the password reset process for a user.
    
    In a production environment, this would typically:
    1. Generate a secure reset token
    2. Store the token with an expiration time
    3. Send an email with a reset link
    
    For this implementation, we'll just check if the email exists.
    
    Args:
        email (str): The user's email address.
        
    Returns:
        tuple: (True, None) if email exists, (False, error_message) if not.
    """
    # Check if the email exists in the database
    user = users_collection.find_one({'email': email})
    if not user:
        logging.warning(f"Password reset failed: No account found for email '{email}'.")
        return False, "No account found with this email address."
    
    # In a real implementation, we would generate a token and send an email here
    # For now, we'll just log that the request was received
    logging.info(f"Password reset requested for email '{email}'.")
    
    # Return success - in a real app, this would mean "email sent"
    return True, None

def reset_password(email, new_password):
    """
    Resets a user's password.
    
    Args:
        email (str): The user's email address.
        new_password (str): The new plain text password.
        
    Returns:
        tuple: (True, None) on success, (False, error_message) on failure.
    """
    # Find the user by email
    user = users_collection.find_one({'email': email})
    if not user:
        logging.warning(f"Password reset failed: No account found for email '{email}'.")
        return False, "No account found with this email address."
    
    try:
        # Hash the new password
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        
        # Update the user's password
        users_collection.update_one(
            {'_id': user['_id']},
            {'$set': {'password': hashed_password}}
        )
        
        logging.info(f"Password reset successful for email '{email}'.")
        return True, None
    
    except Exception as e:
        logging.exception(f"Error during password reset for email '{email}': {e}")
        return False, "Password reset failed due to a server error."


# --- Route Management Functions ---
def save_route(user_id, origin, destination, route_data, route_type="balanced"):
    """
    Saves a route for a specific user.

    Limits the number of saved routes per user to 3. If the user already has 3
    routes, the oldest one is deleted before saving the new one.

    Args:
        user_id (str): The ID of the user saving the route.
        origin (dict or str): Information about the route origin.
        destination (dict or str): Information about the route destination.
        route_data (dict): The detailed route data (e.g., geometry, duration).
        route_type (str): The optimization type ('fastest', 'balanced', etc.).

    Returns:
        ObjectId: The ID of the newly inserted route document.
    """
    # Define the maximum number of routes to keep per user
    MAX_SAVED_ROUTES = 3

    try:
        # Count existing routes for the user
        current_route_count = routes_collection.count_documents({'user_id': user_id})

        # If the user is at or above the limit, remove the oldest route(s)
        if current_route_count >= MAX_SAVED_ROUTES:
            # Find the oldest routes, sorted by creation date (ascending)
            routes_to_delete = list(routes_collection.find(
                {'user_id': user_id},
                sort=[('created_at', 1)], # Oldest first
                limit=(current_route_count - MAX_SAVED_ROUTES + 1) # Number to delete
            ))

            # Delete the oldest route(s)
            for old_route in routes_to_delete:
                routes_collection.delete_one({'_id': old_route['_id']})
                logging.info(f"Removed oldest route '{old_route['_id']}' for user '{user_id}' to maintain limit.")

        # Create the new route document
        new_route = {
            'user_id': user_id,
            'origin': origin,
            'destination': destination,
            'route_data': route_data,
            'route_type': route_type,
            'created_at': datetime.datetime.utcnow()
        }

        # Insert the new route
        result = routes_collection.insert_one(new_route)
        logging.info(f"Saved new route '{result.inserted_id}' for user '{user_id}'.")
        return result.inserted_id

    except Exception as e:
        logging.exception(f"Error saving route for user '{user_id}': {e}")
        raise # Re-raise the exception to be handled by the caller

def get_saved_routes(user_id):
    """
    Retrieves the 3 most recently saved routes for a specific user.

    Args:
        user_id (str): The ID of the user whose routes are to be retrieved.

    Returns:
        list: A list of route documents, sorted by creation date (newest first).
              Each route's '_id' is converted to a string.
    """
    try:
        # Get the 3 most recent routes for the user
        routes_cursor = routes_collection.find(
            {'user_id': user_id},
            sort=[('created_at', -1)], # Newest first
            limit=3
        )

        # Convert cursor to list and ObjectId to string
        routes = []
        for route in routes_cursor:
            route['_id'] = str(route['_id'])
            routes.append(route)

        logging.info(f"Retrieved {len(routes)} saved routes for user '{user_id}'.")
        return routes

    except Exception as e:
        logging.exception(f"Error retrieving saved routes for user '{user_id}': {e}")
        raise # Re-raise the exception