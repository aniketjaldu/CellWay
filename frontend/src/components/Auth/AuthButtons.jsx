import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

import { userIconUrl, loginIconUrl, registerIconUrl } from '../../assets/icons/index.js';
import './AuthButtons.css';


/**
 * AuthButtons Component
 * 
 * Renders authentication buttons and user menu based on login status.
 */
const AuthButtons = ({ user, onLoginClick, onRegisterClick, onLogoutClick, onMyRoutesClick }) => {
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);


  // --- Menu Close Handler ---
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


  // --- Menu Toggle Handler ---
  const handleToggleMenu = () => setShowAuthMenu(prev => !prev);


  // --- Render Logic ---
  return (
    <div className="auth-buttons-container">
      {user ? (
        // --- Logged In State ---
        <>
          <button className="auth-button my-routes-button" onClick={onMyRoutesClick} title="View saved routes">
            My Routes
          </button>
          <button className="auth-button logout-button" onClick={onLogoutClick} title="Log out">
            Logout
          </button>
        </>
      ) : (
        // --- Logged Out State - User Icon Menu ---
        <div className="user-icon-container">
          <button
            ref={buttonRef}
            className="auth-button user-icon-button"
            onClick={handleToggleMenu}
            title="Account options"
            aria-haspopup="true"
            aria-expanded={showAuthMenu}
          >
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
                <span className="auth-menu-icon-wrapper">
                  <img src={loginIconUrl} alt="" className="icon-img small" />
                </span>
                Login
              </button>

              <button
                className="auth-menu-option"
                role="menuitem"
                onClick={() => {
                  onRegisterClick();
                  setShowAuthMenu(false);
                }}
              >
                <span className="auth-menu-icon-wrapper">
                  <img src={registerIconUrl} alt="" className="icon-img small" />
                </span>
                Register
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


AuthButtons.propTypes = {
    user: PropTypes.object, // User object or null if not logged in
    onLoginClick: PropTypes.func.isRequired,       // Handler for Login button click
    onRegisterClick: PropTypes.func.isRequired,    // Handler for Register button click
    onLogoutClick: PropTypes.func.isRequired,      // Handler for Logout button click
    onMyRoutesClick: PropTypes.func.isRequired,     // Handler for My Routes button click
};


export default AuthButtons;