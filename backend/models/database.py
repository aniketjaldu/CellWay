"""
Handles MongoDB connection and provides database/collection objects.
"""
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
import logging
import sys
from config import Config # Go up one level to backend/, import config

log = logging.getLogger(__name__)

try:
    log.info(f"Attempting to connect to MongoDB at {Config.MONGODB_URI}...")
    client = MongoClient(Config.MONGODB_URI, serverSelectionTimeoutMS=5000) # Add timeout
    # The ismaster command is cheap and does not require auth.
    client.admin.command('ismaster')
    db = client['Cellway'] # Select the database
    users_collection = db.users # Define users collection
    routes_collection = db.routes # Define routes collection
    log.info("MongoDB connection successful.")
except ConnectionFailure as e:
    log.critical(f"MongoDB connection failed: {e}", exc_info=True)
    # Exit if DB connection fails on startup - essential service
    sys.exit("FATAL: Could not connect to MongoDB. Check URI and server status.")
except Exception as e:
    log.critical(f"An unexpected error occurred during MongoDB initialization: {e}", exc_info=True)
    sys.exit("FATAL: Error during database initialization.")

def get_db():
    """Returns the database instance."""
    return db

def get_users_collection():
    """Returns the users collection instance."""
    return users_collection

def get_routes_collection():
    """Returns the routes collection instance."""
    return routes_collection