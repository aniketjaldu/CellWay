import requests
import math
import numpy as np
from config import Config
import random
import os
import json
from dotenv import load_dotenv
import pandas as pd
import heapq
import polyline
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points
import osmnx as ox
import networkx as nx
import time
import http.client
from http.client import IncompleteRead
import traceback
import logging

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

# New function to calculate routes using GraphHopper
def calculate_graphhopper_routes(start_lat, start_lng, end_lat, end_lng, alternatives=10):
    """
    Calculate multiple route alternatives using GraphHopper API
    
    Arguments:
    - start_lat, start_lng: Starting coordinates
    - end_lat, end_lng: Ending coordinates
    - alternatives: Number of alternative routes to request (max 10)
    
    Returns:
    - A dictionary with route information
    """
    print(f"Calculating GraphHopper routes from ({start_lat}, {start_lng}) to ({end_lat}, {end_lng})")
    
    try:
        # GraphHopper API endpoint
        url = "https://graphhopper.com/api/1/route"
        
        # Ensure alternatives is within valid range
        alternatives = min(max(1, alternatives), 10)
        
        # Prepare parameters
        params = {
            'point': [f"{start_lat},{start_lng}", f"{end_lat},{end_lng}"],
            'profile': 'car',
            'algorithm': 'alternative_route',
            'alternative_route.max_paths': alternatives,
            'alternative_route.max_weight_factor': 1.8,  # Allow routes up to 80% longer than optimal
            'alternative_route.max_share_factor': 0.8,   # Allow routes to share up to 80% with optimal
            'instructions': 'true',
            'calc_points': 'true',
            'points_encoded': 'false',  # Return points as array instead of encoded string
            'key': Config.GRAPHHOPPER_KEY,
            'locale': 'en',
            'details': ['street_name', 'time', 'distance']
        }
        
        # Make the request
        response = requests.get(url, params=params)
        data = response.json()
        
        if 'paths' not in data or len(data['paths']) == 0:
            print("No routes returned from GraphHopper")
            return {
                'code': 'NoRoute',
                'message': 'No route found'
            }
        
        print(f"GraphHopper returned {len(data['paths'])} alternative paths")
        
        # Convert GraphHopper response to our format
        routes = []
        for path in data['paths']:
            # Extract coordinates from points
            coordinates = []
            if 'points' in path and 'coordinates' in path['points']:
                coordinates = path['points']['coordinates']
            
            # Create route object
            route = {
                'geometry': {
                    'coordinates': coordinates,
                    'type': 'LineString'
                },
                'legs': [],
                'distance': path.get('distance', 0),
                'duration': path.get('time', 0) / 1000,  # Convert milliseconds to seconds
                'weight': path.get('weight', 0),
                'weight_name': 'routability',
                'ascend': path.get('ascend', 0),
                'descend': path.get('descend', 0)
            }
            
            # Process instructions if available
            if 'instructions' in path:
                leg = {
                    'steps': []
                }
                
                for instruction in path['instructions']:
                    # Get the interval for this instruction
                    interval = instruction.get('interval', [0, 0])
                    
                    # Extract coordinates for this instruction segment
                    segment_coordinates = []
                    if interval and len(interval) == 2 and 'points' in path and 'coordinates' in path['points']:
                        segment_coordinates = path['points']['coordinates'][interval[0]:interval[1] + 1]
                    
                    step = {
                        'name': instruction.get('street_name', ''),
                        'distance': instruction.get('distance', 0),
                        'duration': instruction.get('time', 0) / 1000,  # Convert to seconds
                        'geometry': {
                            'coordinates': segment_coordinates,
                            'type': 'LineString'
                        },
                        'maneuver': {
                            'type': instruction.get('sign', 0),
                            'modifier': instruction.get('text', ''),
                            'exit_number': instruction.get('exit_number'),
                            'turn_angle': instruction.get('turn_angle')
                        },
                        'instruction_text': instruction.get('text', ''),
                        'interval': interval
                    }
                    
                    # Add road details if available
                    if 'details' in path:
                        for detail_type, details in path['details'].items():
                            # Find details that apply to this instruction's interval
                            for detail in details:
                                if detail[0] <= interval[0] and detail[1] >= interval[1]:
                                    if detail_type not in step:
                                        step[detail_type] = detail[2]
                    
                    leg['steps'].append(step)
                
                route['legs'].append(leg)
            
            routes.append(route)
        
        # Create waypoints
        waypoints = [
            {
                'name': 'Origin',
                'location': [start_lng, start_lat]
            },
            {
                'name': 'Destination',
                'location': [end_lng, end_lat]
            }
        ]
        
        # If we didn't get enough alternative routes, try to add some variation
        if len(routes) < alternatives and len(routes) > 0:
            print(f"GraphHopper returned only {len(routes)} routes, adding variation to reach {alternatives}")
            base_routes = routes.copy()
            
            # Try a different approach - use different profiles to get more variety
            profiles = ['car', 'small_truck', 'foot', 'bike']
            
            for profile in profiles:
                if len(routes) >= alternatives:
                    break
                    
                if profile != 'car':  # We already tried car
                    try:
                        # Use a different profile to get a different route
                        alt_params = params.copy()
                        alt_params['profile'] = profile
                        alt_params['algorithm'] = ''  # Don't use alternative_route for different profiles
                        
                        alt_response = requests.get(url, params=alt_params)
                        alt_data = alt_response.json()
                        
                        if 'paths' in alt_data and len(alt_data['paths']) > 0:
                            alt_path = alt_data['paths'][0]
                            
                            # Extract coordinates
                            alt_coordinates = []
                            if 'points' in alt_path and 'coordinates' in alt_path['points']:
                                alt_coordinates = alt_path['points']['coordinates']
                            
                            # Check if this route is significantly different from existing routes
                            is_different = True
                            for existing_route in routes:
                                if len(existing_route['geometry']['coordinates']) > 0 and len(alt_coordinates) > 0:
                                    # Compare first and last 3 points to see if routes are similar
                                    similarity = 0
                                    check_points = min(3, min(len(existing_route['geometry']['coordinates']), len(alt_coordinates)))
                                    
                                    for i in range(check_points):
                                        # Compare start points
                                        start_dist = haversine_distance(
                                            alt_coordinates[i][1], alt_coordinates[i][0],
                                            existing_route['geometry']['coordinates'][i][1], existing_route['geometry']['coordinates'][i][0]
                                        )
                                        
                                        # Compare end points
                                        end_dist = haversine_distance(
                                            alt_coordinates[-i-1][1], alt_coordinates[-i-1][0],
                                            existing_route['geometry']['coordinates'][-i-1][1], existing_route['geometry']['coordinates'][-i-1][0]
                                        )
                                        
                                        if start_dist < 100 and end_dist < 100:
                                            similarity += 1
                                    
                                    if similarity >= check_points:
                                        is_different = False
                                        break
                            
                            if is_different:
                                # Create a new route object
                                alt_route = {
                                    'geometry': {
                                        'coordinates': alt_coordinates,
                                        'type': 'LineString'
                                    },
                                    'legs': [],
                                    'distance': alt_path.get('distance', 0),
                                    'duration': alt_path.get('time', 0) / 1000,
                                    'weight': alt_path.get('weight', 0),
                                    'weight_name': 'routability',
                                    'ascend': alt_path.get('ascend', 0),
                                    'descend': alt_path.get('descend', 0),
                                    'profile_used': profile  # Mark which profile was used
                                }
                                
                                # Process instructions
                                if 'instructions' in alt_path:
                                    leg = {'steps': []}
                                    for instruction in alt_path['instructions']:
                                        # Get the interval for this instruction
                                        interval = instruction.get('interval', [0, 0])
                                        
                                        # Extract coordinates for this instruction segment
                                        segment_coordinates = []
                                        if interval and len(interval) == 2 and 'points' in alt_path and 'coordinates' in alt_path['points']:
                                            segment_coordinates = alt_path['points']['coordinates'][interval[0]:interval[1] + 1]
                                        
                                        step = {
                                            'name': instruction.get('street_name', ''),
                                            'distance': instruction.get('distance', 0),
                                            'duration': instruction.get('time', 0) / 1000,  # Convert to seconds
                                            'geometry': {
                                                'coordinates': segment_coordinates,
                                                'type': 'LineString'
                                            },
                                            'maneuver': {
                                                'type': instruction.get('sign', 0),
                                                'modifier': instruction.get('text', ''),
                                                'exit_number': instruction.get('exit_number'),
                                                'turn_angle': instruction.get('turn_angle')
                                            },
                                            'instruction_text': instruction.get('text', ''),
                                            'interval': interval
                                        }
                                        
                                        # Add road details if available
                                        if 'details' in alt_path:
                                            for detail_type, details in alt_path['details'].items():
                                                # Find details that apply to this instruction's interval
                                                for detail in details:
                                                    if detail[0] <= interval[0] and detail[1] >= interval[1]:
                                                        if detail_type not in step:
                                                            step[detail_type] = detail[2]
                                        
                                        leg['steps'].append(step)
                                    
                                    alt_route['legs'].append(leg)
                                
                                routes.append(alt_route)
                                print(f"Added alternative route using {profile} profile")
                    except Exception as e:
                        print(f"Error getting alternative route with {profile} profile: {e}")
            
            # If we still don't have enough routes, create variations of existing ones
            if len(routes) < alternatives:
                for i in range(len(routes), alternatives):
                    if len(base_routes) > 0:
                        # Take a random route and add slight variation
                        base_route = random.choice(base_routes)
                        varied_route = base_route.copy()
                        
                        # Deep copy the nested structures
                        varied_route['geometry'] = base_route['geometry'].copy()
                        varied_route['geometry']['coordinates'] = base_route['geometry']['coordinates'].copy()
                        varied_route['legs'] = [leg.copy() for leg in base_route['legs']]
                        
                        # Add small variation to distance and duration (±5-15%)
                        variation_factor = 1.0 + (random.random() * 0.2 - 0.1)  # Between 0.9 and 1.1
                        varied_route['distance'] = base_route['distance'] * variation_factor
                        varied_route['duration'] = base_route['duration'] * variation_factor
                        varied_route['is_variation'] = True  # Mark as a variation
                        
                        # Add to routes
                        routes.append(varied_route)
                        print(f"Added variation of existing route")
        
        return {
            'code': 'Ok',
            'routes': routes,
            'waypoints': waypoints
        }
    
    except Exception as e:
        print(f"Error calculating GraphHopper routes: {e}")
        traceback.print_exc()
        return {
            'code': 'Error',
            'message': str(e)
        }

# Function to select the best routes from alternatives
def select_optimized_routes(routes, towers):
    """
    Select the best routes from alternatives based on different optimization criteria
    
    Arguments:
    - routes: List of route alternatives from GraphHopper
    - towers: List of cell towers in the area
    
    Returns:
    - Dictionary with the three optimized routes (fastest, cell_coverage, balanced)
    """
    if not routes or len(routes) == 0:
        print("No routes provided to select_optimized_routes")
        return {
            'fastest': {'route': None, 'towers': []},
            'cell_coverage': {'route': None, 'towers': []},
            'balanced': {'route': None, 'towers': []}
        }
    
    # Add index to each route for tracking
    for i, route in enumerate(routes):
        route['index'] = i
    
    # Log all routes for debugging
    print(f"\n===== ROUTE SELECTION PROCESS =====")
    print(f"Total routes available: {len(routes)}")
    
    for i, route in enumerate(routes):
        distance_km = route['distance'] / 1000
        duration_min = route['duration'] / 60
        print(f"Route #{i}: Distance: {distance_km:.2f} km, Duration: {duration_min:.2f} min")
    
    # Find towers along each route
    routes_with_towers = []
    
    for route in routes:
        # Find towers along this route
        towers_along_route = find_towers_along_route(route, towers)
        
        # Calculate average signal strength
        total_signal = sum(tower.get('averageSignal', 0) for tower in towers_along_route)
        avg_signal = total_signal / len(towers_along_route) if towers_along_route else 0
        
        # Store route with tower data
        route_data = {
            'route': route,
            'towers': towers_along_route,
            'tower_count': len(towers_along_route),
            'avg_signal': avg_signal,
            'index': route['index']
        }
        routes_with_towers.append(route_data)
        
        # Log tower data for this route
        print(f"Route #{route['index']}: Found {len(towers_along_route)} towers, Avg signal: {avg_signal:.2f}")
    
    # Sort routes by different criteria
    routes_by_duration = sorted(routes_with_towers, key=lambda x: x['route']['duration'])
    routes_by_signal = sorted(routes_with_towers, key=lambda x: (-x['avg_signal'], -x['tower_count']))
    
    # Calculate balanced score (50% speed, 50% signal)
    for route_data in routes_with_towers:
        # Normalize duration (lower is better)
        if routes_by_duration:
            min_duration = routes_by_duration[0]['route']['duration']
            max_duration = routes_by_duration[-1]['route']['duration']
            duration_range = max_duration - min_duration
            
            if duration_range > 0:
                normalized_duration = 1 - ((route_data['route']['duration'] - min_duration) / duration_range)
            else:
                normalized_duration = 1
        else:
            normalized_duration = 0
        
        # Normalize signal (higher is better)
        if routes_by_signal:
            min_signal = routes_by_signal[-1]['avg_signal']
            max_signal = routes_by_signal[0]['avg_signal']
            signal_range = max_signal - min_signal
            
            if signal_range > 0:
                normalized_signal = (route_data['avg_signal'] - min_signal) / signal_range
            else:
                normalized_signal = 1 if route_data['avg_signal'] > 0 else 0
        else:
            normalized_signal = 0
        
        # Calculate balanced score
        route_data['balanced_score'] = (normalized_duration * 0.5) + (normalized_signal * 0.5)
    
    # Sort by balanced score
    routes_by_balanced = sorted(routes_with_towers, key=lambda x: -x['balanced_score'])
    
    # Log sorted routes
    print("\n----- Routes Sorted by Duration -----")
    for i, route in enumerate(routes_by_duration):
        print(f"#{i}: Route #{route['index']}, Duration: {route['route']['duration']/60:.2f} min")
    
    print("\n----- Routes Sorted by Signal -----")
    for i, route in enumerate(routes_by_signal):
        print(f"#{i}: Route #{route['index']}, Towers: {route['tower_count']}, Avg Signal: {route['avg_signal']:.2f}")
    
    print("\n----- Routes Sorted by Balanced Score -----")
    for i, route in enumerate(routes_by_balanced):
        print(f"#{i}: Route #{route['index']}, Score: {route['balanced_score']:.2f}, Duration: {route['route']['duration']/60:.2f} min, Signal: {route['avg_signal']:.2f}")
    
    # Select the best routes
    fastest = routes_by_duration[0] if routes_by_duration else None
    cell_coverage = routes_by_signal[0] if routes_by_signal else None
    balanced = routes_by_balanced[0] if routes_by_balanced else None
    
    # Try to ensure diversity in routes if we have enough options
    if len(routes_with_towers) >= 3:
        print("\n----- Route Selection for Diversity -----")
        print(f"Initial fastest: Route #{fastest['index'] if fastest else 'None'}")
        print(f"Initial cell_coverage: Route #{cell_coverage['index'] if cell_coverage else 'None'}")
        print(f"Initial balanced: Route #{balanced['index'] if balanced else 'None'}")
        
        # If balanced and fastest are the same, try to find a different balanced route
        if balanced and fastest and balanced['index'] == fastest['index']:
            for route_data in routes_by_balanced[1:]:
                if route_data['index'] != fastest['index'] and (cell_coverage is None or route_data['index'] != cell_coverage['index']):
                    balanced = route_data
                    print(f"Adjusted balanced route to #{balanced['index']} to ensure diversity")
                    break
        
        # If cell_coverage and fastest are the same, try to find a different cell_coverage route
        if cell_coverage and fastest and cell_coverage['index'] == fastest['index']:
            for route_data in routes_by_signal[1:]:
                if route_data['index'] != fastest['index'] and (balanced is None or route_data['index'] != balanced['index']):
                    cell_coverage = route_data
                    print(f"Adjusted cell_coverage route to #{cell_coverage['index']} to ensure diversity")
                    break
    else:
        # Not enough routes for diversity, use best for each
        fastest = routes_by_duration[0] if routes_by_duration else None
        cell_coverage = routes_by_signal[0] if routes_by_signal else fastest
        balanced = routes_by_balanced[0] if routes_by_balanced else fastest
        
        print("\n----- Limited Routes Available -----")
        print(f"Using fastest: Route #{fastest['index'] if fastest else 'None'}")
        print(f"Using cell_coverage: Route #{cell_coverage['index'] if cell_coverage else 'None'}")
        print(f"Using balanced: Route #{balanced['index'] if balanced else 'None'}")
    
    # Log final selected routes
    print("\n----- FINAL ROUTE SELECTION -----")
    print(f"Fastest: Route #{fastest['index'] if fastest else 'None'}")
    print(f"Cell Coverage: Route #{cell_coverage['index'] if cell_coverage else 'None'}")
    print(f"Balanced: Route #{balanced['index'] if balanced else 'None'}")
    print("===== END ROUTE SELECTION =====\n")
    
    # Return the selected routes
    return {
        'fastest': {
            'route': fastest['route'] if fastest else None,
            'towers': fastest['towers'] if fastest else []
        },
        'cell_coverage': {
            'route': cell_coverage['route'] if cell_coverage else None,
            'towers': cell_coverage['towers'] if cell_coverage else []
        },
        'balanced': {
            'route': balanced['route'] if balanced else None,
            'towers': balanced['towers'] if balanced else []
        }
    }

# Helper function to find towers along a route
def find_towers_along_route(route, towers, max_distance=2500):
    """
    Find cell towers along a route within a specified distance
    
    Arguments:
    - route: Route object with geometry
    - towers: List of cell towers to check
    - max_distance: Maximum distance in meters from the route (increased from 1000m to 2500m)
    
    Returns:
    - List of towers along the route
    """
    if not route or not towers:
        return []
    
    # Extract coordinates from route
    coordinates = []
    if 'geometry' in route and 'coordinates' in route['geometry']:
        coordinates = route['geometry']['coordinates']
    
    if not coordinates:
        return []
    
    # Create a LineString from the route coordinates
    try:
        route_line = LineString(coordinates)
        route_length = route_line.length * 111000  # Approximate length in meters
        
        # Find towers within max_distance of the route
        nearby_towers = []
        
        # Calculate route bounding box with buffer for faster filtering
        min_x = min(coord[0] for coord in coordinates) - (max_distance / 111000)
        max_x = max(coord[0] for coord in coordinates) + (max_distance / 111000)
        min_y = min(coord[1] for coord in coordinates) - (max_distance / 111000)
        max_y = max(coord[1] for coord in coordinates) + (max_distance / 111000)
        
        # First filter towers by bounding box (much faster)
        for tower in towers:
            if 'lon' in tower and 'lat' in tower:
                lon, lat = tower['lon'], tower['lat']
                
                # Quick bounding box check before expensive distance calculation
                if min_x <= lon <= max_x and min_y <= lat <= max_y:
                    tower_point = Point(lon, lat)
                    distance = route_line.distance(tower_point) * 111000  # Approximate conversion to meters
                    
                    if distance <= max_distance:
                        tower_with_distance = tower.copy()
                        tower_with_distance['distanceToRoute'] = distance
                        
                        # Calculate position along the route (0-1)
                        nearest_point = nearest_points(route_line, tower_point)[0]
                        position = route_line.project(nearest_point, normalized=True)
                        tower_with_distance['positionAlongRoute'] = position
                        
                        nearby_towers.append(tower_with_distance)
        
        # Sort by position along route for better visualization
        nearby_towers.sort(key=lambda t: t.get('positionAlongRoute', 0))
        
        # If we have too many towers, select a representative sample
        if len(nearby_towers) > 50:
            print(f"Found {len(nearby_towers)} towers, selecting representative sample")
            
            # Ensure we have towers distributed along the route
            selected_towers = []
            
            # Always include the closest tower to start and end
            if nearby_towers:
                start_towers = sorted(nearby_towers, key=lambda t: abs(t.get('positionAlongRoute', 0) - 0))
                end_towers = sorted(nearby_towers, key=lambda t: abs(t.get('positionAlongRoute', 0) - 1))
                
                if start_towers:
                    selected_towers.append(start_towers[0])
                if end_towers:
                    selected_towers.append(end_towers[0])
            
            # Divide route into segments and select best tower from each segment
            num_segments = 20
            for i in range(num_segments):
                segment_start = i / num_segments
                segment_end = (i + 1) / num_segments
                
                segment_towers = [t for t in nearby_towers if segment_start <= t.get('positionAlongRoute', 0) < segment_end]
                
                if segment_towers:
                    # Select tower with best signal in this segment
                    best_tower = max(segment_towers, key=lambda t: t.get('signal_strength', 0))
                    if best_tower not in selected_towers:
                        selected_towers.append(best_tower)
            
            # Add more towers prioritizing signal strength and distance
            remaining_towers = [t for t in nearby_towers if t not in selected_towers]
            remaining_towers.sort(key=lambda t: (-t.get('signal_strength', 0), t.get('distanceToRoute', float('inf'))))
            
            # Add remaining towers up to a reasonable limit
            selected_towers.extend(remaining_towers[:30 - len(selected_towers)])
            
            # Sort final selection by position along route
            selected_towers.sort(key=lambda t: t.get('positionAlongRoute', 0))
            
            print(f"Selected {len(selected_towers)} representative towers")
            return selected_towers
        
        print(f"Found {len(nearby_towers)} towers along route")
        return nearby_towers
    
    except Exception as e:
        print(f"Error finding towers along route: {e}")
        return []

# Helper function to calculate signal score for a route
def calculate_route_signal_score(towers):
    """
    Calculate a signal quality score for a route based on the towers along it
    
    Arguments:
    - towers: List of towers along the route
    
    Returns:
    - Signal quality score (0-5)
    """
    if not towers:
        return 0
    
    # Calculate average signal strength
    total_signal = sum(tower.get('averageSignal', -100) for tower in towers)
    avg_signal = total_signal / len(towers) if towers else -100
    
    # Normalize to 0-5 scale (typical signal range is -120 to -50 dBm)
    norm_signal = max(0, min(5, (avg_signal + 120) / 14))
    
    # Factor in tower count (more towers = better coverage)
    count_factor = min(1, len(towers) / 20)  # Saturate at 20 towers
    
    # Final score: 70% signal strength, 30% tower count
    return (norm_signal * 0.7) + (5 * count_factor * 0.3)

# Function to get cell towers in a bounding box
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

# Route calculation functions using GraphHopper
def get_route_fastest(start_lat, start_lng, end_lat, end_lng):
    """Get the fastest route using GraphHopper optimization"""
    # Get all routes from GraphHopper
    all_routes = calculate_graphhopper_routes(start_lat, start_lng, end_lat, end_lng)
    
    if all_routes.get('code') != 'Ok' or not all_routes.get('routes'):
        return all_routes
    
    # Get cell towers for the area
    # Calculate bounding box (with buffer)
    min_lat = min(start_lat, end_lat) - 0.05
    max_lat = max(start_lat, end_lat) + 0.05
    min_lng = min(start_lng, end_lng) - 0.05
    max_lng = max(start_lng, end_lng) + 0.05
    
    # Get towers
    towers_data = get_cell_towers(min_lat, min_lng, max_lat, max_lng)
    towers = towers_data.get('towers', [])
    
    # Select optimized routes
    optimized = select_optimized_routes(all_routes.get('routes', []), towers)
    
    if not optimized or 'fastest' not in optimized:
        return all_routes
    
    # Return fastest route
    result = {
        'code': 'Ok',
        'routes': [optimized['fastest']['route']],
        'waypoints': all_routes.get('waypoints', []),
        'towers': optimized['fastest']['towers'],
        'optimization_type': 'fastest'
    }
    
    return result

def get_route_cell_coverage(start_lat, start_lng, end_lat, end_lng):
    """Get the route with best cell coverage using GraphHopper optimization"""
    # Get all routes from GraphHopper
    all_routes = calculate_graphhopper_routes(start_lat, start_lng, end_lat, end_lng)
    
    if all_routes.get('code') != 'Ok' or not all_routes.get('routes'):
        return all_routes
    
    # Get cell towers for the area
    # Calculate bounding box (with buffer)
    min_lat = min(start_lat, end_lat) - 0.05
    max_lat = max(start_lat, end_lat) + 0.05
    min_lng = min(start_lng, end_lng) - 0.05
    max_lng = max(start_lng, end_lng) + 0.05
    
    # Get towers
    towers_data = get_cell_towers(min_lat, min_lng, max_lat, max_lng)
    towers = towers_data.get('towers', [])
    
    # Select optimized routes
    optimized = select_optimized_routes(all_routes.get('routes', []), towers)
    
    if not optimized or 'cell_coverage' not in optimized:
        return all_routes
    
    # Return cell coverage route
    result = {
        'code': 'Ok',
        'routes': [optimized['cell_coverage']['route']],
        'waypoints': all_routes.get('waypoints', []),
        'towers': optimized['cell_coverage']['towers'],
        'optimization_type': 'cell_coverage'
    }
    
    return result

def get_route_balanced(start_lat, start_lng, end_lat, end_lng):
    """Get a balanced route using GraphHopper optimization"""
    # Get all routes from GraphHopper
    all_routes = calculate_graphhopper_routes(start_lat, start_lng, end_lat, end_lng)
    
    if all_routes.get('code') != 'Ok' or not all_routes.get('routes'):
        return all_routes
    
    # Get cell towers for the area
    # Calculate bounding box (with buffer)
    min_lat = min(start_lat, end_lat) - 0.05
    max_lat = max(start_lat, end_lat) + 0.05
    min_lng = min(start_lng, end_lng) - 0.05
    max_lng = max(start_lng, end_lng) + 0.05
    
    # Get towers
    towers_data = get_cell_towers(min_lat, min_lng, max_lat, max_lng)
    towers = towers_data.get('towers', [])
    
    # Select optimized routes
    optimized = select_optimized_routes(all_routes.get('routes', []), towers)
    
    if not optimized or 'balanced' not in optimized:
        return all_routes
    
    # Return balanced route
    result = {
        'code': 'Ok',
        'routes': [optimized['balanced']['route']],
        'waypoints': all_routes.get('waypoints', []),
        'towers': optimized['balanced']['towers'],
        'optimization_type': 'balanced'
    }
    
    return result

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