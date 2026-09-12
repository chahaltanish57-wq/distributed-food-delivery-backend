import React, { useState, useEffect, useRef } from 'react';
import { 
  ChefHat, 
  Clock, 
  Flame, 
  CheckCircle2, 
  AlertCircle, 
  Volume2, 
  VolumeX, 
  RotateCw, 
  ArrowLeft, 
  Timer, 
  User, 
  Phone, 
  MapPin, 
  UtensilsCrossed 
} from 'lucide-react';
import { 
  getKitchenOrders, 
  acceptKitchenOrder, 
  startCookingOrder, 
  markFoodReady, 
  rejectKitchenOrder 
} from '../api';

export default function KitchenDashboard({ restaurants, onBackToStorefront, showToast }) {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(() => {
    return restaurants && restaurants.length > 0 ? restaurants[0].id : null;
  });

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const previousOrderIdsRef = useRef(new Set());

  // Web Audio API Synthesizer for Kitchen Chime (No external files needed)
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5

      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12); // D6

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.log('Audio chime auto-play waiting for user interaction:', e);
    }
  };

  // Fetch active kitchen orders
  const fetchOrders = async (silent = false) => {
    if (!selectedRestaurantId) return;
    if (!silent) setLoading(true);

    try {
      const data = await getKitchenOrders(selectedRestaurantId);
      const incomingList = data || [];
      
      // Detect newly arrived tickets to ring chime
      const currentIds = new Set(incomingList.map(o => o.id));
      const hasNewOrders = incomingList.some(
        o => o.status === 'ORDER_PLACED' && !previousOrderIdsRef.current.has(o.id)
      );

      if (hasNewOrders && previousOrderIdsRef.current.size > 0) {
        playChime();
        if (showToast) showToast('🔔 New kitchen order ticket arrived!');
      }

      previousOrderIdsRef.current = currentIds;
      setOrders(incomingList);
    } catch (err) {
      console.error('Failed to fetch kitchen tickets:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Poll kitchen tickets every 4 seconds
  useEffect(() => {
    fetchOrders(false);
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedRestaurantId]);

  // Order Actions
  const handleAccept = async (orderId) => {
    setActionLoadingId(orderId);
    try {
      await acceptKitchenOrder(orderId);
      if (showToast) showToast(`Order #ORD-${orderId} accepted!`);
      await fetchOrders(true);
    } catch (err) {
      console.error('Failed to accept order:', err);
      if (showToast) showToast('Failed to accept order.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartCooking = async (orderId) => {
    setActionLoadingId(orderId);
    try {
      await startCookingOrder(orderId);
      if (showToast) showToast(`Order #ORD-${orderId} is now cooking!`);
      await fetchOrders(true);
    } catch (err) {
      console.error('Failed to start cooking:', err);
      if (showToast) showToast('Failed to start cooking.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleFoodReady = async (orderId) => {
    setActionLoadingId(orderId);
    try {
      await markFoodReady(orderId);
      if (showToast) showToast(`Order #ORD-${orderId} marked ready for pickup!`);
      await fetchOrders(true);
    } catch (err) {
      console.error('Failed to mark food ready:', err);
      if (showToast) showToast('Failed to update status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (orderId) => {
    if (!window.confirm(`Are you sure you want to reject Order #ORD-${orderId}?`)) return;
    setActionLoadingId(orderId);
    try {
      await rejectKitchenOrder(orderId, 'Kitchen at maximum capacity');
      if (showToast) showToast(`Order #ORD-${orderId} rejected.`);
      await fetchOrders(true);
    } catch (err) {
      console.error('Failed to reject order:', err);
      if (showToast) showToast('Failed to reject order.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter into 3 KDS columns
  const newOrders = orders.filter(o => o.status === 'ORDER_PLACED');
  const inKitchenOrders = orders.filter(o => o.status === 'RESTAURANT_ACCEPTED' || o.status === 'PREPARING');
  const readyOrders = orders.filter(o => o.status === 'READY_FOR_PICKUP');

  const selectedRest = (restaurants || []).find(r => r.id === Number(selectedRestaurantId));

  return (
    <div className="kitchen-kds-container">
      {/* KDS Header */}
      <div className="kitchen-kds-header">
        <div className="kitchen-header-left">
          <button className="kds-back-btn" onClick={onBackToStorefront}>
            <ArrowLeft size={18} />
            <span>Storefront</span>
          </button>
          
          <div className="kds-title-group">
            <div className="kds-badge">
              <ChefHat size={20} color="#fc8019" />
              <span>Kitchen Display System</span>
            </div>
            <h2>Live Order Management</h2>
          </div>
        </div>

        <div className="kitchen-header-right">
          {/* Restaurant Selector Dropdown */}
          <div className="kds-restaurant-select-wrapper">
            <label>Select Restaurant:</label>
            <select
              value={selectedRestaurantId || ''}
              onChange={(e) => setSelectedRestaurantId(Number(e.target.value))}
              className="kds-restaurant-select"
            >
              {(restaurants || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.city})
                </option>
              ))}
            </select>
          </div>

          {/* Sound Toggle */}
          <button 
            className={`kds-sound-toggle ${soundEnabled ? 'active' : ''}`}
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playChime();
            }}
            title={soundEnabled ? 'Chime sound enabled' : 'Chime sound muted'}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <span>{soundEnabled ? 'Sound ON' : 'Muted'}</span>
          </button>

          {/* Manual Refresh */}
          <button 
            className="kds-refresh-btn"
            onClick={() => fetchOrders(false)}
            disabled={loading}
            title="Refresh tickets"
          >
            <RotateCw size={18} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Restaurant Overview Banner */}
      {selectedRest && (
        <div className="kds-restaurant-banner">
          <div className="banner-info">
            <strong>{selectedRest.name}</strong> • <span>{selectedRest.cuisine}</span> • <span style={{ color: '#495057' }}>{selectedRest.city}</span>
          </div>
          <div className="banner-counts">
            <span className="count-pill amber"><strong>{newOrders.length}</strong> New</span>
            <span className="count-pill blue"><strong>{inKitchenOrders.length}</strong> Cooking</span>
            <span className="count-pill green"><strong>{readyOrders.length}</strong> Ready</span>
          </div>
        </div>
      )}

      {/* 3-Column Kanban Board */}
      <div className="kds-kanban-board">
        {/* Column 1: New Orders */}
        <div className="kds-column column-amber">
          <div className="kds-column-header">
            <div className="col-title">
              <span className="status-dot dot-amber"></span>
              <h3>New Incoming Tickets</h3>
            </div>
            <span className="col-counter">{newOrders.length}</span>
          </div>

          <div className="kds-column-content">
            {newOrders.length === 0 ? (
              <div className="kds-empty-state">
                <CheckCircle2 size={36} color="#adb5bd" />
                <p>No new orders waiting</p>
                <small>New orders will chime and appear here live</small>
              </div>
            ) : (
              newOrders.map((order) => (
                <NewOrderTicketCard
                  key={order.id}
                  order={order}
                  loading={actionLoadingId === order.id}
                  onAccept={() => handleAccept(order.id)}
                  onReject={() => handleReject(order.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 2: In Kitchen / Preparing */}
        <div className="kds-column column-blue">
          <div className="kds-column-header">
            <div className="col-title">
              <span className="status-dot dot-blue"></span>
              <h3>In Kitchen / Cooking</h3>
            </div>
            <span className="col-counter">{inKitchenOrders.length}</span>
          </div>

          <div className="kds-column-content">
            {inKitchenOrders.length === 0 ? (
              <div className="kds-empty-state">
                <Flame size={36} color="#adb5bd" />
                <p>No tickets currently cooking</p>
                <small>Accept an incoming ticket to start cooking</small>
              </div>
            ) : (
              inKitchenOrders.map((order) => (
                <InKitchenTicketCard
                  key={order.id}
                  order={order}
                  loading={actionLoadingId === order.id}
                  onStartCooking={() => handleStartCooking(order.id)}
                  onFoodReady={() => handleFoodReady(order.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 3: Ready for Pickup */}
        <div className="kds-column column-green">
          <div className="kds-column-header">
            <div className="col-title">
              <span className="status-dot dot-green"></span>
              <h3>Ready for Pickup</h3>
            </div>
            <span className="col-counter">{readyOrders.length}</span>
          </div>

          <div className="kds-column-content">
            {readyOrders.length === 0 ? (
              <div className="kds-empty-state">
                <UtensilsCrossed size={36} color="#adb5bd" />
                <p>No packed orders waiting</p>
                <small>Completed orders move here for driver handoff</small>
              </div>
            ) : (
              readyOrders.map((order) => (
                <ReadyTicketCard key={order.id} order={order} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 1. New Order Ticket with 3-Minute Auto-Cancellation Countdown
function NewOrderTicketCard({ order, loading, onAccept, onReject }) {
  const [secondsRemaining, setSecondsRemaining] = useState(180);

  useEffect(() => {
    if (!order.createdAt) return;
    const calculate = () => {
      const orderTime = new Date(order.createdAt).getTime();
      const elapsed = Math.floor((Date.now() - orderTime) / 1000);
      const remaining = Math.max(0, 180 - elapsed);
      setSecondsRemaining(remaining);
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [order.createdAt]);

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const isUrgent = secondsRemaining < 60;

  return (
    <div className={`kds-ticket-card ${isUrgent ? 'urgent' : ''}`}>
      <div className="ticket-top">
        <div className="ticket-id">
          <strong>#ORD-{order.id}</strong>
          <span className="ticket-tag new">NEW ORDER</span>
        </div>
        <div className="ticket-amount">₹{order.totalAmount}</div>
      </div>

      {/* 3-Minute Auto-Cancel Timer Badge */}
      <div className={`countdown-bar-wrapper ${isUrgent ? 'critical' : ''}`}>
        <div className="countdown-info">
          <Clock size={13} />
          <span>Auto-cancels in: <strong>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</strong></span>
        </div>
        <div className="countdown-progress-track">
          <div 
            className="countdown-progress-fill" 
            style={{ width: `${(secondsRemaining / 180) * 100}%` }}
          />
        </div>
      </div>

      <div className="ticket-customer">
        <div className="customer-row">
          <User size={14} color="#686b78" />
          <span>{order.customerName || 'Customer'}</span>
        </div>
        {order.contactPhone && (
          <div className="customer-row">
            <Phone size={14} color="#686b78" />
            <span>{order.contactPhone}</span>
          </div>
        )}
      </div>

      <div className="ticket-items-list">
        {(order.items || []).map((item, idx) => (
          <div key={idx} className="ticket-item-row">
            <span className="item-qty">{item.quantity}x</span>
            <span className="item-name">{item.itemName}</span>
            <span className="item-price">₹{item.totalPrice}</span>
          </div>
        ))}
      </div>

      <div className="ticket-actions">
        <button 
          className="kds-btn-reject" 
          onClick={onReject}
          disabled={loading}
        >
          Reject
        </button>
        <button 
          className="kds-btn-accept" 
          onClick={onAccept}
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Accept Order'}
        </button>
      </div>
    </div>
  );
}

// 2. In-Kitchen Ticket (RESTAURANT_ACCEPTED or PREPARING)
function InKitchenTicketCard({ order, loading, onStartCooking, onFoodReady }) {
  const isPreparing = order.status === 'PREPARING';

  return (
    <div className="kds-ticket-card in-prep">
      <div className="ticket-top">
        <div className="ticket-id">
          <strong>#ORD-{order.id}</strong>
          <span className={`ticket-tag ${isPreparing ? 'cooking' : 'accepted'}`}>
            {isPreparing ? 'COOKING' : 'ACCEPTED'}
          </span>
        </div>
        <div className="ticket-amount">₹{order.totalAmount}</div>
      </div>

      <div className="prep-status-indicator">
        {isPreparing ? (
          <div className="prep-msg cooking">
            <Flame size={15} color="#e03131" className="flame-pulse" />
            <span>Chefs are actively preparing this order</span>
          </div>
        ) : (
          <div className="prep-msg accepted">
            <Timer size={15} color="#1971c2" />
            <span>Ticket queued for cooking station</span>
          </div>
        )}
      </div>

      <div className="ticket-customer">
        <div className="customer-row">
          <User size={14} color="#686b78" />
          <span>{order.customerName || 'Customer'}</span>
        </div>
      </div>

      <div className="ticket-items-list">
        {(order.items || []).map((item, idx) => (
          <div key={idx} className="ticket-item-row">
            <span className="item-qty">{item.quantity}x</span>
            <span className="item-name">{item.itemName}</span>
            <span className="item-price">₹{item.totalPrice}</span>
          </div>
        ))}
      </div>

      <div className="ticket-actions">
        {!isPreparing ? (
          <button 
            className="kds-btn-start-cooking" 
            onClick={onStartCooking}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Start Cooking'}
          </button>
        ) : (
          <button 
            className="kds-btn-food-ready" 
            onClick={onFoodReady}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Food Ready for Pickup'}
          </button>
        )}
      </div>
    </div>
  );
}

// 3. Ready Ticket Card
function ReadyTicketCard({ order }) {
  return (
    <div className="kds-ticket-card ready">
      <div className="ticket-top">
        <div className="ticket-id">
          <strong>#ORD-{order.id}</strong>
          <span className="ticket-tag ready">PACKED & READY</span>
        </div>
        <div className="ticket-amount">₹{order.totalAmount}</div>
      </div>

      <div className="ready-alert">
        <CheckCircle2 size={18} color="#2b8a3e" />
        <div>
          <strong>Ready for Driver Pickup</strong>
          <p>Order is packed and waiting on pickup shelf</p>
        </div>
      </div>

      <div className="ticket-items-list">
        {(order.items || []).map((item, idx) => (
          <div key={idx} className="ticket-item-row">
            <span className="item-qty">{item.quantity}x</span>
            <span className="item-name">{item.itemName}</span>
            <span className="item-price">₹{item.totalPrice}</span>
          </div>
        ))}
      </div>

      <div className="ready-footer">
        <span className="dispatch-badge">Driver Dispatch Assigned</span>
      </div>
    </div>
  );
}
