import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import RestaurantCard from './components/RestaurantCard';
import MenuModal from './components/MenuModal';
import AuthModal from './components/AuthModal';
import CartDrawer from './components/CartDrawer';
import { 
  getRestaurants, 
  getCart, 
  addToCart, 
  updateCartItem, 
  clearCart, 
  mergeCart 
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
  
  // Redis-Backed Cart State
  const [cart, setCart] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [conflictModal, setConflictModal] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

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
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
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
      />

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

      {/* Slide-out Cart Drawer with Pure CSS */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={handleClearCart}
        onCheckout={() => {
          setIsCartOpen(false);
          showToast('Checkout flow ready for Day 6!');
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

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
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