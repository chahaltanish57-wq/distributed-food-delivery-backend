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
  Pause,
  RotateCcw,
  Sparkles,
  Radio,
  ChefHat,
  Zap,
  ArrowRight,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight
} from 'lucide-react';
import { TrackingSocketClient } from '../trackingSocket';
import { getOrderTracking, simulateTrackingStep, pingDriverTracking } from '../api';

// Mathematical Piecewise Road Trajectory Engine (Zero Diagonal Cut-across)
function calculateRoadNavigation(progressRatio) {
  // Road segments strictly along asphalt street corridors:
  // Seg 1 (East on Sector 29 Market Ave): (140, 330) -> (440, 330) [L1 = 300]
  // Arc 1 (Fillet Turn East to North onto Metro Blvd): (440, 330) via (470, 330) to (470, 300) [LA1 = 47.12]
  // Seg 2 (North along Metro Express Blvd): (470, 300) -> (470, 150) [L2 = 150]
  // Arc 2 (Fillet Turn North to East into Wave Mall Lane): (470, 150) via (470, 120) to (500, 120) [LA2 = 47.12]
  // Seg 3 (East on Wave Mall / Residential Lane): (500, 120) -> (660, 120) [L3 = 160]
  const L1 = 300;
  const LA1 = 47.12;
  const L2 = 150;
  const LA2 = 47.12;
  const L3 = 160;
  const totalLength = L1 + LA1 + L2 + LA2 + L3; // 704.24

  const clamped = Math.max(0.0, Math.min(1.0, progressRatio));
  const d = clamped * totalLength;

  let x = 140, y = 330, heading = 0;
  let instruction = 'Heading East along Sector 29 Market Avenue';
  let iconName = 'ArrowRight';
  let distToTurn = `${Math.max(10, Math.round(L1 - d))}m`;
  let trailPath = `M 140 330`;

  if (d <= L1) {
    // Segment 1: Eastbound on y = 330
    const u = d / L1;
    x = 140 + u * 300;
    y = 330;
    heading = 0;
    instruction = 'Heading East along Sector 29 Market Avenue';
    iconName = 'ArrowRight';
    distToTurn = `${Math.max(15, Math.round(L1 - d))}m`;
    trailPath = `M 140 330 L ${x} 330`;
  } else if (d <= L1 + LA1) {
    // Corner Arc 1: (440, 330) -> (470, 300)
    const u = (d - L1) / LA1;
    x = (1 - u) * (1 - u) * 440 + 2 * (1 - u) * u * 470 + u * u * 470;
    y = (1 - u) * (1 - u) * 330 + 2 * (1 - u) * u * 330 + u * u * 300;
    heading = -u * 90; // sweeps 0 -> -90 deg
    instruction = 'Turning left onto Sector 18 Metro Express Boulevard';
    iconName = 'CornerUpLeft';
    distToTurn = 'In turn';
    const trailCtrlX = (1 - u) * 440 + u * 470;
    const trailCtrlY = (1 - u) * 330 + u * 330;
    trailPath = `M 140 330 L 440 330 Q ${trailCtrlX} ${trailCtrlY} ${x} ${y}`;
  } else if (d <= L1 + LA1 + L2) {
    // Segment 2: Northbound on x = 470
    const u = (d - L1 - LA1) / L2;
    x = 470;
    y = 300 - u * 150;
    heading = -90;
    instruction = 'Proceeding North past Sector 18 Metro Station & Flyover';
    iconName = 'ArrowUp';
    distToTurn = `${Math.max(15, Math.round(L1 + LA1 + L2 - d))}m`;
    trailPath = `M 140 330 L 440 330 Q 470 330 470 300 L 470 ${y}`;
  } else if (d <= L1 + LA1 + L2 + LA2) {
    // Corner Arc 2: (470, 150) -> (500, 120)
    const u = (d - L1 - LA1 - L2) / LA2;
    x = (1 - u) * (1 - u) * 470 + 2 * (1 - u) * u * 470 + u * u * 500;
    y = (1 - u) * (1 - u) * 150 + 2 * (1 - u) * u * 120 + u * u * 120;
    heading = -90 + u * 90; // sweeps -90 -> 0 deg
    instruction = 'Turning right onto Wave Silver Residential Lane';
    iconName = 'CornerUpRight';
    distToTurn = 'In turn';
    const trailCtrlX = (1 - u) * 470 + u * 470;
    const trailCtrlY = (1 - u) * 150 + u * 120;
    trailPath = `M 140 330 L 440 330 Q 470 330 470 300 L 470 150 Q ${trailCtrlX} ${trailCtrlY} ${x} ${y}`;
  } else {
    // Segment 3: Eastbound on y = 120
    const u = (d - L1 - LA1 - L2 - LA2) / L3;
    x = 500 + u * 160;
    y = 120;
    heading = 0;
    instruction = d >= totalLength - 10 ? 'Arrived at Customer Doorstep - Handover Complete!' : 'Approaching Customer Destination Gate Ahead';
    iconName = d >= totalLength - 10 ? 'CheckCircle2' : 'ArrowRight';
    distToTurn = d >= totalLength - 10 ? '0m' : `${Math.max(10, Math.round(totalLength - d))}m`;
    trailPath = `M 140 330 L 440 330 Q 470 330 470 300 L 470 150 Q 470 120 500 120 L ${x} 120`;
  }

  return { x, y, heading, instruction, iconName, distToTurn, trailPath };
}

export default function LiveTrackingView({ orderId, onBack, onOpenKitchen, onOpenDriver }) {
  const [trackingData, setTrackingData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [isLiveDriving, setIsLiveDriving] = useState(false);
  const [driveSpeed, setDriveSpeed] = useState(1);
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

  // 3. Continuous Live Driving Simulator Loop
  useEffect(() => {
    let intervalId = null;
    if (isLiveDriving) {
      intervalId = setInterval(() => {
        setTrackingData((prev) => {
          if (!prev) return prev;
          const currentProgress = (prev.progressPercent || 15) / 100.0;
          if (currentProgress >= 1.0) {
            setIsLiveDriving(false);
            return {
              ...prev,
              orderStatus: 'DELIVERED',
              progressPercent: 100,
              etaMinutes: 0,
              distanceRemainingKm: 0.0,
              message: '🎉 Delivered! Order handoff completed safely.'
            };
          }

          const increment = 0.022 * driveSpeed;
          const nextProgress = Math.min(1.0, currentProgress + increment);
          const nextPercent = Math.round(nextProgress * 100);
          const distRem = Math.max(0.0, Number((2.4 * (1 - nextProgress)).toFixed(1)));
          const etaRem = Math.max(0, Math.round(18 * (1 - nextProgress)));

          let nextStatus = prev.orderStatus;
          if (nextProgress >= 0.98) {
            nextStatus = 'DELIVERED';
          } else if (nextProgress >= 0.15 && nextStatus !== 'DELIVERED') {
            nextStatus = 'OUT_FOR_DELIVERY';
          }

          // Periodic STOMP backend sync
          if (Math.round(nextProgress * 100) % 8 === 0 || nextProgress >= 1.0) {
            simulateTrackingStep(orderId, nextProgress).catch((e) => console.warn('Backend sync error:', e));
          }

          return {
            ...prev,
            orderStatus: nextStatus,
            progressPercent: nextPercent,
            distanceRemainingKm: distRem,
            etaMinutes: etaRem,
            message: nextStatus === 'DELIVERED'
              ? '🎉 Delivered! Order handoff completed safely.'
              : `${prev.driverName ? prev.driverName.split(' ')[0] : 'Partner'} is en route (${distRem} km away)`
          };
        });
      }, 550 / driveSpeed);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLiveDriving, driveSpeed, orderId]);

  // 4. Simulator Step (+20% progress along route)
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

  // 5. Reset Simulation to Restaurant (0%)
  const handleResetSimulation = async () => {
    setIsLiveDriving(false);
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

  // Calculate Normalized Map Position strictly along Paved Asphalt Roads
  const progressRatio = (trackingData.progressPercent || 10) / 100.0;
  const isDehradun = 
    trackingData.restaurantAddress?.toLowerCase().includes('dehradun') || 
    trackingData.deliveryAddress?.toLowerCase().includes('dehradun') ||
    trackingData.restaurantName?.toLowerCase().includes('paltan') ||
    trackingData.restaurantName?.toLowerCase().includes('rajpur');

  // Exact piecewise calculation along authentic road corridors
  const roadNav = calculateRoadNavigation(progressRatio);
  const bikeX = roadNav.x;
  const bikeY = roadNav.y;
  const headingAngle = roadNav.heading;
  const trailSvgPath = roadNav.trailPath;
  const fullRoadPath = "M 140 330 L 440 330 Q 470 330 470 300 L 470 150 Q 470 120 500 120 L 660 120";

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
            
            {/* Live Turn-by-Turn Navigation HUD Pill */}
            <div className="turn-by-turn-hud">
              <div className="turn-hud-icon-badge">
                {roadNav.iconName === 'ArrowRight' && <ArrowRight size={18} />}
                {roadNav.iconName === 'CornerUpLeft' && <CornerUpLeft size={18} />}
                {roadNav.iconName === 'ArrowUp' && <ArrowUp size={18} />}
                {roadNav.iconName === 'CornerUpRight' && <CornerUpRight size={18} />}
                {roadNav.iconName === 'CheckCircle2' && <CheckCircle2 size={18} />}
              </div>
              <div className="turn-hud-details">
                <span className="turn-hud-sub">TURN-BY-TURN GUIDANCE</span>
                <strong className="turn-hud-instruction">{roadNav.instruction}</strong>
              </div>
              <div className="turn-hud-dist-tag">
                <Navigation size={13} />
                <span>{roadNav.distToTurn}</span>
              </div>
            </div>

            <svg viewBox="0 0 800 450" className="map-svg">
              <defs>
                {/* Background Grid Pattern */}
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e9ecef" strokeWidth="1" className="grid-stroke" />
                </pattern>

                {/* Pulsing beacon filter */}
                <radialGradient id="beaconGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00b074" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#00b074" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Background Grid & City Blocks */}
              <rect width="100%" height="100%" fill="#f8f9fa" className="map-canvas-bg" />
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Decorative City Blocks / Green Parks */}
              <rect x="50" y="40" width="130" height="90" rx="12" fill="#e6fcf5" stroke="#c3fae8" strokeWidth="1.5" className="map-park-block" />
              <text x="70" y="90" fill="#0ca678" fontSize="11" fontWeight="800">CENTRAL PARK</text>

              <rect x="530" y="240" width="220" height="120" rx="14" fill="#fff4e6" stroke="#ffe8cc" strokeWidth="1.5" className="map-comm-block" />
              <text x="560" y="305" fill="#f76707" fontSize="11" fontWeight="800">COMMERCIAL DISTRICT</text>

              <rect x="220" y="45" width="180" height="85" rx="10" fill="#f1f3f5" stroke="#dee2e6" strokeWidth="1.5" className="map-sect-block" />
              <text x="245" y="92" fill="#868e96" fontSize="10" fontWeight="700">RESIDENTIAL SECTOR</text>

              {/* AUTHENTIC ASPHALT ROAD NETWORK */}
              {/* Outer Curb Borders */}
              <path d="M 0 330 L 800 330" stroke="#3d4452" strokeWidth="36" strokeLinecap="round" />
              <path d="M 0 120 L 800 120" stroke="#3d4452" strokeWidth="36" strokeLinecap="round" />
              <path d="M 470 0 L 470 450" stroke="#3d4452" strokeWidth="38" strokeLinecap="round" />
              <path d="M 140 280 L 140 450" stroke="#3d4452" strokeWidth="32" strokeLinecap="round" />
              <path d="M 660 0 L 660 200" stroke="#3d4452" strokeWidth="32" strokeLinecap="round" />

              {/* Asphalt Road Surface Fill */}
              <path d="M 0 330 L 800 330" stroke="#2b303a" strokeWidth="30" strokeLinecap="round" />
              <path d="M 0 120 L 800 120" stroke="#2b303a" strokeWidth="30" strokeLinecap="round" />
              <path d="M 470 0 L 470 450" stroke="#2b303a" strokeWidth="32" strokeLinecap="round" />
              <path d="M 140 280 L 140 450" stroke="#2b303a" strokeWidth="26" strokeLinecap="round" />
              <path d="M 660 0 L 660 200" stroke="#2b303a" strokeWidth="26" strokeLinecap="round" />

              {/* Yellow Dashed Centerlines */}
              <path d="M 0 330 L 800 330" stroke="#fcc419" strokeWidth="2" strokeDasharray="10 8" />
              <path d="M 0 120 L 800 120" stroke="#fcc419" strokeWidth="2" strokeDasharray="10 8" />
              <path d="M 470 0 L 470 450" stroke="#ffffff" strokeWidth="2" strokeDasharray="10 8" opacity="0.8" />

              {/* Zebra Crosswalk Markings */}
              <g stroke="#ffffff" strokeWidth="3" opacity="0.65">
                <line x1="430" y1="318" x2="430" y2="342" strokeDasharray="3 3" />
                <line x1="510" y1="318" x2="510" y2="342" strokeDasharray="3 3" />
                <line x1="430" y1="108" x2="430" y2="132" strokeDasharray="3 3" />
                <line x1="510" y1="108" x2="510" y2="132" strokeDasharray="3 3" />
              </g>

              {/* DELIVERY ROUTE RUNNING DIRECTLY DOWN ASPHALT CORRIDOR */}
              {/* Underlying Route Guide */}
              <path
                d={fullRoadPath}
                fill="none"
                stroke="#495057"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.5"
              />
              <path
                d={fullRoadPath}
                fill="none"
                stroke="#00b074"
                strokeWidth="6"
                strokeDasharray="8 8"
                className="animated-route-dash"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Traveled Paved Road Trail (Solid Emerald Neon) */}
              {progressRatio > 0.01 && (
                <path
                  d={trailSvgPath}
                  fill="none"
                  stroke="#00b074"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* CITY LANDMARKS ALONG THE ROADS */}
              {/* Landmark 1: Sector 29 / Paltan Bazaar */}
              <g transform="translate(280, 370)" className="map-landmark-marker">
                <rect x="-82" y="-12" width="164" height="24" rx="12" fill="#ffffff" stroke="#ced4da" strokeWidth="1.5" className="landmark-badge" />
                <circle cx="-68" cy="0" r="5" fill="#fc8019" />
                <text x="-56" y="4" fill="#1e2229" fontSize="10" fontWeight="800">
                  {isDehradun ? '🛍️ Paltan Bazaar' : '🏪 Sector 29 Market'}
                </text>
              </g>

              {/* Landmark 2: Metro Station / Clock Tower */}
              <g transform="translate(520, 225)" className="map-landmark-marker">
                <rect x="-6" y="-13" width="186" height="26" rx="13" fill="#ffffff" stroke="#1971c2" strokeWidth="1.5" className="landmark-badge highlight" />
                <circle cx="8" cy="0" r="5" fill="#1971c2" />
                <text x="20" y="4" fill="#1971c2" fontSize="10" fontWeight="800">
                  {isDehradun ? '🏛️ Clock Tower (Ghanta Ghar)' : '🚇 Sector 18 Metro & Flyover'}
                </text>
              </g>

              {/* Landmark 3: Wave Mall / Rajpur Road */}
              <g transform="translate(580, 80)" className="map-landmark-marker">
                <rect x="-78" y="-12" width="156" height="24" rx="12" fill="#ffffff" stroke="#ced4da" strokeWidth="1.5" className="landmark-badge" />
                <circle cx="-64" cy="0" r="5" fill="#0ca678" />
                <text x="-52" y="4" fill="#1e2229" fontSize="10" fontWeight="800">
                  {isDehradun ? '🌲 Rajpur Road Hub' : '🏢 Wave Silver Mall'}
                </text>
              </g>

              {/* RESTAURANT MARKER (Pickup on Sector 29) */}
              <g transform="translate(140, 330)">
                <circle r="24" fill="#fc8019" opacity="0.2" className="beacon-pulse" />
                <circle r="14" fill="#fc8019" />
                <circle r="6" fill="#ffffff" />
                <text x="0" y="32" textAnchor="middle" fill="#1e2229" fontSize="11" fontWeight="800" className="map-point-label">
                  {trackingData.restaurantName}
                </text>
                <text x="0" y="44" textAnchor="middle" fill="#868e96" fontSize="9">
                  PICKUP HUB
                </text>
              </g>

              {/* CUSTOMER HOME MARKER (Dropoff on Destination Lane) */}
              <g transform="translate(660, 120)">
                <circle r="24" fill="#1971c2" opacity="0.2" className="beacon-pulse" />
                <circle r="14" fill="#1971c2" />
                <circle r="6" fill="#ffffff" />
                <text x="0" y="32" textAnchor="middle" fill="#1e2229" fontSize="11" fontWeight="800" className="map-point-label">
                  {trackingData.customerName || 'Your Location'}
                </text>
                <text x="0" y="44" textAnchor="middle" fill="#868e96" fontSize="9">
                  CUSTOMER DROPOFF
                </text>
              </g>

              {/* LIVE DELIVERY PARTNER (Bike moving strictly on road with dynamic turning) */}
              <g 
                transform={`translate(${bikeX}, ${bikeY})`}
                style={{ transition: isLiveDriving ? 'transform 0.55s linear' : 'transform 0.5s ease-out' }}
              >
                {/* Pulsing radar ripple */}
                <circle r="26" fill="url(#beaconGlow)" className="beacon-pulse-fast" />
                
                {/* Bike Badge Background */}
                <circle r="18" fill="#00b074" stroke="#ffffff" strokeWidth="2.5" />
                
                {/* Bike Icon (oriented strictly down the road) */}
                <g transform={`rotate(${headingAngle + 18}) translate(-10, -10) scale(0.85)`}>
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
                  <rect x="-44" y="-18" width="88" height="20" rx="6" fill="#1e2229" opacity="0.92" />
                  <text x="0" y="-4" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="800">
                    {trackingData.driverName ? trackingData.driverName.split(' ')[0] : 'Partner'} • {Math.round(progressRatio * 100)}%
                  </text>
                </g>
              </g>
            </svg>

            {/* Delivered Celebration Overlay */}
            {trackingData.orderStatus === 'DELIVERED' && (
              <div className="map-delivered-overlay">
                <div className="delivered-celebration-card">
                  <div className="celebration-icon-box">
                    <Sparkles size={24} color="#00b074" />
                  </div>
                  <div className="celebration-text">
                    <h4>Order Delivered! 🎉</h4>
                    <p>Your food arrived safely. Enjoy your meal!</p>
                  </div>
                  <button className="celebration-replay-btn" onClick={handleResetSimulation}>
                    <RotateCcw size={14} />
                    <span>Replay Live Trip</span>
                  </button>
                </div>
              </div>
            )}

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
            <div className="sim-toolbar-group">
              <span className="sim-label">Live Trip Simulation:</span>
              <button
                className={`sim-btn ${isLiveDriving ? 'pause-btn' : 'live-drive-btn'}`}
                onClick={() => {
                  if (trackingData.orderStatus === 'DELIVERED' || trackingData.progressPercent >= 100) {
                    handleResetSimulation().then(() => setIsLiveDriving(true));
                  } else {
                    setIsLiveDriving(!isLiveDriving);
                  }
                }}
                disabled={simulating}
                title={isLiveDriving ? "Pause live delivery" : "Start continuous live delivery journey"}
              >
                {isLiveDriving ? <Pause size={15} /> : <Play size={15} />}
                <span>
                  {isLiveDriving 
                    ? 'Pause Trip' 
                    : (trackingData.orderStatus === 'DELIVERED' ? 'Replay Live Trip' : 'Start Live Delivery Trip')}
                </span>
              </button>

              <div className="speed-pills-wrap">
                <span className="speed-title">Speed:</span>
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    className={`speed-pill ${driveSpeed === s ? 'active' : ''}`}
                    onClick={() => setDriveSpeed(s)}
                    title={`Run at ${s}x speed`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            <div className="sim-toolbar-group right">
              <button
                className="sim-btn step-btn"
                onClick={() => handleStepProgress(0.20)}
                disabled={simulating || isLiveDriving || trackingData.progressPercent >= 100}
                title="Step driver location forward along delivery route"
              >
                <Zap size={14} />
                <span>Step (+20%)</span>
              </button>
              <button
                className="sim-btn reset-btn"
                onClick={handleResetSimulation}
                disabled={simulating}
                title="Reset driver location to restaurant"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            </div>
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
