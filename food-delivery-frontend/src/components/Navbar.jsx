import React, { useState } from 'react';
import { 
  UtensilsCrossed, 
  MapPin, 
  Search, 
  ShoppingBag, 
  User, 
  LogOut, 
  ChevronDown, 
  ChefHat, 
  Bike, 
  Navigation,
  Sun,
  Moon,
  Receipt,
  Home
} from 'lucide-react';

export default function Navbar({
  user,
  cartCount,
  searchQuery,
  onSearchChange,
  onCartClick,
  onOpenAuth,
  onLogout,
  selectedCity,
  onSelectCity,
  viewMode,
  onToggleViewMode,
  onSetViewMode,
  activeTrackingOrderId,
  theme,
  onToggleTheme,
  onOpenOrders,
  onGoHome
}) {
  const [showCityMenu, setShowCityMenu] = useState(false);

  const handleHomeClick = () => {
    if (onGoHome) {
      onGoHome();
    } else if (onSetViewMode) {
      onSetViewMode('CUSTOMER');
    }
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cities = [
    { name: 'Noida', area: 'Sector 18 Market' },
    { name: 'Dehradun', area: 'Rajpur Road' }
  ];

  return (
    <header className="navbar">
      <div className="nav-left">
        <div 
          className="brand-logo" 
          onClick={handleHomeClick}
          style={{ cursor: 'pointer' }}
          title="Swiggy - Back to Home & Restaurant Menus"
        >
          <UtensilsCrossed size={28} />
          <span>Swiggy Distributed</span>
        </div>

        {/* Explicit Home Button */}
        <button 
          className={`nav-home-btn ${viewMode === 'CUSTOMER' ? 'active' : ''}`}
          onClick={handleHomeClick}
          title="Return directly to Restaurant Menus & Storefront"
        >
          <Home size={17} />
          <span>Home</span>
        </button>

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
        {/* Role & Simulator Portals Segmented Pill */}
        <div className="nav-portal-group">
          {/* Kitchen Portal Switcher */}
          <button 
            className={`portal-segment-btn ${viewMode === 'KITCHEN' ? 'active' : ''}`}
            onClick={() => onSetViewMode ? onSetViewMode(viewMode === 'KITCHEN' ? 'CUSTOMER' : 'KITCHEN') : onToggleViewMode()}
            title={viewMode === 'KITCHEN' ? 'Switch back to Customer Storefront' : 'Open Restaurant Kitchen Display System'}
          >
            <ChefHat size={16} />
            <span>Kitchen</span>
          </button>

          {/* Driver Portal Switcher */}
          <button 
            className={`portal-segment-btn ${viewMode === 'DRIVER' ? 'active' : ''}`}
            onClick={() => onSetViewMode ? onSetViewMode(viewMode === 'DRIVER' ? 'CUSTOMER' : 'DRIVER') : null}
            title={viewMode === 'DRIVER' ? 'Switch back to Customer Storefront' : 'Open Driver Dispatch & Fleet Simulator'}
          >
            <Bike size={16} />
            <span>Driver</span>
          </button>

          {/* Live Order Tracking Switcher */}
          {activeTrackingOrderId && (
            <button 
              className={`portal-segment-btn ${viewMode === 'TRACKING' ? 'active' : ''}`}
              onClick={() => onSetViewMode ? onSetViewMode(viewMode === 'TRACKING' ? 'CUSTOMER' : 'TRACKING') : null}
              title="Live Order Tracking Map"
            >
              <Navigation size={15} />
              <span>Track</span>
            </button>
          )}
        </div>

        {/* Customer Actions & Global Utilities */}
        <div className="nav-actions-group">
          {/* My Orders Drawer Button */}
          <button 
            className="nav-orders-btn"
            onClick={onOpenOrders}
            title="View Past and Active Orders"
          >
            <Receipt size={16} />
            <span>My Orders</span>
          </button>

          {/* Dark Mode Theme Toggle */}
          <button 
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Night Theme"}
          >
            {theme === 'dark' ? <Sun size={17} color="#ffd43b" /> : <Moon size={17} color="#495057" />}
          </button>

          {/* Cart Section */}
          {viewMode === 'CUSTOMER' && (
            <button className="cart-btn" onClick={onCartClick}>
              <ShoppingBag size={17} />
              <span>Cart</span>
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>
          )}

          {/* Auth Section */}
          {user ? (
            <div className="nav-user-profile">
              <div className="user-avatar-badge">
                <div className="user-avatar-initial">
                  {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                </div>
                <span className="user-firstname">Hi, {user.fullName.split(' ')[0]}</span>
              </div>

              <button
                onClick={onLogout}
                title="Sign Out"
                className="user-logout-btn"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="nav-signin-btn"
            >
              <User size={16} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}