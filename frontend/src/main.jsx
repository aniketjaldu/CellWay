import React from 'react';
// Commented out StrictMode to prevent double initialization of components
// import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  // StrictMode temporarily disabled to fix map initialization issues
  // <StrictMode>
    <>
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </>
  // </StrictMode>,
);