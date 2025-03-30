"""
Contains functions for user management and authentication
interacting with the users collection.
"""
import datetime
import bcrypt
import logging
from bson import ObjectId # Import ObjectId if needed, though we primarily use strings externally

# Import collection from the database module using relative import
from .database import get_users_collection

log = logging.getLogger(__name__)
users_collection = get_users_collection() # Get the collection instance

# --- User Authentication Functions ---
def register_user(email, password):
    """
    Registers a new user in the database.

    Args:
        email (str): The user's email address (must be unique).
        password (str): The user's plain text password.

    Returns:
        tuple: (user_dict, None) on success, or (None, error_message) on failure.
               user_dict contains the user info including string '_id', excluding password.
    """
    if not email or not password:
         return None, "Email and password are required."

    # Check if email already exists
    if users_collection.find_one({'email': email}):
        log.warning(f"Registration failed: Email '{email}' already registered.")
        return None, "Email already registered"

    try:
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        user_doc = {
            'email': email,
            'password': hashed_password,
            'created_at': datetime.datetime.utcnow(),
            'last_login': datetime.datetime.utcnow()
        }
        result = users_collection.insert_one(user_doc)

        # Prepare user info to return
        user_info = {
            '_id': str(result.inserted_id),
            'email': user_doc['email'],
            'created_at': user_doc['created_at'],
            'last_login': user_doc['last_login']
        }

        log.info(f"User registered successfully with email '{email}'.")
        return user_info, None

    except Exception as e:
        log.exception(f"Error during registration for email '{email}': {e}")
        return None, "Registration failed due to a server error."

def login_user(email, password):
    """
    Logs in a user by verifying email and password.

    Args:
        email (str): The user's email address.
        password (str): The user's plain text password.

    Returns:
        tuple: (user_dict, None) on success, or (None, error_message) on failure.
               user_dict contains the user info including string '_id', excluding password.
    """
    if not email or not password:
         return None, "Email and password are required."

    user = users_collection.find_one({'email': email})
    if not user:
        log.warning(f"Login failed: User not found for email '{email}'.")
        return None, "Invalid email or password"

    try:
        if bcrypt.checkpw(password.encode('utf-8'), user['password']):
            # Update last login time
            users_collection.update_one(
                {'_id': user['_id']},
                {'$set': {'last_login': datetime.datetime.utcnow()}}
            )

            # Prepare user info to return
            user_info = {
                '_id': str(user['_id']),
                'email': user['email'],
                'created_at': user.get('created_at'), # Use .get for safety
                'last_login': datetime.datetime.utcnow() # Return updated time
            }

            log.info(f"User '{email}' logged in successfully.")
            return user_info, None
        else:
            log.warning(f"Login failed: Invalid password for email '{email}'.")
            return None, "Invalid email or password"
    except Exception as e:
        log.exception(f"Error during login check for email '{email}': {e}")
        return None, "Login failed due to a server error."

def forgot_password(email):
    """
    Initiates the password reset process (checks if email exists).

    Args:
        email (str): The user's email address.

    Returns:
        tuple: (True, None) if email exists (simulating email sent),
               (False, error_message) if email not found or error occurs.
               Note: For security, route should return generic success regardless.
    """
    if not email:
        return False, "Email is required."
    try:
        user = users_collection.find_one({'email': email})
        if not user:
            log.warning(f"Password reset requested for non-existent email '{email}'.")
            # Return False internally, but route should still show success to user
            return False, "No account found with this email address."

        log.info(f"Password reset requested for existing email '{email}'. (Simulation: No email sent)")
        return True, None # Indicates email exists
    except Exception as e:
        log.exception(f"Error checking email for password reset '{email}': {e}")
        return False, "Server error during password reset check."


def reset_password(email, new_password):
    """
    Resets a user's password in the database.
    (This function might be called after token verification in a real app).

    Args:
        email (str): The user's email address.
        new_password (str): The new plain text password.

    Returns:
        tuple: (True, None) on success, (False, error_message) on failure.
    """
    if not email or not new_password:
        return False, "Email and new password are required."

    try:
        user = users_collection.find_one({'email': email})
        if not user:
            log.warning(f"Password reset failed: No account found for email '{email}'.")
            return False, "No account found with this email address."

        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        result = users_collection.update_one(
            {'_id': user['_id']},
            {'$set': {'password': hashed_password}}
        )

        if result.modified_count == 1:
            log.info(f"Password reset successful for email '{email}'.")
            return True, None
        else:
            # This case should be rare if user was found, but handle it
            log.error(f"Password reset failed for email '{email}': User found but update failed.")
            return False, "Password reset failed during update."

    except Exception as e:
        log.exception(f"Error during password reset for email '{email}': {e}")
        return False, "Password reset failed due to a server error."

def get_user_by_id(user_id_str):
    """
    Retrieves user information by their string ID.

    Args:
        user_id_str (str): The user's ID as a string.

    Returns:
        dict or None: User document (excluding password) or None if not found/error.
    """
    try:
        user_oid = ObjectId(user_id_str) # Convert string ID back to ObjectId
    except Exception:
        log.warning(f"Attempted to find user with invalid ID format: {user_id_str}")
        return None

    try:
        user = users_collection.find_one({'_id': user_oid})
        if user:
            # Prepare user info to return
            user_info = {
                '_id': str(user['_id']),
                'email': user['email'],
                'created_at': user.get('created_at'),
                'last_login': user.get('last_login')
            }
            return user_info
        else:
            return None
    except Exception as e:
        log.exception(f"Error retrieving user by ID '{user_id_str}': {e}")
        return None