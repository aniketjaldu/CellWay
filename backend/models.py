from pymongo import MongoClient
from config import Config
import datetime
import bcrypt

client = MongoClient(Config.MONGODB_URI)
db = client.get_database()

# Collection for storing user data
users_collection = db.users

# Collection for storing saved routes
routes_collection = db.routes

# Collection for storing user locations
locations_collection = db.locations

# User authentication functions
def register_user(username, email, password):
    """Register a new user"""
    # Check if user already exists
    if users_collection.find_one({'email': email}):
        return None, "Email already registered"
    
    # Hash the password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    # Create user document
    user = {
        'username': username,
        'email': email,
        'password': hashed_password,
        'created_at': datetime.datetime.utcnow(),
        'last_login': datetime.datetime.utcnow()
    }
    
    # Insert the user
    result = users_collection.insert_one(user)
    user['_id'] = str(result.inserted_id)
    user.pop('password')  # Don't return the password
    return user, None

def login_user(email, password):
    """Login a user"""
    # Find the user
    user = users_collection.find_one({'email': email})
    if not user:
        return None, "Invalid email or password"
    
    # Check password
    if bcrypt.checkpw(password.encode('utf-8'), user['password']):
        # Update last login time
        users_collection.update_one(
            {'_id': user['_id']},
            {'$set': {'last_login': datetime.datetime.utcnow()}}
        )
        # Convert ObjectId to string for JSON serialization
        user['_id'] = str(user['_id'])
        # Remove password before returning
        user.pop('password')
        return user, None
    
    return None, "Invalid email or password"

# Helper functions for database operations
def save_route(user_id, origin, destination, route_data, route_type="balanced"):
    """Save a route to the database"""
    # Get the user's existing routes
    existing_routes = list(routes_collection.find(
        {'user_id': user_id}, 
        sort=[('created_at', -1)]
    ))
    
    # If user already has 3 or more routes, keep only the most recent 2 to make room for the new one
    if len(existing_routes) >= 3:
        # Sort by creation date (descending)
        existing_routes.sort(key=lambda x: x['created_at'], reverse=True)
        
        # Delete all but the 2 most recent routes
        for route in existing_routes[2:]:
            routes_collection.delete_one({'_id': route['_id']})
    
    # Create the new route
    route = {
        'user_id': user_id,
        'origin': origin,
        'destination': destination,
        'route_data': route_data,
        'route_type': route_type,
        'created_at': datetime.datetime.utcnow()
    }
    
    return routes_collection.insert_one(route).inserted_id

def get_saved_routes(user_id):
    """Get all saved routes for a user"""
    # Get the 3 most recent routes for the user
    routes = list(routes_collection.find(
        {'user_id': user_id}, 
        sort=[('created_at', -1)],
        limit=3
    ))
    
    # Convert ObjectId to string for JSON serialization
    for route in routes:
        route['_id'] = str(route['_id'])
    
    return routes 