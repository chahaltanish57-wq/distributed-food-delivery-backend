import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-attach JWT Bearer Token if logged in
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getRestaurants = async (city) => {
  const params = city ? { city } : {};
  const response = await apiClient.get('/restaurants', { params });
  return response.data.data;
};

export const getRestaurantMenu = async (restaurantId, category) => {
  const params = category ? { category } : {};
  const response = await apiClient.get(`/restaurants/${restaurantId}/menu`, { params });
  return response.data.data;
};

export const login = async (email, password) => {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data.data;
};

export const register = async (userData) => {
  const response = await apiClient.post('/auth/register', userData);
  return response.data.data;
};

export const getMe = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data.data;
};