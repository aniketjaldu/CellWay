
# CellWay User Manual
Welcome to CellWay! This guide will help you use the CellWay application to plan routes optimized for your needs, including understanding cell coverage along the way.

## 1. Introduction
CellWay is a web-based route planning tool that helps you find the best path between two locations. Beyond just finding the fastest route, CellWay can also estimate routes with potentially better **cell signal strength** or a **balance** between speed and signal quality. You can visualize cell towers, view step-by-step directions, and even save your favorite routes if you create an account.

## 2. Getting Started: The Main Interface
When you open CellWay, you'll see:
-   **Map Area:** The main part of the screen displays an interactive map (using Leaflet).
-   **Search Panel:** Typically visible at the top center, this is where you enter your start (Origin) and end (Destination) points.
-   **Map Controls:** Buttons usually located on the bottom right for interacting with the map (Locate Me, Toggle Towers, Change Route Type).
-   **Authentication Buttons:** Located usually on the bottom left, allowing you to Log In, Register, or access Saved Routes/Logout if logged in.
    

![Main Page](/public/Main_Page.png)

## 3. Finding a Route
This is the core functionality of CellWay.

**Steps:**
1.  **Open Search Panel:** If the search panel isn't visible, click the Search icon button (🔍) usually located at the top center of the map.
2.  **Enter Origin:** Click into the "Origin" input field and start typing an address, place name, or landmark. Suggestions will appear as you type.
3.  **Select Origin Suggestion:** Click on the desired suggestion from the dropdown list. The map may pan to this location, and a marker (usually blue 🔵) will appear.
4.  **Enter Destination:** Click into the "Destination" input field and type your destination address or place name.
5.  **Select Destination Suggestion:** Click on the desired suggestion from the dropdown list. A marker (usually red 🔴) will appear for the destination.
6.  **Route Calculation:** Once both Origin and Destination are set, CellWay will automatically start calculating route options. A loading indicator might appear in the search panel.
    

**Tips:**
-   You can clear an input field by clicking the '×' button inside it. Clearing an input will also clear the current route.
-   Using the "Locate Me" button (📍) in the Map Controls is a quick way to set your current location as the Origin.
    

## 4. Choosing Your Route Type

After the origin and destination are set, CellWay calculates routes based on different priorities.
-   **If you have not saved a preference:** A modal window will pop up asking you to "Choose Route Priority".
-   **If you have saved a preference:** The map will automatically display the route based on your saved preference (e.g., Fastest). You can still change it using the Map Controls.
    

**Route Types Explained:**
1.  **⚡️ Fastest:** This route prioritizes the shortest travel time, similar to standard navigation apps. (Displayed in Blue)
2.  **📱 Cell Coverage:** This route attempts to find a path that maximizes estimated cell signal strength, based on available cell tower data. This might be slower than the fastest route. (Displayed in Green)
3.  **⚖️ Balanced:** This route offers a compromise, trying to balance travel time with estimated cell signal quality. (Displayed in Yellow/Orange)
    

**Using the Route Type Selection Modal:**
-   The modal shows each available route type with its estimated distance and travel time.
-   Click on the desired option (Fastest, Cell Coverage, Balanced) to select it and display it on the map. The modal will close.
-   **Remember Choice:** Check the box "Remember my choice..." if you want CellWay to automatically use the selected route type for future routes without showing the modal. Your preference is saved locally in your browser.

**Changing Route Type (After Initial Selection):**
-   Click the **Route Type button** in the Map Controls (it shows the icon of the currently displayed route type: ⚡️, 📱, or ⚖️).
-   This will cycle through the available computed route types, updating the map display accordingly.
-   Note: This button is only active when a route is currently displayed.
    

## 5. Viewing Directions

Once a route is displayed on the map, the Directions Panel will appear (usually on the right).

**Features:**
1.  **Summary:** At the top, you'll see the total estimated **Distance**, **Time**, and potentially **Ascent (Asc)** and **Descent (Desc)** for the route.
    
2.  **Step-by-Step Instructions:** Scroll through the list of instructions. Each step includes:
    -   **Icon:** An icon representing the maneuver (e.g., ⬆️ for straight, ⬅️ for left turn, 🏁 for arrival).
    -   **Instruction:** Text describing the maneuver (e.g., "Turn left onto Main St", "Continue straight", "Arrive at Destination").
    -   **Distance:** The distance for that specific step.
        
3.  **Map Highlighting:** Click on any instruction step in the panel. The corresponding segment of the route will be highlighted on the map, and a marker will show the start point of that maneuver. Click the map background to clear the highlight.
    
4.  **Minimize/Close:**
    -   Click the '×' button in the Directions Panel header to **minimize** it to a small icon (🗺️). Click the icon to expand it again.
        
    -   Note: Closing the panel entirely might require clearing the route (e.g., by clearing an origin/destination input).
        

## 6. Visualizing Cell Towers
You can optionally display cell tower locations on the map.

**Steps:**
1.  **Toggle Visibility:** Click the **Cell Tower Toggle button** (📡) in the Map Controls.
2.  **View Towers:** When enabled, cell tower markers will appear on the map.
    -   **Colors:** Markers are color-coded based on estimated signal strength (Green = Strong, Yellow/Orange = Medium, Red = Weak).
    -   **Along Route:** Towers estimated to be close to your currently displayed route will have a distinct highlight (e.g., larger size or glow).
3.  **Tower Details:** Click on any tower marker to view a popup with details (if available), such as Network, Radio Type, estimated Range, Signal Strength, and Last Updated time.
4.  **Toggle Off:** Click the Cell Tower Toggle button again to hide the towers.
    

Note: Cell tower data accuracy and availability depend on the source (CSV file or external API). Signal strength is an estimate.

## 7. User Accounts & Saved Routes

Creating an account allows you to save and reload routes.

**Account Actions:**

1.  **Register:**
    -   Click the User icon button (👤) in the bottom-left Auth Buttons area.
    -   Select "Register" from the popup menu.
    -   Fill in your email and password (confirm password) in the modal form.
    -   Click "Register". You will be logged in automatically.
        
2.  **Login:**
    -   Click the User icon button (👤).
    -   Select "Login" from the popup menu.
    -   Enter your email and password in the modal form.
    -   Click "Login".
        
3.  **Logout:**
    -   If logged in, the Auth Buttons area will show "My Routes" and "Logout".
    -   Click the "Logout" button.
        

**Saving Routes:**
1.  Calculate a route you want to save.
2.  In the **Directions Panel header**, click the **Save icon** (💾). (This button only appears if you are logged in).
3.  A confirmation message will appear. The route (including origin/destination names, all calculated route types, and a map preview image) is saved to your account.
    

**Loading Saved Routes:**
1.  Ensure you are logged in.
2.  Click the "**My Routes**" button in the Auth Buttons area.
3.  A panel will appear listing your saved routes, showing a preview image, origin/destination, date saved, and the type that was active when saved.
4.  Click on any route item in the list.
5.  The panel will close, and the selected route (including its markers and path) will be loaded onto the map. You can then use the Route Type button in Map Controls to switch between the different optimization types that were saved with that route.
    

## 8. Forgot Password

If you forget your password:
1.  Click the User icon button (👤) and select "Login".
2.  In the Login form modal, click the "**Forgot Password?**" link.
3.  Enter the email address associated with your account and click "Reset Password".
4.  You will receive an email with a password reset link (check your spam folder if you don't see it).
5.  Click the link in the email. This will open a new page/overlay in CellWay.
6.  Enter your new desired password in both fields on the **Reset Password form**.
7.  Click "Reset Password".
8.  If successful, you can now log in with your new password.
    

## 9. Map Controls Explained

Located typically in the bottom-right:

-   **📍 Locate Me:** Attempts to find your current geographic location using your browser/device and sets it as the **Origin** point. You may need to grant location permissions.
-   **⚡️/📱/⚖️ Route Type:** (Only active when a route is displayed) Click to cycle through the available route optimization types (Fastest, Cell Coverage, Balanced). The icon changes to reflect the currently displayed type.
-   **📡 Cell Tower Toggle:** Click to show or hide cell tower markers on the map. The button may appear highlighted or active when towers are visible.
    

## 10. Troubleshooting & Tips
-   **Route Calculation Fails:** Ensure both origin and destination are valid locations found via suggestions. Points might be too far apart, inaccessible by road, or there might be temporary issues with the routing service. Try slightly different points or try again later.
-   **Location Not Found:** Ensure you have granted location permissions to your browser for the CellWay site. Accuracy depends on your device's GPS and network connection.
-   **Slow Performance:** Displaying a very large number of cell towers can impact performance. Toggle towers off if the map feels slow.
-   **Password Reset Email Not Received:** Check your spam/junk folder. Ensure you entered the correct email address associated with your account.
-   **Saved Route Doesn't Load Correctly:** There might have been an issue during saving or loading. Try saving the route again or recalculating it.

----------

Enjoy using CellWay for your route planning!