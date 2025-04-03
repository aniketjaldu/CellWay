# backend/routes/auth_routes.py
"""
API endpoints for user authentication and password management:
- Registration, Login, Logout
- Current User Information retrieval
- Password Reset (initiation and submission)
"""
import logging
from functools import wraps

from flask import Blueprint, current_app, jsonify, request, session
from flask_mail import Message

from app import mail  # Assuming mail instance is in app.py
from models import user as user_model  # Import user model

# Initialize blueprint for authentication routes
auth_bp = Blueprint("auth", __name__)

# Get logger for this module
log = logging.getLogger(__name__)


# --- Test Route ---
@auth_bp.route("/auth/ping_auth", methods=["GET"])
def ping_auth():
    """
    Simple test endpoint to check if the authentication route blueprint is working.
    Logs an info message and returns a pong response.
    """
    log.info("Auth Ping route accessed!")
    return jsonify({"message": "pong from auth"})


# --- Authentication Middleware ---
def login_required(f):
    """
    Decorator to protect routes that require user authentication.

    Checks if 'user_id' is in the session. If not, returns a 401 Unauthorized error.
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            log.warning("Authentication required for endpoint: %s", request.path)
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)

    return decorated_function


# --- Authentication Endpoints ---
@auth_bp.route("/auth/register", methods=["POST"])
def register():
    """
    Registers a new user.

    Receives email and password in JSON format.
    Validates input, registers user via user model, sets session on success,
    and returns user information. Handles email already registered and server errors.
    """
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        log.warning("Registration attempt failed: Missing email or password.")
        return jsonify({"error": "Email and password are required"}), 400

    user_info, error = user_model.register_user(email, password)
    if error:
        log.warning(f"Registration attempt failed for email '{email}': {error}")
        status_code = 409 if "already registered" in error else 400  # 409 Conflict for existing email
        return jsonify({"error": error}), status_code

    session["user_id"] = user_info["_id"]  # Set session for logged-in user
    log.info(f"User registered successfully: {email} (ID: {session['user_id']})")
    return jsonify({"success": True, "user": user_info}), 201  # 201 Created for successful registration


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    """
    Logs in an existing user.

    Receives email and password in JSON format.
    Authenticates user via user model, sets session on success, and returns user information.
    Handles invalid credentials and account lockout scenarios.
    """
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        log.warning("Login attempt failed: Missing email or password.")
        return jsonify({"error": "Email and password are required"}), 400

    user_info, error = user_model.login_user(email, password)

    if error:
        log.warning(f"Login attempt failed for email '{email}': {error}")
        status_code = 403 if "Account locked" in error else 401  # 403 Forbidden for lockout, 401 Unauthorized for invalid credentials
        return jsonify({"error": error}), status_code

    session["user_id"] = user_info["_id"]  # Set session for logged-in user
    log.info(f"User logged in successfully: {email} (ID: {session['user_id']})")
    return jsonify({"success": True, "user": user_info})


@auth_bp.route("/auth/logout", methods=["POST"])
def logout():
    """
    Logs out the current user.

    Removes 'user_id' from the session. Returns success regardless of session state
    as the desired outcome (logout) is achieved.
    """
    user_id = session.pop("user_id", None)
    if user_id:
        log.info(f"User logged out: {user_id}")
    else:
        log.warning("Logout attempt with no active session.")
    return jsonify({"success": True})  # Success even if no user was logged in


@auth_bp.route("/auth/user", methods=["GET"])
@login_required
def get_user():
    """
    Retrieves the current authenticated user's ID.

    Protected by login_required decorator. Returns the user_id from the session.
    For more detailed user information, additional logic can be added here or in a separate endpoint.
    """
    user_id = session.get("user_id")
    log.info(f"Session user retrieved: {user_id}")
    return jsonify({"user_id": user_id})


# --- Session Diagnostics Endpoint ---
@auth_bp.route("/auth/session-check", methods=["GET"])
def session_check():
    """
    Diagnostic endpoint to check session status.
    
    Returns information about the current session, including whether user_id exists
    and session cookie parameters. Doesn't require authentication.
    """
    # Check session contents
    session_data = {
        "has_user_id": "user_id" in session,
        "session_keys": list(session.keys()) if session else [],
    }
    
    # Additional request details for diagnostics
    request_info = {
        "has_cookies": bool(request.cookies),
        "cookie_names": list(request.cookies.keys()) if request.cookies else [],
        "headers": {k: v for k, v in request.headers.items() if k.lower() in ["origin", "referer", "host", "user-agent"]},
    }
    
    log.info(f"Session diagnostic check: {session_data}")
    return jsonify({
        "session": session_data,
        "request": request_info,
        "message": "This endpoint is for debugging session issues"
    })


# --- Password Reset Endpoints ---
@auth_bp.route("/auth/forgot-password", methods=["POST"])
def forgot_password():
    """
    Initiates the password reset process.

    Receives email in JSON format. Generates a reset token via user model,
    and sends a password reset email to the user if the email exists.
    Returns a generic success message for security reasons, regardless of email existence.
    """
    data = request.json
    email = data.get("email")

    if not email:
        log.warning("Password reset attempt failed: Missing email.")
        return jsonify({"error": "Email is required"}), 400

    token, error = user_model.forgot_password(email)  # Generate and store reset token

    if error and not token:
        log.warning(f"Password reset initiation failed internally for email '{email}': {error}")
        # Still proceed to return generic success to client

    if token:
        log.info(f"Password reset initiated for email: {email}")
        try:
            frontend_url = current_app.config.get("FRONTEND_URL")  # Get frontend URL from config
            reset_url = f"{frontend_url}/reset-password?token={token}"  # Construct reset URL

            subject = "Password Reset Request"
            sender = current_app.config.get("MAIL_DEFAULT_SENDER")
            recipients = [email]
            body_text = f"""
            Hello,

            Someone requested a password reset for the account associated with this email address.
            If this was you, please click the link below to set a new password:

            {reset_url}

            This link will expire in 1 hour.

            If you did not request a password reset, please ignore this email. Your password will remain unchanged.

            Thanks,
            Cellway Team
            """  # Plain text email body
            body_html = f"""
            <p>Hello,</p>
            <p>Someone requested a password reset for the account associated with this email address.</p>
            <p>If this was you, please click the link below to set a new password:</p>
            <p><a href="{reset_url}">{reset_url}</a></p>
            <p>This link will expire in <strong>1 hour</strong>.</p>
            <p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
            <p>Thanks,<br/>Cellway Team</p>
            """  # HTML email body

            if not sender:
                raise ValueError("MAIL_DEFAULT_SENDER is not configured.")  # Ensure sender is configured

            msg = Message(
                subject=subject, sender=sender, recipients=recipients, body=body_text, html=body_html
            )
            mail.send(msg)  # Send the password reset email
            log.info(f"Password reset email sent successfully to {email}")

        except Exception as e:
            log.exception(f"CRITICAL: Failed to send password reset email to {email}: {e}")
            # Consider more robust error reporting (e.g., Sentry)

    return jsonify(
        {"success": True, "message": "If an account exists for this email, a password reset link has been sent."}
    )  # Generic success for security


@auth_bp.route("/auth/reset-password", methods=["POST"])
def reset_password_submit():
    """
    Submits a new password using a reset token to complete the password reset process.

    Receives token and newPassword in JSON format. Verifies the token and updates the password
    via the user model. Returns success or error based on the outcome.
    """
    data = request.json
    token = data.get("token")
    new_password = data.get("newPassword")  # Match frontend key

    if not token or not new_password:
        log.warning("Password reset submission failed: Missing token or new password.")
        return jsonify({"error": "Token and new password are required"}), 400

    success, error = user_model.verify_reset_token_and_update_password(token, new_password)

    if success:
        log.info("Password successfully reset via token.")
        return jsonify(
            {"success": True, "message": "Password reset successfully. You can now log in."}
        )
    else:
        log.warning(f"Password reset submission failed: {error}")
        return jsonify({"error": error or "Password reset failed."}), 400  # 400 Bad Request for reset failure