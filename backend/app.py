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
    
    # Simple, direct CORS configuration
    @app.after_request
    def cors_response(response):
        # Always allow the frontend domain
        response.headers.set('Access-Control-Allow-Origin', 'https://www.cellway.tech')
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.set('Access-Control-Allow-Credentials', 'true')
        return response
        
    # Handle OPTIONS requests explicitly
    @app.route('/api/<path:path>', methods=['OPTIONS'])
    def handle_preflight(path):
        response = app.make_default_options_response()
        response.headers.set('Access-Control-Allow-Origin', 'https://www.cellway.tech')
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.set('Access-Control-Allow-Credentials', 'true')
        return response
    
    # Add health check endpoint
    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "ok", "message": "API is running!"})
        
    # Debug endpoint to test CORS
    @app.route("/api/debug/cors", methods=["GET"])
    def debug_cors():
        return jsonify({
            "message": "CORS configured correctly",
            "headers_set": {
                "Access-Control-Allow-Origin": "https://www.cellway.tech",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Credentials": "true"
            }
        })
    
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