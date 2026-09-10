import React, { useState } from 'react';
import { 
  X, 
  CreditCard, 
  Smartphone, 
  Building2, 
  Banknote, 
  ShieldCheck, 
  Check, 
  ArrowRight,
  Sparkles,
  Lock
} from 'lucide-react';
import { processPayment } from '../api';

export default function PaymentModal({
  isOpen,
  onClose,
  order,
  onPaymentSuccess,
}) {
  if (!isOpen || !order) return null;

  const [activeTab, setActiveTab] = useState('UPI');
  const [upiId, setUpiId] = useState('tanish@okaxis');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('888');
  const [cardName, setCardName] = useState('John Doe');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  
  // Distributed Idempotency Key generated once per payment attempt session
  const [idempotencyKey] = useState(() => 
    'IDEMP_' + Math.random().toString(36).substring(2, 9).toUpperCase() + '_' + Date.now()
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState(null);

  const handlePay = async () => {
    setIsProcessing(true);
    setError(null);
    setProcessingStatus('Securing 256-bit encrypted connection...');

    let method = 'UPI';
    let details = upiId;

    if (activeTab === 'CARD') {
      method = 'CREDIT_CARD';
      details = `Card ending in ${cardNumber.slice(-4)}`;
    } else if (activeTab === 'NET_BANKING') {
      method = 'NET_BANKING';
      details = selectedBank;
    } else if (activeTab === 'COD') {
      method = 'CASH_ON_DELIVERY';
      details = 'Cash / UPI upon delivery';
    }

    try {
      // Step 1: Simulated verification
      await new Promise((r) => setTimeout(r, 600));
      setProcessingStatus('Authorizing payment with bank gateway...');

      // Step 2: Call backend payment API with Redis Idempotency Lock
      const response = await processPayment({
        orderId: order.id,
        idempotencyKey,
        paymentMethod: method,
        amount: order.totalAmount,
        paymentDetails: details,
      });

      // Step 3: Success
      setProcessingStatus('Payment Authorized! Confirming order...');
      await new Promise((r) => setTimeout(r, 500));
      
      setIsProcessing(false);
      onPaymentSuccess(response);
    } catch (err) {
      console.error('Payment processing failed:', err);
      setIsProcessing(false);
      setError(err.response?.data?.message || 'Payment failed. Please try another method.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="payment-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Processing Loading Overlay */}
        {isProcessing && (
          <div className="processing-overlay">
            <div className="spinner-circle" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e2229' }}>
              Processing Payment
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#686b78', maxWidth: 300, marginTop: '4px' }}>
              {processingStatus}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#868e96', marginTop: '1rem' }}>
              <Lock size={13} color="#0f8a65" />
              <span>Do not refresh or press back button</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e2229' }}>
              Complete Payment
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#686b78', marginTop: '2px' }}>
              Order #ORD-{order.id} • Total: <strong style={{ color: '#fc8019' }}>₹{order.totalAmount}</strong>
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={isProcessing}>
            <X size={20} />
          </button>
        </div>

        {/* Payment Tabs */}
        <div className="payment-tabs">
          <button
            className={`payment-tab-btn ${activeTab === 'UPI' ? 'active' : ''}`}
            onClick={() => setActiveTab('UPI')}
          >
            <Smartphone size={16} />
            <span>UPI Options</span>
          </button>

          <button
            className={`payment-tab-btn ${activeTab === 'CARD' ? 'active' : ''}`}
            onClick={() => setActiveTab('CARD')}
          >
            <CreditCard size={16} />
            <span>Cards</span>
          </button>

          <button
            className={`payment-tab-btn ${activeTab === 'NET_BANKING' ? 'active' : ''}`}
            onClick={() => setActiveTab('NET_BANKING')}
          >
            <Building2 size={16} />
            <span>Net Banking</span>
          </button>

          <button
            className={`payment-tab-btn ${activeTab === 'COD' ? 'active' : ''}`}
            onClick={() => setActiveTab('COD')}
          >
            <Banknote size={16} />
            <span>Cash on Delivery</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="payment-tab-body">
          {error && (
            <div style={{ background: '#ffe3e3', color: '#c92a2a', padding: '0.75rem 1rem', borderRadius: 12, fontSize: '0.85rem', marginBottom: '1.25rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* TAB 1: UPI */}
          {activeTab === 'UPI' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="checkout-label">
                  <span>Enter UPI Virtual Address (VPA)</span>
                </label>
                <input
                  type="text"
                  className="checkout-input"
                  placeholder="username@okhdfcbank"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
                
                {/* 1-Click Demo UPI shortcuts */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="demo-chip"
                    onClick={() => setUpiId('demo@okhdfcbank')}
                  >
                    <Sparkles size={12} />
                    <span>Use GPay Demo (demo@okhdfcbank)</span>
                  </button>
                  <button
                    type="button"
                    className="demo-chip"
                    onClick={() => setUpiId('demo@ybl')}
                  >
                    <Sparkles size={12} />
                    <span>Use PhonePe Demo (demo@ybl)</span>
                  </button>
                </div>
              </div>

              <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 14, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e7f5ff', color: '#1864ab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Smartphone size={18} />
                </div>
                <div style={{ fontSize: '0.82rem', color: '#495057' }}>
                  A payment request will be sent to your UPI app. Complete the transaction within 5 minutes.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CREDIT / DEBIT CARD */}
          {activeTab === 'CARD' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label className="checkout-label">
                  <span>Card Number</span>
                </label>
                <input
                  type="text"
                  className="checkout-input"
                  placeholder="4242 •••• •••• 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                />
                <button
                  type="button"
                  className="demo-chip"
                  onClick={() => {
                    setCardNumber('4242 4242 4242 4242');
                    setCardExpiry('12/28');
                    setCardCvv('888');
                    setCardName('John Doe');
                  }}
                >
                  <Sparkles size={12} />
                  <span>Autofill Test Visa Card</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="checkout-label">
                    <span>Cardholder</span>
                  </label>
                  <input
                    type="text"
                    className="checkout-input"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="checkout-label">
                    <span>Expiry</span>
                  </label>
                  <input
                    type="text"
                    className="checkout-input"
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                  />
                </div>
                <div>
                  <label className="checkout-label">
                    <span>CVV</span>
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    className="checkout-input"
                    placeholder="•••"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NET BANKING */}
          {activeTab === 'NET_BANKING' && (
            <div>
              <label className="checkout-label">
                <span>Select Your Bank</span>
              </label>
              <div className="bank-grid">
                {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra', 'Punjab National Bank'].map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={`bank-pill ${selectedBank === b ? 'selected' : ''}`}
                    onClick={() => setSelectedBank(b)}
                  >
                    <span>{b}</span>
                    {selectedBank === b && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: CASH ON DELIVERY */}
          {activeTab === 'COD' && (
            <div style={{ background: '#ebfbee', border: '1px solid #b2f2bb', borderRadius: 16, padding: '1.25rem', textAlign: 'center' }}>
              <Banknote size={36} color="#2b8a3e" style={{ margin: '0 auto 0.5rem' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#2b8a3e', marginBottom: '0.35rem' }}>
                Pay with Cash or UPI upon Delivery
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#2f9e44', maxWidth: 360, margin: '0 auto' }}>
                You can pay in cash or ask the delivery executive to present a QR code to pay via GPay / PhonePe / Paytm on arrival.
              </p>
            </div>
          )}

          {/* Pay Button */}
          <div style={{ marginTop: '1.75rem' }}>
            <button
              onClick={handlePay}
              disabled={isProcessing}
              className="cart-checkout-btn"
            >
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.9, display: 'block' }}>
                  Payable Amount
                </span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                  ₹{order.totalAmount}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 800 }}>
                <span>{activeTab === 'COD' ? 'Confirm Order' : `Pay ₹${order.totalAmount}`}</span>
                <ArrowRight size={18} />
              </div>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#868e96', marginTop: '0.85rem' }}>
              <ShieldCheck size={14} color="#0f8a65" />
              <span>RBI Regulated 256-bit End-to-End Encrypted Gateway</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
