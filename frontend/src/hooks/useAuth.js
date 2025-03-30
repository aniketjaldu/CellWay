import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast'; // Library for displaying notifications

import * as api from '../services/api'; // API service functions


/**
 * useAuth Hook
 * 
 * Custom React hook to manage user authentication state and provide authentication functions.
 * Handles user login, registration, logout, password reset, and session checking.
 * Integrates with react-hot-toast for user feedback notifications.
 */
export const useAuth = () => {
  // --- State Variables ---
  const [user, setUser] = useState(null); // Stores user object ({ id, email, ... }) or null if not logged in
  const [isLoading, setIsLoading] = useState(true); // Tracks if the initial session check is in progress


  // --- Check User Session ---
  // Checks if a user session exists on the backend (e.g., via cookies)
  const checkSession = useCallback(async () => {
    setIsLoading(true); // Start loading state
    try {
      const response = await api.checkUserSession(); // Call API to check session
      if (response.data?.user_id) {
        // If session exists, store user ID (or fetch full details if needed)
        setUser({ id: response.data.user_id });
        // console.log("Session check successful: User ID", response.data.user_id); // Debug log
      } else {
        setUser(null); // No active session
      }
    } catch (error) {
      // A 401 Unauthorized status is expected if the user is not logged in, so don't treat it as an error
      if (error.response?.status !== 401) {
        console.error('Error checking authentication status:', error); // Log other unexpected errors
      }
      setUser(null); // Ensure user is null on any error during session check
    } finally {
      setIsLoading(false); // End loading state
    }
  }, []); // useCallback with empty dependency array ensures function identity remains stable


  // --- Initial Session Check Effect ---
  // Run the session check once when the hook is first mounted
  useEffect(() => {
    checkSession();
  }, [checkSession]); // Dependency: the checkSession function itself


  // --- Login Function ---
  const login = useCallback(async (email, password) => {
    try {
      const response = await api.loginUser(email, password); // Call API to log in
      if (response.data?.success && response.data?.user) {
        // On successful login, process user data and update state
        const userData = { ...response.data.user, id: response.data.user._id }; // Standardize ID field to 'id'
        delete userData._id; // Remove the MongoDB-specific '_id' field
        setUser(userData); // Update user state
        toast.success('Logged in successfully!'); // Show success notification
        return { success: true, user: userData }; // Return success and user data
      }
      // If success is false or user data is missing (should be handled by catch block ideally)
      return { success: false, error: 'Login failed.' }; // Fallback error
    } catch (error) {
      const status = error.response?.status;
      const errorMsg = error.response?.data?.error || 'Login failed. Please try again.'; // Get error message from response or use default

      // Handle specific error cases like account lockout (403 Forbidden)
      if (status === 403 && errorMsg.includes("Account locked")) {
        toast.error(errorMsg, { id: 'login-lockout-err' }); // Show specific lockout message
      } else {
        // For other errors, the API interceptor might show a toast,
        // but we can show one here as a fallback or if interceptor is not configured for all errors.
        toast.error(errorMsg, { id: 'login-err' });
      }
      return { success: false, error: errorMsg }; // Return failure and error message
    }
  }, []); // useCallback ensures function identity is stable


  // --- Register Function ---
  const register = useCallback(async (email, password) => {
    try {
      const response = await api.registerUser(email, password); // Call API to register
      if (response.data?.success && response.data?.user) {
        // On successful registration, process user data and update state
        const userData = { ...response.data.user, id: response.data.user._id };
        delete userData._id;
        setUser(userData); // Update user state (user is automatically logged in)
        toast.success('Registration successful! You are now logged in.'); // Show success notification
        return { success: true, user: userData }; // Return success and user data
      }
      return { success: false, error: 'Registration failed.' }; // Fallback error
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Registration failed. Please try again.';
      // API interceptor likely handles showing the toast for registration errors (e.g., email exists)
      // toast.error(errorMsg); // Optionally show toast here as well
      return { success: false, error: errorMsg }; // Return failure and error message
    }
  }, []); // useCallback ensures function identity is stable


  // --- Logout Function ---
  const logout = useCallback(async () => {
    try {
      await api.logoutUser(); // Call API to log out
      setUser(null); // Clear user state
      toast.success('Logged out successfully.'); // Show success notification
      return { success: true }; // Return success
    } catch (error) {
      console.error("Logout failed:", error); // Log error
      toast.error("Logout failed. Please try again."); // Show error notification
      return { success: false, error: 'Logout failed.' }; // Return failure
    }
  }, []); // useCallback ensures function identity is stable


  // --- Forgot Password Function ---
  // Initiates the password reset process by requesting a token email
  const forgotPassword = useCallback(async (email) => {
    try {
      const response = await api.forgotPasswordRequest(email); // Call API to request reset token
      // Backend should always return success: true for security (prevents email enumeration)
      if (response.data?.success && response.data?.message) {
        toast.success(response.data.message); // Show the generic success message from the backend
        return { success: true, message: response.data.message };
      }
      // This part might not be reached if backend always returns success
      return { success: false, error: 'Failed to send password reset email.' };
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to send password reset email.';
      // API interceptor might handle showing the toast
      // toast.error(errorMsg);
      return { success: false, error: errorMsg }; // Return failure and error message
    }
  }, []); // useCallback ensures function identity is stable


  // --- Reset Password Function ---
  // Submits the new password along with the reset token
  const resetPassword = useCallback(async (token, newPassword) => {
    try {
      const response = await api.resetPassword(token, newPassword); // Call API to reset password
      if (response.data?.success) {
        toast.success(response.data.message || 'Password reset successfully!'); // Show success notification
        return { success: true, message: response.data.message }; // Return success
      }
      // Should typically be handled by the catch block if backend returns error status codes
      return { success: false, error: 'Password reset failed.' }; // Fallback error
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Password reset failed. Please try again.';
      toast.error(errorMsg); // Show specific error message from backend (e.g., invalid token)
      return { success: false, error: errorMsg }; // Return failure and error message
    }
  }, []); // useCallback ensures function identity is stable


  // --- Returned Values ---
  // Expose state and functions to components using the hook
  return {
    user,                // Current user object (or null)
    isLoading,           // Is initial session check loading? (boolean)
    isLoggedIn: !!user,  // Convenience boolean flag for login status
    login,               // Login function
    register,            // Register function
    logout,              // Logout function
    forgotPassword,      // Forgot password function
    resetPassword,       // Reset password function
    checkSession,        // Function to manually re-check session if needed
  };
};