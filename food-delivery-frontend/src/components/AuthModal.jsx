import React, { useState } from 'react';
import { X, Lock, Mail, User, Phone, MapPin, Sparkles, AlertCircle } from 'lucide-react';
import { login, register } from '../api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [tab, setTab] = useState('LOGIN'); // 'LOGIN' or 'REGISTER'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  if (!isOpen) return null;

  const handleFillDemo = () => {
    setEmail('customer@swiggy.com');
    setPassword('password123');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'LOGIN') {
        const data = await login(email, password);
        onAuthSuccess(data);
        onClose();
      } else {
        const data = await register({ fullName, email, phone, password, address });
        onAuthSuccess(data);
        onClose();
      }
    } catch (err) {
      console.error('Auth error:', err);
      const msg = err.response?.data?.message || 'Authentication failed. Please check details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '440px', padding: '2rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>
            {tab === 'LOGIN' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e9ecef', marginBottom: '1.5rem' }}>
          <button
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'none',
              border: 'none',
              borderBottom: tab === 'LOGIN' ? '3px solid #fc8019' : '3px solid transparent',
              fontWeight: 700,
              color: tab === 'LOGIN' ? '#fc8019' : '#868e96',
              cursor: 'pointer',
            }}
            onClick={() => { setTab('LOGIN'); setError(null); }}
          >
            Sign In
          </button>
          <button
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'none',
              border: 'none',
              borderBottom: tab === 'REGISTER' ? '3px solid #fc8019' : '3px solid transparent',
              fontWeight: 700,
              color: tab === 'REGISTER' ? '#fc8019' : '#868e96',
              cursor: 'pointer',
            }}
            onClick={() => { setTab('REGISTER'); setError(null); }}
          >
            Sign Up
          </button>
        </div>

        {/* Demo Account Button for 1-click test */}
        {tab === 'LOGIN' && (
          <div style={{ marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={handleFillDemo}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                border: '1px dashed #fc8019',
                background: '#fff9f2',
                color: '#fc8019',
                fontWeight: 700,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={16} />
              <span>Fill Demo Credentials (1-Click)</span>
            </button>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffe3e3', color: '#c92a2a', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.88rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {tab === 'REGISTER' && (
            <>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#495057', display: 'block', marginBottom: '0.35rem' }}>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#adb5bd' }} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: 8, border: '1px solid #ced4da', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#495057', display: 'block', marginBottom: '0.35rem' }}>Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#adb5bd' }} />
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: 8, border: '1px solid #ced4da', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#495057', display: 'block', marginBottom: '0.35rem' }}>Delivery Address</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#adb5bd' }} />
                  <input
                    type="text"
                    required
                    placeholder="Flat / House No, Street, Landmark"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: 8, border: '1px solid #ced4da', outline: 'none' }}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#495057', display: 'block', marginBottom: '0.35rem' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#adb5bd' }} />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: 8, border: '1px solid #ced4da', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#495057', display: 'block', marginBottom: '0.35rem' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#adb5bd' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: 8, border: '1px solid #ced4da', outline: 'none' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              background: '#fc8019',
              color: '#ffffff',
              border: 'none',
              padding: '0.8rem',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(252, 128, 25, 0.3)',
            }}
          >
            {loading ? 'Please wait...' : tab === 'LOGIN' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}