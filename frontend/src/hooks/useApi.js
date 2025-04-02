import axios from 'axios';

// Add CORS proxy until backend is fixed
const corsProxy = "https://corsproxy.io/?";
const baseURL = import.meta.env.VITE_API_BASE_URL;
const apiURL = process.env.NODE_ENV === 'production' 
    ? `${corsProxy}${encodeURIComponent(baseURL)}` 
    : baseURL;

const api = axios.create({
  baseURL: apiURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Change to false to avoid CORS preflight complexity
});

export default api;