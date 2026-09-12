package com.fooddelivery.service;

import com.fooddelivery.common.dto.DriverDTO;
import com.fooddelivery.common.dto.OrderDTO;
import com.fooddelivery.common.enums.DriverStatus;
import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.entity.DeliveryPartner;
import com.fooddelivery.entity.Order;
import com.fooddelivery.repository.DeliveryPartnerRepository;
import com.fooddelivery.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.data.geo.Circle;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.GeoResults;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.connection.RedisGeoCommands.GeoRadiusCommandArgs;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DriverDispatchService {

    public static final String REDIS_GEO_KEY = "drivers:geo";
    private static final double MAX_DISPATCH_RADIUS_KM = 6.0;

    private final DeliveryPartnerRepository deliveryPartnerRepository;
    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final StringRedisTemplate redisTemplate;
    private final RedissonClient redissonClient;

    /**
     * Retrieve all drivers.
     */
    @Transactional(readOnly = true)
    public List<DriverDTO> getAllDrivers() {
        return deliveryPartnerRepository.findByIsActiveTrue().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Retrieve driver by ID.
     */
    @Transactional(readOnly = true)
    public DriverDTO getDriverById(Long driverId) {
        DeliveryPartner driver = deliveryPartnerRepository.findById(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver not found with id: " + driverId));
        return toDTO(driver);
    }

    /**
     * Update driver's GPS location in PostgreSQL and Redis Geospatial index (GEOADD).
     */
    @Transactional
    public DriverDTO updateDriverLocation(Long driverId, BigDecimal latitude, BigDecimal longitude) {
        DeliveryPartner driver = deliveryPartnerRepository.findById(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver not found with id: " + driverId));

        driver.setCurrentLatitude(latitude);
        driver.setCurrentLongitude(longitude);
        DeliveryPartner saved = deliveryPartnerRepository.save(driver);

        // Redis GEOADD: Point takes (x = longitude, y = latitude)
        if (latitude != null && longitude != null) {
            redisTemplate.opsForGeo().add(
                    REDIS_GEO_KEY,
                    new Point(longitude.doubleValue(), latitude.doubleValue()),
                    String.valueOf(driverId)
            );
            log.info("[Redis GEOADD] Indexed driver #{} coordinates ({}, {}) in key [{}]",
                    driverId, latitude, longitude, REDIS_GEO_KEY);
        }

        return toDTO(saved);
    }

    /**
     * Find nearby drivers within radius using Redis Geospatial search (GEOSEARCH / GEORADIUS).
     */
    @Transactional(readOnly = true)
    public List<DriverDTO> findNearbyDrivers(BigDecimal latitude, BigDecimal longitude, double radiusKm) {
        if (latitude == null || longitude == null) {
            return Collections.emptyList();
        }

        Circle searchCircle = new Circle(
                new Point(longitude.doubleValue(), latitude.doubleValue()),
                new Distance(radiusKm, Metrics.KILOMETERS)
        );

        GeoRadiusCommandArgs args = GeoRadiusCommandArgs.newGeoRadiusArgs()
                .includeDistance()
                .sortAscending();

        GeoResults<org.springframework.data.redis.connection.RedisGeoCommands.GeoLocation<String>> geoResults =
                redisTemplate.opsForGeo().radius(REDIS_GEO_KEY, searchCircle, args);

        if (geoResults == null || geoResults.getContent().isEmpty()) {
            return Collections.emptyList();
        }

        Map<Long, Double> distanceMap = new HashMap<>();
        List<Long> driverIds = new ArrayList<>();

        geoResults.getContent().forEach(result -> {
            try {
                Long dId = Long.parseLong(result.getContent().getName());
                double dist = result.getDistance().getValue();
                distanceMap.put(dId, dist);
                driverIds.add(dId);
            } catch (NumberFormatException ignored) {}
        });

        List<DeliveryPartner> drivers = deliveryPartnerRepository.findAllById(driverIds);

        return drivers.stream()
                .filter(d -> Boolean.TRUE.equals(d.getIsActive()))
                .map(d -> {
                    DriverDTO dto = toDTO(d);
                    dto.setDistanceKm(Math.round(distanceMap.getOrDefault(d.getId(), 0.0) * 10.0) / 10.0);
                    return dto;
                })
                .sorted(Comparator.comparingDouble(d -> d.getDistanceKm() != null ? d.getDistanceKm() : Double.MAX_VALUE))
                .collect(Collectors.toList());
    }

    /**
     * Get available delivery runs for a driver within 6km radius.
     */
    @Transactional(readOnly = true)
    public List<OrderDTO> getAvailableOrdersForDriver(Long driverId) {
        DeliveryPartner driver = deliveryPartnerRepository.findById(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver not found with id: " + driverId));

        // Available orders are in PREPARING or READY_FOR_PICKUP without an assigned driver
        List<Order> unassignedOrders = orderRepository.findByStatusInAndDeliveryPartnerIdIsNullOrderByCreatedAtDesc(
                Arrays.asList(OrderStatus.READY_FOR_PICKUP, OrderStatus.PREPARING)
        );

        BigDecimal driverLat = driver.getCurrentLatitude();
        BigDecimal driverLng = driver.getCurrentLongitude();

        List<OrderDTO> availableRuns = new ArrayList<>();

        for (Order order : unassignedOrders) {
            double distanceKm = 0.0;
            if (driverLat != null && driverLng != null && order.getRestaurant() != null) {
                distanceKm = calculateHaversineKm(
                        driverLat.doubleValue(),
                        driverLng.doubleValue(),
                        order.getRestaurant().getLatitude().doubleValue(),
                        order.getRestaurant().getLongitude().doubleValue()
                );
            }

            // Include if within radius or matching same city
            boolean cityMatches = order.getRestaurant() != null &&
                    order.getRestaurant().getCity() != null &&
                    order.getRestaurant().getCity().equalsIgnoreCase(driver.getCity());

            if (distanceKm <= MAX_DISPATCH_RADIUS_KM || cityMatches) {
                OrderDTO dto = orderService.toDTO(order, order.getCustomer() != null ? order.getCustomer().getPhone() : null);
                dto.setDistanceToRestaurantKm(Math.round(distanceKm * 10.0) / 10.0);
                dto.setRestaurantAddress(order.getRestaurant() != null ? order.getRestaurant().getAddress() : "");
                
                // Delivery Payout formula: Base ₹40 + ₹12/km
                BigDecimal payout = BigDecimal.valueOf(40.0 + (distanceKm * 12.0))
                        .setScale(2, RoundingMode.HALF_UP);
                dto.setEstimatedPayout(payout);

                availableRuns.add(dto);
            }
        }

        // Sort runs by closest distance first
        availableRuns.sort(Comparator.comparingDouble(o -> o.getDistanceToRestaurantKm() != null ? o.getDistanceToRestaurantKm() : 999.0));
        return availableRuns;
    }

    /**
     * Get active in-progress delivery mission for a driver.
     */
    @Transactional(readOnly = true)
    public OrderDTO getActiveMission(Long driverId) {
        List<Order> activeOrders = orderRepository.findByDeliveryPartnerIdAndStatusIn(
                driverId,
                Arrays.asList(OrderStatus.READY_FOR_PICKUP, OrderStatus.PREPARING, OrderStatus.OUT_FOR_DELIVERY)
        );

        if (activeOrders.isEmpty()) {
            return null;
        }

        DeliveryPartner driver = deliveryPartnerRepository.findById(driverId).orElse(null);
        Order activeOrder = activeOrders.get(0);
        return toEnrichedOrderDTO(activeOrder, driver);
    }

    /**
     * Claim delivery run with Redisson Distributed Lock to prevent duplicate driver assignment.
     */
    public OrderDTO acceptDelivery(Long driverId, Long orderId) {
        String lockKey = "lock:order:dispatch:" + orderId;
        RLock lock = redissonClient.getLock(lockKey);

        try {
            // Try to acquire lock within 3 seconds, holds for max 8 seconds
            boolean acquired = lock.tryLock(3, 8, TimeUnit.SECONDS);
            if (!acquired) {
                log.warn("Concurrent lock conflict on order #{} for driver #{}", orderId, driverId);
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Another driver is currently claiming this order. Please refresh.");
            }

            return doAcceptDeliveryInTransaction(driverId, orderId);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Driver dispatch lock interrupted");
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    @Transactional
    protected OrderDTO doAcceptDeliveryInTransaction(Long driverId, Long orderId) {
        Order order = orderRepository.findWithDetailsById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + orderId));

        if (order.getDeliveryPartnerId() != null) {
            log.warn("Order #{} already claimed by delivery partner #{}", orderId, order.getDeliveryPartnerId());
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Order #ORD-" + orderId + " has already been claimed by another driver!");
        }

        DeliveryPartner driver = deliveryPartnerRepository.findById(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver not found with id: " + driverId));

        if (driver.getStatus() == DriverStatus.BUSY) {
            throw new IllegalStateException("Driver is already busy on an active delivery run.");
        }

        // Exclusively assign order to driver
        order.setDeliveryPartnerId(driver.getId());
        Order savedOrder = orderRepository.save(order);

        // Mark driver as BUSY
        driver.setStatus(DriverStatus.BUSY);
        deliveryPartnerRepository.save(driver);

        log.info("[Driver Dispatch] Order #{} successfully claimed by Driver {} ({}) using Redisson Lock",
                orderId, driver.getName(), driver.getPhone());

        return toEnrichedOrderDTO(savedOrder, driver);
    }

    /**
     * Driver arrives at restaurant, picks up food (READY_FOR_PICKUP -> OUT_FOR_DELIVERY).
     */
    @Transactional
    public OrderDTO pickupOrder(Long driverId, Long orderId) {
        Order order = orderRepository.findWithDetailsById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + orderId));

        if (!driverId.equals(order.getDeliveryPartnerId())) {
            throw new IllegalArgumentException("Unauthorized: Driver is not assigned to order #" + orderId);
        }

        DeliveryPartner driver = deliveryPartnerRepository.findById(driverId).orElse(null);
        OrderDTO updated = orderService.updateOrderStatus(orderId, OrderStatus.OUT_FOR_DELIVERY);
        log.info("[Driver Action] Driver #{} picked up Order #{}. Now OUT_FOR_DELIVERY.", driverId, orderId);

        if (driver != null) {
            updated.setDeliveryPartnerId(driver.getId());
            updated.setDeliveryPartnerName(driver.getName());
            updated.setDeliveryPartnerPhone(driver.getPhone());
        }
        return updated;
    }

    /**
     * Driver delivers food to customer (OUT_FOR_DELIVERY -> DELIVERED).
     */
    @Transactional
    public OrderDTO completeDelivery(Long driverId, Long orderId) {
        Order order = orderRepository.findWithDetailsById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + orderId));

        if (!driverId.equals(order.getDeliveryPartnerId())) {
            throw new IllegalArgumentException("Unauthorized: Driver is not assigned to order #" + orderId);
        }

        DeliveryPartner driver = deliveryPartnerRepository.findById(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver not found with id: " + driverId));

        OrderDTO updated = orderService.updateOrderStatus(orderId, OrderStatus.DELIVERED);
        
        // Reset driver to AVAILABLE
        driver.setStatus(DriverStatus.AVAILABLE);
        deliveryPartnerRepository.save(driver);
        log.info("[Driver Action] Driver #{} delivered Order #{}. Status set to DELIVERED, driver AVAILABLE.",
                driverId, orderId);

        updated.setDeliveryPartnerId(driver.getId());
        updated.setDeliveryPartnerName(driver.getName());
        updated.setDeliveryPartnerPhone(driver.getPhone());
        return updated;
    }

    private OrderDTO toEnrichedOrderDTO(Order order, DeliveryPartner driver) {
        OrderDTO dto = orderService.toDTO(order, order.getCustomer() != null ? order.getCustomer().getPhone() : null);
        if (driver != null) {
            dto.setDeliveryPartnerId(driver.getId());
            dto.setDeliveryPartnerName(driver.getName());
            dto.setDeliveryPartnerPhone(driver.getPhone());
        }
        if (order.getRestaurant() != null) {
            dto.setRestaurantAddress(order.getRestaurant().getAddress());
        }
        dto.setEstimatedPayout(BigDecimal.valueOf(65.00));
        return dto;
    }

    private DriverDTO toDTO(DeliveryPartner d) {
        return DriverDTO.builder()
                .id(d.getId())
                .name(d.getName())
                .phone(d.getPhone())
                .vehicleType(d.getVehicleType())
                .status(d.getStatus())
                .currentLatitude(d.getCurrentLatitude())
                .currentLongitude(d.getCurrentLongitude())
                .city(d.getCity())
                .isActive(d.getIsActive())
                .createdAt(d.getCreatedAt())
                .build();
    }

    private double calculateHaversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6371.0 * c; // Radius of Earth in KM
    }
}
