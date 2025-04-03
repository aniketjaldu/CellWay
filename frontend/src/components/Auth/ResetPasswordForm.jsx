import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './AuthForm.css'; // Reusing AuthForm styles for consistency


/**
 * ResetPasswordForm Component
 * 
 * Handles the password reset process, allowing users to set a new password
 * after receiving a reset token via email.
 */
const ResetPasswordForm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);


  // --- Token Initialization Effect ---
  useEffect(() => {
    const urlToken = searchParams.get('token');
    console.log('Reset token from URL:', urlToken);
    if (urlToken) {
      setToken(urlToken); // Set token from URL query parameter
    } else {
      setError('Reset token is missing from the URL. Please use the password reset link from your email.');
    }
  }, [searchParams]);


  // --- Form Submission Handler ---
  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent default form submission
    setError('');          // Clear previous errors
    setMessage('');         // Clear previous messages

    // --- Input Validation ---
    if (!token) {
      setError('Reset token is missing.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please ensure both password fields are identical.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long for security reasons.');
      return;
    }

    setIsLoading(true); // Start loading/processing state
    try {
      // Ensure we're using the API with the correct base URL (from the .env VITE_API_BASE_URL)
      const resetResult = await resetPassword(token, newPassword); // Call resetPassword from useAuth hook
      if (resetResult.success) {
        setMessage(resetResult.message || 'Password reset successful. Redirecting to login page...');
        setTimeout(() => {
          navigate('/login'); // Redirect to login page after successful reset
        }, 3000); // Short delay before redirection
      } else {
        setError(resetResult.error || 'Password reset attempt failed. Please check your token or try again.');
      }
    } catch (apiError) {
      console.error("Password reset error:", apiError);
      setError(apiError.message || 'An unexpected error occurred during password reset. Please try again later.');
    } finally {
      setIsLoading(false); // End loading state regardless of outcome
    }
  };


  // --- Conditional Rendering: Show Form or Message ---
  const showResetForm = token && !message; // Show reset form only if token exists and no success message is shown


  // --- Render Form ---
  return (
    <div className="auth-form-overlay"> {/* Reusing overlay styles from AuthForm */}
      <div className="auth-form-container" style={{ maxWidth: '450px' }}> {/* Reusing container styles */}
        <div className="auth-form-header">
          <h2>Reset Password</h2> {/* Form Header */}
          {/* Optional: Close button or link in header */}
        </div>

        {error && <div className="auth-form-error">{error}</div>}     {/* Display error message */}
        {message && <div className="auth-form-message">{message}</div>} {/* Display success message */}


        {showResetForm && (
          // --- Password Reset Form ---
          <form onSubmit={handleSubmit} className="auth-form-body">
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
              Enter your new password below to reset your password.
            </p>

            {/* --- New Password Input Group --- */}
            <div className="form-group">
              <label htmlFor="reset-newPassword">New Password</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="reset-newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="password-visibility-toggle"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex="-1"
                >
                  <span className={`eye-icon ${showPassword ? 'visible' : 'hidden'}`}></span>
                </button>
              </div>
            </div>


            {/* --- Confirm New Password Input Group --- */}
            <div className="form-group">
              <label htmlFor="reset-confirmPassword">Confirm New Password</label>
              <div className="password-input-container">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="reset-confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="password-visibility-toggle"
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  tabIndex="-1"
                >
                  <span className={`eye-icon ${showConfirmPassword ? 'visible' : 'hidden'}`}></span>
                </button>
              </div>
            </div>


            {/* --- Form Actions and Switch Links --- */}
            <div className="form-actions">
              <button type="submit" className="submit-button" disabled={isLoading || !token}>
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>

            <div className="auth-switch-links">
              <Link to="/login">Back to Login</Link> {/* Link back to login page */}
            </div>
          </form>
        )}


        {/* --- Back to Login Link (if token is missing or after success) --- */}
        {!showResetForm && !message && (
          <div className="auth-form-body">
            <div className="auth-switch-links">
              <Link to="/login">Back to Login</Link> {/* Link back to login page */}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};


export default ResetPasswordForm;