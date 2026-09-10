import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  MapPin, 
  ShoppingBag, 
  Bike, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function OrderSuccessModal({
  isOpen,
  onClose,
  order,
  payment,
}) {
  if (!isOpen || !order) return null;

  const items = order.items || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="success-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Animated Check Icon */}
        <div className="success-icon-wrapper">
          <CheckCircle2 size={46} strokeWidth={2.2} />
        </div>

        <span style={{ 
          background: '#d3f9d8', 
          color: '#2b8a3e', 
          fontSize: '0.78rem', 
          fontWeight: 800, 
          padding: '4px 12px', 
          borderRadius: 20, 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: 4,
          marginBottom: '0.65rem'
        }}>
          <Sparkles size={14} /> ORDER CONFIRMED
        </span>

        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1e2229', marginBottom: '0.25rem' }}>
          Thank you for your order!
        </h2>

        <p style={{ fontSize: '0.88rem', color: '#686b78', marginBottom: '1.25rem' }}>
          Order <strong>#ORD-{order.id}</strong> placed with <strong>{order.restaurantName}</strong> ({order.restaurantCity})
        </p>

        {/* Payment Transaction Receipt */}
        {payment && (
          <div style={{
            background: '#ebfbee',
            border: '1px solid #b2f2bb',
            borderRadius: 14,
            padding: '0.75rem 1rem',
            textAlign: 'left',
            fontSize: '0.82rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#2b8a3e', display: 'block', fontWeight: 600 }}>
                Transaction ID: {payment.transactionId}
              </span>
              <strong style={{ color: '#2b8a3e', fontSize: '0.85rem' }}>
                Paid via {payment.paymentMethod} • ₹{payment.amount}
              </strong>
            </div>
            <span style={{ background: '#2b8a3e', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 12 }}>
              PAID
            </span>
          </div>
        )}

        {/* ETA & Status Banner */}
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: 16,
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#e7f5ff',
              color: '#1864ab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bike size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#868e96', display: 'block' }}>
                Estimated Delivery
              </span>
              <strong style={{ fontSize: '1rem', color: '#1e2229' }}>
                {order.estimatedDeliveryMinutes || 25} Minutes
              </strong>
            </div>
          </div>

          <div style={{
            background: '#fff3bf',
            color: '#d9480f',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase'
          }}>
            {order.status}
          </div>
        </div>

        {/* Delivery Details */}
        <div style={{
          background: '#ffffff',
          border: '1px dashed #ced4da',
          borderRadius: 14,
          padding: '0.85rem 1rem',
          textAlign: 'left',
          fontSize: '0.82rem',
          color: '#495057',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6rem',
          marginBottom: '1.25rem'
        }}>
          <MapPin size={16} color="#fc8019" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: '#1e2229', display: 'block', marginBottom: 2 }}>
              Delivering to
            </strong>
            <span>{order.deliveryAddress}</span>
          </div>
        </div>

        {/* Itemized Snapshot */}
        <div style={{
          background: '#f8f9fa',
          borderRadius: 14,
          padding: '0.85rem 1rem',
          textAlign: 'left',
          marginBottom: '1.5rem',
          fontSize: '0.82rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#495057', marginBottom: '0.5rem' }}>
            <ShoppingBag size={14} />
            <span>Items Ordered ({items.length})</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {items.map((i) => (
              <div key={i.id || i.menuItemId} style={{ display: 'flex', justifyContent: 'space-between', color: '#686b78' }}>
                <span>{i.quantity}x {i.itemName}</span>
                <span style={{ fontWeight: 700, color: '#1e2229' }}>₹{i.totalPrice}</span>
              </div>
            ))}
          </div>

          <div style={{
            borderTop: '1px solid #dee2e6',
            marginTop: '0.65rem',
            paddingTop: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.92rem',
            fontWeight: 800,
            color: '#1e2229'
          }}>
            <span>Total Paid / Payable</span>
            <span style={{ color: '#fc8019', fontSize: '1.05rem' }}>₹{order.totalAmount}</span>
          </div>
        </div>

        {/* Close / Done Button */}
        <button
          onClick={onClose}
          className="cart-checkout-btn"
          style={{ justifyContent: 'center', gap: '0.5rem' }}
        >
          <span>Back to Restaurants</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
