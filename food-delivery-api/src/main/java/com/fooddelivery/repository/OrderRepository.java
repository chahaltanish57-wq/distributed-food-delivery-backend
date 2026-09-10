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

    @EntityGraph(attributePaths = {"customer", "restaurant", "orderItems"})
    Optional<Order> findWithDetailsById(Long id);
}
