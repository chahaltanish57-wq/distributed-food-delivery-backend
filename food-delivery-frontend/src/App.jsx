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
    // Refresh cart for guest session
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

      {/* Menu Modal */}
      {selectedRestaurant && (
        <MenuModal
          restaurant={selectedRestaurant}
          onClose={() => setSelectedRestaurant(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Slide-out Cart Drawer */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Replace cart items?
            </h3>
            
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Your cart already contains items from <strong className="text-gray-800">{conflictModal.currentRestaurantName}</strong>. A cart can only have items from one restaurant at a time.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => setConflictModal(null)}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReplaceCart}
                className="flex-1 py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-orange-500/25 transition cursor-pointer"
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