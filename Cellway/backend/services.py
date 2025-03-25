import requests
from config import Config

def geocode_location(query):
    """Search for a location using MapTiler geocoding API"""
    url = f"https://api.maptiler.com/geocoding/{query}.json"
    params = {
        'key': Config.MAPTILER_KEY
    }
    
    response = requests.get(url, params=params)
    return response.json()

def reverse_geocode(lng, lat):
    """Get an address from coordinates using MapTiler API"""
    url = f"https://api.maptiler.com/geocoding/{lng},{lat}.json"
    params = {
        'key': Config.MAPTILER_KEY
    }
    
    response = requests.get(url, params=params)
    return response.json()

def get_route(start_lat, start_lng, end_lat, end_lng):
    """Calculate a route between two points"""
    url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}"
    params = {
        'overview': 'full',
        'geometries': 'geojson',
        'steps': 'true'
    }
    
    response = requests.get(url, params=params)
    return response.json() 