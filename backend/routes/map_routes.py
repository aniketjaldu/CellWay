"""
Map-related API routes.

This module defines API endpoints for map initialization, configuration,
and related functionality. It allows the map to be instantiated through
the backend rather than directly in the frontend.
"""
import logging
from flask import Blueprint, jsonify, current_app

# Initialize logger for this module
log = logging.getLogger(__name__)

# Create map blueprint
map_bp = Blueprint('map', __name__)

@map_bp.route('/map/config', methods=['GET'])
def get_map_config():
    """
    Returns the map configuration needed by the frontend to instantiate the map.
    
    This centralizes map settings in the backend, allowing for easier configuration
    management and the ability to dynamically adjust map settings based on server-side logic.
    
    Returns:
        JSON: Map configuration including API keys, initial view settings, and other map options.
    """
    try:
        # Get MapTiler key from config
        maptiler_key = current_app.config.get('MAPTILER_KEY')
        
        if not maptiler_key:
            log.warning("MAPTILER_KEY not found in application config")
            return jsonify({
                "error": "Map configuration is incomplete. MAPTILER_KEY missing."
            }), 500
            
        # Return map configuration
        map_config = {
            "maptiler_key": maptiler_key,
            "initial_view": {
                "center": [42.336687, -71.095762],  # Boston coordinates
                "zoom": 13
            },
            "tile_layer": {
                "url": f"https://api.maptiler.com/maps/dataviz/{{z}}/{{x}}/{{y}}.png?key={maptiler_key}",
                "options": {
                    "attribution": '© <a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a> © <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> © <a href="https://www.graphhopper.com/" target="_blank" rel="noopener noreferrer">GraphHopper</a> contributors.',
                    "tileSize": 512,
                    "zoomOffset": -1,
                    "minZoom": 3,
                    "crossOrigin": True
                }
            },
            "controls": {
                "zoom": {
                    "position": "topleft"
                },
                "attribution": {
                    "position": "bottomright",
                    "prefix": False
                }
            }
        }
        
        log.info("Map configuration successfully generated")
        return jsonify(map_config)
        
    except Exception as e:
        log.error(f"Error generating map configuration: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Failed to generate map configuration",
            "message": str(e)
        }), 500 