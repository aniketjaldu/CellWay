import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Change to false for now
});

// Add default handling for 5xx errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.message === 'Network Error' || error.response?.status >= 500) {
      console.error('Backend server error:', error);
      // You could show a toast or notification here
    }
    return Promise.reject(error);
  }
);

export default apiClient;