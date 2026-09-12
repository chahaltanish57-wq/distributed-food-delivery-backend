package com.fooddelivery.repository;

import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.entity.Order;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    @EntityGraph(attributePaths = {"restaurant", "orderItems"})
    List<Order> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    @EntityGraph(attributePaths = {"customer", "orderItems"})
    List<Order> findByRestaurantIdOrderByCreatedAtDesc(Long restaurantId);

    List<Order> findByStatus(OrderStatus status);

    List<Order> findByStatusAndCreatedAtBefore(OrderStatus status, java.time.Instant timestamp);

    @EntityGraph(attributePaths = {"customer", "orderItems"})
    List<Order> findByRestaurantIdAndStatusInOrderByCreatedAtDesc(Long restaurantId, java.util.Collection<OrderStatus> statuses);

    @EntityGraph(attributePaths = {"customer", "restaurant", "orderItems"})
    Optional<Order> findWithDetailsById(Long id);

    @EntityGraph(attributePaths = {"customer", "restaurant", "orderItems"})
    List<Order> findByDeliveryPartnerIdAndStatusIn(Long deliveryPartnerId, java.util.Collection<OrderStatus> statuses);

    @EntityGraph(attributePaths = {"customer", "restaurant", "orderItems"})
    List<Order> findByStatusInAndDeliveryPartnerIdIsNullOrderByCreatedAtDesc(java.util.Collection<OrderStatus> statuses);

    /**
     * Used by MetricsConfig Gauge beans — returns live count of orders in a given status.
     * Spring Data JPA derives this automatically from the method name.
     */
    long countByStatus(OrderStatus status);
}

