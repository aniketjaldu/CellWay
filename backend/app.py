from flask import Flask
from flask_cors import CORS
from routes import api_bp
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for frontend
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})

# Register blueprint
app.register_blueprint(api_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True, port=5001) 