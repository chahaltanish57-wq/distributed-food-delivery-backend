import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Phone, 
  FileText, 
  CreditCard, 
  ShieldCheck, 
  ArrowRight, 
  Clock, 
  Check,
  Building
} from 'lucide-react';

export default function CheckoutModal({
  isOpen,
  onClose,
  cart,
  user,
  onConfirmOrder,
}) {
  if (!isOpen || !cart) return null;

  const city = cart.city || 'Noida';

  const defaultAddresses = city === 'Dehradun' ? [
    { label: 'Home', address: 'Villa 8, Jakhan, Rajpur Road, Dehradun - 248001', lat: 30.3421, lng: 78.0583 },
    { label: 'Work', address: 'Clock Tower Square, Paltan Bazaar, Dehradun - 248001', lat: 30.3244, lng: 78.0418 },
    { label: 'Other', address: 'Foothills Cottage, Dakpatti, Dehradun - 248009', lat: 30.3812, lng: 78.0891 }
  ] : [
    { label: 'Home', address: 'Tower 4, Flat 302, Logix Cyber Park, Sector 62, Noida - 201309', lat: 28.6280, lng: 77.3649 },
    { label: 'Work', address: 'Suite 12, Wave Silver Tower, Sector 18, Noida - 201301', lat: 28.5708, lng: 77.3219 },
    { label: 'Other', address: 'House 24, Brahmaputra Complex, Sector 29, Noida - 201303', lat: 28.5672, lng: 77.3342 }
  ];

  const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);
  const [customAddress, setCustomAddress] = useState(defaultAddresses[0].address);
  const [phone, setPhone] = useState(user?.phone || '+91 98765 43210');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSelectAddress = (idx) => {
    setSelectedAddressIndex(idx);
    setCustomAddress(defaultAddresses[idx].address);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customAddress.trim()) {
      setError('Please provide a delivery address.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const activeAddr = defaultAddresses[selectedAddressIndex];
    let lat = activeAddr?.lat;
    let lng = activeAddr?.lng;

    if (!lat || !lng) {
      lat = city === 'Dehradun' ? 30.3421 : 28.5708;
      lng = city === 'Dehradun' ? 78.0583 : 77.3219;
    }

    try {
      await onConfirmOrder({
        deliveryAddress: customAddress.trim(),
        deliveryLatitude: lat,
        deliveryLongitude: lng,
        contactPhone: phone.trim(),
        specialInstructions: specialInstructions.trim(),
      });
    } catch (err) {
      console.error('Order submission error:', err);
      setError(err.response?.data?.message || 'Failed to place order. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="checkout-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e2229' }}>
              Checkout & Delivery
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#686b78', marginTop: '2px' }}>
              Ordering from <strong style={{ color: '#343a40' }}>{cart.restaurantName}</strong> ({cart.city})
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem 1.75rem' }}>
          
          {error && (
            <div style={{ background: '#ffe3e3', color: '#c92a2a', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.85rem', marginBottom: '1.25rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* 1. Delivery Address Section */}
          <div className="checkout-section">
            <label className="checkout-label">
              <MapPin size={15} color="#fc8019" />
              <span>Select Delivery Address in {city}</span>
            </label>

            <div className="address-grid">
              {defaultAddresses.map((addr, idx) => (
                <button
                  key={addr.label}
                  type="button"
                  className={`address-pill ${selectedAddressIndex === idx ? 'selected' : ''}`}
                  onClick={() => handleSelectAddress(idx)}
                >
                  <Building size={14} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '0.85rem' }}>{addr.label}</strong>
                    <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>{addr.address}</span>
                  </div>
                  {selectedAddressIndex === idx && <Check size={16} color="#fc8019" />}
                </button>
              ))}
            </div>

            <textarea
              className="checkout-textarea"
              placeholder="Or type full street address, landmark, flat number..."
              value={customAddress}
              onChange={(e) => {
                setCustomAddress(e.target.value);
                setSelectedAddressIndex(-1);
              }}
              required
            />
          </div>

          {/* 2. Contact Phone & Delivery Note */}
          <div className="checkout-section">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="checkout-label">
                  <Phone size={15} color="#0f8a65" />
                  <span>Contact Phone</span>
                </label>
                <input
                  type="text"
                  className="checkout-input"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="checkout-label">
                  <Clock size={15} color="#0077b6" />
                  <span>Est. Delivery</span>
                </label>
                <div style={{ padding: '0.65rem 1rem', background: '#e7f5ff', border: '1px solid #a5d8ff', borderRadius: 12, fontSize: '0.88rem', fontWeight: 700, color: '#1864ab' }}>
                  ⚡ 22 - 25 mins
                </div>
              </div>
            </div>

            <div style={{ marginTop: '0.85rem' }}>
              <label className="checkout-label">
                <FileText size={15} color="#868e96" />
                <span>Special Instructions (Optional)</span>
              </label>
              <input
                type="text"
                className="checkout-input"
                placeholder="e.g. Please leave package at the door, avoid ringing bell"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
              />
            </div>
          </div>

          {/* 3. Payment Method Simulation Preview */}
          <div className="checkout-section">
            <label className="checkout-label">
              <CreditCard size={15} color="#5c7cfa" />
              <span>Payment Option</span>
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.15rem',
              borderRadius: 14,
              border: '1.5px solid #b197fc',
              background: '#f8f0fc'
            }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#5f3dc4', display: 'block' }}>
                  Cash on Delivery / Pay on Delivery (UPI)
                </strong>
                <span style={{ fontSize: '0.78rem', color: '#7048e8' }}>
                  Pay via Cash, UPI QR code, or Cards upon delivery
                </span>
              </div>
              <span style={{ background: '#7048e8', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6 }}>
                SELECTED
              </span>
            </div>
          </div>

          {/* 4. Bill Summary */}
          <div className="cart-bill-box" style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: '#868e96' }}>
              Order Breakdown
            </h4>

            <div className="cart-bill-row">
              <span>Item Total ({cart.totalItemCount} items)</span>
              <span style={{ fontWeight: 700, color: '#1e2229' }}>₹{cart.itemTotal}</span>
            </div>

            <div className="cart-bill-row">
              <span>Delivery Fee</span>
              <span style={{ fontWeight: 700, color: cart.deliveryFee === 0 ? '#2b8a3e' : '#1e2229' }}>
                {cart.deliveryFee === 0 ? 'FREE' : `₹${cart.deliveryFee}`}
              </span>
            </div>

            <div className="cart-bill-row">
              <span>Taxes & GST (5%)</span>
              <span style={{ fontWeight: 700, color: '#1e2229' }}>₹{cart.gst}</span>
            </div>

            <div className="cart-bill-total">
              <div>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e2229', display: 'block' }}>
                  GRAND TOTAL
                </span>
                <span style={{ fontSize: '0.72rem', color: '#868e96' }}>
                  Payable upon delivery or online
                </span>
              </div>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fc8019' }}>
                ₹{cart.grandTotal}
              </span>
            </div>
          </div>

          {/* 5. Place Order Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="cart-checkout-btn"
            style={{ opacity: isSubmitting ? 0.7 : 1 }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.9, display: 'block' }}>
                Total to Pay
              </span>
              <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                ₹{cart.grandTotal}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 800 }}>
              <span>{isSubmitting ? 'Placing Order...' : 'Confirm & Place Order'}</span>
              {!isSubmitting && <ArrowRight size={18} />}
            </div>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#868e96', marginTop: '0.85rem' }}>
            <ShieldCheck size={15} color="#0f8a65" />
            <span>Safe & Contactless Food Delivery</span>
          </div>
        </form>
      </div>
    </div>
  );
}
