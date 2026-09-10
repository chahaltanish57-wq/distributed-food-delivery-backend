import React, { useEffect, useState } from 'react';
import { X, Star, Clock, Check } from 'lucide-react';
import { getRestaurantMenu } from '../api';

export default function MenuModal({ restaurant, onClose, onAddToCart }) {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [addedItemIds, setAddedItemIds] = useState(new Set());

  useEffect(() => {
    if (!restaurant) return;
    setLoading(true);
    getRestaurantMenu(restaurant.id)
      .then((items) => setMenuItems(items || []))
      .catch((err) => console.error('Failed to load menu:', err))
      .finally(() => setLoading(false));
  }, [restaurant]);

  if (!restaurant) return null;

  const categories = ['ALL', ...new Set(menuItems.map((item) => item.category))];

  const filteredItems = menuItems.filter((item) => {
    if (selectedCategory === 'ALL') return true;
    return item.category === selectedCategory;
  });

  const handleAdd = (item) => {
    onAddToCart(item);
    setAddedItemIds((prev) => new Set(prev).add(item.id));
    setTimeout(() => {
      setAddedItemIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 1200);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              {restaurant.name}
            </h2>
            <p style={{ color: '#686b78', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
              {restaurant.cuisineType} • {restaurant.city} ({restaurant.address})
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span className="rating-badge">
                <Star size={12} fill="#ffffff" /> {restaurant.rating}
              </span>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#495057', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={14} /> {restaurant.deliveryTimeMins} mins delivery
              </span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Categories Bar */}
        <div style={{ padding: '1rem 1.75rem 0', display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Items List */}
        <div className="menu-list">
          {loading ? (
            <p style={{ textAlign: 'center', color: '#868e96', padding: '2rem' }}>Loading menu items...</p>
          ) : filteredItems.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#868e96', padding: '2rem' }}>No dishes found in this category.</p>
          ) : (
            filteredItems.map((item) => {
              const isAdded = addedItemIds.has(item.id);
              return (
                <div key={item.id} className="menu-item-card">
                  <div className="menu-item-info">
                    <span className={item.isVegetarian ? 'veg-icon' : 'nonveg-icon'} />
                    <h4 className="item-name">{item.name}</h4>
                    <p className="item-price" style={{ color: '#fc8019', fontWeight: 800 }}>
                      ₹{Math.round(item.price)}
                    </p>
                    <p className="item-desc">{item.description}</p>
                  </div>

                  <div className="menu-item-action">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="item-img" />
                    ) : (
                      <div style={{ width: 110, height: 95, borderRadius: 12, background: '#e9ecef' }} />
                    )}
                    <button
                      className="add-item-btn"
                      onClick={() => handleAdd(item)}
                      style={{
                        background: isAdded ? '#0f8a65' : '#ffffff',
                        color: isAdded ? '#ffffff' : '#0f8a65',
                      }}
                    >
                      {isAdded ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Check size={14} /> ADDED
                        </span>
                      ) : (
                        '+ ADD'
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}