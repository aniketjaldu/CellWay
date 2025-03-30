import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import * as api from '../services/api'; // Import API functions

export const useAuth = () => {
    const [user, setUser] = useState(null); // Store user object { id, email, ... } or null
    const [isLoading, setIsLoading] = useState(true); // Track initial session check

    // Check session on initial load
    const checkSession = useCallback(async () => {
    setIsLoading(true);
    try {
        const response = await api.checkUserSession();
        if (response.data?.user_id) {
            // Fetch full user details if needed, or just store ID
            // For now, just store ID as before
            setUser({ id: response.data.user_id });
            // console.log("Session check: User is logged in.", response.data.user_id);
        } else {
            setUser(null);
        }
    } catch (error) {
        // 401 is expected if not logged in, don't log error for that
        if (error.response?.status !== 401) {
            console.error('Error checking authentication status:', error);
        }
        setUser(null);
    } finally {
        setIsLoading(false);
    }
    }, []);

    useEffect(() => {
    checkSession();
    }, [checkSession]);

    // Login function
    const login = useCallback(async (email, password) => {
    try {
        const response = await api.loginUser(email, password);
        if (response.data?.success && response.data?.user) {
            const userData = { ...response.data.user, id: response.data.user._id }; // Standardize ID field
            delete userData._id; // Remove MongoDB specific ID if present
            setUser(userData);
            toast.success('Logged in successfully!');
            return { success: true, user: userData };
        }
        // Errors handled by interceptor or below
        return { success: false, error: 'Login failed.' }; // Fallback error
    } catch (error) {
        const errorMsg = error.response?.data?.error || 'Login failed. Please try again.';
        // Toast handled by interceptor for common cases, but can add specific here
        // toast.error(errorMsg);
        return { success: false, error: errorMsg };
    }
    }, []);

    // Register function
    const register = useCallback(async (email, password) => {
    try {
        const response = await api.registerUser(email, password);
        if (response.data?.success && response.data?.user) {
            const userData = { ...response.data.user, id: response.data.user._id };
            delete userData._id;
            setUser(userData);
            toast.success('Registration successful! You are now logged in.');
            return { success: true, user: userData };
        }
        return { success: false, error: 'Registration failed.' };
    } catch (error) {
        const errorMsg = error.response?.data?.error || 'Registration failed. Please try again.';
        // toast.error(errorMsg);
        return { success: false, error: errorMsg };
    }
    }, []);

    // Logout function
    const logout = useCallback(async () => {
    try {
        await api.logoutUser();
        setUser(null);
        toast.success('Logged out.');
        return { success: true };
    } catch (error) {
        console.error("Logout failed:", error);
        toast.error("Logout failed. Please try again.");
        return { success: false, error: 'Logout failed.' };
    }
    }, []);

    // Forgot Password function
    const forgotPassword = useCallback(async (email) => {
        try {
            const response = await api.forgotPasswordRequest(email);
            if (response.data?.success) {
                toast.success(response.data.message || 'Password reset email sent successfully!');
                return { success: true, message: response.data.message };
            }
            return { success: false, error: 'Failed to send reset email.' };
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to send password reset email.';
            // toast.error(errorMsg);
            return { success: false, error: errorMsg };
        }
    }, []);


    return {
        user,
        isLoading,
        isLoggedIn: !!user,
        login,
        register,
        logout,
        forgotPassword,
        checkSession // Expose session check if needed externally
    };
};