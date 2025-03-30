"""
Contains functions for user management and authentication
interacting with the users collection.
"""
import datetime
import bcrypt
import logging
import secrets
from bson import ObjectId
from datetime import timedelta


# Import collection from the database module using relative import
from .database import get_users_collection

log = logging.getLogger(__name__)
users_collection = get_users_collection() # Get the collection instance

MAX_LOGIN_ATTEMPTS = 7
LOCKOUT_DURATION_MINUTES = 15 

# --- Helper to check if locked out ---
def is_user_locked_out(user):
    """Checks if a user document indicates an active lockout."""
    if not user:
        return False
    lockout_until = user.get('lockout_until')
    if lockout_until and lockout_until > datetime.datetime.utcnow():
        return True
    return False

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
            'last_login': datetime.datetime.utcnow(),
            'failed_login_attempts': 0,
            'lockout_until': None,
            'password_reset_token': None,
            'password_reset_expires': None
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

    # Check if locked out BEFORE checking password
    if is_user_locked_out(user):
        lockout_time_str = user.get('lockout_until').strftime('%Y-%m-%d %H:%M:%S UTC')
        log.warning(f"Login failed: Account for email '{email}' is locked until {lockout_time_str}.")
        # Return a specific error for lockout
        return None, f"Account locked due to too many failed attempts. Please try again later."

    try:
        # Check password
        if bcrypt.checkpw(password.encode('utf-8'), user['password']):
            # --- Successful Login ---
            # Reset failed attempts and lockout on success
            update_fields = {
                '$set': {
                    'last_login': datetime.datetime.utcnow(),
                    'failed_login_attempts': 0,
                    'lockout_until': None # Explicitly clear lockout
                }
            }
            users_collection.update_one({'_id': user['_id']}, update_fields)

            # Prepare user info to return
            user_info = {
                '_id': str(user['_id']),
                'email': user['email'],
                'created_at': user.get('created_at'), 
                'last_login': datetime.datetime.utcnow() # Return updated time
            }

            log.info(f"User '{email}' logged in successfully.")
            return user_info, None
        else:
            # --- Failed Login ---
            log.warning(f"Login failed: Invalid password for email '{email}'.")

            # Increment failed attempts
            new_attempts = user.get('failed_login_attempts', 0) + 1
            update_fields = {'$inc': {'failed_login_attempts': 1}}

            # Check if lockout threshold is reached
            if new_attempts >= MAX_LOGIN_ATTEMPTS:
                lockout_end_time = datetime.datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
                update_fields['$set'] = {'lockout_until': lockout_end_time}
                log.warning(f"Account for email '{email}' locked out until {lockout_end_time.strftime('%Y-%m-%d %H:%M:%S UTC')}.")

            users_collection.update_one({'_id': user['_id']}, update_fields)

            # Return generic error after incrementing/locking
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
            # Still return None token, route handles user feedback
            return None, "No account found with this email address."

        # Check if already locked out (optional, maybe allow reset even if locked)
        # if is_user_locked_out(user):
        #     log.warning(f"Password reset attempted for locked account '{email}'.")
        #     return None, "Account is currently locked." # Or allow?

        # Generate secure token and expiry
        token = secrets.token_urlsafe(32) # Generate a 32-byte URL-safe token
        expiry_time = datetime.datetime.utcnow() + timedelta(hours=1) # Token valid for 1 hour

        # Store token hash? For added security, store hash instead of raw token.
        # For simplicity here, storing raw token. Consider hashing in production.
        update_fields = {
            '$set': {
                'password_reset_token': token,
                'password_reset_expires': expiry_time
            }
        }
        users_collection.update_one({'_id': user['_id']}, update_fields)

        log.info(f"Password reset token generated for email '{email}'. Expiry: {expiry_time}")
        return token, None # Return the token to the route for email sending

    except Exception as e:
        log.exception(f"Error generating password reset token for '{email}': {e}")
        return None, "Server error during password reset initiation."


def verify_reset_token_and_update_password(token, new_password):
    """Verifies reset token and updates password if valid."""
    if not token or not new_password:
        return False, "Token and new password are required."

    try:
        # Find user by the reset token
        user = users_collection.find_one({'password_reset_token': token})

        if not user:
            log.warning(f"Password reset failed: Invalid or already used token provided.")
            return False, "Invalid or expired reset token."

        # Check if token has expired
        reset_expires = user.get('password_reset_expires')
        if not reset_expires or reset_expires < datetime.datetime.utcnow():
            # Clear expired token fields for hygiene
            users_collection.update_one(
                {'_id': user['_id']},
                {'$set': {'password_reset_token': None, 'password_reset_expires': None}}
            )
            log.warning(f"Password reset failed: Token expired for email '{user['email']}'.")
            return False, "Invalid or expired reset token."

        # --- Token is valid ---
        # Hash the new password
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())

        # Update password and clear reset/lockout fields
        update_fields = {
            '$set': {
                'password': hashed_password,
                'password_reset_token': None,
                'password_reset_expires': None,
                'failed_login_attempts': 0, # Reset lockout status as well
                'lockout_until': None
            }
        }
        result = users_collection.update_one({'_id': user['_id']}, update_fields)

        if result.modified_count == 1:
            log.info(f"Password reset successful for email '{user['email']}'.")
            return True, None
        else:
            log.error(f"Password reset failed for email '{user['email']}': Update query failed.")
            return False, "Password reset failed during database update."

    except Exception as e:
        log.exception(f"Error during password reset verification/update: {e}")
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