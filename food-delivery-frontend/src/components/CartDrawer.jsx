import React from 'react';
import { 
  X, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowRight, 
  ShieldCheck, 
  MapPin, 
  Bike,
  Sparkles
} from 'lucide-react';

export default function CartDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onClearCart,
  onCheckout,
}) {
  if (!isOpen) return null;

  const items = cart?.items || [];
  const itemCount = cart?.totalItemCount || 0;
  const itemTotal = cart?.itemTotal || 0;
  const deliveryFee = cart?.deliveryFee || 0;
  const gst = cart?.gst || 0;
  const grandTotal = cart?.grandTotal || 0;
  const freeDeliveryThreshold = 500;
  const amountNeededForFreeDelivery = Math.max(0, freeDeliveryThreshold - itemTotal);

  return (
    <div className="cart-drawer-overlay" onClick={onClose}>
      <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
        
        {/* Drawer Header */}
        <div className="cart-drawer-header">
          <div className="cart-drawer-title-group">
            <div className="cart-drawer-icon">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e2229' }}>
                Your Cart
              </h2>
              {cart?.restaurantName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#686b78', marginTop: '2px' }}>
                  <span style={{ fontWeight: 700, color: '#343a40' }}>
                    {cart.restaurantName}
                  </span>
                  {cart?.city && (
                    <>
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', color: '#fc8019', fontWeight: 600 }}>
                        <MapPin size={12} style={{ marginRight: 2 }} />
                        {cart.city}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <button className="modal-close-btn" onClick={onClose} title="Close Cart">
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="cart-drawer-body">
          {items.length === 0 ? (
            <div className="cart-empty-state">
              <div className="cart-empty-icon">
                <ShoppingBag size={44} strokeWidth={1.5} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e2229' }}>
                Your cart is empty
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#868e96', maxWidth: 280, lineHeight: 1.5 }}>
                Explore authentic eateries in Noida & Dehradun and add delicious dishes to your order!
              </p>
              <button
                onClick={onClose}
                className="filter-btn active"
                style={{ marginTop: '0.5rem', padding: '0.65rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Browse Restaurants
              </button>
            </div>
          ) : (
            <>
              {/* Free Delivery Upsell Banner */}
              {amountNeededForFreeDelivery > 0 ? (
                <div className="cart-banner cart-banner-amber">
                  <Sparkles size={16} color="#d9480f" style={{ flexShrink: 0 }} />
                  <span>
                    Add items worth <strong>₹{amountNeededForFreeDelivery.toFixed(0)}</strong> more to unlock <strong>FREE Delivery</strong>!
                  </span>
                </div>
              ) : (
                <div className="cart-banner cart-banner-green">
                  <Bike size={16} color="#2b8a3e" style={{ flexShrink: 0 }} />
                  <span>
                    🎉 You've unlocked <strong>FREE Delivery</strong> for this order!
                  </span>
                </div>
              )}

              {/* Items List */}
              <div className="cart-item-list">
                {items.map((item) => (
                  <div key={item.menuItemId} className="cart-item-row">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', maxWidth: '60%' }}>
                      <span className={item.isVegetarian ? 'veg-icon' : 'nonveg-icon'} style={{ marginTop: '3px' }} />
                      <div>
                        <p style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e2229', lineHeight: 1.3 }}>
                          {item.name}
                        </p>
                        <p style={{ fontSize: '0.8rem', color: '#868e96', marginTop: '2px' }}>
                          ₹{Math.round(item.price)} each
                        </p>
                      </div>
                    </div>

                    {/* Quantity Pill & Item Subtotal */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className="qty-pill">
                        <button
                          onClick={() => onUpdateQuantity(item.menuItemId, -1)}
                          className="qty-pill-btn"
                          title="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="qty-pill-count">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.menuItemId, 1)}
                          className="qty-pill-btn"
                          title="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e2229', minWidth: '55px', textAlign: 'right' }}>
                        ₹{Math.round(item.subtotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bill Details Box */}
              <div className="cart-bill-box">
                <h4 style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#868e96' }}>
                  Bill Details
                </h4>

                <div className="cart-bill-row">
                  <span>Item Total ({itemCount} {itemCount === 1 ? 'dish' : 'dishes'})</span>
                  <span style={{ fontWeight: 700, color: '#1e2229' }}>₹{itemTotal}</span>
                </div>

                <div className="cart-bill-row">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    Delivery Partner Fee
                    {deliveryFee === 0 && (
                      <span style={{ background: '#d3f9d8', color: '#2b8a3e', fontSize: '0.72rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px' }}>
                        FREE
                      </span>
                    )}
                  </span>
                  <span style={{ fontWeight: 700, color: deliveryFee === 0 ? '#2b8a3e' : '#1e2229' }}>
                    {deliveryFee === 0 ? '₹0' : `₹${deliveryFee}`}
                  </span>
                </div>

                <div className="cart-bill-row">
                  <span>Govt Taxes & GST (5%)</span>
                  <span style={{ fontWeight: 700, color: '#1e2229' }}>₹{gst}</span>
                </div>

                <div className="cart-bill-total">
                  <div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e2229', display: 'block' }}>
                      TO PAY
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#868e96' }}>
                      Includes all applicable taxes
                    </span>
                  </div>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fc8019' }}>
                    ₹{grandTotal}
                  </span>
                </div>
              </div>

              {/* Trust Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#868e96', padding: '0.5rem 0' }}>
                <ShieldCheck size={16} color="#0f8a65" />
                <span>100% Hygienic Delivery Guaranteed</span>
              </div>
            </>
          )}
        </div>

        {/* Drawer Sticky Footer */}
        {items.length > 0 && (
          <div className="cart-drawer-footer">
            <button
              onClick={onCheckout}
              className="cart-checkout-btn"
            >
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.9, display: 'block' }}>
                  Grand Total
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                  ₹{grandTotal}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 800 }}>
                <span>Proceed to Checkout</span>
                <ArrowRight size={18} />
              </div>
            </button>

            <button
              onClick={onClearCart}
              className="cart-clear-btn"
            >
              <Trash2 size={13} />
              <span>Clear Cart</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
