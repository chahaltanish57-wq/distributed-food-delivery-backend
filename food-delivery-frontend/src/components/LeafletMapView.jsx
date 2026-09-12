import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Calculate bearing angle between two lat/lng points in degrees
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (toDeg(theta) + 360) % 360;
}

// Interpolate along a multi-point polyline given progress ratio (0.0 - 1.0)
function interpolatePolyline(points, progress) {
  if (!points || points.length === 0) return { lat: 28.5672, lng: 77.3342, bearing: 0, index: 0 };
  if (points.length === 1) return { lat: points[0][0], lng: points[0][1], bearing: 0, index: 0 };

  const clamped = Math.max(0.0, Math.min(1.0, progress));

  // Compute segment lengths
  const segmentLengths = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dLat = points[i + 1][0] - points[i][0];
    const dLng = points[i + 1][1] - points[i][1];
    const len = Math.sqrt(dLat * dLat + dLng * dLng);
    segmentLengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) return { lat: points[0][0], lng: points[0][1], bearing: 0, index: 0 };

  const targetDist = clamped * totalLength;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const nextAcc = accumulated + segmentLengths[i];
    if (targetDist <= nextAcc || i === segmentLengths.length - 1) {
      const segRatio = segmentLengths[i] > 0 ? (targetDist - accumulated) / segmentLengths[i] : 0;
      const lat = points[i][0] + segRatio * (points[i + 1][0] - points[i][0]);
      const lng = points[i][1] + segRatio * (points[i + 1][1] - points[i][1]);
      const bearing = calculateBearing(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
      return { lat, lng, bearing, index: i };
    }
    accumulated = nextAcc;
  }

  const last = points[points.length - 1];
  return { lat: last[0], lng: last[1], bearing: 0, index: points.length - 1 };
}

export default function LeafletMapView({
  trackingData,
  isDeliveryLeg,
  pickupProgress,
  deliveryProgress,
  theme,
  isLiveDriving,
  isLivePickupDriving
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const restMarkerRef = useRef(null);
  const custMarkerRef = useRef(null);
  const outpostMarkerRef = useRef(null);
  const plannedPolylineRef = useRef(null);
  const traveledPolylineRef = useRef(null);

  const [pickupRoutePoints, setPickupRoutePoints] = useState([]);
  const [deliveryRoutePoints, setDeliveryRoutePoints] = useState([]);

  // Detect City & Resolve Authentic GPS coordinates
  const isDehradun = useMemo(() => {
    return (
      trackingData?.restaurantAddress?.toLowerCase().includes('dehradun') ||
      trackingData?.deliveryAddress?.toLowerCase().includes('dehradun') ||
      trackingData?.restaurantName?.toLowerCase().includes('paltan') ||
      trackingData?.restaurantName?.toLowerCase().includes('rajpur')
    );
  }, [trackingData]);

  // Real GPS Waypoints
  const coordinates = useMemo(() => {
    if (isDehradun) {
      return {
        restaurant: [
          trackingData?.restaurantLatitude ? parseFloat(trackingData.restaurantLatitude) : 30.3244,
          trackingData?.restaurantLongitude ? parseFloat(trackingData.restaurantLongitude) : 78.0418
        ], // Paltan Bazaar, Dehradun
        customer: [
          trackingData?.deliveryLatitude ? parseFloat(trackingData.deliveryLatitude) : 30.3421,
          trackingData?.deliveryLongitude ? parseFloat(trackingData.deliveryLongitude) : 78.0583
        ], // Rajpur Road, Dehradun
        outpost: [30.3160, 78.0380] // Dehradun Station / Outpost
      };
    } else {
      return {
        restaurant: [
          trackingData?.restaurantLatitude ? parseFloat(trackingData.restaurantLatitude) : 28.5672,
          trackingData?.restaurantLongitude ? parseFloat(trackingData.restaurantLongitude) : 77.3342
        ], // Sector 29 Brahmaputra Market, Noida
        customer: [
          trackingData?.deliveryLatitude ? parseFloat(trackingData.deliveryLatitude) : 28.5708,
          trackingData?.deliveryLongitude ? parseFloat(trackingData.deliveryLongitude) : 77.3219
        ], // Sector 18 / Wave Mall, Noida
        outpost: [28.5605, 77.3342] // Sector 29 South Feeder Outpost
      };
    }
  }, [isDehradun, trackingData]);

  // Fetch Real Road Geometry from Open Source Routing Machine (OSRM)
  useEffect(() => {
    let isMounted = true;

    async function fetchRoutes() {
      try {
        // 1. Fetch Pickup Route: Outpost -> Restaurant
        const pickupUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates.outpost[1]},${coordinates.outpost[0]};${coordinates.restaurant[1]},${coordinates.restaurant[0]}?overview=full&geometries=geojson`;
        const pickupRes = await fetch(pickupUrl).then((r) => r.json());
        if (isMounted && pickupRes.routes && pickupRes.routes[0]) {
          const pts = pickupRes.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          setPickupRoutePoints(pts);
        } else {
          // Fallback straight corridor
          setPickupRoutePoints([coordinates.outpost, coordinates.restaurant]);
        }
      } catch (err) {
        if (isMounted) setPickupRoutePoints([coordinates.outpost, coordinates.restaurant]);
      }

      try {
        // 2. Fetch Delivery Route: Restaurant -> Customer
        const deliveryUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates.restaurant[1]},${coordinates.restaurant[0]};${coordinates.customer[1]},${coordinates.customer[0]}?overview=full&geometries=geojson`;
        const deliveryRes = await fetch(deliveryUrl).then((r) => r.json());
        if (isMounted && deliveryRes.routes && deliveryRes.routes[0]) {
          const pts = deliveryRes.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          setDeliveryRoutePoints(pts);
        } else {
          // Fallback realistic road corridor
          setDeliveryRoutePoints([coordinates.restaurant, coordinates.customer]);
        }
      } catch (err) {
        if (isMounted) setDeliveryRoutePoints([coordinates.restaurant, coordinates.customer]);
      }
    }

    fetchRoutes();
    return () => {
      isMounted = false;
    };
  }, [coordinates]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialCenter = coordinates.restaurant;
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 14,
        zoomControl: false,
        attributionControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Attribution
      L.control
        .attribution({ position: 'bottomleft', prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors')
        .addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Switch Tile Layer based on theme (Light vs Dark)
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl =
      theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const newTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    tileLayerRef.current = newTileLayer;

    // Invalidate map size to ensure tiles render sharply
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }, [theme, coordinates]);

  // Destroy map on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Static Destination Markers & Fit Bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Restaurant Icon
    const restIcon = L.divIcon({
      className: 'osm-custom-marker',
      html: `
        <div class="osm-marker-pin rest">
          <div class="osm-pin-pulse"></div>
          <div class="osm-pin-icon">🏪</div>
          <div class="osm-pin-label">${trackingData?.restaurantName || 'Restaurant'}</div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    if (restMarkerRef.current) {
      restMarkerRef.current.setLatLng(coordinates.restaurant);
    } else {
      restMarkerRef.current = L.marker(coordinates.restaurant, { icon: restIcon }).addTo(map);
    }

    // 2. Customer Dropoff Icon
    const custIcon = L.divIcon({
      className: 'osm-custom-marker',
      html: `
        <div class="osm-marker-pin cust">
          <div class="osm-pin-pulse blue"></div>
          <div class="osm-pin-icon">📍</div>
          <div class="osm-pin-label">${trackingData?.customerName || 'Delivery Gate'}</div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    if (custMarkerRef.current) {
      custMarkerRef.current.setLatLng(coordinates.customer);
    } else {
      custMarkerRef.current = L.marker(coordinates.customer, { icon: custIcon }).addTo(map);
    }

    // 3. Driver Dispatch Outpost Icon
    const outpostIcon = L.divIcon({
      className: 'osm-custom-marker',
      html: `
        <div class="osm-marker-pin outpost">
          <div class="osm-pin-icon">🛵</div>
          <div class="osm-pin-label">Dispatch Outpost</div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (outpostMarkerRef.current) {
      outpostMarkerRef.current.setLatLng(coordinates.outpost);
    } else {
      outpostMarkerRef.current = L.marker(coordinates.outpost, { icon: outpostIcon }).addTo(map);
    }

    // Fit bounds including all markers
    const bounds = L.latLngBounds([
      coordinates.outpost,
      coordinates.restaurant,
      coordinates.customer
    ]);
    map.fitBounds(bounds, { padding: [55, 55], maxZoom: 15 });
  }, [coordinates, trackingData?.restaurantName, trackingData?.customerName]);

  // Compute Active Route Points & Biker Position
  const activeRoute = isDeliveryLeg ? deliveryRoutePoints : pickupRoutePoints;
  const activeRatio = isDeliveryLeg ? deliveryProgress : pickupProgress;

  const currentNav = useMemo(() => {
    return interpolatePolyline(activeRoute, activeRatio);
  }, [activeRoute, activeRatio]);

  // Update Route Polylines on Leaflet
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || activeRoute.length < 2) return;

    // Planned Route Line
    if (plannedPolylineRef.current) {
      plannedPolylineRef.current.setLatLngs(activeRoute);
      plannedPolylineRef.current.setStyle({
        color: isDeliveryLeg ? '#00b074' : '#fc8019',
        dashArray: '8, 8',
        opacity: 0.6,
        weight: 5
      });
    } else {
      plannedPolylineRef.current = L.polyline(activeRoute, {
        color: isDeliveryLeg ? '#00b074' : '#fc8019',
        dashArray: '8, 8',
        opacity: 0.6,
        weight: 5
      }).addTo(map);
    }

    // Traveled Sub-route Line
    const traveledPoints = activeRoute.slice(0, currentNav.index + 1);
    traveledPoints.push([currentNav.lat, currentNav.lng]);

    if (traveledPolylineRef.current) {
      traveledPolylineRef.current.setLatLngs(traveledPoints);
      traveledPolylineRef.current.setStyle({
        color: isDeliveryLeg ? '#00b074' : '#fc8019',
        opacity: 0.95,
        weight: 7
      });
    } else {
      traveledPolylineRef.current = L.polyline(traveledPoints, {
        color: isDeliveryLeg ? '#00b074' : '#fc8019',
        opacity: 0.95,
        weight: 7
      }).addTo(map);
    }
  }, [activeRoute, currentNav, isDeliveryLeg]);

  // Update Live Biker Marker with Real-World Road Bearing Angle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const driverName = trackingData?.driverName ? trackingData.driverName.split(' ')[0] : 'Partner';
    const tagText = isDeliveryLeg
      ? `${Math.round(activeRatio * 100)}%`
      : (pickupProgress >= 0.95 ? 'At Restaurant' : 'To Pickup');

    const bikerHtml = `
      <div class="osm-biker-marker ${isDeliveryLeg ? 'delivery-mode' : 'pickup-mode'}">
        <div class="biker-beacon-glow"></div>
        <div class="biker-icon-wheel" style="transform: rotate(${currentNav.bearing}deg);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="5.5" cy="17.5" r="2.5" />
            <circle cx="18.5" cy="17.5" r="2.5" />
            <path d="M15 6h1a2 2 0 0 1 2 2v2M9 14.5 12 7l4 4M12 14.5l-3-4" />
          </svg>
        </div>
        <div class="biker-popup-badge">
          <strong>${driverName}</strong> • ${tagText}
        </div>
      </div>
    `;

    const bikerIcon = L.divIcon({
      className: 'osm-biker-divicon',
      html: bikerHtml,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([currentNav.lat, currentNav.lng]);
      driverMarkerRef.current.setIcon(bikerIcon);
    } else {
      driverMarkerRef.current = L.marker([currentNav.lat, currentNav.lng], {
        icon: bikerIcon,
        zIndexOffset: 1000
      }).addTo(map);
    }
  }, [currentNav, isDeliveryLeg, activeRatio, pickupProgress, trackingData?.driverName]);

  return (
    <div className="osm-map-wrapper">
      <div ref={mapContainerRef} className="osm-leaflet-canvas" />

      {/* Floating GPS Telemetry Overlay */}
      <div className="osm-floating-hud">
        <div className="osm-hud-chip">
          <span className="osm-chip-dot"></span>
          <span><strong>OSM Live GPS:</strong> {currentNav.lat.toFixed(5)}, {currentNav.lng.toFixed(5)}</span>
        </div>
        <div className="osm-hud-chip city">
          <span>📍 <strong>{isDehradun ? 'Dehradun Real Network' : 'Noida Metro Corridor'}</strong></span>
        </div>
      </div>
    </div>
  );
}
