"""
Manages user accounts, authentication, and password reset functionalities.
Interacts with the 'users' collection in MongoDB.
"""

import datetime
import logging
import secrets
from datetime import timedelta

import bcrypt
from bson import ObjectId  # Import ObjectId for database interactions

from .database import get_user_collection  # Relative import from database module

# Initialize logger for this module
log = logging.getLogger(__name__)

# Get the users collection instance from the database module
users_collection = get_user_collection()

# Constants for login attempt limits and lockout duration
MAX_LOGIN_ATTEMPTS = 7
LOCKOUT_DURATION_MINUTES = 15


def is_user_locked_out(user: dict) -> bool:
    """
    Checks if a user account is currently locked out due to excessive failed login attempts.

    Args:
        user (dict): The user document retrieved from the database.

    Returns:
        bool: True if the user is locked out, False otherwise.
    """
    if not user:
        return False  # User not found, not locked out
    lockout_until_time = user.get("lockout_until")
    if lockout_until_time and lockout_until_time > datetime.datetime.utcnow():
        return True  # Lockout time is set and in the future
    return False  # No lockout or lockout time expired


def register_user(email: str, password: str) -> tuple[dict | None, str | None]:
    """
    Registers a new user in the database.

    Args:
        email (str): The user's email address (must be unique).
        password (str): The user's plain text password.

    Returns:
        tuple[dict | None, str | None]:
            - (user_info_dict, None) on successful registration. user_info_dict contains user details
              (including string '_id', excluding password).
            - (None, error_message) if registration fails.
    """
    if not email or not password:
        return None, "Email and password are required."

    if users_collection.find_one({"email": email}):
        log.warning(f"Registration attempt failed: Email '{email}' is already registered.")
        return None, "Email already registered."

    try:
        hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        user_document = {
            "email": email,
            "password": hashed_password,
            "created_at": datetime.datetime.utcnow(),
            "last_login": datetime.datetime.utcnow(),
            "failed_login_attempts": 0,
            "lockout_until": None,
            "password_reset_token": None,
            "password_reset_expires": None,
        }
        insert_result = users_collection.insert_one(user_document)

        user_info = {
            "_id": str(insert_result.inserted_id),
            "email": user_document["email"],
            "created_at": user_document["created_at"],
            "last_login": user_document["last_login"],
        }

        log.info(f"User registered successfully with email '{email}'.")
        return user_info, None

    except Exception as e:
        log.exception(f"Error during registration for email '{email}': {e}")
        return None, "Registration failed due to a server error."


def login_user(email: str, password: str) -> tuple[dict | None, str | None]:
    """
    Logs in a user by verifying email and password and handling failed login attempts/lockouts.

    Args:
        email (str): The user's email address.
        password (str): The user's plain text password.

    Returns:
        tuple[dict | None, str | None]:
            - (user_info_dict, None) on successful login. user_info_dict contains user details
              (including string '_id', excluding password).
            - (None, error_message) if login fails.
    """
    if not email or not password:
        return None, "Email and password are required."

    user = users_collection.find_one({"email": email})
    if not user:
        log.warning(f"Login attempt failed: User not found for email '{email}'.")
        return None, "Invalid email or password."

    if is_user_locked_out(user):
        lockout_time_str = user.get("lockout_until").strftime("%Y-%m-%d %H:%M:%S UTC")
        log.warning(
            f"Login attempt failed: Account for email '{email}' is locked until {lockout_time_str}."
        )
        return None, f"Account locked due to too many failed attempts. Please try again later."

    try:
        if bcrypt.checkpw(password.encode("utf-8"), user["password"]):
            # Successful Login: Reset failed attempts and lockout
            update_fields = {
                "$set": {
                    "last_login": datetime.datetime.utcnow(),
                    "failed_login_attempts": 0,
                    "lockout_until": None,  # Explicitly clear lockout
                }
            }
            users_collection.update_one({"_id": user["_id"]}, update_fields)

            user_info = {
                "_id": str(user["_id"]),
                "email": user["email"],
                "created_at": user.get("created_at"),
                "last_login": datetime.datetime.utcnow(),  # Return updated login time
            }

            log.info(f"User '{email}' logged in successfully.")
            return user_info, None
        else:
            # Failed Login: Increment failed attempts and handle potential lockout
            log.warning(f"Login attempt failed: Invalid password for email '{email}'.")

            new_attempts = user.get("failed_login_attempts", 0) + 1
            update_fields = {"$inc": {"failed_login_attempts": 1}}

            if new_attempts >= MAX_LOGIN_ATTEMPTS:
                lockout_end_time = datetime.datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
                update_fields["$set"] = {"lockout_until": lockout_end_time}
                log.warning(
                    f"Account for email '{email}' locked out until {lockout_end_time.strftime('%Y-%m-%d %H:%M:%S UTC')}."
                )

            users_collection.update_one({"_id": user["_id"]}, update_fields)
            return None, "Invalid email or password."

    except Exception as e:
        log.exception(f"Error during login process for email '{email}': {e}")
        return None, "Login failed due to a server error."


def forgot_password(email: str) -> tuple[str | None, str | None]:
    """
    Initiates the password reset process by generating a reset token and saving it to the user document.

    Args:
        email (str): The user's email address.

    Returns:
        tuple[str | None, str | None]:
            - (reset_token, None) if email exists and token is generated (simulating email sent).
              The reset_token is returned for use in constructing the reset link/email.
            - (None, error_message) if email not found or an error occurs.
              Note: For security, a generic success response should be returned to the client regardless
              of whether the email exists to prevent email enumeration. However, internally, we log
              if the email was not found for monitoring purposes.
    """
    if not email:
        return None, "Email is required."
    try:
        user = users_collection.find_one({"email": email})
        if not user:
            log.warning(f"Password reset requested for non-existent email '{email}'.")
            return None, "Password reset initiated if email exists."  # Generic message for security

        # Generate secure reset token and expiry time
        reset_token = secrets.token_urlsafe(32)  # 32 bytes for good security
        expiry_time = datetime.datetime.utcnow() + timedelta(hours=1)  # Token valid for 1 hour

        update_fields = {
            "$set": {
                "password_reset_token": reset_token,
                "password_reset_expires": expiry_time,
            }
        }
        users_collection.update_one({"_id": user["_id"]}, update_fields)

        log.info(f"Password reset token generated for email '{email}'. Token expires at: {expiry_time}")
        return reset_token, None

    except Exception as e:
        log.exception(f"Error generating password reset token for '{email}': {e}")
        return None, "Server error during password reset initiation."


def verify_reset_token_and_update_password(token: str, new_password: str) -> tuple[bool, str | None]:
    """
    Verifies the password reset token and updates the user's password if the token is valid and not expired.

    Args:
        token (str): The password reset token to verify.
        new_password (str): The new password to set.

    Returns:
        tuple[bool, str | None]:
            - (True, None) if the token is valid and password update is successful.
            - (False, error_message) if the token is invalid, expired, or password update fails.
    """
    if not token or not new_password:
        return False, "Token and new password are required."

    try:
        user = users_collection.find_one({"password_reset_token": token})

        if not user:
            log.warning(f"Password reset attempt failed: Invalid or already used token provided.")
            return False, "Invalid or expired reset token."

        reset_expires_time = user.get("password_reset_expires")
        if not reset_expires_time or reset_expires_time < datetime.datetime.utcnow():
            # Token expired: Clear token fields for cleanup
            users_collection.update_one(
                {"_id": user["_id"]},
                {"$set": {"password_reset_token": None, "password_reset_expires": None}},
            )
            log.warning(f"Password reset attempt failed: Token expired for email '{user['email']}'.")
            return False, "Invalid or expired reset token."

        # Token is valid: Hash the new password and update user document
        hashed_password = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt())
        update_fields = {
            "$set": {
                "password": hashed_password,
                "password_reset_token": None,  # Clear reset token after use
                "password_reset_expires": None,
                "failed_login_attempts": 0,  # Reset lockout status as well
                "lockout_until": None,
            }
        }
        update_result = users_collection.update_one({"_id": user["_id"]}, update_fields)

        if update_result.modified_count == 1:
            log.info(f"Password reset successful for email '{user['email']}'.")
            return True, None
        else:
            log.error(
                f"Password reset failed for email '{user['email']}': Database update query failed."
            )
            return False, "Password reset failed during database update."

    except Exception as e:
        log.exception(f"Error during password reset verification/update process: {e}")
        return False, "Password reset failed due to a server error."


def get_user_by_id(user_id_str: str) -> dict | None:
    """
    Retrieves user information by their string ID.

    Args:
        user_id_str (str): The user's ID as a string.

    Returns:
        dict | None: User document (excluding password) or None if not found or error.
    """
    try:
        user_object_id = ObjectId(user_id_str)  # Convert string ID to ObjectId for MongoDB query
    except Exception:
        log.warning(f"Attempted to find user with invalid ID format: '{user_id_str}'.")
        return None

    try:
        user = users_collection.find_one({"_id": user_object_id})
        if user:
            user_info = {
                "_id": str(user["_id"]),
                "email": user["email"],
                "created_at": user.get("created_at"),
                "last_login": user.get("last_login"),
            }
            return user_info
        else:
            return None  # User not found
    except Exception as e:
        log.exception(f"Error retrieving user by ID '{user_id_str}': {e}")
        return None