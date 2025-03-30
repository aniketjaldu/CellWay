import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './AuthForm.css';
import { closeIconUrl } from '../../assets/icons/index.js';

const AuthForm = ({
  mode, // 'login', 'register', 'forgot_password'
  onClose,
  onLogin, // async (email, password) => { success, error }
  onRegister, // async (email, password) => { success, error }
  onForgotPassword, // async (email) => { success, error, message }
  onChangeMode, // (newMode) => void
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(''); // For success messages like password reset

  // Clear state when mode changes or form opens/closes
  useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError('');
    setMessage('');
    setIsLoading(false);
  }, [mode, onClose]); // Rerun if mode changes or onClose changes (proxy for visibility)

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    let result;
    try {
      if (mode === 'login') {
        result = await onLogin(email, password);
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        result = await onRegister(email, password);
      } else if (mode === 'forgot_password') {
        result = await onForgotPassword(email);
        if (result.success) {
          setMessage(result.message || 'Password reset email sent.');
          // Optionally switch back to login after a delay
          // setTimeout(() => onChangeMode('login'), 3000);
        }
      }

      if (result && !result.success && result.error) {
        setError(result.error);
      } else if (result && result.success && (mode === 'login' || mode === 'register')) {
        onClose(); // Close form on successful login/register
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    if (mode === 'login') return 'Login';
    if (mode === 'register') return 'Register';
    if (mode === 'forgot_password') return 'Forgot Password';
    return '';
  };

  return (
    <div className="auth-form-overlay" onClick={onClose}> {/* Close on overlay click */}
      <div className="auth-form-container" onClick={(e) => e.stopPropagation()}> {/* Prevent closing on form click */}
        <div className="auth-form-header">
          <h2>{getTitle()}</h2>
          <button className="auth-close-button" onClick={onClose} title="Close" aria-label="Close">
            {/* Use img tag with imported URL */}
            <img src={closeIconUrl} alt="Close" className="icon-img small" />
          </button>
        </div>

        {error && <div className="auth-form-error">{error}</div>}
        {message && <div className="auth-form-message">{message}</div>}

        {/* Don't show form fields if message indicates success (e.g., after password reset) */}
        {!message && (
          <form onSubmit={handleSubmit} className="auth-form-body">
            <div className="form-group">
              <label htmlFor="auth-email">Email</label>
              <input
                type="email" id="auth-email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email"
                disabled={isLoading}
              />
            </div>

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
                    tabIndex="-1" // Prevent tabbing to it
                  >
                    <span className={`eye-icon ${showPassword ? 'visible' : 'hidden'}`}></span>
                  </button>
                </div>
              </div>
            )}

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

            <div className="form-actions">
              <button type="submit" className="submit-button" disabled={isLoading}>
                {isLoading ? 'Processing...' : getTitle()}
              </button>
            </div>

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
  mode: PropTypes.oneOf(['login', 'register', 'forgot_password']).isRequired,
  onClose: PropTypes.func.isRequired,
  onLogin: PropTypes.func.isRequired,
  onRegister: PropTypes.func.isRequired,
  onForgotPassword: PropTypes.func.isRequired,
  onChangeMode: PropTypes.func.isRequired,
};

export default AuthForm;