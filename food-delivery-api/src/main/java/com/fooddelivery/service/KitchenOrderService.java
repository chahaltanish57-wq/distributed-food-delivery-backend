package com.fooddelivery.service;

import com.fooddelivery.common.dto.OrderDTO;
import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.entity.Order;
import com.fooddelivery.repository.OrderRepository;
import com.fooddelivery.repository.RestaurantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class KitchenOrderService {

    private static final Duration UNATTENDED_TIMEOUT = Duration.ofMinutes(3);

    private final OrderRepository orderRepository;
    private final RestaurantRepository restaurantRepository;
    private final OrderService orderService;
    private final OrderStateMachine orderStateMachine;

    /**
     * Retrieve all active kitchen tickets for a restaurant.
     */
    @Transactional(readOnly = true)
    public List<OrderDTO> getActiveKitchenOrders(Long restaurantId) {
        if (!restaurantRepository.existsById(restaurantId)) {
            throw new IllegalArgumentException("Restaurant not found with id: " + restaurantId);
        }

        List<OrderStatus> activeStatuses = Arrays.asList(
                OrderStatus.ORDER_PLACED,
                OrderStatus.RESTAURANT_ACCEPTED,
                OrderStatus.PREPARING,
                OrderStatus.READY_FOR_PICKUP
        );

        List<Order> orders = orderRepository.findByRestaurantIdAndStatusInOrderByCreatedAtDesc(restaurantId, activeStatuses);

        return orders.stream()
                .map(o -> orderService.toDTO(o, o.getCustomer() != null ? o.getCustomer().getPhone() : null))
                .collect(Collectors.toList());
    }

    /**
     * Restaurant accepts the incoming order ticket (ORDER_PLACED -> RESTAURANT_ACCEPTED).
     */
    @Transactional
    public OrderDTO acceptOrder(Long orderId) {
        log.info("[Kitchen Action] Restaurant accepting Order #{}", orderId);
        return orderService.updateOrderStatus(orderId, OrderStatus.RESTAURANT_ACCEPTED);
    }

    /**
     * Kitchen begins preparing food (RESTAURANT_ACCEPTED -> PREPARING).
     */
    @Transactional
    public OrderDTO startCooking(Long orderId) {
        log.info("[Kitchen Action] Kitchen started cooking Order #{}", orderId);
        return orderService.updateOrderStatus(orderId, OrderStatus.PREPARING);
    }

    /**
     * Kitchen marks food ready for driver pickup (PREPARING -> READY_FOR_PICKUP).
     */
    @Transactional
    public OrderDTO markFoodReady(Long orderId) {
        log.info("[Kitchen Action] Food ready for driver pickup for Order #{}", orderId);
        return orderService.updateOrderStatus(orderId, OrderStatus.READY_FOR_PICKUP);
    }

    /**
     * Kitchen rejects the order if kitchen is overwhelmed (ORDER_PLACED -> RESTAURANT_REJECTED).
     */
    @Transactional
    public OrderDTO rejectOrder(Long orderId, String reason) {
        log.warn("[Kitchen Action] Restaurant rejected Order #{}. Reason: {}", orderId, reason);
        return orderService.updateOrderStatus(orderId, OrderStatus.RESTAURANT_REJECTED);
    }

    /**
     * Background scheduled task running every 15 seconds.
     * Automatically cancels any order left unattended in ORDER_PLACED state for > 3 minutes.
     */
    @Scheduled(fixedRate = 15000)
    @Transactional
    public void autoCancelUnattendedOrders() {
        Instant cutoff = Instant.now().minus(UNATTENDED_TIMEOUT);
        List<Order> unattendedOrders = orderRepository.findByStatusAndCreatedAtBefore(OrderStatus.ORDER_PLACED, cutoff);

        if (!unattendedOrders.isEmpty()) {
            log.warn("[Kitchen Watchdog] Found {} unattended orders older than 3 minutes. Auto-cancelling...",
                    unattendedOrders.size());

            for (Order order : unattendedOrders) {
                try {
                    orderStateMachine.validateTransition(order.getStatus(), OrderStatus.CANCELLED);
                    order.setStatus(OrderStatus.CANCELLED);
                    orderRepository.save(order);
                    log.warn("  -> Order #{} for Restaurant '{}' auto-cancelled due to kitchen inactivity (> 3 mins)",
                            order.getId(),
                            order.getRestaurant() != null ? order.getRestaurant().getName() : "Unknown");
                } catch (Exception ex) {
                    log.error("Failed to auto-cancel order #{}: {}", order.getId(), ex.getMessage());
                }
            }
        }
    }
}
