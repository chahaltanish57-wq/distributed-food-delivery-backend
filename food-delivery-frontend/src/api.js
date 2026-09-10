import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getRestaurants = async () => {
  const response = await apiClient.get('/restaurants');
  return response.data.data;
};

export const getRestaurantMenu = async (restaurantId, category) => {
  const params = category ? { category } : {};
  const response = await apiClient.get(`/restaurants/${restaurantId}/menu`, { params });
  return response.data.data;
};