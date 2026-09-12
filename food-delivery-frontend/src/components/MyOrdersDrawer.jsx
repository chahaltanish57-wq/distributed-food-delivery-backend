import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  X, 
  Navigation, 
  RotateCcw, 
  Receipt, 
  Clock, 
  Store, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { getCustomerOrders } from '../api';

export default function MyOrdersDrawer({ isOpen, onClose, onTrackOrder, onReorder, user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCustomerOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load customer orders:', err);
      setError('Could not load order history. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'DELIVERED':
        return 'status-badge delivered';
      case 'OUT_FOR_DELIVERY':
        return 'status-badge out-for-delivery';
      case 'READY_FOR_PICKUP':
      case 'PREPARING':
        return 'status-badge preparing';
      case 'ORDER_PLACED':
      case 'RESTAURANT_ACCEPTED':
        return 'status-badge placed';
      case 'CANCELLED':
      case 'PAYMENT_FAILED':
        return 'status-badge cancelled';
      default:
        return 'status-badge';
    }
  };

  const isActiveOrder = (status) => {
    return ['ORDER_PLACED', 'RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(status);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="orders-drawer-backdrop" onClick={onClose}>
      <div className="orders-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="orders-drawer-header">
          <div className="orders-drawer-title-row">
            <div className="orders-drawer-icon-box">
              <ShoppingBag size={22} color="#fc8019" />
            </div>
            <div>
              <h2 className="orders-drawer-title">My Orders</h2>
              <span className="orders-drawer-sub">
                {orders.length} {orders.length === 1 ? 'order' : 'orders'} placed
              </span>
            </div>
          </div>
          <button className="orders-drawer-close-btn" onClick={onClose} title="Close drawer">
            <X size={20} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="orders-drawer-body">
          {loading ? (
            <div className="orders-loading-state">
              <div className="spinner"></div>
              <p>Fetching your order history...</p>
            </div>
          ) : error ? (
            <div className="orders-error-state">
              <AlertCircle size={36} color="#e03131" />
              <h4>Oops!</h4>
              <p>{error}</p>
              <button className="orders-retry-btn" onClick={loadOrders}>
                <RotateCcw size={14} /> Retry
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="orders-empty-state">
              <ShoppingBag size={48} color="#adb5bd" />
              <h3>No Orders Found Yet</h3>
              <p>Explore authentic restaurants in Noida and Dehradun and enjoy hot meals delivered to your doorstep.</p>
              <button className="orders-browse-btn" onClick={onClose}>
                Browse Food Near You
              </button>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => {
                const active = isActiveOrder(order.status);
                const isExpanded = expandedOrderId === order.id;

                return (
                  <div key={order.id} className={`order-history-card ${active ? 'active-border' : ''}`}>
                    {/* Card Top Row */}
                    <div className="order-card-header">
                      <div className="order-id-meta">
                        <span className="order-number">#ORD-{order.id}</span>
                        <span className="order-date">{formatDate(order.createdAt)}</span>
                      </div>
                      <span className={getStatusBadgeClass(order.status)}>
                        {order.status?.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Restaurant Info */}
                    <div className="order-restaurant-row">
                      <Store size={18} color="#fc8019" className="rest-icon" />
                      <div>
                        <h4 className="order-rest-name">{order.restaurantName || 'Restaurant'}</h4>
                        <p className="order-rest-address">{order.deliveryAddress || 'Standard Delivery'}</p>
                      </div>
                    </div>

                    {/* Items Accordion Summary */}
                    <div className="order-items-snippet">
                      <div 
                        className="order-items-toggle-row"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      >
                        <span className="order-items-count">
                          {order.items?.length || 1} {(order.items?.length || 1) === 1 ? 'item' : 'items'}
                        </span>
                        <div className="order-items-arrow">
                          <span>{isExpanded ? 'Hide items' : 'View items'}</span>
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </div>
                      </div>

                      {/* Expanded Items Breakdown */}
                      {isExpanded && order.items && (
                        <div className="order-expanded-items">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="order-item-detail-row">
                              <span className="item-name-qty">
                                {item.quantity}x {item.menuItemName || 'Dish Item'}
                              </span>
                              <span className="item-price">₹{Number(item.subtotal || item.unitPrice * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bill Amount & Actions */}
                    <div className="order-card-footer">
                      <div className="order-total-box">
                        <span className="total-label">Total Paid</span>
                        <strong className="total-amount">₹{Number(order.totalAmount).toFixed(2)}</strong>
                      </div>

                      <div className="order-card-actions">
                        {/* Live Tracking Action for Active Orders */}
                        {active && (
                          <button 
                            className="order-action-btn track-btn"
                            onClick={() => {
                              onTrackOrder(order.id);
                              onClose();
                            }}
                          >
                            <Navigation size={14} />
                            <span>Track Live</span>
                          </button>
                        )}

                        {/* 1-Click Reorder Action */}
                        <button 
                          className="order-action-btn reorder-btn"
                          onClick={() => {
                            if (onReorder) {
                              onReorder(order);
                              onClose();
                            }
                          }}
                          title="Add these dishes back to cart"
                        >
                          <RotateCcw size={14} />
                          <span>Reorder</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
