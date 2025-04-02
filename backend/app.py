"""
Main Flask application setup and initialization.

This script sets up the Flask application, configures CORS, initializes Flask-Mail,
registers API blueprints for different functionalities (authentication, geocoding, routing, tower data),
configures logging, and defines a basic health check endpoint.
"""
from flask import Flask, jsonify, request
import logging
import os
import secrets

from flask_cors import CORS
from flask_mail import Mail

from config import Config  # Absolute import for configuration

# --- Logging Configuration ---
logging.basicConfig(
    level=logging.INFO,  # Set default logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",  # Log message format
    datefmt="%Y-%m-%d %H:%M:%S",  # Date format in logs
)
log = logging.getLogger(__name__)  # Logger for this module

# --- Flask-Mail Initialization ---
mail = Mail()  # Initialize Flask-Mail extension


# --- Flask Application Factory ---
def create_app(config_class=Config) -> Flask:
    """
    Application factory function to create and configure the Flask application.

    This function is used to create a new instance of the Flask application,
    load configuration, initialize extensions, register blueprints,
    configure CORS, and set up logging.

    Args:
        config_class (Config, optional): Configuration class to use for the Flask app.
                                         Defaults to Config (from config.py).

    Returns:
        Flask: Configured Flask application instance.
    """
    log.info("Creating Flask application instance...")
    app = Flask(__name__, instance_relative_config=True)  # Initialize Flask app

    # --- Load Configuration ---
    app.config.from_object(config_class)  # Load configuration from the specified class
    log.info(f"Flask app configuration loaded from: {config_class.__name__}")

    # --- Validate Mail Configuration ---
    mail_config_vars = ["MAIL_SERVER", "MAIL_USERNAME", "MAIL_PASSWORD"]
    if not all(app.config.get(key) for key in mail_config_vars):
        log.warning(f"Flask-Mail is not fully configured. Missing configuration for: {', '.join(mail_config_vars)}. Email sending will likely fail.")
    if not app.config.get("MAIL_DEFAULT_SENDER"):
        log.warning("MAIL_DEFAULT_SENDER is not configured. Password reset emails will likely fail to send.")

    # --- Ensure Instance Folder Exists ---
    try:
        os.makedirs(app.instance_path, exist_ok=True)  # Create instance folder if it doesn't exist
    except OSError as e:
        log.error(f"Could not create instance folder at '{app.instance_path}'. Error: {e}")

    # --- Configure Secret Key for Sessions ---
    app.secret_key = app.config.get("SECRET_KEY") or secrets.token_hex(16)  # Use SECRET_KEY from config or generate a fallback key
    if not app.config.get("SECRET_KEY"):
        log.warning(
            "SECRET_KEY is not set in configuration. Using a randomly generated secret key. "
            "Sessions will be invalidated on application restart. This is not recommended for production."
        )

    # --- Initialize Flask Extensions ---
    mail.init_app(app)  # Initialize Flask-Mail with the Flask application
    log.info("Flask-Mail extension initialized.")

    # --- Configure CORS (Cross-Origin Resource Sharing) ---
    frontend_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173", 
        "https://cellway.tech",
        "https://www.cellway.tech"
    ]

    # CORS should be applied before registering blueprints
    CORS(
        app,
        origins=frontend_origins,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )
    log.info(f"CORS configured to allow requests from origins: {frontend_origins}")

    # Add a more direct CORS handler for all responses
    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get('Origin')
        if origin in frontend_origins:
            response.headers.set('Access-Control-Allow-Origin', origin)
        else:
            # For development and testing
            response.headers.set('Access-Control-Allow-Origin', '*')
        
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.set('Access-Control-Allow-Credentials', 'true')
        return response

    # Add inside create_app function, before registering blueprints
    @app.route('/api/<path:path>', methods=['OPTIONS'])
    def handle_preflight(path):
        response = app.make_default_options_response()
        origin = request.headers.get('Origin')
        if origin in frontend_origins:
            response.headers.set('Access-Control-Allow-Origin', origin)
        else:
            response.headers.set('Access-Control-Allow-Origin', '*')
        
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.set('Access-Control-Allow-Credentials', 'true')
        return response

    # --- Register API Blueprints ---
    from routes.auth_routes import auth_bp  # Import authentication blueprint
    from routes.geo_routes import geo_bp  # Import geocoding blueprint
    from routes.routing_routes import routing_bp  # Import routing blueprint
    from routes.tower_routes import tower_bp  # Import tower data blueprint
    from routes.map_routes import map_bp  # Import map blueprint

    app.register_blueprint(auth_bp, url_prefix="/api")  # Register authentication blueprint under /api prefix
    app.register_blueprint(geo_bp, url_prefix="/api")  # Register geocoding blueprint under /api prefix
    app.register_blueprint(routing_bp, url_prefix="/api")  # Register routing blueprint under /api prefix
    app.register_blueprint(tower_bp, url_prefix="/api")  # Register tower data blueprint under /api prefix
    app.register_blueprint(map_bp, url_prefix="/api")  # Register map blueprint under /api prefix
    log.info("Registered API blueprints for authentication, geocoding, routing, tower data, and map configuration.")

    # --- Define Test Endpoint ---
    @app.route("/api/ping")  # Define a simple ping endpoint for API testing
    def ping_api():
        """API health check endpoint (returns 'pong')."""
        log.info("API ping endpoint '/api/ping' was accessed.")
        return jsonify({"message": "pong"})

    # --- Define Debug CORS Endpoint ---
    @app.route("/api/debug/cors", methods=["GET"])
    def debug_cors():
        """Endpoint to test CORS configuration"""
        return jsonify({
            "message": "CORS is working!",
            "allowed_origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "https://cellway.tech",
                "https://www.cellway.tech"
            ]
        })

    # --- Define Proxy Endpoint ---
    @app.route("/api/proxy/<path:path>", methods=["GET", "POST", "PUT", "DELETE"])
    def proxy_endpoint(path):
        """Proxy endpoint that simply returns data with proper CORS headers for testing"""
        return jsonify({
            "message": "Successfully proxied request",
            "requested_path": path,
            "method": request.method,
            "headers": dict(request.headers),
            "data": request.get_json(silent=True)
        })

    # --- Define Root Endpoint (Health Check) ---
    @app.route("/")  # Define a basic root endpoint for health check
    def index():
        """Root endpoint for basic health check (returns 'Backend is running.')."""
        return "Backend is running."

    log.info("Flask application created and configured successfully.")
    return app  # Return the created Flask application


# --- Application Execution Entry Point ---
if __name__ == "__main__":
    app = create_app()  # Create Flask application instance
    # --- Start Flask Development Server ---
    log.info("Starting Flask development server...")
    app.run(debug=True, host="0.0.0.0", port=5001)  # Run Flask app in debug mode on all interfaces (for container access)
    # --- NOTE: Use production-ready WSGI server (e.g., gunicorn, waitress) for production deployments. ---