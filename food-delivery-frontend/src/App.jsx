import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import RestaurantCard from './components/RestaurantCard';
import MenuModal from './components/MenuModal';
import { getRestaurants } from './api';
import { Flame, Star, Zap, Leaf, CheckCircle } from 'lucide-react';

export default function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [cart, setCart] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    getRestaurants()
      .then((data) => {
        setRestaurants(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch restaurants:', err);
        setError('Could not connect to Spring Boot backend. Ensure backend is running on port 8080.');
        setLoading(false);
      });
  }, []);

  const handleAddToCart = (item) => {
    setCart((prev) => [...prev, item]);
    showToast(`Added "${item.name}" to cart!`);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Filter & Search Logic
  const filteredRestaurants = restaurants.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cuisineType.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'RATING_45') return Number(r.rating) >= 4.7;
    if (filterType === 'FAST') return Number(r.deliveryTimeMins) <= 25;
    if (filterType === 'VEG') return r.cuisineType.toLowerCase().includes('healthy') || r.cuisineType.toLowerCase().includes('vegan');

    return true;
  });

  return (
    <div>
      <Navbar
        cartCount={cart.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCartClick={() => showToast(`Cart has ${cart.length} item(s). Total: $${cart.reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)}`)}
      />

      <main className="container">
        {/* Swiggy Hero Banner */}
        <div className="hero-banner">
          <div>
            <h1 className="hero-title">Hungry? Order from Top Kitchens</h1>
            <p className="hero-subtitle">
              Live event-driven food delivery backend powered by Spring Boot, Redis & Kafka.
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.75rem 1.25rem', borderRadius: 16, textAlign: 'center' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>⚡ 20m</span>
            <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>Avg Delivery</p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="filter-row">
          <button
            className={`filter-btn ${filterType === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterType('ALL')}
          >
            <Flame size={16} color="#fc8019" />
            <span>All Restaurants</span>
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
            <span>Fast Delivery (≤ 25 mins)</span>
          </button>

          <button
            className={`filter-btn ${filterType === 'VEG' ? 'active' : ''}`}
            onClick={() => setFilterType('VEG')}
          >
            <Leaf size={16} color="#0f8a65" />
            <span>Healthy & Pure Veg</span>
          </button>
        </div>

        {/* Section Title */}
        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '1.25rem' }}>
          {filteredRestaurants.length} Restaurants Available Near You
        </h2>

        {/* Loading / Error States */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: '#868e96' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Connecting to Spring Boot Backend...</p>
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