import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'super-secret-key'
    MAPTILER_KEY = os.environ.get('MAPTILER_KEY')
    OPENCELLID_KEY = os.environ.get('OPENCELLID_KEY')
    MONGODB_URI = os.environ.get('MONGODB_URI') or 'mongodb://localhost:27017/cellway' 
    GRAPHHOPPER_KEY = os.environ.get('GRAPHHOPPER_KEY')

    # --- Flask-Mail Configuration ---
    MAIL_SERVER = os.environ.get('MAIL_SERVER')
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 25) # Default port 25 if not set
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'false').lower() in ['true', '1', 't']
    MAIL_USE_SSL = os.environ.get('MAIL_USE_SSL', 'false').lower() in ['true', '1', 't']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')
    # Optional: Suppress sending emails for testing
    # MAIL_SUPPRESS_SEND = os.environ.get('MAIL_SUPPRESS_SEND', 'false').lower() in ['true', '1', 't']

    # --- Frontend URL for Links ---
    FRONTEND_URL = os.environ.get('FRONTEND_URL') or 'http://localhost:5173' # Default if not set