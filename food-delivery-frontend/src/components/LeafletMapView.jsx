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

// Pre-baked authentic road geometries for instant zero-lag rendering
const PREBAKED_ROUTES = {
  noida: {
    pickup: [
      [28.5605, 77.3342],
      [28.5625, 77.3342],
      [28.5650, 77.3342],
      [28.5672, 77.3342]
    ],
    delivery: [
      [28.5672, 77.3342],
      [28.5675, 77.3315],
      [28.5678, 77.3275],
      [28.5695, 77.3245],
      [28.5708, 77.3219]
    ]
  },
  dehradun: {
    pickup: [
      [30.3160, 78.0380],
      [30.3195, 78.0395],
      [30.3222, 78.0408],
      [30.3244, 78.0418]
    ],
    delivery: [
      [30.3244, 78.0418],
      [30.3288, 78.0465],
      [30.3345, 78.0520],
      [30.3385, 78.0555],
      [30.3421, 78.0583]
    ]
  }
};

export default function LeafletMapView({
  trackingData,
  isDeliveryLeg,
  pickupProgress = 0,
  deliveryProgress = 0,
  theme = 'light'
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
  const initialFitDoneRef = useRef(false);

  // Stable primitives from trackingData to prevent re-render loops on driver ticks
  const restaurantId = trackingData?.restaurantId;
  const orderId = trackingData?.orderId;
  const restaurantName = trackingData?.restaurantName || 'Restaurant';
  const customerName = trackingData?.customerName || 'Delivery Gate';
  const driverName = trackingData?.driverName ? trackingData.driverName.split(' ')[0] : 'Partner';

  // Detect City from address/name
  const isDehradun = useMemo(() => {
    const text = (
      (trackingData?.restaurantAddress || '') +
      ' ' +
      (trackingData?.deliveryAddress || '') +
      ' ' +
      (trackingData?.restaurantName || '')
    ).toLowerCase();
    return text.includes('dehradun') || text.includes('rajpur') || text.includes('paltan');
  }, [trackingData?.restaurantAddress, trackingData?.deliveryAddress, trackingData?.restaurantName]);

  const cityKey = isDehradun ? 'dehradun' : 'noida';

  // Fixed static landmarks for the order (DO NOT depend on driver live coordinates!)
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
        outpost: [30.3160, 78.0380] // Dehradun Outpost
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
  }, [isDehradun, restaurantId, orderId]);

  // Initial road points from pre-baked corridors so lines render instantly
  const [pickupRoutePoints, setPickupRoutePoints] = useState(() => PREBAKED_ROUTES[cityKey].pickup);
  const [deliveryRoutePoints, setDeliveryRoutePoints] = useState(() => PREBAKED_ROUTES[cityKey].delivery);

  // 1. Fetch High-Accuracy OSRM Road Geometry (ONLY ONCE when city/order changes)
  useEffect(() => {
    let isMounted = true;
    setPickupRoutePoints(PREBAKED_ROUTES[cityKey].pickup);
    setDeliveryRoutePoints(PREBAKED_ROUTES[cityKey].delivery);

    async function fetchRoutes() {
      try {
        const pickupUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates.outpost[1]},${coordinates.outpost[0]};${coordinates.restaurant[1]},${coordinates.restaurant[0]}?overview=full&geometries=geojson`;
        const pickupRes = await fetch(pickupUrl).then((r) => r.json());
        if (isMounted && pickupRes.routes && pickupRes.routes[0]?.geometry?.coordinates?.length > 1) {
          const pts = pickupRes.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          setPickupRoutePoints(pts);
        }
      } catch (err) {
        // Fallback pre-baked routes already set
      }

      try {
        const deliveryUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates.restaurant[1]},${coordinates.restaurant[0]};${coordinates.customer[1]},${coordinates.customer[0]}?overview=full&geometries=geojson`;
        const deliveryRes = await fetch(deliveryUrl).then((r) => r.json());
        if (isMounted && deliveryRes.routes && deliveryRes.routes[0]?.geometry?.coordinates?.length > 1) {
          const pts = deliveryRes.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          setDeliveryRoutePoints(pts);
        }
      } catch (err) {
        // Fallback pre-baked routes already set
      }
    }

    fetchRoutes();
    return () => {
      isMounted = false;
    };
  }, [cityKey, coordinates.restaurant[0], coordinates.restaurant[1], coordinates.customer[0], coordinates.customer[1]]);

  // 2. Initialize Leaflet Map ONCE on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: coordinates.restaurant,
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: false, // Prevents grey flickering during layer updates
        zoomAnimation: true
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.control
        .attribution({ position: 'bottomleft', prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>')
        .addTo(map);

      // Add CartoDB Fastly CDN Tile Layer (Voyager for light, Dark Matter for dark)
      // CartoDB supports full 'abcd' subdomains without rate-limiting or grey boxes!
      const initialTileUrl =
        theme === 'dark'
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

      const tileLayer = L.tileLayer(initialTileUrl, {
        maxZoom: 20,
        subdomains: 'abcd'
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;

      // Force layout size detection at staggered intervals
      map.invalidateSize();
      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 400);

      // Auto resize listener
      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        initialFitDoneRef.current = false;
      }
    };
  }, []);

  // 3. Smooth Tile Layer Switching on Theme change (WITHOUT destroying map)
  useEffect(() => {
    const tileLayer = tileLayerRef.current;
    if (!tileLayer) return;

    const nextUrl =
      theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    tileLayer.setUrl(nextUrl);
  }, [theme]);

  // 4. Create / Update Static Landmark Markers & Bounds (ONCE or on order change)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Restaurant Marker
    const restHtml = `
      <div class="osm-marker-pin rest">
        <div class="osm-pin-pulse"></div>
        <div class="osm-pin-icon">🏪</div>
        <div class="osm-pin-label">${restaurantName}</div>
      </div>
    `;
    const restIcon = L.divIcon({
      className: 'osm-custom-marker',
      html: restHtml,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    if (restMarkerRef.current) {
      restMarkerRef.current.setLatLng(coordinates.restaurant);
      restMarkerRef.current.setIcon(restIcon);
    } else {
      restMarkerRef.current = L.marker(coordinates.restaurant, { icon: restIcon }).addTo(map);
    }

    // 2. Customer Marker
    const custHtml = `
      <div class="osm-marker-pin cust">
        <div class="osm-pin-pulse blue"></div>
        <div class="osm-pin-icon">📍</div>
        <div class="osm-pin-label">${customerName}</div>
      </div>
    `;
    const custIcon = L.divIcon({
      className: 'osm-custom-marker',
      html: custHtml,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    if (custMarkerRef.current) {
      custMarkerRef.current.setLatLng(coordinates.customer);
      custMarkerRef.current.setIcon(custIcon);
    } else {
      custMarkerRef.current = L.marker(coordinates.customer, { icon: custIcon }).addTo(map);
    }

    // 3. Outpost Marker
    const outpostHtml = `
      <div class="osm-marker-pin outpost">
        <div class="osm-pin-icon">🛵</div>
        <div class="osm-pin-label">Dispatch Outpost</div>
      </div>
    `;
    const outpostIcon = L.divIcon({
      className: 'osm-custom-marker',
      html: outpostHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (outpostMarkerRef.current) {
      outpostMarkerRef.current.setLatLng(coordinates.outpost);
      outpostMarkerRef.current.setIcon(outpostIcon);
    } else {
      outpostMarkerRef.current = L.marker(coordinates.outpost, { icon: outpostIcon }).addTo(map);
    }

    // Fit bounds ONLY ONCE initially so user map panning is preserved
    if (!initialFitDoneRef.current) {
      const bounds = L.latLngBounds([
        coordinates.outpost,
        coordinates.restaurant,
        coordinates.customer
      ]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      initialFitDoneRef.current = true;
    }
  }, [coordinates, restaurantName, customerName]);

  // Compute Active Route Points & Biker Position
  const activeRoute = isDeliveryLeg ? deliveryRoutePoints : pickupRoutePoints;
  const activeRatio = isDeliveryLeg ? deliveryProgress : pickupProgress;

  const currentNav = useMemo(() => {
    return interpolatePolyline(activeRoute, activeRatio);
  }, [activeRoute, activeRatio]);

  // 5. Update Route Polylines (Planned & Traveled)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || activeRoute.length < 2) return;

    const routeColor = isDeliveryLeg ? '#00b074' : '#fc8019';

    // Planned dashed line
    if (plannedPolylineRef.current) {
      plannedPolylineRef.current.setLatLngs(activeRoute);
      plannedPolylineRef.current.setStyle({
        color: routeColor,
        dashArray: '8, 8',
        opacity: 0.6,
        weight: 5
      });
    } else {
      plannedPolylineRef.current = L.polyline(activeRoute, {
        color: routeColor,
        dashArray: '8, 8',
        opacity: 0.6,
        weight: 5
      }).addTo(map);
    }

    // Traveled solid line
    const traveledPoints = activeRoute.slice(0, currentNav.index + 1);
    traveledPoints.push([currentNav.lat, currentNav.lng]);

    if (traveledPolylineRef.current) {
      traveledPolylineRef.current.setLatLngs(traveledPoints);
      traveledPolylineRef.current.setStyle({
        color: routeColor,
        opacity: 0.95,
        weight: 7
      });
    } else {
      traveledPolylineRef.current = L.polyline(traveledPoints, {
        color: routeColor,
        opacity: 0.95,
        weight: 7
      }).addTo(map);
    }
  }, [activeRoute, currentNav.index, currentNav.lat, currentNav.lng, isDeliveryLeg]);

  // 6. Smooth 60FPS Driver Marker Updates (NO DOM DESTRUCTION)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const tagText = isDeliveryLeg
      ? `${Math.round(activeRatio * 100)}%`
      : (pickupProgress >= 0.95 ? 'At Restaurant' : 'To Pickup');

    // If marker doesn't exist yet, create it once with DOM structure
    if (!driverMarkerRef.current) {
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
            <strong>${driverName}</strong> • <span class="biker-popup-tag">${tagText}</span>
          </div>
        </div>
      `;

      const bikerIcon = L.divIcon({
        className: 'osm-biker-divicon',
        html: bikerHtml,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      driverMarkerRef.current = L.marker([currentNav.lat, currentNav.lng], {
        icon: bikerIcon,
        zIndexOffset: 1000
      }).addTo(map);

    } else {
      // Fast in-place position update without rebuilding icon
      driverMarkerRef.current.setLatLng([currentNav.lat, currentNav.lng]);

      // Direct DOM style updates for heading rotation and text (instant 60 FPS)
      const el = driverMarkerRef.current.getElement();
      if (el) {
        const wheel = el.querySelector('.biker-icon-wheel');
        if (wheel) {
          wheel.style.transform = `rotate(${currentNav.bearing}deg)`;
        }
        const tag = el.querySelector('.biker-popup-tag');
        if (tag) {
          tag.innerText = tagText;
        }
        const markerRoot = el.querySelector('.osm-biker-marker');
        if (markerRoot) {
          markerRoot.className = `osm-biker-marker ${isDeliveryLeg ? 'delivery-mode' : 'pickup-mode'}`;
        }
      }
    }
  }, [currentNav.lat, currentNav.lng, currentNav.bearing, isDeliveryLeg, activeRatio, pickupProgress, driverName]);

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
