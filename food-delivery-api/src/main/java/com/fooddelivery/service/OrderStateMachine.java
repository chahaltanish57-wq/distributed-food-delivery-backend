package com.fooddelivery.service;

import com.fooddelivery.common.enums.OrderStatus;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class OrderStateMachine {

    private static final Map<OrderStatus, Set<OrderStatus>> VALID_TRANSITIONS = new EnumMap<>(OrderStatus.class);

    static {
        // Initial states
        VALID_TRANSITIONS.put(OrderStatus.CREATED, Set.of(
                OrderStatus.PAYMENT_PENDING,
                OrderStatus.CANCELLED
        ));

        // Payment states
        VALID_TRANSITIONS.put(OrderStatus.PAYMENT_PENDING, Set.of(
                OrderStatus.ORDER_PLACED,
                OrderStatus.PAYMENT_FAILED,
                OrderStatus.CANCELLED
        ));

        VALID_TRANSITIONS.put(OrderStatus.PAYMENT_FAILED, Set.of(
                OrderStatus.PAYMENT_PENDING,
                OrderStatus.CANCELLED
        ));

        // Restaurant handling
        VALID_TRANSITIONS.put(OrderStatus.ORDER_PLACED, Set.of(
                OrderStatus.RESTAURANT_ACCEPTED,
                OrderStatus.RESTAURANT_REJECTED,
                OrderStatus.CANCELLED
        ));

        VALID_TRANSITIONS.put(OrderStatus.RESTAURANT_ACCEPTED, Set.of(
                OrderStatus.PREPARING,
                OrderStatus.CANCELLED
        ));

        VALID_TRANSITIONS.put(OrderStatus.RESTAURANT_REJECTED, Set.of(
                OrderStatus.CANCELLED
        ));

        // Kitchen & Delivery progression
        VALID_TRANSITIONS.put(OrderStatus.PREPARING, Set.of(
                OrderStatus.READY_FOR_PICKUP
        ));

        VALID_TRANSITIONS.put(OrderStatus.READY_FOR_PICKUP, Set.of(
                OrderStatus.OUT_FOR_DELIVERY
        ));

        VALID_TRANSITIONS.put(OrderStatus.OUT_FOR_DELIVERY, Set.of(
                OrderStatus.DELIVERED
        ));

        // Terminal states have no valid transitions
        VALID_TRANSITIONS.put(OrderStatus.DELIVERED, Collections.emptySet());
        VALID_TRANSITIONS.put(OrderStatus.CANCELLED, Collections.emptySet());
    }

    public boolean isValidTransition(OrderStatus current, OrderStatus next) {
        if (current == null || next == null) {
            return false;
        }
        return VALID_TRANSITIONS.getOrDefault(current, Collections.emptySet()).contains(next);
    }

    public void validateTransition(OrderStatus current, OrderStatus next) {
        if (!isValidTransition(current, next)) {
            throw new IllegalStateException(String.format(
                    "Invalid order status transition: Cannot transition from '%s' to '%s'. Allowed: %s",
                    current,
                    next,
                    VALID_TRANSITIONS.getOrDefault(current, Collections.emptySet())
            ));
        }
    }

    public Set<OrderStatus> getPermittedTransitions(OrderStatus current) {
        return VALID_TRANSITIONS.getOrDefault(current, Collections.emptySet());
    }
}
