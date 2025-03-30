import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import './AuthForm.css';
import { closeIconUrl } from '../../assets/icons/index.js';


/**
 * AuthForm Component
 * 
 * Generic authentication form component for login, registration, and forgot password modes.
 */
const AuthForm = ({
  mode, 
  onClose,
  onLogin, 
  onRegister, 
  onForgotPassword, 
  onChangeMode, 
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');


  // --- State Reset on Mode Change ---
  useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError('');
    setMessage('');
    setIsLoading(false);
  }, [mode, onClose]); // Reset form state when mode or visibility changes


  // --- Form Submit Handler ---
  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent default form submission behavior
    setError('');         // Clear any previous errors
    setMessage('');        // Clear any previous messages
    setIsLoading(true);    // Indicate loading state

    let authResult;
    try {
      if (mode === 'login') {
        authResult = await onLogin(email, password);
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match'); // Password mismatch error
        }
        authResult = await onRegister(email, password);
      } else if (mode === 'forgot_password') {
        authResult = await onForgotPassword(email);
        if (authResult.success) {
          setMessage(authResult.message || 'Password reset email sent.');
          // Optional: Auto-switch back to login after reset request
          // setTimeout(() => onChangeMode('login'), 3000); 
        }
      }

      if (authResult && !authResult.success && authResult.error) {
        setError(authResult.error); // Set error message from auth result
      } else if (authResult && authResult.success && (mode === 'login' || mode === 'register')) {
        onClose(); // Close form on successful login or registration
      }

    } catch (submitError) {
      setError(submitError.message || 'An unexpected error occurred.'); // Set generic error for exceptions
    } finally {
      setIsLoading(false); // End loading state regardless of outcome
    }
  };


  // --- Dynamic Form Title ---
  const getFormTitle = () => {
    switch (mode) {
      case 'login':           return 'Login';
      case 'register':        return 'Register';
      case 'forgot_password': return 'Forgot Password';
      default:                return '';
    }
  };


  // --- Render Form ---
  return (
    <div className="auth-form-overlay" onClick={onClose}> {/* Close form on overlay click */}
      <div className="auth-form-container" onClick={(event) => event.stopPropagation()}> {/* Prevent overlay close on form clicks */}

        {/* --- Form Header --- */}
        <div className="auth-form-header">
          <h2>{getFormTitle()}</h2>
          <button className="auth-close-button" onClick={onClose} title="Close" aria-label="Close">
            <img src={closeIconUrl} alt="Close" className="icon-img small" />
          </button>
        </div>

        {/* --- Error and Message Display --- */}
        {error && <div className="auth-form-error">{error}</div>}
        {message && <div className="auth-form-message">{message}</div>}

        {/* --- Form Body (Conditional Rendering based on message) --- */}
        {!message && (
          <form onSubmit={handleSubmit} className="auth-form-body">

            {/* --- Email Input Group --- */}
            <div className="form-group">
              <label htmlFor="auth-email">Email</label>
              <input
                type="email" id="auth-email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email"
                disabled={isLoading}
              />
            </div>

            {/* --- Password Input Group (Conditional Rendering - not for forgot password mode) --- */}
            {mode !== 'forgot_password' && (
              <div className="form-group">
                <label htmlFor="auth-password">Password</label>
                <div className="password-input-container">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="auth-password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
            )}

            {/* --- Confirm Password Input Group (Conditional Rendering - register mode only) --- */}
            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="auth-confirmPassword">Confirm Password</label>
                <div className="password-input-container">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="auth-confirmPassword" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required autoComplete="new-password"
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
            )}

            {/* --- Form Actions (Submit Button) --- */}
            <div className="form-actions">
              <button type="submit" className="submit-button" disabled={isLoading}>
                {isLoading ? 'Processing...' : getFormTitle()}
              </button>
            </div>

            {/* --- Auth Switch Links (Mode Switching Buttons) --- */}
            <div className="auth-switch-links">
              {mode === 'login' && (
                <>
                  <button type="button" onClick={() => onChangeMode('register')}>Need an account? Register</button>
                  <button type="button" onClick={() => onChangeMode('forgot_password')}>Forgot Password?</button>
                </>
              )}
              {mode === 'register' && (
                <button type="button" onClick={() => onChangeMode('login')}>Have an account? Login</button>
              )}
              {mode === 'forgot_password' && (
                <button type="button" onClick={() => onChangeMode('login')}>Back to Login</button>
              )}
            </div>

          </form>
        )}
      </div>
    </div>
  );
};


AuthForm.propTypes = {
  mode: PropTypes.oneOf(['login', 'register', 'forgot_password']).isRequired, // Current auth mode
  onClose: PropTypes.func.isRequired,               // Handler to close the form
  onLogin: PropTypes.func.isRequired,               // Handler for login submission
  onRegister: PropTypes.func.isRequired,            // Handler for registration submission
  onForgotPassword: PropTypes.func.isRequired,      // Handler for forgot password submission
  onChangeMode: PropTypes.func.isRequired,         // Handler to switch auth mode
};


export default AuthForm;