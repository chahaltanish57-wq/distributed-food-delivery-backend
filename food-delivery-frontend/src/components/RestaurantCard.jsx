import React from 'react';
import { Star, Clock } from 'lucide-react';

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
        <div className="card-badge">50% OFF UP TO $10</div>
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
        </div>

        <p className="card-cuisine">{restaurant.cuisineType}</p>
        <p className="card-address">{restaurant.address}</p>
      </div>
    </div>
  );
}