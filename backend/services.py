import requests
import math
import numpy as np
from config import Config
import random

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
    """Generate mock cell tower data for a bounding box (no API calls)"""
    
    print(f"Generating mock cell towers in area: {min_lat},{min_lng},{max_lat},{max_lng}")
    
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
    
    print(f"Generated {len(towers)} mock cell towers")
    
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

def get_route_balanced(start_lat, start_lng, end_lat, end_lng):
    """Get a route balanced between speed and cell coverage"""
    try:
        # First get the standard/fastest route
        fastest_route = get_route_fastest(start_lat, start_lng, end_lat, end_lng)
        
        # Make sure we have a valid response
        if 'code' not in fastest_route or fastest_route['code'] != 'Ok':
            print(f"Error in OSRM response: {fastest_route}")
            return fastest_route
        
        # If no routes were provided, return an error
        if 'routes' not in fastest_route or len(fastest_route['routes']) < 1:
            return {
                'code': 'Error',
                'message': 'No routes available'
            }
            
        # Get mock cell towers in the area with padding
        # More distant routes need larger area to search for towers
        primary_distance = fastest_route['routes'][0]['distance']
        padding = min(0.5, max(0.1, primary_distance / 100000))
        
        lat_min = min(start_lat, end_lat) - padding
        lat_max = max(start_lat, end_lat) + padding
        lng_min = min(start_lng, end_lng) - padding
        lng_max = max(start_lng, end_lng) + padding
        
        try:
            # Extend the search area to cover all potential routes 
            for route in fastest_route['routes']:
                if 'geometry' in route and 'coordinates' in route['geometry']:
                    for coord in route['geometry']['coordinates']:
                        lng, lat = coord
                        lat_min = min(lat_min, lat - 0.05)
                        lat_max = max(lat_max, lat + 0.05)
                        lng_min = min(lng_min, lng - 0.05)
                        lng_max = max(lng_max, lng + 0.05)
                        
            cell_data = get_cell_towers(lat_min, lng_min, lat_max, lng_max)
            towers = cell_data.get('towers', [])
        except Exception as e:
            print(f"Error getting mock cell towers: {e}")
            # If we can't get cell data, still return the fastest route
            return fastest_route
        
        # If no towers found, just return the fastest route
        if not towers:
            return fastest_route
        
        # For each route, calculate the signal quality along the path
        if 'routes' in fastest_route:
            for i, route in enumerate(fastest_route['routes']):
                # Extract route geometry
                if 'geometry' in route and 'coordinates' in route['geometry']:
                    coords = route['geometry']['coordinates']
                    
                    # Skip routes with no or very few coordinates
                    if not coords or len(coords) < 5:
                        continue
                    
                    # Calculate signal strength at each point
                    total_signal = 0
                    signal_samples = []
                    min_signal = -120  # Worst possible signal
                    
                    # Sample the route at regular intervals for efficiency
                    sample_interval = max(1, len(coords) // 100)  # Sample up to 100 points
                    
                    for j in range(0, len(coords), sample_interval):
                        if j < len(coords):
                            lng, lat = coords[j]
                            try:
                                signal = calculate_signal_strength(lat, lng, towers)
                                total_signal += signal
                                signal_samples.append(signal)
                                min_signal = max(min_signal, signal)
                            except Exception as e:
                                print(f"Error calculating signal strength: {e}")
                                continue
                    
                    # Average signal along the route
                    avg_signal = total_signal / len(signal_samples) if signal_samples else -100
                    
                    # Calculate signal variance (lower is better - more consistent signal)
                    try:
                        signal_variance = np.var(signal_samples) if signal_samples else 0
                    except Exception as e:
                        print(f"Error calculating signal variance: {e}")
                        signal_variance = 0
                    
                    # Calculate low signal percentage
                    low_signal_points = sum(1 for s in signal_samples if s < -90)
                    low_signal_percentage = (low_signal_points / len(signal_samples)) if signal_samples else 1
                    
                    # Add signal information to route
                    fastest_route['routes'][i]['cell_coverage'] = {
                        'average_signal': avg_signal,
                        'signal_variance': signal_variance,
                        'min_signal': min_signal,
                        'low_signal_percentage': low_signal_percentage,
                        'signal_samples': len(signal_samples)
                    }
        
        # Sort routes by a balanced score
        if 'routes' in fastest_route and len(fastest_route['routes']) > 1:
            try:
                # Calculate maximum duration and other normalization factors
                max_duration = max(r['duration'] for r in fastest_route['routes'])
                
                for route in fastest_route['routes']:
                    # Normalize signal (typically between -120dBm and -50dBm)
                    signal = route.get('cell_coverage', {}).get('average_signal', -100)
                    normalized_signal = (signal + 120) / 70  # Map -120 to 0 and -50 to 1
                    
                    # Normalize minimum signal
                    min_signal = route.get('cell_coverage', {}).get('min_signal', -120)
                    normalized_min_signal = (min_signal + 120) / 70
                    
                    # Normalize signal variance
                    variance = route.get('cell_coverage', {}).get('signal_variance', 1000)
                    normalized_variance = 1 - min(1, variance / 1000)  # Lower variance is better
                    
                    # Normalize low signal percentage (lower is better)
                    low_signal_pct = route.get('cell_coverage', {}).get('low_signal_percentage', 1)
                    
                    # Normalize duration (lower is better)
                    normalized_duration = 1 - (route['duration'] / max_duration)
                    
                    # Calculate balanced score (weights sum to 1.0)
                    route['balanced_score'] = (
                        0.45 * normalized_duration +    # Speed is important
                        0.25 * normalized_signal +      # Average signal matters
                        0.15 * normalized_min_signal +  # Minimum signal matters
                        0.10 * normalized_variance -    # Consistent signal is good
                        0.25 * low_signal_pct           # Penalize routes with signal gaps
                    )
                
                # Sort by balanced score (descending)
                fastest_route['routes'].sort(key=lambda x: x.get('balanced_score', 0), reverse=True)
                
                # Print the sorted route scores for debugging
                for i, route in enumerate(fastest_route['routes']):
                    print(f"Balanced Route {i+1}: Score {route.get('balanced_score', 0):.4f}, "
                          f"Duration: {route['duration']/60:.1f}min, "
                          f"Avg signal: {route.get('cell_coverage', {}).get('average_signal', -100):.1f}dBm")
            except Exception as e:
                print(f"Error sorting routes: {e}")
                # If sorting fails, the original route order is preserved
        
        return fastest_route
    except Exception as e:
        print(f"Error in get_route_balanced: {e}")
        # Create a basic error response
        return {
            'code': 'Error',
            'message': f'Route calculation failed: {str(e)}'
        }

def get_route_cell_coverage(start_lat, start_lng, end_lat, end_lng):
    """Get a route optimized for cell coverage"""
    try:
        # First get the standard/fastest routes
        fastest_route = get_route_fastest(start_lat, start_lng, end_lat, end_lng)
        
        # Make sure we have a valid response
        if 'code' not in fastest_route or fastest_route['code'] != 'Ok':
            print(f"Error in OSRM response: {fastest_route}")
            return fastest_route
        
        # If no alternatives were provided, just return the fastest route
        if 'routes' not in fastest_route or len(fastest_route['routes']) < 1:
            return fastest_route
            
        # Get mock cell towers in the area with padding based on the route distance
        # More distant routes need larger area to search for towers
        primary_distance = fastest_route['routes'][0]['distance']
        padding = min(0.5, max(0.1, primary_distance / 100000))  # Dynamic padding based on route distance
        
        lat_min = min(start_lat, end_lat) - padding
        lat_max = max(start_lat, end_lat) + padding
        lng_min = min(start_lng, end_lng) - padding
        lng_max = max(start_lng, end_lng) + padding
        
        try:
            # Extend the search area to cover all potential routes 
            for route in fastest_route['routes']:
                if 'geometry' in route and 'coordinates' in route['geometry']:
                    for coord in route['geometry']['coordinates']:
                        lng, lat = coord
                        lat_min = min(lat_min, lat - 0.05)
                        lat_max = max(lat_max, lat + 0.05)
                        lng_min = min(lng_min, lng - 0.05)
                        lng_max = max(lng_max, lng + 0.05)
            
            print(f"Generating mock cell towers in area: {lat_min},{lng_min},{lat_max},{lng_max}")
            cell_data = get_cell_towers(lat_min, lng_min, lat_max, lng_max)
            towers = cell_data.get('towers', [])
            print(f"Generated {len(towers)} mock towers for the route")
        except Exception as e:
            print(f"Error generating mock cell towers: {e}")
            # If we can't get cell data, still return the fastest route
            return fastest_route
        
        # If no towers found, just return the fastest route
        if not towers:
            return fastest_route
        
        # For each route, calculate the signal quality along the path
        if 'routes' in fastest_route:
            for i, route in enumerate(fastest_route['routes']):
                # Extract route geometry
                if 'geometry' in route and 'coordinates' in route['geometry']:
                    coords = route['geometry']['coordinates']
                    
                    # Skip routes with no or very few coordinates
                    if not coords or len(coords) < 5:
                        continue
                    
                    # Calculate signal strength at each point
                    total_signal = 0
                    signal_samples = []
                    min_signal = -120  # Worst possible signal
                    max_signal = -50   # Best possible signal
                    
                    # Sample the route at regular intervals
                    # For very long routes, we don't need to check every point
                    sample_interval = max(1, len(coords) // 100)  # Sample up to 100 points
                    
                    for j in range(0, len(coords), sample_interval):
                        if j < len(coords):
                            lng, lat = coords[j]
                            try:
                                signal = calculate_signal_strength(lat, lng, towers)
                                total_signal += signal
                                signal_samples.append(signal)
                                min_signal = max(min_signal, signal)  # Track best minimum signal
                            except Exception as e:
                                print(f"Error calculating signal strength: {e}")
                                continue
                    
                    # Average signal along the route
                    avg_signal = total_signal / len(signal_samples) if signal_samples else -100
                    
                    # Calculate signal variance (lower is better - more consistent signal)
                    try:
                        signal_variance = np.var(signal_samples) if signal_samples else 0
                    except Exception as e:
                        print(f"Error calculating signal variance: {e}")
                        signal_variance = 0
                    
                    # Calculate minimum signal strength duration
                    # This helps identify routes that have signal gaps
                    low_signal_points = sum(1 for s in signal_samples if s < -90)
                    low_signal_percentage = (low_signal_points / len(signal_samples)) if signal_samples else 1
                    
                    # Calculate weighted score based on several factors
                    # 1. Average signal (higher is better)
                    # 2. Signal variance (lower is better)
                    # 3. Minimum signal points (lower is better)
                    # 4. Low signal percentage (lower is better)
                    
                    # Add signal information to route
                    fastest_route['routes'][i]['cell_coverage'] = {
                        'average_signal': avg_signal,
                        'signal_variance': signal_variance,
                        'min_signal': min_signal,
                        'low_signal_percentage': low_signal_percentage,
                        'signal_samples': len(signal_samples)
                    }
                    
                    # Calculate cell coverage score (higher is better)
                    normalized_avg_signal = (avg_signal + 120) / 70  # Map -120 to 0 and -50 to 1
                    normalized_variance = 1 - min(1, signal_variance / 1000)  # Lower variance is better
                    normalized_min = (min_signal + 120) / 70  # Map -120 to 0 and -50 to 1
                    
                    # Combine factors with appropriate weights
                    cell_score = (
                        0.5 * normalized_avg_signal +
                        0.2 * normalized_variance +
                        0.3 * normalized_min -
                        0.4 * low_signal_percentage
                    )
                    
                    fastest_route['routes'][i]['cell_coverage']['score'] = max(0, min(1, cell_score))
        
        # Sort routes by cell coverage quality
        if 'routes' in fastest_route and len(fastest_route['routes']) > 1:
            try:
                # Sort primarily by cell coverage score (descending)
                fastest_route['routes'].sort(
                    key=lambda x: (
                        x.get('cell_coverage', {}).get('score', -1)
                    ),
                    reverse=True  # Descending by signal strength
                )
                
                # Print the sorted route scores for debugging
                for i, route in enumerate(fastest_route['routes']):
                    if 'cell_coverage' in route:
                        print(f"Route {i+1}: Cell score {route['cell_coverage'].get('score', -1)}, "
                              f"Avg signal: {route['cell_coverage'].get('average_signal', -100)}, "
                              f"Low signal %: {route['cell_coverage'].get('low_signal_percentage', 1) * 100:.1f}%")
            except Exception as e:
                print(f"Error sorting routes: {e}")
                # If sorting fails, the original route order is preserved
        
        return fastest_route
    except Exception as e:
        print(f"Error in get_route_cell_coverage: {e}")
        # Create a basic error response
        return {
            'code': 'Error',
            'message': f'Route calculation failed: {str(e)}'
        }

def get_route_fastest(start_lat, start_lng, end_lat, end_lng):
    """Calculate the fastest route between two points"""
    try:
        url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}"
        params = {
            'overview': 'full',
            'geometries': 'geojson',
            'steps': 'true',
            'alternatives': 'true'  # Request alternative routes
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()  # Raise an exception for bad responses
        
        return response.json()
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