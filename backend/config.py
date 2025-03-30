import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'super-secret-key'
    MAPTILER_KEY = os.environ.get('MAPTILER_KEY')
    OPENCELLID_KEY = os.environ.get('OPENCELLID_KEY')
    MONGODB_URI = os.environ.get('MONGODB_URI') or 'mongodb://localhost:27017/cellway' 
    GRAPHHOPPER_KEY = os.environ.get('GRAPHHOPPER_KEY')