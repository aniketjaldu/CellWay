# CellWay - Route Planner with Cell Coverage Visualization

## Description

CellWay is a full-stack web application designed for planning routes between two locations while providing insights into estimated cell signal strength along the way. It leverages external APIs for geocoding and routing, integrates with a MongoDB database for user accounts and saved routes, and visualizes data on an interactive Leaflet map.

The application features user authentication, allowing users to save their frequently used routes. It calculates different route optimization types (fastest, best cell coverage, balanced) and displays relevant information, including step-by-step directions and nearby cell towers.

## Features

*   **Interactive Map:** Uses Leaflet for displaying maps, routes, markers, and cell towers.
*   **Geocoding Search:** Search for origin and destination locations with autocomplete suggestions (powered by MapTiler via backend proxy).
*   **Route Calculation:** Calculates multiple route options using GraphHopper (via backend proxy):
    *   **Fastest:** Optimizes for the shortest travel time.
    *   **Cell Coverage:** Optimizes for the route estimated to have the best average cell signal strength (based on available tower data).
    *   **Balanced:** Provides a compromise between travel time and cell signal quality.
*   **Route Display:** Visualizes the selected route path on the map with appropriate coloring based on type.
*   **Step-by-Step Directions:** Displays turn-by-turn instructions in a collapsible panel.
*   **Direction Highlighting:** Highlights the corresponding map segment when a direction step is clicked.
*   **Cell Tower Visualization:** Fetches and displays nearby cell tower locations on the map, color-coded by estimated signal strength and highlighting those near the active route. (Data sourced from CSV or mock data).
*   **User Authentication:**
    *   User Registration & Login.
    *   Session Management (using backend sessions/cookies).
    *   Password Reset functionality (Forgot Password email flow).
    *   Account Lockout after multiple failed login attempts.
*   **Saved Routes:** Logged-in users can save their calculated routes (including origin/destination names, route data for all computed types, and a map preview image) and load them later.
*   **Map Controls:** Buttons for locating the user, toggling cell tower visibility, and selecting the route optimization type.
*   **UI Panels & Modals:** Non-intrusive UI elements for search, directions, authentication, saved routes, and route type selection, designed to overlay the map without blocking interaction unnecessarily.

## Tech Stack

**Frontend:**

*   **Framework:** React (using Vite)
*   **Mapping:** Leaflet
*   **API Communication:** Axios
*   **Routing:** React Router DOM
*   **UI Notifications:** react-hot-toast
*   **Styling:** CSS Modules / Global CSS
*   **Image Capture:** html2canvas
*   **Linting:** ESLint
*   **Type Checking (Dev):** PropTypes, JSDoc

**Backend:**

*   **Framework:** Flask (Python)
*   **Database:** MongoDB (with Pymongo)
*   **Password Hashing:** bcrypt
*   **CORS:** Flask-CORS
*   **Email:** Flask-Mail
*   **Environment Variables:** python-dotenv

**External Services:**

*   **Map Tiles & Geocoding:** MapTiler (via backend proxy)
*   **Routing:** GraphHopper (via backend proxy)
*   **Cell Tower Data:** CSV file (or mock data fallback)

## Project Structure
├── backend/  
│ ├── config.py # Backend configuration (API keys, DB URI, Mail)  
│ ├── app.py # Flask app factory and initialization  
│ ├── database.py # MongoDB connection setup  
│ ├── models/ # Database interaction logic (user.py, route.py)  
│ ├── routes/ # Flask blueprints for API endpoints (auth, geo, routing, tower)  
│ ├── services/ # Business logic (geocoding, routing, tower data processing)  
│ ├── utils/ # Utility functions (geometry, formatting - potentially shared)  
│ ├── data/ # Data files (e.g., cell_towers.csv)  
│ ├── .env # Backend environment variables (API keys, DB URI, etc.) - GITIGNORED  
│ └── requirements.txt # Python dependencies  
│  
└── frontend/  
├── public/ # Static assets  
├── src/  
│ ├── assets/ # Icons, images  
│ ├── components/ # React components (Auth, Map, Search, Directions, etc.)  
│ ├── hooks/ # Custom React hooks (useAuth, useMap, useRouting, etc.)  
│ ├── services/ # Frontend API service (api.js using Axios)  
│ ├── utils/ # Frontend utility functions (formatting, geometry)  
│ ├── App.jsx # Main application component  
│ ├── main.jsx # React application entry point  
│ └── main.css # Global styles  
├── .env # Frontend environment variables (VITE_API_BASE_URL, etc.) - GITIGNORED  
├── index.html # Main HTML file  
├── package.json # Node.js dependencies and scripts  
└── vite.config.js # Vite configuration

## Setup and Installation

**Prerequisites:**

*   Node.js and npm (or yarn)
*   Python 3.x and pip
*   MongoDB instance (running locally or accessible via URI)

**1. Backend Setup:**

```bash
# 1. Clone the repository
git clone <your-repository-url>
cd <your-repository-url>/backend

# 2. Create and activate a virtual environment (recommended)
python -m venv venv
# On Windows:
# venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate

# 3. Install Python dependencies

pip install -r requirements.txt

# 4. Create a .env file in the backend directory
#    Copy .env.example if provided, or create manually
touch .env

# 5. Add environment variables to backend/.env (see Configuration section below)
#    Example:
#    SECRET_KEY=your_strong_random_secret_key
#    MONGODB_URI=mongodb://localhost:27017/cellway
#    MAPTILER_KEY=your_maptiler_api_key
#    GRAPHHOPPER_KEY=your_graphhopper_api_key
#    MAIL_SERVER=smtp.example.com
#    MAIL_PORT=587
#    MAIL_USE_TLS=true
#    MAIL_USERNAME=your_email_username
#    MAIL_PASSWORD=your_email_password
#    MAIL_DEFAULT_SENDER=noreply@example.com
#    FRONTEND_URL=http://localhost:5173

# 6. Ensure your MongoDB server is running.

# 7. Place cell tower data (e.g., cell_towers.csv) in the backend/data/ directory if using CSV source.
```
**2. Frontend Setup:**
```python
# 1. Navigate to the frontend directory
cd ../frontend
# or from root: cd <your-repository-url>/frontend

# 2. Install Node.js dependencies
npm install
# or: yarn install

# 3. Create a .env file in the frontend directory
touch .env

# 4. Add environment variables to frontend/.env (see Configuration section below)
#    VITE_MAPTILER_KEY=your_maptiler_api_key # Needed directly by the frontend for rendering MapTiler tiles
```

## Configuration
Environment variables are used for configuration. Create .env files in both the backend and frontend directories.

**Backend (backend/.env):**
-   `SECRET_KEY`: A strong, random secret key for Flask session security. **Required for production.**
-   `MONGODB_URI`: Connection string for your MongoDB database (defaults to mongodb://localhost:27017/cellway). **Required.**
-   `MAPTILER_KEY`: Your API key from MapTiler (for geocoding & tiles via backend). **Required.**
-   `GRAPHHOPPER_KEY`: Your API key from GraphHopper (for routing via backend). **Required.**
-   `MAIL_SERVER: SMTP` server address for sending emails. **Required for password reset.**
-   `MAIL_PORT: SMTP` server port (e.g., 587 for TLS, 465 for SSL, 25 default). **Required for password reset.**
-   `MAIL_USE_TLS`: Set to true to enable TLS.
-   `MAIL_USE_SSL`: Set to true to enable SSL.
-   `MAIL_USERNAME`: Username for SMTP authentication. **Required for password reset if server needs auth.**
-   `MAIL_PASSWORD`: Password for SMTP authentication. **Required for password reset if server needs auth.**
-   `MAIL_DEFAULT_SENDER`: The "From" address for emails sent by the app (e.g., noreply@yourdomain.com). **Required for password reset.**
-   FRONTEND_URL: The base URL of the running frontend application (used for password reset links, defaults to http://localhost:5173). **Required for password reset.**
    

**Frontend (frontend/.env):**
-   VITE_MAPTILER_KEY: Your API key from MapTiler (needed directly by the frontend for rendering MapTiler tiles). **Required.**
   
## Running the Application:
1.  **Start the Backend Server:**
    
    ```bash
    cd backend
    # Ensure virtual environment is activated
    flask run --port=5001
    # or potentially: python app.py
    ```
    The backend should be running on http://localhost:5001.
    
2.  **Start the Frontend Development Server:**
    ```python
    cd frontend
    npm run dev
    # or: yarn dev
    ```
    The frontend should be running on http://localhost:5173 (or another port specified by Vite).
    
3.  Open your web browser and navigate to http://localhost:5173.

## Key Frontend Components & Hooks
-   **Hooks:**
    -   `useAuth`: Manages user authentication state and logic.
    -   `useMap`: Manages the Leaflet map instance, layers, and view.
    -   `useRouting`: Manages route calculation, state, display, saving, and loading.
    -   `useTowers`: Manages fetching, processing, and visibility of cell tower data.
    -   `useMapInteraction`: Provides user location and map interaction prevention utilities.
        
-   **Core Components:**
    -   `App.jsx`: Root component, orchestrates hooks and renders UI.
    -   `MapContainer.jsx`: Holds the Leaflet map instance.
    -   `SearchPanel.jsx`: Origin/Destination inputs and suggestions.
    -   `DirectionsPanel.jsx`: Displays step-by-step route instructions.
    -   `AuthButtons.jsx` / `AuthForm.jsx` / `ResetPasswordForm.jsx`: Handle user authentication UI.
    -   `SavedRoutesPanel.jsx`: Displays saved routes for logged-in users.
    -   `MapControls.jsx`: Buttons for map interactions (locate, towers, route type).
    -   `RouteTypeSelectionModal.jsx`: Modal for choosing route optimization.
    -   `TowerMarkers.jsx`: Renders cell tower markers on the map.
    -   `RouteHighlight.jsx`: Highlights specific route segments on the map.

## Potential Improvements / TODOs
-   **Production Deployment:** Configure backend for a production WSGI server (Gunicorn, Waitress) and frontend for optimized static builds.
-   **Error Handling:** Enhance global and component-level error handling and user feedback.
-   **Real-time Cell Data:** Integrate with a real-time cell data instead of relying solely on a static CSV.
-   **Advanced Route Scoring:** Refine the `calculateSignalScore` logic based on more sophisticated cell coverage models.
-   **Testing:** Add unit and integration tests for both frontend and backend.
-   **UI/UX Refinements:** Improve visual design, accessibility, and user experience based on feedback.
-   **Configuration Management:** Make CORS origins configurable via environment variables for production.
## License

MIT License

Copyright (c) [2025] [Aniket Jaldu, Jovaughn Olivier, Avi Patel]

Permission is hereby granted, free of charge, to any person obtaining a copy  
of this software and associated documentation files (the "Software"), to deal  
in the Software without restriction, including without limitation the rights  
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell  
copies of the Software, and to permit persons to whom the Software is  
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all  
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR  
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,  
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE  
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER  
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,  
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE  
SOFTWARE.