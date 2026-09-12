import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bike, 
  MapPin, 
  Navigation, 
  PackageCheck, 
  Clock, 
  Coins, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle, 
  ArrowRight, 
  Store,
  User,
  Radio
} from 'lucide-react';
import { 
  getDrivers, 
  getDriver, 
  getAvailableOrdersForDriver, 
  getActiveMissionForDriver, 
  acceptDeliveryRun, 
  pickupDeliveryOrder, 
  completeDeliveryOrder,
  updateDriverLocation
} from '../api';

export default function DriverDashboard({ onBackToStorefront, showToast }) {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [currentDriver, setCurrentDriver] = useState(null);
  const [availableRuns, setAvailableRuns] = useState([]);
  const [activeMission, setActiveMission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [conflictError, setConflictError] = useState(null);
  const [simulatingGps, setSimulatingGps] = useState(false);

  // 1. Fetch all drivers initially
  const loadDrivers = useCallback(async () => {
    try {
      const data = await getDrivers();
      setDrivers(data || []);
      if (data && data.length > 0 && !selectedDriverId) {
        setSelectedDriverId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load drivers:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDriverId]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  // 2. Fetch driver profile, active mission, and available runs
  const refreshDriverData = useCallback(async (driverId) => {
    if (!driverId) return;
    try {
      const [driverData, missionData, runsData] = await Promise.all([
        getDriver(driverId),
        getActiveMissionForDriver(driverId),
        getAvailableOrdersForDriver(driverId)
      ]);
      setCurrentDriver(driverData);
      setActiveMission(missionData);
      setAvailableRuns(runsData || []);
      setConflictError(null);
    } catch (err) {
      console.error('Failed to refresh driver data:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedDriverId) {
      refreshDriverData(selectedDriverId);
    }
  }, [selectedDriverId, refreshDriverData]);

  // Periodic polling every 5s to refresh available runs
  useEffect(() => {
    if (!selectedDriverId) return;
    const interval = setInterval(() => {
      refreshDriverData(selectedDriverId);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedDriverId, refreshDriverData]);

  const broadcastDriverEvent = (type, orderId, extra = {}) => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('swiggy_delivery_events');
        bc.postMessage({ type, orderId, timestamp: Date.now(), ...extra });
        setTimeout(() => bc.close(), 100);
      }
      localStorage.setItem('swiggy_last_driver_event', JSON.stringify({
        type,
        orderId,
        timestamp: Date.now(),
        ...extra
      }));
    } catch (e) {
      console.warn('Driver event broadcast warning:', e);
    }
  };

  // 3. Claim Delivery Run with Redisson Distributed Lock
  const handleAcceptRun = async (orderId) => {
    if (!selectedDriverId || actionLoading) return;
    setActionLoading(true);
    setConflictError(null);
    try {
      const mission = await acceptDeliveryRun(selectedDriverId, orderId);
      setActiveMission(mission);
      showToast && showToast(`Mission Claimed! Proceed to ${mission.restaurantName} for pickup.`);
      broadcastDriverEvent('DRIVER_ACCEPTED_RUN', orderId, {
        driverId: selectedDriverId,
        driverName: currentDriver?.name || mission?.deliveryPartnerName || 'Rohan Sharma'
      });
      await refreshDriverData(selectedDriverId);
    } catch (err) {
      console.error('Failed to claim order:', err);
      const errMsg = err.response?.data?.message || err.message || 'Run could not be claimed.';
      setConflictError(errMsg);
      // Refresh available runs in case someone else claimed it
      refreshDriverData(selectedDriverId);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Pickup food from restaurant
  const handlePickup = async (orderId) => {
    if (!selectedDriverId || actionLoading) return;
    setActionLoading(true);
    try {
      const updated = await pickupDeliveryOrder(selectedDriverId, orderId);
      setActiveMission(updated);
      showToast && showToast('Order Picked Up! Navigating to customer location.');
      broadcastDriverEvent('DRIVER_COLLECTED_ORDER', orderId, {
        driverId: selectedDriverId
      });
      await refreshDriverData(selectedDriverId);
    } catch (err) {
      console.error('Failed to pickup order:', err);
      alert(err.response?.data?.message || 'Pickup failed');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Complete delivery to customer
  const handleDeliver = async (orderId) => {
    if (!selectedDriverId || actionLoading) return;
    setActionLoading(true);
    try {
      await completeDeliveryOrder(selectedDriverId, orderId);
      setActiveMission(null);
      showToast && showToast('Delivery Completed! ₹65.00 Payout credited to your driver wallet.');
      await refreshDriverData(selectedDriverId);
    } catch (err) {
      console.error('Failed to complete delivery:', err);
      alert(err.response?.data?.message || 'Delivery completion failed');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Simulate GPS Ping (Redis GEOADD)
  const handleSimulateGpsPing = async () => {
    if (!currentDriver || simulatingGps) return;
    setSimulatingGps(true);
    try {
      // Add random jitter of +/- 0.002 deg (~200m)
      const latDelta = (Math.random() - 0.5) * 0.004;
      const lngDelta = (Math.random() - 0.5) * 0.004;
      const newLat = (parseFloat(currentDriver.currentLatitude) + latDelta).toFixed(7);
      const newLng = (parseFloat(currentDriver.currentLongitude) + lngDelta).toFixed(7);

      const updated = await updateDriverLocation(currentDriver.id, newLat, newLng);
      setCurrentDriver(updated);
      showToast && showToast(`GPS updated! Redis GEO indexed at (${newLat}, ${newLng})`);
      await refreshDriverData(currentDriver.id);
    } catch (err) {
      console.error('Failed to update GPS:', err);
    } finally {
      setSimulatingGps(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
        <p style={{ color: '#686b78', fontWeight: 600 }}>Loading Driver Dispatch Simulator...</p>
      </div>
    );
  }

  return (
    <div className="driver-dashboard-container">
      {/* Header Bar */}
      <div className="driver-header">
        <div className="driver-header-left">
          <div className="driver-header-badge">
            <Radio size={16} color="#00b074" className="pulse-icon" />
            <span>Redis Geospatial Dispatch Active</span>
          </div>
          <h1 className="driver-header-title">
            Fleet Dispatcher & Delivery Simulator
          </h1>
          <p className="driver-header-sub">
            Simulate on-demand driver discovery, real-time GPS indexing (<code>GEOADD</code>), and Redisson distributed locking.
          </p>
        </div>

        <div className="driver-header-actions">
          <button 
            className="driver-secondary-btn"
            onClick={() => refreshDriverData(selectedDriverId)}
            title="Refresh Available Runs"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <button 
            className="driver-back-btn"
            onClick={onBackToStorefront}
          >
            <Store size={16} />
            <span>Customer Storefront</span>
          </button>
        </div>
      </div>

      {/* Driver Selector Pills */}
      <div className="driver-selector-section">
        <div className="driver-selector-title">
          <User size={16} color="#fc8019" />
          <span>Select Active Delivery Partner:</span>
        </div>
        <div className="driver-pills-row">
          {drivers.map((d) => {
            const isSelected = d.id === selectedDriverId;
            return (
              <button
                key={d.id}
                className={`driver-pill ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedDriverId(d.id)}
              >
                <Bike size={16} color={isSelected ? '#ffffff' : '#fc8019'} />
                <div className="driver-pill-info">
                  <span className="driver-pill-name">{d.name}</span>
                  <span className="driver-pill-city">{d.city} &bull; {d.status}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Layout: Driver Status Card + Missions & Runs */}
      <div className="driver-layout-grid">
        
        {/* Left Column: Driver Info & GPS Simulator Card */}
        {currentDriver && (
          <div className="driver-profile-card">
            <div className="driver-avatar-row">
              <div className="driver-avatar">
                <Bike size={28} color="#fc8019" />
              </div>
              <div>
                <h2 className="driver-name">{currentDriver.name}</h2>
                <span className="driver-phone">{currentDriver.phone}</span>
              </div>
              <div className={`driver-status-badge ${currentDriver.status.toLowerCase()}`}>
                {currentDriver.status}
              </div>
            </div>

            <div className="driver-specs-list">
              <div className="driver-spec-item">
                <span className="spec-label">City Zone</span>
                <span className="spec-val"><strong>{currentDriver.city}</strong></span>
              </div>
              <div className="driver-spec-item">
                <span className="spec-label">Assigned Vehicle</span>
                <span className="spec-val">{currentDriver.vehicleType}</span>
              </div>
              <div className="driver-spec-item">
                <span className="spec-label">GPS Latitude</span>
                <span className="spec-val code-val">{currentDriver.currentLatitude || '28.5700'}</span>
              </div>
              <div className="driver-spec-item">
                <span className="spec-label">GPS Longitude</span>
                <span className="spec-val code-val">{currentDriver.currentLongitude || '77.3220'}</span>
              </div>
              <div className="driver-spec-item">
                <span className="spec-label">Redis Index Key</span>
                <span className="spec-val code-val">drivers:geo</span>
              </div>
            </div>

            {/* GPS Simulation Action */}
            <div className="driver-gps-action-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Navigation size={16} color="#0077b6" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e2229' }}>GPS Telemetry Simulation</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#686b78', marginBottom: '0.85rem', lineHeight: 1.4 }}>
                Simulate driver movement by ~200m. Updates PostgreSQL and runs <code>GEOADD drivers:geo</code> in Redis.
              </p>
              <button
                className="driver-gps-ping-btn"
                onClick={handleSimulateGpsPing}
                disabled={simulatingGps}
              >
                <Navigation size={14} />
                <span>{simulatingGps ? 'Updating GPS...' : 'Simulate GPS Ping'}</span>
              </button>
            </div>

            {/* Redisson Lock Architecture Note */}
            <div className="driver-tech-note">
              <ShieldCheck size={18} color="#2b8a3e" />
              <div>
                <strong>Concurrency Guard:</strong> Order claims use Redisson distributed lock <code>lock:order:dispatch:{'{orderId}'}</code> with 3s acquisition timeout to prevent race conditions.
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Active Mission or Available Delivery Runs */}
        <div className="driver-missions-column">
          
          {/* Conflict Error Notification */}
          {conflictError && (
            <div className="driver-conflict-alert">
              <AlertCircle size={20} color="#e03131" />
              <div>
                <strong>Order Claim Conflict:</strong> {conflictError}
              </div>
            </div>
          )}

          {/* ACTIVE IN-PROGRESS MISSION */}
          {activeMission ? (
            <div className="driver-active-mission-card">
              <div className="mission-card-header">
                <div>
                  <span className="mission-tag">ACTIVE DELIVERY MISSION</span>
                  <h3 className="mission-order-title">Order #ORD-{activeMission.id}</h3>
                </div>
                <div className="mission-payout-badge">
                  <Coins size={16} color="#2b8a3e" />
                  <span>Est. Payout: <strong>₹65.00</strong></span>
                </div>
              </div>

              {/* Mission Details Grid */}
              <div className="mission-details-grid">
                <div className="mission-step">
                  <div className="mission-step-icon pickup">
                    <Store size={18} />
                  </div>
                  <div>
                    <span className="mission-step-label">PICKUP FROM</span>
                    <strong className="mission-step-val">{activeMission.restaurantName}</strong>
                    <p className="mission-step-sub">{activeMission.restaurantAddress || `${activeMission.restaurantCity} Central`}</p>
                  </div>
                </div>

                <div className="mission-step">
                  <div className="mission-step-icon dropoff">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <span className="mission-step-label">DELIVER TO</span>
                    <strong className="mission-step-val">{activeMission.customerName || 'Customer'}</strong>
                    <p className="mission-step-sub">{activeMission.deliveryAddress}</p>
                    {activeMission.contactPhone && (
                      <span className="mission-step-phone">📞 {activeMission.contactPhone}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Items Summary */}
              <div className="mission-items-summary">
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#495057' }}>Dishes in Order:</span>
                <div className="mission-items-chips">
                  {activeMission.items?.map((item, idx) => (
                    <span key={idx} className="mission-item-chip">
                      {item.quantity}x {item.itemName}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons based on status */}
              <div className="mission-action-bar">
                {activeMission.status === 'READY_FOR_PICKUP' || activeMission.status === 'PREPARING' ? (
                  <button
                    className="mission-primary-btn pickup-btn"
                    onClick={() => handlePickup(activeMission.id)}
                    disabled={actionLoading}
                  >
                    <PackageCheck size={20} />
                    <span>{actionLoading ? 'Updating...' : 'Arrived at Restaurant & Pick Up Order'}</span>
                  </button>
                ) : activeMission.status === 'OUT_FOR_DELIVERY' ? (
                  <button
                    className="mission-primary-btn deliver-btn"
                    onClick={() => handleDeliver(activeMission.id)}
                    disabled={actionLoading}
                  >
                    <CheckCircle2 size={20} />
                    <span>{actionLoading ? 'Finalizing...' : 'Deliver to Customer & Collect Payout (₹65)'}</span>
                  </button>
                ) : (
                  <div className="mission-completed-msg">
                    <CheckCircle2 size={18} color="#2b8a3e" />
                    <span>Mission completed! Status: {activeMission.status}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* AVAILABLE RUNS (when driver is free) */
            <div className="driver-available-runs-section">
              <div className="available-runs-header">
                <div>
                  <h3 className="available-runs-title">
                    Nearby Delivery Runs Available
                  </h3>
                  <p className="available-runs-sub">
                    Orders ready or preparing within 6km of {currentDriver?.name}'s location in {currentDriver?.city}.
                  </p>
                </div>
                <span className="runs-count-badge">
                  {availableRuns.length} Available
                </span>
              </div>

              {availableRuns.length === 0 ? (
                <div className="no-runs-box">
                  <Clock size={40} color="#adb5bd" />
                  <h4>No Available Runs Right Now</h4>
                  <p>
                    Place an order from the customer storefront and accept it in Kitchen KDS to see live delivery runs appear here!
                  </p>
                </div>
              ) : (
                <div className="runs-list">
                  {availableRuns.map((run) => (
                    <div key={run.id} className="run-card">
                      <div className="run-card-top">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="run-id">#ORD-{run.id}</span>
                            <span className={`run-status-pill ${run.status.toLowerCase()}`}>
                              {run.status === 'READY_FOR_PICKUP' ? '⚡ Food Ready' : '🍳 Preparing'}
                            </span>
                          </div>
                          <h4 className="run-restaurant-name">{run.restaurantName}</h4>
                          <p className="run-restaurant-address">{run.restaurantAddress}</p>
                        </div>

                        <div className="run-payout-box">
                          <span className="run-payout-label">Payout</span>
                          <span className="run-payout-amount">₹{run.estimatedPayout || '52.00'}</span>
                        </div>
                      </div>

                      <div className="run-card-meta">
                        <div className="run-meta-item">
                          <MapPin size={14} color="#fc8019" />
                          <span>Distance: <strong>{run.distanceToRestaurantKm || 1.2} km</strong></span>
                        </div>
                        <div className="run-meta-item">
                          <Navigation size={14} color="#0077b6" />
                          <span>To: <strong>{run.deliveryAddress?.slice(0, 28)}...</strong></span>
                        </div>
                        <div className="run-meta-item">
                          <Coins size={14} color="#2b8a3e" />
                          <span>Order Total: <strong>₹{run.totalAmount}</strong></span>
                        </div>
                      </div>

                      <div className="run-card-footer">
                        <span className="run-items-snippet">
                          {run.items?.length || 1} items &bull; {run.items?.[0]?.itemName}
                        </span>

                        <button
                          className="run-claim-btn"
                          onClick={() => handleAcceptRun(run.id)}
                          disabled={actionLoading}
                        >
                          <span>Claim Delivery</span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
