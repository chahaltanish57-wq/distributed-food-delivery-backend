package com.fooddelivery.service;

import com.fooddelivery.common.dto.TrackingUpdateDTO;
import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.entity.DeliveryPartner;
import com.fooddelivery.entity.Order;
import com.fooddelivery.repository.DeliveryPartnerRepository;
import com.fooddelivery.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderTrackingService {

    public static final String TRACKING_TOPIC_PREFIX = "/topic/orders/";
    public static final String TRACKING_TOPIC_SUFFIX = "/tracking";

    private final SimpMessagingTemplate messagingTemplate;
    private final OrderRepository orderRepository;
    private final DeliveryPartnerRepository deliveryPartnerRepository;

    /**
     * Retrieve the current tracking snapshot for an order.
     */
    @Transactional(readOnly = true)
    public TrackingUpdateDTO getTrackingSnapshot(Long orderId) {
        Order order = orderRepository.findWithDetailsById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + orderId));

        DeliveryPartner driver = null;
        if (order.getDeliveryPartnerId() != null) {
            driver = deliveryPartnerRepository.findById(order.getDeliveryPartnerId()).orElse(null);
        }

        return buildTrackingDTO(order, driver, null, null, null, null);
    }

    /**
     * Broadcast tracking update to connected STOMP subscribers on /topic/orders/{orderId}/tracking
     */
    public TrackingUpdateDTO broadcastTrackingUpdate(Long orderId, TrackingUpdateDTO update) {
        String destination = TRACKING_TOPIC_PREFIX + orderId + TRACKING_TOPIC_SUFFIX;
        messagingTemplate.convertAndSend(destination, update);
        log.info("[WebSocket STOMP] Broadcasted tracking telemetry for Order #{} to destination [{}] (Status: {}, Lat: {}, Lng: {})",
                orderId, destination, update.getOrderStatus(), update.getCurrentLatitude(), update.getCurrentLongitude());
        return update;
    }

    /**
     * Refresh snapshot and broadcast current order state.
     */
    @Transactional(readOnly = true)
    public TrackingUpdateDTO broadcastOrderState(Long orderId) {
        TrackingUpdateDTO snapshot = getTrackingSnapshot(orderId);
        return broadcastTrackingUpdate(orderId, snapshot);
    }

    /**
     * Manually ping driver location for an order and broadcast over WebSocket.
     */
    @Transactional
    public TrackingUpdateDTO pingDriverLocation(Long orderId, BigDecimal lat, BigDecimal lng, Double heading) {
        Order order = orderRepository.findWithDetailsById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + orderId));

        DeliveryPartner driver = null;
        if (order.getDeliveryPartnerId() != null) {
            driver = deliveryPartnerRepository.findById(order.getDeliveryPartnerId()).orElse(null);
            if (driver != null) {
                driver.setCurrentLatitude(lat);
                driver.setCurrentLongitude(lng);
                deliveryPartnerRepository.save(driver);
            }
        }

        TrackingUpdateDTO update = buildTrackingDTO(order, driver, lat, lng, heading, null);
        return broadcastTrackingUpdate(orderId, update);
    }

    /**
     * Simulate progress along the route between restaurant and customer dropoff (0.0 = at restaurant, 1.0 = at customer).
     */
    @Transactional
    public TrackingUpdateDTO simulateStep(Long orderId, double progressRatio) {
        Order order = orderRepository.findWithDetailsById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + orderId));

        double rLat = order.getRestaurant() != null ? order.getRestaurant().getLatitude().doubleValue() : 28.5672;
        double rLng = order.getRestaurant() != null ? order.getRestaurant().getLongitude().doubleValue() : 77.3342;

        BigDecimal custLatBD = order.getDeliveryLatitude();
        BigDecimal custLngBD = order.getDeliveryLongitude();
        double cLat = custLatBD != null ? custLatBD.doubleValue() : defaultCustomerLat(order.getRestaurant() != null ? order.getRestaurant().getCity() : "Noida");
        double cLng = custLngBD != null ? custLngBD.doubleValue() : defaultCustomerLng(order.getRestaurant() != null ? order.getRestaurant().getCity() : "Noida");

        // Linear interpolation with a small realistic sinusoidal road curvature
        double clampedRatio = Math.max(0.0, Math.min(1.0, progressRatio));
        double roadJitterLat = Math.sin(clampedRatio * Math.PI) * 0.0015;
        double roadJitterLng = Math.sin(clampedRatio * Math.PI) * 0.0012;

        double currentLatDouble = rLat + ((cLat - rLat) * clampedRatio) + roadJitterLat;
        double currentLngDouble = rLng + ((cLng - rLng) * clampedRatio) + roadJitterLng;

        BigDecimal currentLat = BigDecimal.valueOf(currentLatDouble).setScale(7, RoundingMode.HALF_UP);
        BigDecimal currentLng = BigDecimal.valueOf(currentLngDouble).setScale(7, RoundingMode.HALF_UP);

        // Heading in degrees towards destination
        double heading = Math.toDegrees(Math.atan2(cLng - rLng, cLat - rLat));
        if (heading < 0) heading += 360.0;

        DeliveryPartner driver = null;
        if (order.getDeliveryPartnerId() != null) {
            driver = deliveryPartnerRepository.findById(order.getDeliveryPartnerId()).orElse(null);
            if (driver != null) {
                driver.setCurrentLatitude(currentLat);
                driver.setCurrentLongitude(currentLng);
                deliveryPartnerRepository.save(driver);
            }
        }

        // Auto-progress order state in DB during tracking simulation
        if (clampedRatio >= 0.98) {
            if (order.getStatus() != OrderStatus.DELIVERED) {
                order.setStatus(OrderStatus.DELIVERED);
                orderRepository.save(order);
                log.info("Order #{} marked as DELIVERED via tracking simulation", orderId);
            }
        } else if (clampedRatio >= 0.05) {
            if (order.getStatus() == OrderStatus.READY_FOR_PICKUP ||
                order.getStatus() == OrderStatus.PREPARING ||
                order.getStatus() == OrderStatus.RESTAURANT_ACCEPTED) {
                order.setStatus(OrderStatus.OUT_FOR_DELIVERY);
                orderRepository.save(order);
                log.info("Order #{} transitioned to OUT_FOR_DELIVERY via tracking simulation", orderId);
            }
        }

        int progressPercent = (int) Math.round(clampedRatio * 100.0);
        TrackingUpdateDTO update = buildTrackingDTO(order, driver, currentLat, currentLng, heading, progressPercent);
        return broadcastTrackingUpdate(orderId, update);
    }

    /**
     * Broadcast location updates for all active orders assigned to a driver.
     */
    @Transactional(readOnly = true)
    public void broadcastActiveOrdersForDriver(Long driverId, BigDecimal lat, BigDecimal lng) {
        List<Order> activeOrders = orderRepository.findByDeliveryPartnerIdAndStatusIn(
                driverId,
                List.of(OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY)
        );

        for (Order order : activeOrders) {
            try {
                DeliveryPartner driver = deliveryPartnerRepository.findById(driverId).orElse(null);
                TrackingUpdateDTO dto = buildTrackingDTO(order, driver, lat, lng, null, null);
                broadcastTrackingUpdate(order.getId(), dto);
            } catch (Exception e) {
                log.warn("Failed to broadcast tracking for Order #{} on driver update: {}", order.getId(), e.getMessage());
            }
        }
    }

    private TrackingUpdateDTO buildTrackingDTO(
            Order order,
            DeliveryPartner driver,
            BigDecimal overrideLat,
            BigDecimal overrideLng,
            Double heading,
            Integer overrideProgress) {

        String city = order.getRestaurant() != null ? order.getRestaurant().getCity() : "Noida";

        BigDecimal restLat = order.getRestaurant() != null ? order.getRestaurant().getLatitude() : new BigDecimal("28.5672000");
        BigDecimal restLng = order.getRestaurant() != null ? order.getRestaurant().getLongitude() : new BigDecimal("77.3342000");

        BigDecimal custLat = order.getDeliveryLatitude() != null ? order.getDeliveryLatitude() : BigDecimal.valueOf(defaultCustomerLat(city));
        BigDecimal custLng = order.getDeliveryLongitude() != null ? order.getDeliveryLongitude() : BigDecimal.valueOf(defaultCustomerLng(city));

        // Determine current coordinates
        BigDecimal currLat = overrideLat;
        BigDecimal currLng = overrideLng;

        if (currLat == null || currLng == null) {
            if (driver != null && driver.getCurrentLatitude() != null && driver.getCurrentLongitude() != null) {
                currLat = driver.getCurrentLatitude();
                currLng = driver.getCurrentLongitude();
            } else if (order.getStatus() == OrderStatus.DELIVERED) {
                currLat = custLat;
                currLng = custLng;
            } else {
                currLat = restLat;
                currLng = restLng;
            }
        }

        // Calculate distance remaining to customer
        double distKm = calculateHaversineKm(
                currLat.doubleValue(),
                currLng.doubleValue(),
                custLat.doubleValue(),
                custLng.doubleValue()
        );
        distKm = Math.round(distKm * 10.0) / 10.0;

        // Calculate ETA
        int etaMinutes = 0;
        if (order.getStatus() == OrderStatus.DELIVERED) {
            etaMinutes = 0;
        } else {
            // Speed ~25 km/h for delivery bike + 4 mins buffer
            etaMinutes = Math.max(3, (int) Math.ceil((distKm / 25.0) * 60.0) + 4);
        }

        // Progress percentage calculation
        int progress = overrideProgress != null ? overrideProgress : calculateDefaultProgress(order.getStatus());

        return TrackingUpdateDTO.builder()
                .orderId(order.getId())
                .orderStatus(order.getStatus())
                .driverId(driver != null ? driver.getId() : null)
                .driverName(driver != null ? driver.getName() : null)
                .driverPhone(driver != null ? driver.getPhone() : null)
                .vehicleType(driver != null ? driver.getVehicleType() : null)
                .currentLatitude(currLat)
                .currentLongitude(currLng)
                .headingDegrees(heading != null ? heading : 45.0)
                .distanceRemainingKm(distKm)
                .etaMinutes(etaMinutes)
                .progressPercent(progress)
                .restaurantId(order.getRestaurant() != null ? order.getRestaurant().getId() : null)
                .restaurantName(order.getRestaurant() != null ? order.getRestaurant().getName() : "Restaurant")
                .restaurantAddress(order.getRestaurant() != null ? order.getRestaurant().getAddress() : "")
                .restaurantLatitude(restLat)
                .restaurantLongitude(restLng)
                .customerName(order.getCustomer() != null ? order.getCustomer().getFullName() : "Customer")
                .deliveryAddress(order.getDeliveryAddress())
                .deliveryLatitude(custLat)
                .deliveryLongitude(custLng)
                .message(buildStatusMessage(order.getStatus(), driver != null ? driver.getName() : null, etaMinutes))
                .timestamp(Instant.now())
                .build();
    }

    private int calculateDefaultProgress(OrderStatus status) {
        if (status == null) return 0;
        return switch (status) {
            case CREATED, PAYMENT_PENDING -> 5;
            case ORDER_PLACED -> 15;
            case RESTAURANT_ACCEPTED -> 30;
            case PREPARING -> 50;
            case READY_FOR_PICKUP -> 68;
            case OUT_FOR_DELIVERY -> 85;
            case DELIVERED -> 100;
            case CANCELLED, RESTAURANT_REJECTED, PAYMENT_FAILED -> 0;
        };
    }

    private String buildStatusMessage(OrderStatus status, String driverName, int etaMinutes) {
        if (status == null) return "Processing order...";
        return switch (status) {
            case CREATED, PAYMENT_PENDING -> "Awaiting payment confirmation...";
            case ORDER_PLACED -> "Order placed! Restaurant has been notified.";
            case RESTAURANT_ACCEPTED -> "Restaurant accepted your order and will begin preparation.";
            case PREPARING -> "Your delicious food is currently being cooked in the kitchen.";
            case READY_FOR_PICKUP -> driverName != null ?
                    driverName + " is arriving at the restaurant to pick up your food." :
                    "Food is prepared and waiting for driver pickup.";
            case OUT_FOR_DELIVERY -> driverName != null ?
                    driverName + " picked up your order and is speeding your way! Arriving in ~" + etaMinutes + " mins." :
                    "Your order is out for delivery! Arriving in ~" + etaMinutes + " mins.";
            case DELIVERED -> "Order has been safely delivered! Enjoy your meal.";
            case CANCELLED -> "Order was cancelled.";
            case RESTAURANT_REJECTED -> "Restaurant was unable to fulfill your order.";
            case PAYMENT_FAILED -> "Payment failed.";
        };
    }

    private double defaultCustomerLat(String city) {
        if ("Dehradun".equalsIgnoreCase(city)) return 30.3244;
        return 28.5708; // Noida Sector 18
    }

    private double defaultCustomerLng(String city) {
        if ("Dehradun".equalsIgnoreCase(city)) return 78.0418;
        return 77.3219; // Noida Sector 18
    }

    private double calculateHaversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6371.0 * c;
    }
}
