from pymongo import MongoClient
from config import Config
import datetime
import bcrypt
import re
import uuid
from bson.objectid import ObjectId
from pymongo import MongoClient

client = MongoClient(Config.MONGODB_URI)
db = client.get_database()

# Collection for storing user data
users_collection = db.users

# Collection for storing saved routes
routes_collection = db.routes

# Collection for storing user locations
locations_collection = db.locations

# Collection for storing password reset tokens
reset_tokens_collection = db.reset_tokens

# Email validation regex
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

# User authentication functions
def register_user(email, password):
    """Register a new user"""
    # Validate email format
    if not EMAIL_REGEX.match(email):
        return None, "Invalid email format"
    
    # Validate password strength (at least 8 characters with numbers and letters)
    if len(password) < 8 or not (any(c.isalpha() for c in password) and any(c.isdigit() for c in password)):
        return None, "Password must be at least 8 characters and contain both letters and numbers"
    
    # Check if user already exists
    if users_collection.find_one({'email': email.lower()}):
        return None, "Email already registered"
    
    # Hash the password with a stronger work factor
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(12))
    
    # Create user document
    user = {
        'email': email.lower(),
        'password': hashed_password,
        'created_at': datetime.datetime.utcnow(),
        'last_login': datetime.datetime.utcnow(),
        'is_active': True,
        'verified': False,  # For email verification (optional)
        'preferences': {
            'default_route_type': 'balanced'
        }
    }
    
    # Insert the user
    result = users_collection.insert_one(user)
    user['_id'] = str(result.inserted_id)
    user.pop('password')  # Don't return the password
    return user, None

def login_user(email, password):
    """Login a user"""
    # Find the user
    user = users_collection.find_one({'email': email.lower()})
    if not user:
        return None, "Invalid email or password"
    
    # Check if account is active
    if not user.get('is_active', True):
        return None, "Account is disabled"
    
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

def get_user_by_id(user_id):
    """Get user by ID"""
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if user:
            user['_id'] = str(user['_id'])
            user.pop('password', None)
            return user
        return None
    except:
        return None

def update_user(user_id, update_data):
    """Update user data"""
    # Don't allow updating critical fields
    for field in ['_id', 'password', 'email']:
        update_data.pop(field, None)
    
    update_data['updated_at'] = datetime.datetime.utcnow()
    
    result = users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': update_data}
    )
    
    return result.modified_count > 0

def change_password(user_id, current_password, new_password):
    """Change user password"""
    # Find the user
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    if not user:
        return False, "User not found"
    
    # Verify current password
    if not bcrypt.checkpw(current_password.encode('utf-8'), user['password']):
        return False, "Current password is incorrect"
    
    # Validate new password strength
    if len(new_password) < 8 or not (any(c.isalpha() for c in new_password) and any(c.isdigit() for c in new_password)):
        return False, "New password must be at least 8 characters and contain both letters and numbers"
    
    # Hash the new password
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt(12))
    
    # Update the password
    result = users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {
            'password': hashed_password,
            'updated_at': datetime.datetime.utcnow()
        }}
    )
    
    return result.modified_count > 0, None

def create_password_reset_token(email):
    """Create a password reset token"""
    # Find the user
    user = users_collection.find_one({'email': email.lower()})
    if not user:
        return None, "Email not found"
    
    # Generate a unique token
    token = str(uuid.uuid4())
    
    # Store the token with expiration (24 hours)
    expiration = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    reset_tokens_collection.insert_one({
        'user_id': user['_id'],
        'token': token,
        'created_at': datetime.datetime.utcnow(),
        'expires_at': expiration,
        'used': False
    })
    
    return {
        'token': token,
        'user_id': str(user['_id']),
        'email': user['email'],
        'expires_at': expiration
    }, None

def verify_reset_token(token):
    """Verify a password reset token"""
    # Find the token
    token_doc = reset_tokens_collection.find_one({
        'token': token,
        'used': False,
        'expires_at': {'$gt': datetime.datetime.utcnow()}
    })
    
    if not token_doc:
        return None, "Invalid or expired token"
    
    # Get the user
    user = users_collection.find_one({'_id': token_doc['user_id']})
    if not user:
        return None, "User not found"
    
    return {
        'user_id': str(user['_id']),
        'email': user['email']
    }, None

def reset_password_with_token(token, new_password):
    """Reset password using a token"""
    # Verify the token
    user_data, error = verify_reset_token(token)
    if error:
        return False, error
    
    # Validate password strength
    if len(new_password) < 8 or not (any(c.isalpha() for c in new_password) and any(c.isdigit() for c in new_password)):
        return False, "Password must be at least 8 characters and contain both letters and numbers"
    
    # Hash the new password
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt(12))
    
    # Update the password
    result = users_collection.update_one(
        {'_id': ObjectId(user_data['user_id'])},
        {'$set': {
            'password': hashed_password,
            'updated_at': datetime.datetime.utcnow()
        }}
    )
    
    # Mark the token as used
    reset_tokens_collection.update_one(
        {'token': token},
        {'$set': {'used': True}}
    )
    
    return result.modified_count > 0, None

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