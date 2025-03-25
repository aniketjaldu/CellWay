from pymongo import MongoClient
from config import Config

client = MongoClient(Config.MONGODB_URI)
db = client.get_database()

# Collection for storing saved routes
routes_collection = db.routes

# Collection for storing user locations
locations_collection = db.locations

# Helper functions for database operations
def save_route(user_id, origin, destination, route_data):
    """Save a route to the database"""
    route = {
        'user_id': user_id,
        'origin': origin,
        'destination': destination,
        'route_data': route_data,
        'created_at': datetime.datetime.utcnow()
    }
    return routes_collection.insert_one(route).inserted_id

def get_saved_routes(user_id):
    """Get all saved routes for a user"""
    return list(routes_collection.find({'user_id': user_id}, {'_id': 0})) 