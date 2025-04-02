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
from utils.middleware import register_error_handlers

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
    """Application factory function to create Flask app instance"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions
    mail.init_app(app)  # Initialize Flask-Mail with the app
    
    # Initialize CORS with more permissive settings for debugging
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    
    @app.after_request
    def add_cors_headers(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    # Add health check endpoint
    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "ok", "message": "API is running!"})
    
    # Register API Blueprints
    from routes.auth_routes import auth_bp
    from routes.geo_routes import geo_bp
    from routes.routing_routes import routing_bp
    from routes.tower_routes import tower_bp
    from routes.map_routes import map_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(geo_bp, url_prefix="/api")
    app.register_blueprint(routing_bp, url_prefix="/api")
    app.register_blueprint(tower_bp, url_prefix="/api")
    app.register_blueprint(map_bp, url_prefix="/api")
    
    # Register error handlers
    register_error_handlers(app)
    
    return app


# --- Application Execution Entry Point ---
if __name__ == "__main__":
    app = create_app()  # Create Flask application instance
    # --- Start Flask Development Server ---
    log.info("Starting Flask development server...")
    app.run(debug=True, host="0.0.0.0", port=5001)  # Run Flask app in debug mode on all interfaces (for container access)
    # --- NOTE: Use production-ready WSGI server (e.g., gunicorn, waitress) for production deployments. ---