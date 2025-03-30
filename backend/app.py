"""
Main Flask application setup file.
Initializes the Flask app, configures CORS, registers blueprints,
and sets up logging.
"""
from flask import Flask, jsonify
from flask_cors import CORS
import logging
import secrets
import os

# --- Configuration ---
from config import Config # Absolute import

# --- Blueprints ---
# Use absolute imports from the backend package
from routes.auth_routes import auth_bp
from routes.geo_routes import geo_bp
from routes.routing_routes import routing_bp
from routes.tower_routes import tower_bp

# --- Logging Setup ---
# Configure logging early
logging.basicConfig(
    level=logging.INFO, # Adjust level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger(__name__) # Get logger for this module

# --- App Initialization ---
def create_app(config_class=Config):
    """Creates and configures the Flask application."""
    log.info("Creating Flask application...")
    app = Flask(__name__, instance_relative_config=True)

    # Load configuration
    app.config.from_object(config_class)
    log.info(f"App configured with {config_class.__name__}")

    # Ensure instance folder exists for potential session files etc.
    try:
        os.makedirs(app.instance_path, exist_ok=True)
    except OSError:
        log.error(f"Could not create instance folder at {app.instance_path}")

    # Set secret key for session management
    # Use SECRET_KEY from config, fallback to generating one (less ideal for prod)
    app.secret_key = app.config.get('SECRET_KEY') or secrets.token_hex(16)
    if not app.config.get('SECRET_KEY'):
            log.warning("SECRET_KEY not set in config, using a randomly generated key. "
                        "Sessions will be invalidated on app restart.")


    # --- CORS Configuration ---
    # Allow requests from the typical frontend development server origin
    # In production, restrict this to the actual frontend domain
    # TODO: Make origins configurable via environment variable for production
    CORS(app, resources={
            r"/api/*": {
                "origins": ["http://localhost:5173", "http://127.0.0.1:5173"], # Add other origins if needed
                "supports_credentials": True
            }
        })
    log.info("CORS configured for development origins.")


    # --- Register Blueprints ---
    # Note the url_prefix combines with prefixes defined within blueprints
    app.register_blueprint(auth_bp, url_prefix='/api') # Becomes /api/auth/...
    app.register_blueprint(geo_bp, url_prefix='/api') # Becomes /api/geo/...
    app.register_blueprint(routing_bp, url_prefix='/api') # Becomes /api/routing/...
    app.register_blueprint(tower_bp, url_prefix='/api') # Becomes /api/towers/...
    log.info("Registered API blueprints.")

    @app.route('/api/ping')
    def ping():
        log.info("Ping route accessed!")
        return jsonify({"message": "pong"})

    # --- Optional: Add a simple root route for health check ---
    @app.route('/')
    def index():
        return "Backend is running."

    log.info("Flask application created successfully.")
    return app

# --- Main Execution ---
if __name__ == '__main__':
    app = create_app()
    # Use waitress or gunicorn for production instead of Flask development server
    log.info("Starting Flask development server...")
    app.run(debug=True, host='0.0.0.0', port=5001) # Listen on all interfaces for container access