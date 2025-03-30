"""
Utility functions for geometric calculations.
"""
import math
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points
import logging

log = logging.getLogger(__name__)

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate the great circle distance between two points on earth in meters."""
    earth_radius = 6371000  # Earth radius in meters
    try:
        lat1_rad, lon1_rad, lat2_rad, lon2_rad = map(math.radians, [lat1, lon1, lat2, lon2])
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
        c = 2 * math.asin(math.sqrt(a))
        return earth_radius * c
    except (TypeError, ValueError) as e:
        log.error(f"Error calculating Haversine distance for ({lat1},{lon1}) to ({lat2},{lon2}): {e}")
        return float('inf') # Return infinity on error

def find_towers_near_route_shapely(route_coords, towers, max_distance_meters=2500):
    """
    Finds cell towers from a list that are within a specified distance of a route.
    Uses Shapely for efficient geometric operations.

    Args:
        route_coords (list): List of [lng, lat] coordinates defining the route.
        towers (list): A list of tower dictionaries, each needing 'lat' and 'lon'.
        max_distance_meters (int): Maximum distance in meters from the route.

    Returns:
        list: A list of tower dictionaries that are along the route, sorted by
                their projected position along the route. Includes 'distanceToRoute'
                and 'positionAlongRoute' (0.0 to 1.0).
    """
    if not route_coords or len(route_coords) < 2 or not towers:
        return []

    try:
        # Create Shapely LineString from route coordinates [lng, lat]
        route_line = LineString(route_coords)
        route_length = route_line.length # Length in degrees

        nearby_towers = []
        # Approximation: Convert max_distance_meters to degrees (latitude varies, use estimate)
        # This is a rough filter; precise distance check is done later if needed.
        # A more robust approach might involve projecting points or using a spatial index.
        max_dist_degrees_approx = max_distance_meters / 111000 # Approx meters per degree at equator

        for tower in towers:
            if 'lat' in tower and 'lon' in tower:
                try:
                    tower_point = Point(tower['lon'], tower['lat'])

                    # Calculate the minimum distance from the tower to the route line
                    # Shapely's distance is in the units of the coordinates (degrees here)
                    distance_degrees = route_line.distance(tower_point)

                    # Only proceed if the degree distance is potentially within range
                    if distance_degrees <= max_dist_degrees_approx * 1.5: # Add buffer to approx check
                        # Find the nearest point on the route to the tower
                        nearest_route_point_geom = nearest_points(route_line, tower_point)[0]

                        # Calculate actual distance in meters using Haversine
                        distance_meters = haversine_distance(
                            tower_point.y, tower_point.x,
                            nearest_route_point_geom.y, nearest_route_point_geom.x
                        )

                        if distance_meters <= max_distance_meters:
                            tower_copy = tower.copy()
                            tower_copy['distanceToRoute'] = distance_meters

                            # Calculate the normalized distance along the route (0.0 at start, 1.0 at end)
                            # project() returns distance along in coordinate units (degrees)
                            position_degrees = route_line.project(nearest_route_point_geom)
                            # Normalize based on total route length in degrees
                            position_normalized = position_degrees / route_length if route_length > 0 else 0
                            tower_copy['positionAlongRoute'] = max(0.0, min(1.0, position_normalized)) # Clamp to [0, 1]

                            nearby_towers.append(tower_copy)
                except Exception as geo_err:
                    log.warning(f"Could not process tower geometry: {tower}. Error: {geo_err}")

        # Sort towers by their position along the route
        nearby_towers.sort(key=lambda t: t.get('positionAlongRoute', 0))

        return nearby_towers

    except ImportError:
        log.error("Shapely library not found. Cannot perform geometric operations for find_towers_near_route_shapely.")
        return [] # Return empty if Shapely is missing
    except Exception as e:
        log.exception(f"Error in find_towers_near_route_shapely: {e}")
        return []