import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY') or 'super-secret-key'
    MAPTILER_KEY = os.getenv('VITE_MAPTILER_KEY')
    OPENCELLID_KEY = os.getenv('OPENCELLID_KEY')
    MONGODB_URI = os.getenv('MONGODB_URI') or 'mongodb://localhost:27017/cellway' 
    GRAPHHOPPER_KEY = os.getenv('GRAPHHOPPER_KEY')