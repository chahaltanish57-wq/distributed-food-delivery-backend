import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bike, 
  MapPin, 
  Store, 
  Clock, 
  Phone, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  Navigation, 
  Play, 
  RotateCcw,
  Sparkles,
  Radio,
  ChefHat
} from 'lucide-react';
import { TrackingSocketClient } from '../trackingSocket';
import { getOrderTracking, simulateTrackingStep, pingDriverTracking } from '../api';

export default function LiveTrackingView({ orderId, onBack, onOpenKitchen, onOpenDriver }) {
  const [trackingData, setTrackingData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const socketClientRef = useRef(null);

  // 1. Fetch initial snapshot from REST
  const loadSnapshot = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const data = await getOrderTracking(orderId);
      setTrackingData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load tracking snapshot:', err);
      setError('Could not load order tracking details.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  // 2. Connect to STOMP WebSocket topic /topic/orders/{orderId}/tracking
  useEffect(() => {
    if (!orderId) return;

    const client = new TrackingSocketClient(
      orderId,
      (incomingTelemetry) => {
        // console.log('[STOMP Message Received]:', incomingTelemetry);
        setTrackingData(incomingTelemetry);
      },
      (status) => {
        setConnectionStatus(status);
      }
    );

    client.connect();
    socketClientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [orderId]);

  // 3. Simulator Step (+20% progress along route)
  const handleStepProgress = async (delta = 0.20) => {
    if (!trackingData || simulating) return;
    setSimulating(true);
    try {
      const currentProgress = (trackingData.progressPercent || 20) / 100.0;
      let nextProgress = Math.min(1.0, currentProgress + delta);
      if (nextProgress >= 0.99) nextProgress = 1.0;
      const updated = await simulateTrackingStep(orderId, nextProgress);
      setTrackingData(updated);
    } catch (err) {
      console.error('Simulate step failed:', err);
    } finally {
      setSimulating(false);
    }
  };

  // 4. Reset Simulation to Restaurant (0%)
  const handleResetSimulation = async () => {
    if (!trackingData || simulating) return;
    setSimulating(true);
    try {
      const updated = await simulateTrackingStep(orderId, 0.05);
      setTrackingData(updated);
    } catch (err) {
      console.error('Reset simulation failed:', err);
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
        <p style={{ color: '#686b78', fontWeight: 700 }}>Connecting to Live Delivery Telemetry...</p>
      </div>
    );
  }

  if (error || !trackingData) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <AlertCircle size={48} color="#e03131" style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ color: '#1e2229', marginBottom: '0.5rem' }}>Unable to track order #{orderId}</h3>
        <p style={{ color: '#686b78', marginBottom: '1.5rem' }}>{error || 'No active tracking data available.'}</p>
        <button className="driver-back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Storefront</span>
        </button>
      </div>
    );
  }

  // Calculate Map Coordinate Bounds & Interpolation
  const restLat = trackingData.restaurantLatitude ? parseFloat(trackingData.restaurantLatitude) : 28.5672;
  const restLng = trackingData.restaurantLongitude ? parseFloat(trackingData.restaurantLongitude) : 77.3342;
  const custLat = trackingData.deliveryLatitude ? parseFloat(trackingData.deliveryLatitude) : 28.5708;
  const custLng = trackingData.deliveryLongitude ? parseFloat(trackingData.deliveryLongitude) : 77.3219;
  const driverLat = trackingData.currentLatitude ? parseFloat(trackingData.currentLatitude) : restLat;
  const driverLng = trackingData.currentLongitude ? parseFloat(trackingData.currentLongitude) : restLng;

  // Normalized map SVG positions (viewBox: 0 0 800 450)
  // We compute relative progress (0% to 100%) to interpolate SVG coordinate points
  const progressRatio = (trackingData.progressPercent || 15) / 100.0;
  const mapStartX = 140;
  const mapStartY = 330;
  const mapEndX = 660;
  const mapEndY = 120;

  // Waypoints along a natural curved delivery road
  const midX = 390;
  const midY = 190;

  // Quadratic Bezier interpolation for the bike position on the map
  const t = Math.max(0.0, Math.min(1.0, progressRatio));
  const bikeX = (1 - t) * (1 - t) * mapStartX + 2 * (1 - t) * t * midX + t * t * mapEndX;
  const bikeY = (1 - t) * (1 - t) * mapStartY + 2 * (1 - t) * t * midY + t * t * mapEndY;

  // Status Stepper Items
  const steps = [
    { key: 'CONFIRMED', label: 'Confirmed', done: ['ORDER_PLACED', 'RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(trackingData.orderStatus) },
    { key: 'KITCHEN', label: 'Preparing', done: ['PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(trackingData.orderStatus) },
    { key: 'READY', label: 'Food Ready', done: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(trackingData.orderStatus) },
    { key: 'DISPATCHED', label: 'On The Way', done: ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(trackingData.orderStatus) },
    { key: 'DELIVERED', label: 'Delivered', done: trackingData.orderStatus === 'DELIVERED' }
  ];

  return (
    <div className="tracking-container">
      {/* Top Header */}
      <div className="tracking-header">
        <button className="tracking-back-btn" onClick={onBack} title="Back">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>

        <div className="tracking-header-info">
          <div className="tracking-order-id-row">
            <span className="tracking-order-badge">#ORD-{trackingData.orderId}</span>
            <span className="tracking-status-badge">
              {trackingData.orderStatus?.replace(/_/g, ' ')}
            </span>
          </div>
          <h2 className="tracking-order-title">
            {trackingData.restaurantName}
          </h2>
        </div>

        <div className="tracking-live-pill">
          <Radio size={15} className="pulse-icon" color="#00b074" />
          <span>STOMP WebSocket: <strong>{connectionStatus}</strong></span>
        </div>
      </div>

      {/* Main Grid: Map on Left / Top, Telemetry HUD on Right */}
      <div className="tracking-grid">
        
        {/* Left Column: Interactive Vector Map */}
        <div className="tracking-map-wrapper">
          
          {/* Map Overhead Status Banner */}
          <div className="map-hud-banner">
            <div className="map-hud-eta-box">
              <Clock size={20} color="#fc8019" />
              <div>
                <span className="map-hud-eta-sub">ESTIMATED ARRIVAL</span>
                <strong className="map-hud-eta-val">
                  {trackingData.orderStatus === 'DELIVERED' ? 'Delivered!' : `${trackingData.etaMinutes || 18} Mins`}
                </strong>
              </div>
            </div>

            <div className="map-hud-dist-box">
              <span className="map-hud-dist-sub">DISTANCE</span>
              <strong className="map-hud-dist-val">{trackingData.distanceRemainingKm || 1.4} km away</strong>
            </div>
          </div>

          {/* SVG Vector Map Canvas */}
          <div className="vector-map-canvas">
            <svg viewBox="0 0 800 450" className="map-svg">
              <defs>
                {/* Background Grid Pattern */}
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e9ecef" strokeWidth="1" />
                </pattern>

                {/* Pulsing beacon filter */}
                <radialGradient id="beaconGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00b074" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#00b074" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Background Grid & Green Blocks */}
              <rect width="100%" height="100%" fill="#f8f9fa" />
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Decorative City Blocks / Parks */}
              <rect x="60" y="40" width="120" height="80" rx="10" fill="#e6fcf5" stroke="#c3fae8" strokeWidth="1.5" />
              <text x="75" y="85" fill="#0ca678" fontSize="11" fontWeight="700">CITY PARK</text>

              <rect x="520" y="240" width="180" height="110" rx="12" fill="#fff4e6" stroke="#ffe8cc" strokeWidth="1.5" />
              <text x="540" y="300" fill="#f76707" fontSize="11" fontWeight="700">COMMERCIAL HUB</text>

              <rect x="220" y="50" width="160" height="70" rx="8" fill="#f1f3f5" stroke="#dee2e6" strokeWidth="1" />
              <text x="235" y="90" fill="#868e96" fontSize="10" fontWeight="600">SECTOR COMPLEX</text>

              {/* Road Network Lines */}
              <path d="M 0 330 L 800 330" stroke="#dee2e6" strokeWidth="18" strokeLinecap="round" />
              <path d="M 140 0 L 140 450" stroke="#dee2e6" strokeWidth="16" strokeLinecap="round" />
              <path d="M 660 0 L 660 450" stroke="#dee2e6" strokeWidth="16" strokeLinecap="round" />
              <path d="M 0 120 L 800 120" stroke="#dee2e6" strokeWidth="18" strokeLinecap="round" />

              {/* Active Delivery Route (Curved Bezier Path) */}
              <path
                d={`M ${mapStartX} ${mapStartY} Q ${midX} ${midY} ${mapEndX} ${mapEndY}`}
                fill="none"
                stroke="#ced4da"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d={`M ${mapStartX} ${mapStartY} Q ${midX} ${midY} ${mapEndX} ${mapEndY}`}
                fill="none"
                stroke="#00b074"
                strokeWidth="6"
                strokeDasharray="8 8"
                className="animated-route-dash"
                strokeLinecap="round"
              />

              {/* RESTAURANT MARKER (Pickup) */}
              <g transform={`translate(${mapStartX}, ${mapStartY})`}>
                <circle r="22" fill="#fc8019" opacity="0.2" className="beacon-pulse" />
                <circle r="14" fill="#fc8019" />
                <circle r="6" fill="#ffffff" />
                <text x="0" y="32" textAnchor="middle" fill="#1e2229" fontSize="11" fontWeight="800">
                  {trackingData.restaurantName}
                </text>
                <text x="0" y="44" textAnchor="middle" fill="#868e96" fontSize="9">
                  PICKUP
                </text>
              </g>

              {/* CUSTOMER HOME MARKER (Dropoff) */}
              <g transform={`translate(${mapEndX}, ${mapEndY})`}>
                <circle r="22" fill="#1971c2" opacity="0.2" className="beacon-pulse" />
                <circle r="14" fill="#1971c2" />
                <circle r="6" fill="#ffffff" />
                <text x="0" y="32" textAnchor="middle" fill="#1e2229" fontSize="11" fontWeight="800">
                  {trackingData.customerName || 'Your Location'}
                </text>
                <text x="0" y="44" textAnchor="middle" fill="#868e96" fontSize="9">
                  DROPOFF
                </text>
              </g>

              {/* LIVE DELIVERY PARTNER (Bike) */}
              <g 
                transform={`translate(${bikeX}, ${bikeY})`}
                style={{ transition: 'all 0.5s ease-out' }}
              >
                {/* Pulsing radar ripple */}
                <circle r="26" fill="url(#beaconGlow)" className="beacon-pulse-fast" />
                
                {/* Bike Badge Background */}
                <circle r="18" fill="#00b074" stroke="#ffffff" strokeWidth="2.5" />
                
                {/* Bike Icon (embedded SVG) */}
                <g transform="translate(-10, -10) scale(0.85)">
                  <path 
                    d="M5.5 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM15 6h1a2 2 0 0 1 2 2v2M9 14.5 12 7l4 4M12 14.5l-3-4" 
                    fill="none" 
                    stroke="#ffffff" 
                    strokeWidth="2.2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                </g>

                {/* Floating Partner Tooltip */}
                <g transform="translate(0, -28)">
                  <rect x="-42" y="-18" width="84" height="20" rx="6" fill="#1e2229" opacity="0.9" />
                  <text x="0" y="-4" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="800">
                    {trackingData.driverName ? trackingData.driverName.split(' ')[0] : 'Partner'} • {Math.round(progressRatio * 100)}%
                  </text>
                </g>
              </g>
            </svg>

            {/* Bottom Status Overlay */}
            <div className="map-bottom-status-overlay">
              <div className="status-message-box">
                <Sparkles size={16} color="#fc8019" />
                <span>{trackingData.message}</span>
              </div>
            </div>
          </div>

          {/* Interactive Route Simulation Controls */}
          <div className="map-simulator-toolbar">
            <span className="sim-label">Demo Simulator Controls:</span>
            <button
              className="sim-btn step-btn"
              onClick={() => handleStepProgress(0.25)}
              disabled={simulating || trackingData.progressPercent >= 100}
              title="Step driver location forward along delivery route"
            >
              <Play size={14} />
              <span>Step Bike (+25%)</span>
            </button>
            <button
              className="sim-btn reset-btn"
              onClick={handleResetSimulation}
              disabled={simulating}
              title="Reset driver location to restaurant"
            >
              <RotateCcw size={14} />
              <span>Reset Route</span>
            </button>
          </div>
        </div>

        {/* Right Column: Order Milestones & Driver Card */}
        <div className="tracking-sidebar">
          
          {/* Status Stepper Card */}
          <div className="tracking-card">
            <h3 className="tracking-card-title">Order Status</h3>
            <div className="tracking-stepper">
              {steps.map((s, idx) => (
                <div key={s.key} className={`stepper-step ${s.done ? 'completed' : ''}`}>
                  <div className="stepper-bullet">
                    {s.done ? <CheckCircle2 size={16} /> : <span>{idx + 1}</span>}
                  </div>
                  <div className="stepper-content">
                    <strong className="stepper-label">{s.label}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Driver Card */}
          {trackingData.driverName ? (
            <div className="tracking-card driver-hud-card">
              <div className="driver-hud-header">
                <div className="driver-hud-avatar">
                  <Bike size={24} color="#00b074" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <h4 className="driver-hud-name">{trackingData.driverName}</h4>
                    <span className="driver-hud-rating">★ 4.9</span>
                  </div>
                  <span className="driver-hud-vehicle">{trackingData.vehicleType || 'Motorcycle'}</span>
                </div>
                <a 
                  href={`tel:${trackingData.driverPhone}`} 
                  className="driver-call-btn"
                  title="Call Delivery Partner"
                >
                  <Phone size={16} />
                </a>
              </div>

              <div className="driver-safety-badge">
                <ShieldCheck size={16} color="#00b074" />
                <span>Vaccinated • Temperature Checked • Mask Verified</span>
              </div>
            </div>
          ) : (
            <div className="tracking-card unassigned-card">
              <Bike size={28} color="#adb5bd" />
              <h4>Assigning Delivery Partner...</h4>
              <p>Searching for nearby partners in {trackingData.restaurantName} zone via Redis Geospatial dispatch.</p>
              {onOpenDriver && (
                <button 
                  className="sim-driver-open-btn"
                  onClick={onOpenDriver}
                >
                  Open Driver Simulator
                </button>
              )}
            </div>
          )}

          {/* Delivery Address & Details */}
          <div className="tracking-card">
            <h4 className="tracking-card-title">Delivery Details</h4>
            
            <div className="delivery-location-item">
              <Store size={18} color="#fc8019" />
              <div>
                <span className="loc-label">RESTAURANT</span>
                <strong className="loc-val">{trackingData.restaurantName}</strong>
                <p className="loc-sub">{trackingData.restaurantAddress || 'Central Market'}</p>
              </div>
            </div>

            <div className="delivery-location-item" style={{ marginTop: '0.85rem' }}>
              <MapPin size={18} color="#1971c2" />
              <div>
                <span className="loc-label">DELIVERING TO</span>
                <strong className="loc-val">{trackingData.customerName || 'Customer'}</strong>
                <p className="loc-sub">{trackingData.deliveryAddress || 'Delivery Address'}</p>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="tracking-shortcuts-card">
            {onOpenKitchen && (
              <button 
                className="shortcut-portal-btn kitchen"
                onClick={onOpenKitchen}
              >
                <ChefHat size={16} />
                <span>View in Kitchen KDS</span>
              </button>
            )}
            {onOpenDriver && (
              <button 
                className="shortcut-portal-btn driver"
                onClick={onOpenDriver}
              >
                <Bike size={16} />
                <span>Open Driver Simulator</span>
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
