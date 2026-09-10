import React from 'react';
import { UtensilsCrossed, MapPin, Search, ShoppingBag } from 'lucide-react';

export default function Navbar({ cartCount, searchQuery, onSearchChange, onCartClick }) {
  return (
    <header className="navbar">
      <div className="nav-left">
        <div className="brand-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <UtensilsCrossed size={28} />
          <span>Swiggy Distributed</span>
        </div>

        <div className="location-pill">
          <MapPin size={16} className="text-orange-500" />
          <span><strong>Bangalore</strong>, Indiranagar</span>
        </div>
      </div>

      <div className="nav-search">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search for restaurants or dishes..."
          className="search-input"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="nav-right">
        <button className="cart-btn" onClick={onCartClick}>
          <ShoppingBag size={18} />
          <span>Cart</span>
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}