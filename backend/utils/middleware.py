from flask import request, make_response
import logging

log = logging.getLogger(__name__)

def add_cors_headers(response):
    """Add CORS headers to all responses"""
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://cellway.tech",
        "https://www.cellway.tech"
    ]
    
    origin = request.headers.get('Origin')
    
    if origin in allowed_origins:
        response.headers.add('Access-Control-Allow-Origin', origin)
    else:
        response.headers.add('Access-Control-Allow-Origin', '*')
        
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

def cors_middleware(app):
    """Register CORS middleware with the Flask app"""
    @app.after_request
    def after_request(response):
        return add_cors_headers(response)
        
    @app.route('/api/options', methods=['OPTIONS'])
    def handle_options():
        response = make_response()
        return add_cors_headers(response)
    
    log.info("CORS middleware configured")