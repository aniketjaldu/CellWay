"""
Handles MongoDB connection and provides access to database and collections.
"""
import logging
import sys

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

from config import Config  # Assuming config.py is in the parent directory

# Initialize logger for this module
log = logging.getLogger(__name__)

# Database and collection variables (initialized upon successful connection)
db = None
users_collection = None
routes_collection = None

try:
    log.info(f"Attempting to connect to MongoDB at: {Config.MONGODB_URI}")
    client = MongoClient(Config.MONGODB_URI, serverSelectionTimeoutMS=5000)  # Set connection timeout
    client.admin.command('ismaster')  # Verify connection
    db = client['Cellway']  # Select the database named 'Cellway'
    users_collection = db['users']  # Access 'users' collection
    routes_collection = db['routes']  # Access 'routes' collection
    log.info("Successfully connected to MongoDB.")

except ConnectionFailure as ce:
    log.critical(f"MongoDB Connection Failed: {ce}", exc_info=True)
    sys.exit("FATAL: Could not establish connection to MongoDB. Please verify the URI and MongoDB server status.")

except Exception as e:
    log.critical(f"An unexpected error occurred during MongoDB initialization: {e}", exc_info=True)
    sys.exit("FATAL: Database initialization encountered an error.")


def get_database():
    """
    Returns the MongoDB database instance.

    Returns:
        pymongo.database.Database: The MongoDB database object.
    """
    return db


def get_user_collection():
    """
    Returns the MongoDB 'users' collection instance.

    Returns:
        pymongo.collection.Collection: The MongoDB users collection object.
    """
    return users_collection


def get_route_collection():
    """
    Returns the MongoDB 'routes' collection instance.

    Returns:
        pymongo.collection.Collection: The MongoDB routes collection object.
    """
    return routes_collection