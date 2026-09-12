import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api/v1';

export const getSessionId = () => {
  let sessionId = localStorage.getItem('guest_session_id');
  if (!sessionId) {
    sessionId = 'guest_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('guest_session_id', sessionId);
  }
  return sessionId;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-attach JWT Bearer Token if logged in, plus X-Session-Id for guest cart persistence
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Session-Id'] = getSessionId();
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

// Cart APIs backed by Redis
export const getCart = async () => {
  const response = await apiClient.get('/cart');
  return response.data.data;
};

export const addToCart = async (restaurantId, menuItemId, quantity = 1, forceReplace = false) => {
  const response = await apiClient.post('/cart/items', {
    restaurantId,
    menuItemId,
    quantity,
    forceReplace,
  });
  return response.data.data;
};

export const updateCartItem = async (menuItemId, delta) => {
  const response = await apiClient.patch(`/cart/items/${menuItemId}`, null, {
    params: { delta },
  });
  return response.data.data;
};

export const removeCartItem = async (menuItemId) => {
  const response = await apiClient.delete(`/cart/items/${menuItemId}`);
  return response.data.data;
};

export const clearCart = async () => {
  const response = await apiClient.delete('/cart');
  return response.data.data;
};

export const mergeCart = async () => {
  const guestSessionId = localStorage.getItem('guest_session_id');
  if (!guestSessionId) return null;
  const response = await apiClient.post('/cart/merge', null, {
    params: { guestSessionId },
  });
  return response.data.data;
};

// Order & Checkout APIs
export const createOrder = async (orderData) => {
  const response = await apiClient.post('/orders', orderData);
  return response.data.data;
};

export const getOrder = async (orderId) => {
  const response = await apiClient.get(`/orders/${orderId}`);
  return response.data.data;
};

export const getCustomerOrders = async () => {
  const response = await apiClient.get('/orders');
  return response.data.data;
};

// Payment APIs with Distributed Idempotency
export const processPayment = async (paymentData) => {
  const response = await apiClient.post('/payments/process', paymentData);
  return response.data.data;
};

export const getPaymentReceipt = async (orderId) => {
  const response = await apiClient.get(`/payments/order/${orderId}`);
  return response.data.data;
};

// Kitchen Live Dashboard APIs
export const getKitchenOrders = async (restaurantId) => {
  const response = await apiClient.get(`/kitchen/restaurants/${restaurantId}/orders`);
  return response.data.data;
};

export const acceptKitchenOrder = async (orderId) => {
  const response = await apiClient.patch(`/kitchen/orders/${orderId}/accept`);
  return response.data.data;
};

export const startCookingOrder = async (orderId) => {
  const response = await apiClient.patch(`/kitchen/orders/${orderId}/start-cooking`);
  return response.data.data;
};

export const markFoodReady = async (orderId) => {
  const response = await apiClient.patch(`/kitchen/orders/${orderId}/food-ready`);
  return response.data.data;
};

export const rejectKitchenOrder = async (orderId, reason = 'Kitchen is overwhelmed') => {
  const response = await apiClient.patch(`/kitchen/orders/${orderId}/reject`, { reason });
  return response.data.data;
};

// =========================================================================
// Driver Geospatial Dispatch & Redisson Locking APIs
// =========================================================================

export const getDrivers = async () => {
  const response = await apiClient.get('/drivers');
  return response.data.data;
};

export const getDriver = async (driverId) => {
  const response = await apiClient.get(`/drivers/${driverId}`);
  return response.data.data;
};

export const getNearbyDrivers = async (latitude, longitude, radiusKm = 6.0) => {
  const response = await apiClient.get('/drivers/nearby', {
    params: { latitude, longitude, radiusKm }
  });
  return response.data.data;
};

export const getAvailableOrdersForDriver = async (driverId) => {
  const response = await apiClient.get(`/drivers/${driverId}/available-orders`);
  return response.data.data;
};

export const getActiveMissionForDriver = async (driverId) => {
  const response = await apiClient.get(`/drivers/${driverId}/active-mission`);
  return response.data.data;
};

export const updateDriverLocation = async (driverId, latitude, longitude) => {
  const response = await apiClient.patch(`/drivers/${driverId}/location`, { latitude, longitude });
  return response.data.data;
};

export const acceptDeliveryRun = async (driverId, orderId) => {
  const response = await apiClient.post(`/drivers/${driverId}/orders/${orderId}/accept`);
  return response.data.data;
};

export const pickupDeliveryOrder = async (driverId, orderId) => {
  const response = await apiClient.patch(`/drivers/${driverId}/orders/${orderId}/pickup`);
  return response.data.data;
};

export const completeDeliveryOrder = async (driverId, orderId) => {
  const response = await apiClient.patch(`/drivers/${driverId}/orders/${orderId}/deliver`);
  return response.data.data;
};

// =========================================================================
// Real-Time Order Tracking & Simulation APIs (WebSockets / STOMP)
// =========================================================================

export const getOrderTracking = async (orderId) => {
  const response = await apiClient.get(`/tracking/orders/${orderId}`);
  return response.data.data;
};

export const pingDriverTracking = async (orderId, latitude, longitude, headingDegrees = 45.0) => {
  const response = await apiClient.post(`/tracking/orders/${orderId}/ping`, {
    latitude,
    longitude,
    headingDegrees,
  });
  return response.data.data;
};

export const simulateTrackingStep = async (orderId, progressRatio) => {
  const response = await apiClient.post(`/tracking/orders/${orderId}/simulate-step`, null, {
    params: { progressRatio },
  });
  return response.data.data;
};

// =========================================================================
// Gemini AI Customer Support Bot & Food Recommendations
// =========================================================================

export const sendAiChatMessage = async (message, currentOrderId = null, city = 'Noida', history = []) => {
  const response = await apiClient.post('/ai/chat', {
    message,
    currentOrderId,
    city,
    history,
  });
  return response.data;
};

export const getAiStatus = async () => {
  const response = await apiClient.get('/ai/status');
  return response.data;
};