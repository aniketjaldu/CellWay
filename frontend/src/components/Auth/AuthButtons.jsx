import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { userIconUrl, loginIconUrl, registerIconUrl } from '../../assets/icons/index.js'; // Import URLs
import './AuthButtons.css';

const AuthButtons = ({ user, onLoginClick, onRegisterClick, onLogoutClick, onMyRoutesClick }) => {
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target) &&
        buttonRef.current && !buttonRef.current.contains(event.target)
      ) {
        setShowAuthMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleMenu = () => setShowAuthMenu(prev => !prev);

  return (
    <div className="auth-buttons-container">
      {user ? (
        <>
          <button className="auth-button my-routes-button" onClick={onMyRoutesClick} title="View saved routes">
            My Routes
          </button>
          <button className="auth-button logout-button" onClick={onLogoutClick} title="Log out">
            Logout
          </button>
        </>
      ) : (
        <div className="user-icon-container">
          <button
            ref={buttonRef}
            className="auth-button user-icon-button"
            onClick={handleToggleMenu}
            title="Account options"
            aria-haspopup="true"
            aria-expanded={showAuthMenu}
          >
            {/* Use img tag with imported URL */}
            <img src={userIconUrl} alt="User" className="icon-img" />
          </button>
          {showAuthMenu && (
            <div ref={menuRef} className="auth-menu-popup" role="menu">
              <div className="auth-menu-arrow"></div>
              <button
                className="auth-menu-option"
                role="menuitem"
                onClick={() => {
                  onLoginClick();
                  setShowAuthMenu(false);
                }}
              >
                <span className="auth-menu-icon-wrapper"> {/* Optional wrapper */}
                  {/* Use img tag with imported URL */}
                  <img src={loginIconUrl} alt="" className="icon-img small" />
                </span> Login
              </button>
              <button
                className="auth-menu-option"
                role="menuitem"
                onClick={() => {
                  onRegisterClick();
                  setShowAuthMenu(false);
                }}
              >
                 <span className="auth-menu-icon-wrapper"> {/* Optional wrapper */}
                  {/* Use img tag with imported URL */}
                  <img src={registerIconUrl} alt="" className="icon-img small" />
                 </span> Register
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

AuthButtons.propTypes = {
    user: PropTypes.object, // User object or null
    onLoginClick: PropTypes.func.isRequired,
    onRegisterClick: PropTypes.func.isRequired,
    onLogoutClick: PropTypes.func.isRequired,
    onMyRoutesClick: PropTypes.func.isRequired,
};

export default AuthButtons;