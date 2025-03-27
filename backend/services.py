import requests
import math
import numpy as np
from config import Config
import random
import os
import json
from dotenv import load_dotenv
import pandas as pd  # Add pandas import for CSV handling
import heapq
import polyline
from shapely.geometry import LineString, Point
# Add a new import for osmnx
import osmnx as ox
import networkx as nx
import time
import http.client
from http.client import IncompleteRead
import traceback
import logging

# Global toggle for custom routing
USE_CUSTOM_ROUTING = False  # Set to False to use OSRM for all route types

# Global cache for road networks to avoid re-fetching
road_network_cache = {}

def geocode_location(query, autocomplete=False, proximity_lng=None, proximity_lat=None):
    """Search for a location using MapTiler geocoding API"""
    """Looks for location based on the given string(Address, State, Zip Code) query > returns Lat, Lon"""
    url = f"https://api.maptiler.com/geocoding/{query}.json"
    params = {
        'key': Config.MAPTILER_KEY,
        'autocomplete': str(autocomplete).lower()
    }
    
    # Add proximity parameters if provided
    if proximity_lng is not None and proximity_lat is not None:
        params['proximity'] = f"{proximity_lng},{proximity_lat}"
    
    response = requests.get(url, params=params)
    return response.json()

def reverse_geocode(lng, lat):
    """Get an address from coordinates using MapTiler API"""
    """Returns Lat, Lon < given string(Address, State, Zip Code) """

    url = f"https://api.maptiler.com/geocoding/{lng},{lat}.json"
    params = {
        'key': Config.MAPTILER_KEY
    }
    
    response = requests.get(url, params=params)
    return response.json()

def get_cell_towers(min_lat, min_lng, max_lat, max_lng):
    """Get real cell tower data for a bounding box from CSV file"""
    
    print(f"Fetching real cell towers in area: {min_lat},{min_lng},{max_lat},{max_lng}")
    
    try:
        # Path to the CSV file
        csv_path = os.path.join(os.path.dirname(__file__), 'data', 'cell_towers.csv')
        
        # Read the CSV file
        df = pd.read_csv(csv_path)
        
        # Filter towers within the bounding box
        towers_df = df[(df['lat'] >= min_lat) & (df['lat'] <= max_lat) & 
                       (df['lon'] >= min_lng) & (df['lon'] <= max_lng)]
        
        # Limit to a reasonable number of towers for performance (e.g., 500)
        if len(towers_df) > 500:
            towers_df = towers_df.sample(500)
        
        # Convert to list of dictionaries
        towers = towers_df.to_dict('records')
        
        # Ensure all towers have averageSignal if it's missing
        for tower in towers:
            if 'averageSignal' not in tower or tower['averageSignal'] == 0:
                # Generate a realistic signal strength if not available
                tower['averageSignal'] = random.randint(-110, -60)
        
        print(f"Found {len(towers)} real cell towers in the area")
        
        return {
            'towers': towers,
            'total': len(towers)
        }
    
    except Exception as e:
        print(f"Error reading cell tower data: {e}")
        print("Falling back to mock tower data...")
        
        # Fallback to mock data if there's an error
        # Calculate area dimensions
        lat_range = max_lat - min_lat
        lng_range = max_lng - min_lng
        
        # Generate between 20-40 random towers for good coverage
        num_towers = random.randint(20, 40)
        towers = []
        
        for i in range(num_towers):
            # Random position within bounds
            lat = min_lat + random.random() * lat_range
            lng = min_lng + random.random() * lng_range
            
            # Random signal strength (between -110 and -60 dBm)
            signal_strength = random.randint(-110, -60)
            
            # Cell types
            radio_types = ['GSM', 'UMTS', 'LTE', '5G']
            radio = random.choice(radio_types)
            
            # Generate more 5G and LTE towers than older technologies
            if random.random() < 0.7:  # 70% chance for modern technology
                radio = '5G' if random.random() < 0.4 else 'LTE'
                
            # Create tower data
            towers.append({
                'lat': lat,
                'lon': lng,
                'radio': radio,
                'mcc': 310,  # US mobile country code
                'net': random.randint(0, 999),
                'area': random.randint(0, 9999),
                'cell': random.randint(0, 99999),
                'unit': 0,
                'range': random.randint(1000, 6000),  # 1-6km range
                'samples': random.randint(1, 100),
                'changeable': 1,
                'created': int(random.random() * 10000000) + 1600000000,
                'updated': int(random.random() * 10000000) + 1600000000,
                'averageSignal': signal_strength
            })
        
        print(f"Generated {len(towers)} mock cell towers as fallback")
        
        return {
            'towers': towers,
            'total': len(towers)
        }

def calculate_signal_strength(lat, lng, towers):
    """Calculate the estimated signal strength at a given point based on nearby towers"""
    if not towers:
        return 0
    
    total_signal = 0
    total_weight = 0
    
    for tower in towers:
        # Calculate distance to tower in meters
        tower_lat = tower['lat']
        tower_lng = tower['lon']
        
        # Simplified distance calculation using Haversine formula
        lat1, lon1, lat2, lon2 = map(math.radians, [lat, lng, tower_lat, tower_lng])
        
        # Earth radius in meters
        earth_radius = 6371000
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        distance = earth_radius * c
        
        # Tower range is typically 1-30km
        tower_range = tower['range'] if tower['range'] > 0 else 5000  # Default 5km if not specified
        
        # Weight based on inverse square law (signal strength decreases with square of distance)
        if distance <= tower_range:
            # For very close distances, cap the weight to avoid extremely high values
            distance = max(100, distance)  # Minimum 100m to avoid division by very small numbers
            weight = 1 / (distance**2)
            signal = tower['averageSignal'] if tower['averageSignal'] != 0 else -70  # Default signal if not provided
            
            total_signal += signal * weight
            total_weight += weight
    
    # If no towers are in range
    if total_weight == 0:
        return -100  # Very poor signal
    
    # Return weighted average signal strength
    return total_signal / total_weight

# New function to get a road network graph from OpenStreetMap
def get_road_network(min_lat, min_lng, max_lat, max_lng, simplify=True):
    """Get a road network graph from OpenStreetMap for the given bounding box"""
    # Configure OSMnx to use alternative providers
    ox.settings.overpass_settings = '[out:json][timeout:180]'
    ox.settings.overpass_endpoint = 'https://overpass-api.de/api/interpreter'  # Alternative endpoint
    
    # Add debug logging for the area size
    area_size = (max_lat - min_lat) * (max_lng - min_lng)
    print(f"Requested area size: {area_size:.6f} sq degrees (approx {area_size * 111 * 111:.1f} sq km)")
    
    # For testing purposes - special handling for known locations
    # Boston area test - REMOVED LIMITATION
    boston_area = (42.2, -71.2, 42.4, -71.0)  # Approximate Boston bounding box
    # Boston area check removed to allow routing anywhere
    # Previously had a check here that restricted routing to Boston area
    
    # Check if the area is extremely large and progressively reduce it
    if area_size > 0.1:  # Very large area (roughly 10km x 10km)
        print(f"Area too large ({area_size:.4f}), reducing to direct route corridor")
        # Calculate the midpoint of start and end
        mid_lat = (min_lat + max_lat) / 2
        mid_lng = (min_lng + max_lng) / 2
        
        # Calculate the direction vector
        lat_direction = max_lat - min_lat
        lng_direction = max_lng - min_lng
        
        # Use much smaller padding (direct route corridor)
        small_buffer = 0.005  # ~500m buffer
        
        # Create a narrower bounding box along the route direction
        new_min_lat = mid_lat - abs(lat_direction) / 4 - small_buffer
        new_max_lat = mid_lat + abs(lat_direction) / 4 + small_buffer
        new_min_lng = mid_lng - abs(lng_direction) / 4 - small_buffer
        new_max_lng = mid_lng + abs(lng_direction) / 4 + small_buffer
        
        print(f"Reduced area: {new_min_lat:.6f},{new_min_lng:.6f} to {new_max_lat:.6f},{new_max_lng:.6f}")
        return get_road_network(new_min_lat, new_min_lng, new_max_lat, new_max_lng, simplify)
    
    # Generate a cache key based on the bounding box
    cache_key = f"{min_lat:.4f},{min_lng:.4f},{max_lat:.4f},{max_lng:.4f}"
    
    # Check if we have this network cached
    if cache_key in road_network_cache:
        print(f"Using cached road network for {cache_key}")
        return road_network_cache[cache_key]
    
    # Set timeout and retry parameters
    max_retries = 3
    current_retry = 0
    timeout = 90  # Increased timeout
    
    while current_retry < max_retries:
        try:
            print(f"Fetching road network for area: {min_lat},{min_lng},{max_lat},{max_lng} (Attempt {current_retry+1}/{max_retries})")
            
            # Configure session for OSMnx
            ox.config(timeout=timeout, memory=2000, use_cache=True)
            
            # Try different approaches based on retry count
            if current_retry == 0:
                # First attempt - standard JSON
                ox.settings.overpass_settings = '[out:json][timeout:180]'
            elif current_retry == 1:
                # Second attempt - alternative endpoint
                ox.settings.overpass_endpoint = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
            elif current_retry == 2:
                # Third attempt - XML format
                print("Trying XML format instead of JSON...")
                ox.settings.overpass_settings = '[out:xml][timeout:180]'
            
            # Check if the area is too large (more than ~5km x 5km)
            if (max_lat - min_lat > 0.05) or (max_lng - min_lng > 0.05):
                print("Large area detected, using custom download parameters")
                # For large areas, use a less detailed network type
                graph = ox.graph_from_bbox(
                    north=max_lat, 
                    south=min_lat, 
                    east=max_lng, 
                    west=min_lng, 
                    network_type='drive_service',  # Less detailed than 'drive'
                    simplify=simplify,
                    retain_all=False,
                    truncate_by_edge=True  # This helps with large areas
                )
            else:
                # Normal case for smaller areas
                graph = ox.graph_from_bbox(
                    north=max_lat, 
                    south=min_lat, 
                    east=max_lng, 
                    west=min_lng, 
                    network_type='drive',
                    simplify=simplify,
                    retain_all=False
                )
            
            # Verify that the graph has nodes and edges
            if graph and (len(graph.nodes) == 0 or len(graph.edges) == 0):
                print("Retrieved empty graph, retrying...")
                current_retry += 1
                timeout += 30  # Increase timeout for next attempt
                continue
            
            # Apply additional simplification to reduce complexity
            if graph and simplify and len(graph.nodes) > 1000:
                try:
                    print(f"Simplifying large graph with {len(graph.nodes)} nodes...")
                    graph = ox.simplify_graph(graph)
                    print(f"Simplified to {len(graph.nodes)} nodes")
                except Exception as e:
                    print(f"Error during additional simplification: {e}")
            
            if graph:
                # Add the graph to our cache
                road_network_cache[cache_key] = graph
                
                print(f"Retrieved road network with {len(graph.nodes)} nodes and {len(graph.edges)} edges")
                return graph
            else:
                print("Failed to get graph, retrying...")
                current_retry += 1
        
        except requests.exceptions.Timeout:
            print(f"Timeout error fetching road network (attempt {current_retry+1}/{max_retries})")
            current_retry += 1
            timeout += 30  # Increase timeout for next attempt
            
            # If we've retried at least once, try with a smaller area
            if current_retry >= 2:
                print("Reducing area size due to timeout...")
                # Reduce the area by 20% 
                lat_mid = (min_lat + max_lat) / 2
                lng_mid = (min_lng + max_lng) / 2
                lat_range = (max_lat - min_lat) * 0.4  # 40% of original range
                lng_range = (max_lng - min_lng) * 0.4  # 40% of original range
                
                smaller_min_lat = lat_mid - lat_range / 2
                smaller_max_lat = lat_mid + lat_range / 2
                smaller_min_lng = lng_mid - lng_range / 2
                smaller_max_lng = lng_mid + lng_range / 2
                
                print(f"Trying smaller area: {smaller_min_lat:.6f},{smaller_min_lng:.6f} to {smaller_max_lat:.6f},{smaller_max_lng:.6f}")
                result = get_road_network(smaller_min_lat, smaller_min_lng, smaller_max_lat, smaller_max_lng, simplify)
                if result:
                    return result
        
        except requests.exceptions.ConnectionError as e:
            print(f"Connection error fetching road network (attempt {current_retry+1}/{max_retries}): {e}")
            current_retry += 1
            time.sleep(2)  # Wait before retrying
        
        except (IncompleteRead, http.client.IncompleteRead) as e:
            print(f"IncompleteRead error fetching road network (attempt {current_retry+1}/{max_retries}): {e}")
            current_retry += 1
            time.sleep(3)  # Wait before retrying
            
        except Exception as e:
            print(f"Error fetching road network (attempt {current_retry+1}/{max_retries}): {e}")
            traceback.print_exc()  # Print full traceback for debugging
            current_retry += 1
            time.sleep(1)  # Wait before retrying
    
    # All attempts failed, try one last approach using NetworkX to create a simplified graph directly
    print("All OSM attempts failed, creating a basic grid network...")
    try:
        # Create a simplified grid network as a last resort
        import networkx as nx
        
        # Generate a grid with ~10 points in each direction
        grid_size = 10
        lat_step = (max_lat - min_lat) / grid_size
        lng_step = (max_lng - min_lng) / grid_size
        
        # Create a grid graph
        G = nx.grid_2d_graph(grid_size+1, grid_size+1)
        
        # Convert to a proper road network format
        road_network = nx.DiGraph()
        
        for node in G.nodes():
            i, j = node
            # Convert grid coordinates to lat/lng
            lat = min_lat + i * lat_step
            lng = min_lng + j * lng_step
            
            # Add node with required attributes
            road_network.add_node(node, y=lat, x=lng)
        
        # Add edges with length attributes
        for u, v in G.edges():
            i1, j1 = u
            i2, j2 = v
            
            # Calculate length in meters
            lat1 = min_lat + i1 * lat_step
            lng1 = min_lng + j1 * lng_step
            lat2 = min_lat + i2 * lat_step
            lng2 = min_lng + j2 * lng_step
            
            length = haversine_distance(lat1, lng1, lat2, lng2)
            
            # Add edge with attributes
            road_network.add_edge(u, v, length=length, speed_kph=50)
            road_network.add_edge(v, u, length=length, speed_kph=50)  # Add reverse direction
        
        print(f"Created fallback grid network with {len(road_network.nodes)} nodes and {len(road_network.edges)} edges")
        return road_network
    
    except Exception as e:
        print(f"Failed to create fallback network: {e}")
        return None

# New function to find nearest network node for a lat/lng point
def get_nearest_node(graph, lat, lng):
    """Find the nearest node in the road network to the given coordinates"""
    try:
        # Use osmnx to find the nearest node
        return ox.distance.nearest_nodes(graph, lng, lat)
    except Exception as e:
        print(f"Error finding nearest node with osmnx: {e}")
        try:
            # Fallback method: manual calculation
            print("Using manual nearest node calculation")
            nearest_node = None
            nearest_dist = float('inf')
            
            # Iterate through all nodes to find the closest
            for node, data in graph.nodes(data=True):
                if 'y' in data and 'x' in data:
                    node_lat = data['y']
                    node_lng = data['x']
                    dist = haversine_distance(lat, lng, node_lat, node_lng)
                    
                    if dist < nearest_dist:
                        nearest_dist = dist
                        nearest_node = node
            
            if nearest_node is not None:
                print(f"Found nearest node at distance {nearest_dist:.2f}m")
                return nearest_node
            else:
                print("No suitable node found")
                return None
        except Exception as inner_e:
            print(f"Error in manual nearest node calculation: {inner_e}")
            return None

# New function to calculate a custom route using cell tower data
def calculate_custom_route(start_lat, start_lng, end_lat, end_lng, towers=None, signal_weight=0.25):
    """
    Calculate a route between two points using a custom algorithm that incorporates cell tower data.
    
    Arguments:
    - start_lat, start_lng: Starting coordinates
    - end_lat, end_lng: Ending coordinates
    - towers: List of cell towers to use for signal calculations
    - signal_weight: Weight to give to signal strength vs. distance (0-1)
                     0 = purely fastest route, 1 = purely best signal
                     
    Returns:
    - A dictionary with route information similar to OSRM response format
    """
    start_time = time.time()
    
    # Print debug info
    print(f"=== CUSTOM ROUTE CALCULATION ===")
    print(f"From: {start_lat:.6f},{start_lng:.6f} to {end_lat:.6f},{end_lng:.6f}")
    print(f"Signal weight: {signal_weight}")
    
    # Always get fresh cell tower data for route calculations
    try:
        # Add padding to ensure we get enough road network
        distance_km = haversine_distance(start_lat, start_lng, end_lat, end_lng) / 1000
        print(f"Route distance: {distance_km:.2f} km")
        
        # Scale padding based on distance - smaller for longer routes to avoid timeouts
        if distance_km > 50:
            padding = 0.02  # Very small padding for long routes
        elif distance_km > 20:
            padding = 0.05  # Small padding for medium routes
        else:
            padding = min(0.2, max(0.05, distance_km / 40))  # Normal padding for short routes
        
        print(f"Using padding of {padding} degrees (approx {padding*111:.1f} km)")
        
        # Define bounding box
        lat_min = min(start_lat, end_lat) - padding
        lat_max = max(start_lat, end_lat) + padding
        lng_min = min(start_lng, end_lng) - padding
        lng_max = max(start_lng, end_lng) + padding
        
        print(f"Fetching cell towers in area: {lat_min:.6f},{lng_min:.6f} to {lat_max:.6f},{lng_max:.6f}")
        cell_data = get_cell_towers(lat_min, lng_min, lat_max, lng_max)
        fresh_towers = cell_data.get('towers', [])
        print(f"Found {len(fresh_towers)} cell towers in the area")
        
        # Merge with provided towers if any
        if towers and len(towers) > 0:
            # Use a set to avoid duplicates
            tower_ids = set(tower['id'] for tower in fresh_towers)
            for tower in towers:
                if tower['id'] not in tower_ids:
                    fresh_towers.append(tower)
            
            print(f"Combined with provided towers: now using {len(fresh_towers)} towers")
        
        # Update towers with fresh data
        towers = fresh_towers
    except Exception as e:
        print(f"Error fetching fresh cell towers: {e}")
        # If we have provided towers, use those
        if not towers or len(towers) == 0:
            print("No cell tower data available, using distance-only routing")
            signal_weight = 0  # Force distance-only routing if no towers
    
    # If signal weight is 0, just use the fastest route
    if signal_weight == 0:
        print("Signal weight is 0, using fastest route only")
        return get_route_fastest(start_lat, start_lng, end_lat, end_lng)
    
    # Define initial bounding box for road network
    distance_km = haversine_distance(start_lat, start_lng, end_lat, end_lng) / 1000
    
    # Scale padding based on distance - smaller for longer routes to avoid timeouts
    if distance_km > 50:
        padding = 0.02  # Very small padding for long routes
    elif distance_km > 20:
        padding = 0.05  # Small padding for medium routes
    else:
        padding = min(0.2, max(0.05, distance_km / 40))  # Normal padding for short routes
    
    print(f"Using padding of {padding} degrees (approx {padding*111:.1f} km)")
    
    # Define bounding box
    lat_min = min(start_lat, end_lat) - padding
    lat_max = max(start_lat, end_lat) + padding
    lng_min = min(start_lng, end_lng) - padding
    lng_max = max(start_lng, end_lng) + padding
        
    # First attempt with normal padding
    print("Attempting to get road network...")
    graph = get_road_network(lat_min, lng_min, lat_max, lng_max)
    
    # If that fails, the get_road_network function will now try recursively with smaller areas
    if not graph:
        print("Failed to get road network after all attempts, falling back to OSRM")
        return get_route_fastest(start_lat, start_lng, end_lat, end_lng)
    
    # Find nearest nodes to start and end points
    print("Finding nearest nodes in network...")
    start_node = get_nearest_node(graph, start_lat, start_lng)
    end_node = get_nearest_node(graph, end_lat, end_lng)
    
    if start_node is None or end_node is None:
        print("Could not find nearest nodes, falling back to OSRM")
        return get_route_fastest(start_lat, start_lng, end_lat, end_lng)
    
    # Print debug info about the nodes
    print(f"Start node: {start_node}, End node: {end_node}")
    
    # Calculate route using modified Dijkstra's algorithm that incorporates signal strength
    try:
        print(f"Calculating route with signal_weight={signal_weight}, using {len(towers)} cell towers...")
        path, details = dijkstra_with_signal(graph, start_node, end_node, towers, signal_weight)
        
        if not path or len(path) < 2:
            print("No valid path found, falling back to OSRM")
            return get_route_fastest(start_lat, start_lng, end_lat, end_lng)
        
        print(f"Found path with {len(path)} nodes")
        
        # Extract path coordinates
        coords = []
        for node in path:
            # Get node coordinates
            node_data = graph.nodes[node]
            coords.append([node_data['x'], node_data['y']])  # [longitude, latitude]
        
        # Create a GeoJSON LineString for the route geometry
        geometry = {
            "type": "LineString",
            "coordinates": coords
        }
        
        # Calculate route distance and duration
        distance = details['distance']
        duration = details['duration']
        
        # Generate turn-by-turn directions
        print("Generating turn-by-turn directions for custom route...")
        directions = generate_directions(coords)
        print(f"Generated {len(directions)} direction steps")
        
        # Build legs array with steps
        legs = [{
            "distance": distance,
            "duration": duration,
            "summary": f"Custom route ({len(coords)} points)",
            "steps": directions
        }]
        
        # Create route data in OSRM compatible format
        route_data = {
            "code": "Ok",
            "routes": [
                {
                    "geometry": {
                        "coordinates": coords,
                        "type": "LineString"
                    },
                    "legs": legs,  # Include the legs with directions
                    "distance": distance,
                    "duration": duration,
                    "cell_coverage": {
                        "average_signal": details['average_signal'],
                        "signal_variance": details['signal_variance'],
                        "min_signal": details['min_signal'],
                        "low_signal_percentage": details['low_signal_percentage'],
                        "signal_samples": details['signal_samples'],
                        "score": details['signal_score']
                    },
                    "custom_route": True,
                    "towers_used": len(towers)
                }
            ],
            "waypoints": [
                {"location": [start_lng, start_lat]},
                {"location": [end_lng, end_lat]}
            ],
            "towers": towers  # Include the towers in the response
        }
        
        end_time = time.time()
        print(f"Custom route calculation took {end_time - start_time:.2f} seconds")
        print(f"Path has {len(path)} nodes, {len(coords)} coordinates")
        print(f"Distance: {distance/1000:.2f}km, Duration: {duration/60:.2f}min")
        print(f"Avg Signal: {details['average_signal']:.2f}dBm, Min: {details['min_signal']:.2f}dBm")
        print(f"Signal Score: {details['signal_score']:.2f}")
        
        return route_data
        
    except Exception as e:
        print(f"Error calculating custom route: {e}")
        traceback.print_exc()  # Add full stack trace for debugging
        # Fall back to OSRM routing
        return get_route_fastest(start_lat, start_lng, end_lat, end_lng)

# Helper function for Haversine distance calculation
def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate the great circle distance between two points on earth in meters"""
    # Earth radius in meters
    earth_radius = 6371000
    
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Return distance in meters
    return earth_radius * c

# Implementation of Dijkstra's algorithm with signal strength consideration
def dijkstra_with_signal(graph, start_node, end_node, towers, signal_weight):
    """
    Modified Dijkstra's algorithm that considers both distance and signal strength.
    
    Arguments:
    - graph: NetworkX graph of the road network
    - start_node, end_node: Node IDs for start and end
    - towers: List of cell towers
    - signal_weight: Weight to give to signal strength vs. distance (0-1)
    
    Returns:
    - Tuple of (path, details) where path is a list of nodes and details contains route statistics
    """
    print(f"Starting Dijkstra with {len(towers)} towers and signal_weight={signal_weight}")
    
    # For safety, ensure we have at least some towers
    if not towers or len(towers) == 0:
        print("Warning: No cell towers provided, using standard Dijkstra (distance only)")
        signal_weight = 0  # Force distance-only routing
    
    # Initialize distances and visited sets
    distances = {node: float('infinity') for node in graph.nodes()}
    previous = {node: None for node in graph.nodes()}
    visited = set()
    
    # Signal information for each node
    node_signals = {}
    signal_samples = []
    
    # Set start distance to 0
    distances[start_node] = 0
    
    # Priority queue for nodes to visit
    pq = [(0, start_node)]
    
    # Precompute signal strengths for all nodes to avoid repeated calculations
    if signal_weight > 0 and towers and len(towers) > 0:
        print("Precomputing signal strengths for all nodes...")
        for node in graph.nodes():
            node_data = graph.nodes[node]
            lat = node_data['y']  # NetworkX stores lat in 'y'
            lng = node_data['x']  # NetworkX stores lng in 'x'
            signal = calculate_signal_strength(lat, lng, towers)
            node_signals[node] = signal
        print(f"Precomputed signal strengths for {len(node_signals)} nodes")
    
    # Count nodes processed to monitor progress
    nodes_processed = 0
    last_progress = 0
    
    # Start time for performance tracking
    start_time = time.time()
    
    while pq:
        # Get node with smallest distance
        current_distance, current_node = heapq.heappop(pq)
        
        # Skip if already visited
        if current_node in visited:
                                continue
                    
        # Mark as visited
        visited.add(current_node)
        
        # Progress tracking
        nodes_processed += 1
        progress_pct = (nodes_processed / len(graph.nodes)) * 100
        if progress_pct - last_progress >= 10:  # Report every 10%
            last_progress = progress_pct
            elapsed = time.time() - start_time
            print(f"Processed {nodes_processed}/{len(graph.nodes)} nodes ({progress_pct:.1f}%) in {elapsed:.2f}s")
        
        # If we've reached the end, reconstruct and return path
        if current_node == end_node:
            print(f"Reached end node after processing {nodes_processed}/{len(graph.nodes)} nodes")
            path = []
            while current_node:
                path.append(current_node)
                current_node = previous[current_node]
            path.reverse()
            
            # Calculate route details
            total_distance = 0
            total_duration = 0
            prev_node = None
            
            # Signal quality metrics along the route
            route_signals = []
            
            for node in path:
                if prev_node is not None:
                    # Get edge data
                    try:
                        # NetworkX can have multiple edges between nodes
                        edge_data = min(
                            graph.get_edge_data(prev_node, node).values(),
                            key=lambda x: x.get('length', float('infinity'))
                        )
                        
                        # Add distance and estimated duration
                        distance = edge_data.get('length', 0)
                        total_distance += distance
                        
                        # Estimate duration based on speed
                        speed = edge_data.get('speed_kph', 50)  # Default to 50 kph
                        duration = (distance / 1000) / (speed / 3600)  # Convert to seconds
                        total_duration += duration
                        
                        # Add signal if available
                        if node in node_signals:
                            route_signals.append(node_signals[node])
                    except Exception as e:
                        print(f"Error processing edge {prev_node}->{node}: {e}")
                
                prev_node = node
            
            # Calculate signal statistics
            if route_signals:
                avg_signal = sum(route_signals) / len(route_signals)
                min_signal = min(route_signals)
                signal_variance = sum((s - avg_signal) ** 2 for s in route_signals) / len(route_signals)
                # Count percentage of points with signal below -100 dBm (poor signal)
                low_signal_count = sum(1 for s in route_signals if s < -100)
                low_signal_pct = (low_signal_count / len(route_signals)) * 100
                
                # Calculate a normalized signal score (0-1)
                # Convert from dBm (-50 = excellent, -120 = very poor) to 0-1 scale
                signal_score = max(0, min(1, (avg_signal + 120) / 70))
            else:
                # No signal data
                avg_signal = -120
                min_signal = -120
                signal_variance = 0
                low_signal_pct = 100
                signal_score = 0
            
            # Return path and details
            return path, {
                'distance': total_distance,
                'duration': total_duration,
                        'average_signal': avg_signal,
                'min_signal': min_signal,
                        'signal_variance': signal_variance,
                'low_signal_percentage': low_signal_pct,
                'signal_samples': len(route_signals),
                'signal_score': signal_score
            }
        
        # Explore neighbors
        for neighbor in graph.neighbors(current_node):
            if neighbor in visited:
                continue
                
            # Get edge data (there can be multiple edges)
            try:
                # Get the shortest edge if there are multiple
                edge_data = min(
                    graph.get_edge_data(current_node, neighbor).values(),
                    key=lambda x: x.get('length', float('infinity'))
                )
                
                # Get distance for this edge
                distance = edge_data.get('length', 0)
                
                # Base weight is distance
                weight = distance
                
                # Apply signal weighting if enabled
                if signal_weight > 0:
                    # Get signal at this node (precomputed)
                    signal = node_signals.get(neighbor, -120)  # Default to poor signal
                    
                    # Convert signal from dBm (-50 = excellent, -120 = very poor) to 0-1 scale
                    # -50 dBm → 1.0, -120 dBm → 0.0
                    normalized_signal = max(0, min(1, (signal + 120) / 70))
                    
                    # Invert for weighting (higher signal = lower weight)
                    signal_factor = 1 - normalized_signal
                    
                    # Adjust the weight based on signal_weight
                    # weight = (1-signal_weight) * distance + signal_weight * signal_factor * distance_scale
                    distance_scale = 1000  # Scale factor to make signal comparable to distance
                    adjusted_weight = (
                        (1 - signal_weight) * distance + 
                        signal_weight * signal_factor * distance_scale
                    )
                    
                    # Update the weight
                    weight = adjusted_weight
                
                # Calculate new distance
                new_distance = distances[current_node] + weight
                
                # Update if this path is better
                if new_distance < distances[neighbor]:
                    distances[neighbor] = new_distance
                    previous[neighbor] = current_node
                    heapq.heappush(pq, (new_distance, neighbor))
            except Exception as e:
                print(f"Error processing edge {current_node}->{neighbor}: {e}")
                continue
    
    # If we've exhausted all nodes and haven't found the end
    print("Could not find a path to the destination node")
    return None, {}

# Modify this function to use our custom router for cell_coverage optimization
def get_route_cell_coverage(start_lat, start_lng, end_lat, end_lng):
    """Get a route optimized for cell coverage using our custom routing algorithm"""
    try:
        # Check if custom routing is enabled
        if not USE_CUSTOM_ROUTING:
            print("Custom routing disabled, using OSRM for cell_coverage route")
            return get_route_fastest(start_lat, start_lng, end_lat, end_lng)
            
        # Get cell towers in the area with padding
        # More distant routes need larger area to search for towers
        distance_km = haversine_distance(start_lat, start_lng, end_lat, end_lng) / 1000
        padding = min(0.5, max(0.1, distance_km / 50))  # Dynamic padding based on route distance
        
        lat_min = min(start_lat, end_lat) - padding
        lat_max = max(start_lat, end_lat) + padding
        lng_min = min(start_lng, end_lng) - padding
        lng_max = max(start_lng, end_lng) + padding
        
        # Extend the search area
        cell_data = get_cell_towers(lat_min, lng_min, lat_max, lng_max)
        towers = cell_data.get('towers', [])
        
        # Use our custom routing algorithm with high signal weight (1)
        return calculate_custom_route(start_lat, start_lng, end_lat, end_lng, towers=towers, signal_weight=1)
    
    except Exception as e:
        print(f"Error in get_route_cell_coverage: {e}")
        # Fall back to OSRM routing
        return get_route_fastest(start_lat, start_lng, end_lat, end_lng)

# Modify balanced route to use our custom router with a medium signal weight
def get_route_balanced(start_lat, start_lng, end_lat, end_lng):
    """Get a route balanced between speed and cell coverage using our custom routing algorithm"""
    try:
        # Check if custom routing is enabled
        if not USE_CUSTOM_ROUTING:
            print("Custom routing disabled, using OSRM for balanced route")
            return get_route_fastest(start_lat, start_lng, end_lat, end_lng)
            
        # Get cell towers in the area with padding
        distance_km = haversine_distance(start_lat, start_lng, end_lat, end_lng) / 1000
        padding = min(0.5, max(0.1, distance_km / 50))
        
        lat_min = min(start_lat, end_lat) - padding
        lat_max = max(start_lat, end_lat) + padding
        lng_min = min(start_lng, end_lng) - padding
        lng_max = max(start_lng, end_lng) + padding
        
        cell_data = get_cell_towers(lat_min, lng_min, lat_max, lng_max)
        towers = cell_data.get('towers', [])
        
        # Use our custom routing algorithm with balanced signal weight (0.25)
        # The tower parameter is now optional in calculate_custom_route
        return calculate_custom_route(start_lat, start_lng, end_lat, end_lng, towers=towers, signal_weight=0.25)
    
    except Exception as e:
        print(f"Error in get_route_balanced: {e}")
        # Fall back to OSRM routing
        return get_route_fastest(start_lat, start_lng, end_lat, end_lng)

def get_route_fastest(start_lat, start_lng, end_lat, end_lng):
    """Calculate the fastest route between two points using OSRM"""
    try:
        # Calculate the distance to determine appropriate timeout
        distance_km = haversine_distance(start_lat, start_lng, end_lat, end_lng) / 1000
        
        # Adjust timeout based on distance
        if distance_km > 100:  # For very long routes
            timeout = 30
        elif distance_km > 50:  # For medium-long routes
            timeout = 20
        else:  # For shorter routes
            timeout = 15
            
        print(f"Calculating route of {distance_km:.1f}km with {timeout}s timeout")
        
        url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}"
        params = {
            'overview': 'full',
            'geometries': 'geojson',
            'steps': 'true',
            'alternatives': 'true'  # Request alternative routes
        }
        
        # Add retry logic for long routes
        max_retries = 3
        current_retry = 0
        
        while current_retry < max_retries:
            try:
                response = requests.get(url, params=params, timeout=timeout)
                response.raise_for_status()  # Raise an exception for bad responses
                return response.json()
            except requests.exceptions.Timeout:
                current_retry += 1
                if current_retry < max_retries:
                    print(f"Timeout on attempt {current_retry}, retrying with increased timeout...")
                    timeout += 10  # Increase timeout for next attempt
                    time.sleep(1)  # Wait a bit before retrying
                else:
                    print("All retry attempts failed")
                    return {
                        'code': 'Error',
                        'message': 'Route calculation timed out after multiple attempts'
                    }
            except requests.exceptions.RequestException as e:
                print(f"OSRM API request failed: {e}")
                return {
                    'code': 'Error',
                    'message': f'OSRM route calculation failed: {str(e)}'
                }
                
    except ValueError as e:
        print(f"Error parsing OSRM response: {e}")
        return {
            'code': 'Error',
            'message': f'Error parsing OSRM response: {str(e)}'
        }
    except Exception as e:
        print(f"Unexpected error in get_route_fastest: {e}")
        return {
            'code': 'Error',
            'message': f'Route calculation failed: {str(e)}'
        }

# Unused since Leaflet Routing Machine in frontend isn't running into issues
def get_route(start_lat, start_lng, end_lat, end_lng):
    """Calculate a route between two points"""
    url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}"
    params = {
        'overview': 'full',
        'geometries': 'geojson',
        'steps': 'true',
        'alternatives': 'true'  # Request alternative routes
    }
    
    response = requests.get(url, params=params)
    return response.json() 

def generate_directions(coords):
    """Generate turn-by-turn directions for a list of coordinates"""
    if not coords or len(coords) < 3:
        return []
        
    directions = []
    # Start with the first segment
    first_bearing = calculate_bearing(coords[0][1], coords[0][0], coords[1][1], coords[1][0])
    
    directions.append({
        "distance": 0,
        "type": "depart",
        "instruction": "Start heading " + get_direction_name(first_bearing),
        "bearing": first_bearing
    })
    
    # Process each segment to detect turns
    current_distance = 0
    
    for i in range(len(coords) - 2):
        # Calculate the bearing (direction) of the current segment
        current_bearing = calculate_bearing(coords[i][1], coords[i][0], coords[i+1][1], coords[i+1][0])
        # Calculate the bearing of the next segment
        next_bearing = calculate_bearing(coords[i+1][1], coords[i+1][0], coords[i+2][1], coords[i+2][0])
        
        # Calculate the change in direction
        bearing_diff = ((next_bearing - current_bearing + 180) % 360) - 180
        
        # Calculate the distance of this segment
        segment_distance = haversine_distance(coords[i][1], coords[i][0], coords[i+1][1], coords[i+1][0])
        current_distance += segment_distance
        
        # Determine if this is a significant turn
        if abs(bearing_diff) > 30:  # Threshold for considering it a turn
            turn_type = get_turn_type(bearing_diff)
            direction = get_direction_name(next_bearing)
            
            directions.append({
                "distance": current_distance,
                "type": turn_type,
                "instruction": f"{turn_type.capitalize()} onto road heading {direction}",
                "bearing": next_bearing
            })
            
            # Reset distance after recording a turn
            current_distance = 0
    
    # Add the final arrival step
    total_distance = sum(haversine_distance(coords[i][1], coords[i][0], coords[i+1][1], coords[i+1][0]) 
                         for i in range(len(coords) - 1))
    
    directions.append({
        "distance": total_distance,
        "type": "arrive",
        "instruction": "Arrive at destination",
        "bearing": 0
    })
    
    return directions

def calculate_bearing(lat1, lon1, lat2, lon2):
    """Calculate the bearing (in degrees) between two points"""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.degrees(math.atan2(y, x))
    
    # Normalize to 0-360
    return (bearing + 360) % 360

def get_direction_name(bearing):
    """Convert a bearing in degrees to a cardinal direction name"""
    directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north']
    index = round(bearing / 45)
    return directions[index]

def get_turn_type(bearing_diff):
    """Determine the type of turn based on the change in bearing"""
    if bearing_diff > 45:
        return "right"
    elif bearing_diff < -45:
        return "left"
    elif bearing_diff > 15:
        return "slight right"
    elif bearing_diff < -15:
        return "slight left"
    else:
        return "continue" 