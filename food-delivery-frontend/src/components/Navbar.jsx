import React, { useState } from 'react';
import { UtensilsCrossed, MapPin, Search, ShoppingBag, User, LogOut, ChevronDown } from 'lucide-react';

export default function Navbar({
  user,
  cartCount,
  searchQuery,
  onSearchChange,
  onCartClick,
  onOpenAuth,
  onLogout,
  selectedCity,
  onSelectCity
}) {
  const [showCityMenu, setShowCityMenu] = useState(false);

  const cities = [
    { name: 'Noida', area: 'Sector 18 Market' },
    { name: 'Dehradun', area: 'Rajpur Road' }
  ];

  return (
    <header className="navbar">
      <div className="nav-left">
        <div className="brand-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <UtensilsCrossed size={28} />
          <span>Swiggy Distributed</span>
        </div>

        {/* City Selector Pill */}
        <div style={{ position: 'relative' }}>
          <div
            className="location-pill"
            onClick={() => setShowCityMenu(!showCityMenu)}
            style={{ border: '1px solid #ced4da', background: '#ffffff', cursor: 'pointer' }}
          >
            <MapPin size={16} color="#fc8019" />
            <span><strong>{selectedCity}</strong>, {selectedCity === 'Noida' ? 'Sector 18' : 'Rajpur Road'}</span>
            <ChevronDown size={14} color="#868e96" />
          </div>

          {showCityMenu && (
            <div
              style={{
                position: 'absolute',
                top: '120%',
                left: 0,
                background: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                border: '1px solid #e9ecef',
                width: '230px',
                zIndex: 200,
                padding: '0.5rem 0',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: '#868e96', textTransform: 'uppercase' }}>
                Select Delivery City
              </div>
              {cities.map((c) => (
                <div
                  key={c.name}
                  onClick={() => {
                    onSelectCity(c.name);
                    setShowCityMenu(false);
                  }}
                  style={{
                    padding: '0.65rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    background: selectedCity === c.name ? '#fff3e8' : 'transparent',
                    borderLeft: selectedCity === c.name ? '4px solid #fc8019' : '4px solid transparent',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCity !== c.name) e.currentTarget.style.background = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCity !== c.name) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: selectedCity === c.name ? '#fc8019' : '#212529' }}>
                    {c.name}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#6c757d' }}>{c.area}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="nav-search">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder={`Search in ${selectedCity} restaurants or dishes...`}
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