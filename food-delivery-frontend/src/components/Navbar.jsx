import React from 'react';
import { UtensilsCrossed, MapPin, Search, ShoppingBag, User, LogOut } from 'lucide-react';

export default function Navbar({
  user,
  cartCount,
  searchQuery,
  onSearchChange,
  onCartClick,
  onOpenAuth,
  onLogout
}) {
  return (
    <header className="navbar">
      <div className="nav-left">
        <div className="brand-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <UtensilsCrossed size={28} />
          <span>Swiggy Distributed</span>
        </div>

        <div className="location-pill">
          <MapPin size={16} color="#fc8019" />
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
        {/* Auth Section */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#f8f9fa',
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              border: '1px solid #e9ecef',
              fontSize: '0.88rem',
              fontWeight: 700
            }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: '#fc8019',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem'
              }}>
                {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </div>
              <span>Hi, {user.fullName.split(' ')[0]}</span>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              style={{
                background: 'none',
                border: 'none',
                color: '#868e96',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0.4rem',
                borderRadius: '8px',
                transition: 'color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#e23744'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#868e96'}
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: '#ffffff',
              border: '1px solid #ced4da',
              color: '#343a40',
              padding: '0.55rem 1rem',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <User size={16} />
            <span>Sign In</span>
          </button>
        )}

        {/* Cart Section */}
        <button className="cart-btn" onClick={onCartClick}>
          <ShoppingBag size={18} />
          <span>Cart</span>
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}