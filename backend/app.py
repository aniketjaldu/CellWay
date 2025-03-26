from flask import Flask
from flask_cors import CORS
from routes import api_bp
from config import Config
import secrets

app = Flask(__name__)
app.config.from_object(Config)

# Set secret key for session
app.secret_key = secrets.token_hex(16)

# Enable CORS for frontend with credentials support
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173", "supports_credentials": True}})

# Register blueprint
app.register_blueprint(api_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True, port=5001) 