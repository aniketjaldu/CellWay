# backend/routes/auth_routes.py
"""
Handles authentication-related API endpoints:
- User registration
- User login
- User logout
- Fetching current user info
- Password reset initiation
"""
from flask import Blueprint, request, jsonify, session, current_app
from functools import wraps
import logging
from models import user as user_model
from flask_mail import Message
from app import mail

# Configure basic logging (or inherit from app)
log = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

# --- Simple Test Route ---
@auth_bp.route('/auth/ping_auth', methods=['GET'])
def ping_auth():
    log.info("Auth Ping route accessed!")
    # Need to import jsonify here too if not already imported globally
    from flask import jsonify
    return jsonify({"message": "pong from auth"})

# --- Authentication Middleware ---
def login_required(f):
    """Decorator to ensure the user is logged in."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            log.warning("Authentication required for endpoint: %s", request.path)
            return jsonify({'error': 'Authentication required'}), 401
        # Optionally fetch user object here if needed frequently
        # user_details, error = user_model.get_user_by_id(session['user_id'])
        # if error or not user_details:
        #     log.warning("User ID in session not found in DB or error: %s", session['user_id'])
        #     session.pop('user_id', None) # Clear invalid session
        #     return jsonify({'error': 'Invalid session'}), 401
        # g.user = user_details # Store user in Flask's g object for request context if needed
        return f(*args, **kwargs)
    return decorated_function

# --- Authentication Endpoints ---
@auth_bp.route('/auth/register', methods=['POST'])
def register():
    """Endpoint for user registration."""
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        log.warning("Registration attempt failed: Missing required fields")
        return jsonify({'error': 'Missing required fields'}), 400

    user_info, error = user_model.register_user(email, password)
    if error:
        log.warning("Registration attempt failed for email %s: %s", email, error)
        # Be specific about errors if possible (e.g., email exists)
        status_code = 409 if "already registered" in error else 400
        return jsonify({'error': error}), status_code

    # Set session upon successful registration
    # user_info already has string _id from the model function
    session['user_id'] = user_info['_id']
    log.info("User registered successfully: %s (ID: %s)", email, session['user_id'])

    # user_info is already prepared by the model (excludes password, has string ID)
    return jsonify({'success': True, 'user': user_info}), 201 # Use 201 Created status

@auth_bp.route('/auth/login', methods=['POST'])
def login():
    """Endpoint for user login."""
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        log.warning("Login attempt failed: Missing required fields")
        return jsonify({'error': 'Missing required fields'}), 400

    user_info, error = user_model.login_user(email, password)

    if error:
        log.warning("Login attempt failed for email %s: %s", email, error)
        # Check if it's the specific lockout error message
        if "Account locked" in error:
            return jsonify({'error': error}), 403 # Use 403 Forbidden for lockout
        else:
            return jsonify({'error': error}), 401 # Use 401 Unauthorized for other login failures

    # Set session upon successful login
    session['user_id'] = user_info['_id']
    log.info("User logged in successfully: %s (ID: %s)", email, session['user_id'])
    return jsonify({'success': True, 'user': user_info})

@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    """Endpoint for user logout."""
    user_id = session.pop('user_id', None)
    if user_id:
        log.info("User logged out: %s", user_id)
        return jsonify({'success': True})
    else:
        log.warning("Logout attempt without active session")
        # Still return success, as the state is effectively logged out
        return jsonify({'success': True})


@auth_bp.route('/auth/user', methods=['GET'])
@login_required
def get_user():
    """Endpoint for getting the current authenticated user's ID."""
    user_id = session.get('user_id')
    # Optionally fetch full details if needed for frontend display
    # user_details, error = user_model.get_user_by_id(user_id)
    # if error or not user_details:
    #     log.warning(f"Could not retrieve details for user ID {user_id}: {error}")
    #     # Decide how to handle - maybe clear session?
    #     return jsonify({'error': 'User details not found'}), 404
    # return jsonify({'user': user_details})
    return jsonify({'user_id': user_id}) # Keep original behavior

# --- Forgot Password Route ---
@auth_bp.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    """Endpoint for initiating password reset."""
    data = request.json
    email = data.get('email')

    if not email:
        log.warning("Password reset attempt failed: Missing email")
        return jsonify({'error': 'Email is required'}), 400

    token, error = user_model.forgot_password(email) # Generates/stores token

    if error and not token:
         log.warning("Password reset check failed internally for email %s: %s", email, error)
         # Still return generic success below
    elif token:
        log.info("Password reset initiated for email: %s", email)
        # --- Send the actual email ---
        try:
            # Construct reset URL using FRONTEND_URL from config
            frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173') # Fallback just in case
            reset_url = f"{frontend_url}/reset-password?token={token}"

            # Create the email message
            subject = "Password Reset Request"
            sender = current_app.config.get('MAIL_DEFAULT_SENDER')
            recipients = [email]
            body_text = f"""
            Hello,

            Someone requested a password reset for the account associated with this email address.
            If this was you, please click the link below to set a new password:

            {reset_url}

            This link will expire in 1 hour.

            If you did not request a password reset, please ignore this email. Your password will remain unchanged.

            Thanks,
            Your App Team
            """
            body_html = f"""
            <p>Hello,</p>
            <p>Someone requested a password reset for the account associated with this email address.</p>
            <p>If this was you, please click the link below to set a new password:</p>
            <p><a href="{reset_url}">{reset_url}</a></p>
            <p>This link will expire in <strong>1 hour</strong>.</p>
            <p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
            <p>Thanks,<br/>Your App Team</p>
            """

            if not sender:
                raise ValueError("MAIL_DEFAULT_SENDER is not configured.")

            msg = Message(subject=subject,
                          sender=sender,
                          recipients=recipients,
                          body=body_text,
                          html=body_html)

            # Send the message
            mail.send(msg)
            log.info(f"Password reset email sent successfully to {email}")

        except Exception as e:
            # Log the error but DO NOT prevent the user from seeing the success message
            log.exception(f"CRITICAL: Failed to send password reset email to {email}: {e}")
            # You might want more robust error reporting here (e.g., Sentry)
        # --- End email sending ---

    # Return generic success message regardless of whether the email exists or email sending succeeded/failed
    return jsonify({'success': True, 'message': 'If an account exists for this email, a password reset link has been sent.'})


# --- Reset Password Route ---
@auth_bp.route('/auth/reset-password', methods=['POST'])
def reset_password_submit():
    """Endpoint for submitting new password with reset token."""
    data = request.json
    token = data.get('token')
    new_password = data.get('newPassword') # Match frontend key

    if not token or not new_password:
        log.warning("Password reset submission failed: Missing token or newPassword")
        return jsonify({'error': 'Token and new password are required'}), 400

    success, error = user_model.verify_reset_token_and_update_password(token, new_password)

    if success:
        log.info("Password successfully reset via token.")
        return jsonify({'success': True, 'message': 'Password reset successfully. You can now log in.'})
    else:
        log.warning(f"Password reset submission failed: {error}")
        # Return the specific error from the model (e.g., "Invalid or expired token")
        return jsonify({'error': error or 'Password reset failed.'}), 400 # Use 400 Bad Request