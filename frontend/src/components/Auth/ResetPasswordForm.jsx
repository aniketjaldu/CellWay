import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom'; // Use react-router hooks
import { useAuth } from '../../hooks/useAuth'; // Adjust path as needed
import './AuthForm.css'; // Reuse AuthForm styles

const ResetPasswordForm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuth(); // Get reset function from hook

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
    } else {
      setError('Reset token not found in URL. Please check the link or request a new password reset.');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Missing reset token.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) { // Add basic password length validation
        setError('Password must be at least 6 characters long.');
        return;
    }

    setIsLoading(true);
    try {
      const result = await resetPassword(token, newPassword);
      if (result.success) {
        setMessage(result.message || 'Password reset successfully. Redirecting to login...');
        // Redirect to login after a short delay
        setTimeout(() => {
          navigate('/login'); // Or wherever your login route is
        }, 3000);
      } else {
        setError(result.error || 'Failed to reset password.');
      }
    } catch (err) {
      // This catch might not be needed if useAuth handles errors, but good practice
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render form if token is missing or after success message
  const showForm = token && !message;

  return (
    <div className="auth-form-overlay"> {/* Reuse overlay style */}
      <div className="auth-form-container" style={{ maxWidth: '450px' }}> {/* Reuse container */}
        <div className="auth-form-header">
          <h2>Reset Password</h2>
          {/* Optional: Add close button or link back to login */}
        </div>

        {error && <div className="auth-form-error">{error}</div>}
        {message && <div className="auth-form-message">{message}</div>}

        {showForm && (
          <form onSubmit={handleSubmit} className="auth-form-body">
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
              Enter your new password below.
            </p>
             <div className="form-group">
                <label htmlFor="reset-newPassword">New Password</label>
                <div className="password-input-container">
                    <input
                    type={showPassword ? 'text' : 'password'}
                    id="reset-newPassword" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required autoComplete="new-password"
                    disabled={isLoading}
                    />
                     <button
                        type="button" className="password-visibility-toggle"
                        onClick={() => setShowPassword(prev => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"} tabIndex="-1">
                        <span className={`eye-icon ${showPassword ? 'visible' : 'hidden'}`}></span>
                    </button>
                </div>
             </div>

             <div className="form-group">
                <label htmlFor="reset-confirmPassword">Confirm New Password</label>
                <div className="password-input-container">
                    <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="reset-confirmPassword" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required autoComplete="new-password"
                    disabled={isLoading}
                    />
                     <button
                        type="button" className="password-visibility-toggle"
                        onClick={() => setShowConfirmPassword(prev => !prev)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"} tabIndex="-1">
                        <span className={`eye-icon ${showConfirmPassword ? 'visible' : 'hidden'}`}></span>
                    </button>
                </div>
             </div>


            <div className="form-actions">
              <button type="submit" className="submit-button" disabled={isLoading || !token}>
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
             <div className="auth-switch-links">
                <Link to="/login">Back to Login</Link> {/* Use Link for navigation */}
             </div>
          </form>
        )}
         {!showForm && !message && ( /* Show only if token missing and no success message */
             <div className="auth-form-body">
                 <div className="auth-switch-links">
                    <Link to="/login">Back to Login</Link>
                 </div>
             </div>
         )}
      </div>
    </div>
  );
};

export default ResetPasswordForm;