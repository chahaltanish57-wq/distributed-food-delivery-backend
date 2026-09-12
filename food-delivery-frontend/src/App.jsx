import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import RestaurantCard from './components/RestaurantCard';
import MenuModal from './components/MenuModal';
import AuthModal from './components/AuthModal';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';
import PaymentModal from './components/PaymentModal';
import OrderSuccessModal from './components/OrderSuccessModal';
import KitchenDashboard from './components/KitchenDashboard';
import DriverDashboard from './components/DriverDashboard';
import LiveTrackingView from './components/LiveTrackingView';
import MyOrdersDrawer from './components/MyOrdersDrawer';
import { 
  getRestaurants, 
  getCart, 
  addToCart, 
  updateCartItem, 
  clearCart, 
  mergeCart,
  createOrder
} from './api';
import { Flame, Star, Zap, Leaf, CheckCircle, AlertTriangle } from 'lucide-react';

export default function App() {
  const [selectedCity, setSelectedCity] = useState('Noida');
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  
  // Theme State ('light' | 'dark')
  const [theme, setTheme] = useState(() => localStorage.getItem('food_delivery_theme') || 'light');
  
  // My Orders Drawer State
  const [isOrdersDrawerOpen, setIsOrdersDrawerOpen] = useState(false);

  // Redis-Backed Cart State
  const [cart, setCart] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [conflictModal, setConflictModal] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Day 6 & 7: Checkout & Payment State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState(null);
  const [completedPayment, setCompletedPayment] = useState(null);
  const [successOrder, setSuccessOrder] = useState(null);
  const [pendingCheckoutAfterLogin, setPendingCheckoutAfterLogin] = useState(false);

  // Day 11: Live Order Tracking State
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState(() => {
    if (window.location.hash.startsWith('#track')) {
      const parts = window.location.hash.split('=');
      return parts[1] ? parseInt(parts[1], 10) : null;
    }
    return null;
  });

  // Day 9, 10 & 11: Multi-Portal View Mode ('CUSTOMER' | 'KITCHEN' | 'DRIVER' | 'TRACKING')
  const [viewMode, setViewMode] = useState(() => {
    if (window.location.hash.startsWith('#track')) return 'TRACKING';
    if (window.location.hash === '#driver') return 'DRIVER';
    if (window.location.hash === '#restaurant') return 'KITCHEN';
    return 'CUSTOMER';
  });

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash.startsWith('#track')) {
        const parts = window.location.hash.split('=');
        if (parts[1]) {
          setActiveTrackingOrderId(parseInt(parts[1], 10));
        }
        setViewMode('TRACKING');
      } else if (window.location.hash === '#driver') {
        setViewMode('DRIVER');
      } else if (window.location.hash === '#restaurant') {
        setViewMode('KITCHEN');
      } else {
        setViewMode('CUSTOMER');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSetViewMode = (mode, orderId = null) => {
    setViewMode(mode);
    if (mode === 'TRACKING') {
      const targetId = orderId || activeTrackingOrderId;
      if (orderId) setActiveTrackingOrderId(orderId);
      window.location.hash = targetId ? `track=${targetId}` : 'track';
    } else if (mode === 'DRIVER') {
      window.location.hash = 'driver';
    } else if (mode === 'KITCHEN') {
      window.location.hash = 'restaurant';
    } else {
      window.location.hash = '';
    }
  };

  const handleToggleViewMode = () => {
    handleSetViewMode(viewMode === 'CUSTOMER' ? 'KITCHEN' : 'CUSTOMER');
  };

  // Authentication State
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Synchronize Dark Mode Theme with HTML root & body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('food_delivery_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 1-Click Reorder Handler: Re-populates active cart with past order items
  const handleReorder = async (pastOrder) => {
    if (!pastOrder || !pastOrder.items || pastOrder.items.length === 0) return;
    try {
      showToast(`Reordering dishes from ${pastOrder.restaurantName || 'Restaurant'}... 🍲`);
      for (const item of pastOrder.items) {
        if (item.menuItemId) {
          await addToCart(pastOrder.restaurantId, item.menuItemId, item.quantity || 1, true);
        }
      }
      const updatedCart = await getCart();
      setCart(updatedCart);
      setIsCartOpen(true);
      showToast(`Reordered ${pastOrder.items.length} items successfully! 🛒`);
    } catch (err) {
      console.error('Failed to reorder items:', err);
      showToast('Could not reorder items automatically. Please add from menu.');
    }
  };

  // 1. Fetch active Cart from Redis on initial load
  useEffect(() => {
    getCart()
      .then((data) => setCart(data))
      .catch((err) => console.error('Failed to load Redis cart:', err));
  }, []);

  // 2. Fetch restaurants whenever selectedCity changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    getRestaurants(selectedCity)
      .then((data) => {
        setRestaurants(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch restaurants:', err);
        setError('Could not connect to Spring Boot backend on port 8080.');
        setLoading(false);
      });
  }, [selectedCity]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Cart Operations via Redis Backend
  const handleAddToCart = async (item, restaurant) => {
    const restaurantId = restaurant ? restaurant.id : item.restaurantId;
    try {
      const updatedCart = await addToCart(restaurantId, item.id, 1, false);
      setCart(updatedCart);
      showToast(`Added "${item.name}" (₹${Math.round(item.price)}) to cart!`);
    } catch (err) {
      if (err.response && err.response.status === 409) {
        // Single-restaurant rule conflict
        const conflictData = err.response.data?.data;
        setConflictModal({
          currentRestaurantName: conflictData?.currentRestaurantName || 'another restaurant',
          item,
          restaurantId,
        });
      } else {
        console.error('Failed to add item to cart:', err);
        showToast('Error adding item to cart. Please try again.');
      }
    }
  };

  const handleConfirmReplaceCart = async () => {
    if (!conflictModal) return;
    try {
      const updatedCart = await addToCart(
        conflictModal.restaurantId, 
        conflictModal.item.id, 
        1, 
        true
      );
      setCart(updatedCart);
      showToast(`Cart refreshed with "${conflictModal.item.name}"!`);
      setConflictModal(null);
    } catch (err) {
      console.error('Failed to replace cart:', err);
      showToast('Could not replace cart items.');
      setConflictModal(null);
    }
  };

  const handleUpdateQuantity = async (menuItemId, delta) => {
    try {
      const updatedCart = await updateCartItem(menuItemId, delta);
      setCart(updatedCart);
    } catch (err) {
      console.error('Failed to update item quantity:', err);
      showToast('Could not update item quantity.');
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCart();
      setCart(null);
      showToast('Cart cleared successfully.');
    } catch (err) {
      console.error('Failed to clear cart:', err);
      showToast('Error clearing cart.');
    }
  };

  // Day 6 & 7: Checkout & Payment Flow
  const handleStartCheckout = () => {
    if (!user) {
      setPendingCheckoutAfterLogin(true);
      setIsAuthOpen(true);
      showToast('Please sign in or create an account to checkout.');
      return;
    }
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleConfirmOrder = async (orderPayload) => {
    const order = await createOrder(orderPayload);
    setCart(null);
    setIsCheckoutOpen(false);
    setPendingPaymentOrder(order);
    setIsPaymentOpen(true);
    showToast(`Order #ORD-${order.id} created! Choose payment method.`);
    return order;
  };

  const handlePaymentSuccess = (paymentResponse) => {
    setIsPaymentOpen(false);
    setCompletedPayment(paymentResponse);
    setSuccessOrder({
      ...pendingPaymentOrder,
      status: 'ORDER_PLACED'
    });
    if (pendingPaymentOrder?.id) {
      setActiveTrackingOrderId(pendingPaymentOrder.id);
    }
    showToast(`Payment of ₹${pendingPaymentOrder?.totalAmount} verified! Order confirmed.`);
  };

  const handleAuthSuccess = async (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    showToast(`Welcome, ${data.fullName.split(' ')[0]}!`);

    // Merge guest cart items into authenticated customer Redis cart
    try {
      const merged = await mergeCart();
      if (merged) setCart(merged);
    } catch (e) {
      console.error('Failed to merge guest cart on login:', e);
    }

    // Auto-proceed to checkout if user was waiting
    if (pendingCheckoutAfterLogin) {
      setPendingCheckoutAfterLogin(false);
      setIsCartOpen(false);
      setIsCheckoutOpen(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsCheckoutOpen(false);
    setIsPaymentOpen(false);
    showToast('Signed out successfully');
    getCart().then(setCart).catch(console.error);
  };

  // Filter & Search Logic
  const filteredRestaurants = restaurants.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cuisineType.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'RATING_45') return Number(r.rating) >= 4.7;
    if (filterType === 'FAST') return Number(r.deliveryTimeMins) <= 22;
    if (filterType === 'VEG') return r.cuisineType.toLowerCase().includes('healthy') || r.cuisineType.toLowerCase().includes('chaat') || r.cuisineType.toLowerCase().includes('sweets');

    return true;
  });

  const cartCount = cart?.totalItemCount || 0;

  return (
    <div>
      <Navbar
        user={user}
        cartCount={cartCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCartClick={() => setIsCartOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        selectedCity={selectedCity}
        onSelectCity={setSelectedCity}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        onSetViewMode={handleSetViewMode}
        activeTrackingOrderId={activeTrackingOrderId}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenOrders={() => setIsOrdersDrawerOpen(true)}
      />

      {/* Day 9: Kitchen Display System (KDS) View */}
      {viewMode === 'KITCHEN' ? (
        <KitchenDashboard
          restaurants={restaurants}
          onBackToStorefront={() => handleSetViewMode('CUSTOMER')}
          showToast={showToast}
        />
      ) : viewMode === 'DRIVER' ? (
        <DriverDashboard
          onBackToStorefront={() => handleSetViewMode('CUSTOMER')}
          showToast={showToast}
        />
      ) : viewMode === 'TRACKING' ? (
        <LiveTrackingView
          orderId={activeTrackingOrderId}
          onBack={() => handleSetViewMode('CUSTOMER')}
          onOpenKitchen={() => handleSetViewMode('KITCHEN')}
          onOpenDriver={() => handleSetViewMode('DRIVER')}
        />
      ) : (
        <main className="container">
        {/* Swiggy Hero Banner */}
        <div className="hero-banner">
          <div>
            <h1 className="hero-title">
              {user ? `Welcome back, ${user.fullName.split(' ')[0]}!` : `Craving food in ${selectedCity}?`}
            </h1>
            <p className="hero-subtitle">
              Delivering authentic food across {selectedCity === 'Noida' ? 'Noida (Sector 18, 29, 62)' : 'Dehradun (Rajpur Road, Clock Tower)'} powered by Spring Boot, Redis & Kafka.
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.75rem 1.25rem', borderRadius: 16, textAlign: 'center' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>⚡ 22m</span>
            <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>Avg Delivery in {selectedCity}</p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="filter-row">
          <button
            className={`filter-btn ${filterType === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterType('ALL')}
          >
            <Flame size={16} color="#fc8019" />
            <span>All {selectedCity} Kitchens</span>
          </button>

          <button
            className={`filter-btn ${filterType === 'RATING_45' ? 'active' : ''}`}
            onClick={() => setFilterType('RATING_45')}
          >
            <Star size={16} color="#119643" />
            <span>Top Rated (4.7+)</span>
          </button>

          <button
            className={`filter-btn ${filterType === 'FAST' ? 'active' : ''}`}
            onClick={() => setFilterType('FAST')}
          >
            <Zap size={16} color="#0077b6" />
            <span>Fast Delivery (≤ 22 mins)</span>
          </button>

          <button
            className={`filter-btn ${filterType === 'VEG' ? 'active' : ''}`}
            onClick={() => setFilterType('VEG')}
          >
            <Leaf size={16} color="#0f8a65" />
            <span>Pure Veg & Sweets</span>
          </button>
        </div>

        {/* Section Title */}
        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '1.25rem' }}>
          {filteredRestaurants.length} Restaurants Available in {selectedCity}
        </h2>

        {/* Loading / Error States */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: '#868e96' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading restaurants in {selectedCity}...</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#ffe3e3', color: '#c92a2a', padding: '1.25rem', borderRadius: 12, marginBottom: '2rem' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Restaurant Grid */}
        {!loading && !error && (
          <div className="restaurant-grid">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onClick={() => setSelectedRestaurant(restaurant)}
              />
            ))}
          </div>
        )}
      </main>
      )}

      {/* Menu Modal with Inline Quantity Controls */}
      {selectedRestaurant && (
        <MenuModal
          restaurant={selectedRestaurant}
          onClose={() => setSelectedRestaurant(null)}
          onAddToCart={handleAddToCart}
          cart={cart}
          onUpdateQuantity={handleUpdateQuantity}
        />
      )}

      {/* Slide-out Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={handleClearCart}
        onCheckout={handleStartCheckout}
      />

      {/* Day 6: Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        user={user}
        onConfirmOrder={handleConfirmOrder}
      />

      {/* Day 7: Payment Modal */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        order={pendingPaymentOrder}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Day 6 & 7: Order Success Modal with Payment Receipt */}
      <OrderSuccessModal
        isOpen={!!successOrder}
        onClose={() => {
          setSuccessOrder(null);
          setPendingPaymentOrder(null);
          setCompletedPayment(null);
        }}
        order={successOrder}
        payment={completedPayment}
        onOpenKitchen={() => {
          setViewMode('KITCHEN');
          window.location.hash = 'restaurant';
        }}
        onOpenTracking={(orderId) => {
          handleSetViewMode('TRACKING', orderId);
        }}
      />

      {/* Single-Restaurant Conflict Modal */}
      {conflictModal && (
        <div className="modal-overlay" onClick={() => setConflictModal(null)}>
          <div className="conflict-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#fff3bf',
              color: '#d9480f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem'
            }}>
              <AlertTriangle size={32} />
            </div>
            
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e2229', marginBottom: '0.5rem' }}>
              Replace cart items?
            </h3>
            
            <p style={{ fontSize: '0.9rem', color: '#686b78', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Your cart already contains items from <strong style={{ color: '#1e2229' }}>{conflictModal.currentRestaurantName}</strong>. A cart can only contain dishes from one restaurant at a time.
            </p>

            <div style={{ display: 'flex', gap: '0.85rem' }}>
              <button
                onClick={() => setConflictModal(null)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: 12,
                  border: '1px solid #ced4da',
                  background: '#ffffff',
                  color: '#495057',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReplaceCart}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: 12,
                  border: 'none',
                  background: '#fc8019',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(252, 128, 25, 0.4)'
                }}
              >
                Yes, Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Orders History Drawer */}
      <MyOrdersDrawer
        isOpen={isOrdersDrawerOpen}
        onClose={() => setIsOrdersDrawerOpen(false)}
        onTrackOrder={(orderId) => {
          setActiveTrackingOrderId(orderId);
          handleSetViewMode('TRACKING', orderId);
        }}
        onReorder={handleReorder}
        user={user}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false);
          setPendingCheckoutAfterLogin(false);
        }}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-bar">
          <CheckCircle size={20} color="#48c479" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}