import React from 'react';
import { Star, Clock, MapPin } from 'lucide-react';

export default function RestaurantCard({ restaurant, onClick }) {
  return (
    <div className="restaurant-card" onClick={onClick}>
      <div className="card-img-wrapper">
        <img
          src={restaurant.imageUrl}
          alt={restaurant.name}
          className="card-img"
          loading="lazy"
        />
        <div className="card-badge">FLAT ₹120 OFF ABOVE ₹299</div>
      </div>

      <div className="card-content">
        <h3 className="card-title">{restaurant.name}</h3>
        
        <div className="card-meta">
          <div className="rating-badge">
            <Star size={12} fill="#ffffff" />
            <span>{restaurant.rating}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#495057' }}>
            <Clock size={14} />
            <span>{restaurant.deliveryTimeMins} mins</span>
          </div>
          <span style={{ fontSize: '0.78rem', background: '#e9ecef', color: '#495057', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>
            {restaurant.city}
          </span>
        </div>

        <p className="card-cuisine">{restaurant.cuisineType}</p>
        <p className="card-address">{restaurant.address}</p>
      </div>
    </div>
  );
}