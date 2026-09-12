package com.fooddelivery.controller;

import com.fooddelivery.common.dto.ApiResponse;
import com.fooddelivery.common.dto.CreateOrderRequest;
import com.fooddelivery.common.dto.OrderDTO;
import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.entity.Customer;
import com.fooddelivery.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Tag(name = "Order & Checkout APIs", description = "Order creation, lifecycle state transitions, and history")
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    @Operation(summary = "Place order from active cart", description = "Checks out the Redis cart, persists the Order in PostgreSQL, and clears the cart.")
    public ResponseEntity<ApiResponse<OrderDTO>> placeOrder(@RequestBody CreateOrderRequest request) {
        Customer customer = getAuthenticatedCustomer();
        OrderDTO order = orderService.createOrder(customer, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(order, "Order placed successfully! Please proceed to payment."));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get order details", description = "Retrieves order status, receipt, and delivery details by order ID.")
    public ResponseEntity<ApiResponse<OrderDTO>> getOrder(@PathVariable("id") Long id) {
        Customer customer = getAuthenticatedCustomer();
        OrderDTO order = orderService.getOrderById(id, customer);
        return ResponseEntity.ok(ApiResponse.success(order, "Order details retrieved"));
    }

    @GetMapping
    @Operation(summary = "Get customer order history", description = "Retrieves all past orders placed by the currently logged-in customer.")
    public ResponseEntity<ApiResponse<List<OrderDTO>>> getCustomerOrders() {
        Customer customer = getOptionalAuthenticatedCustomer();
        List<OrderDTO> orders;
        if (customer != null) {
            orders = orderService.getCustomerOrders(customer);
        } else {
            orders = orderService.getAllRecentOrders();
        }
        return ResponseEntity.ok(ApiResponse.success(orders, "Order history retrieved"));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Transition order status", description = "Applies FSM transition to advance order status.")
    public ResponseEntity<ApiResponse<OrderDTO>> updateStatus(
            @PathVariable("id") Long id,
            @RequestParam("status") OrderStatus status
    ) {
        OrderDTO updated = orderService.updateOrderStatus(id, status);
        return ResponseEntity.ok(ApiResponse.success(updated, "Order status updated to " + status));
    }

    private Customer getOptionalAuthenticatedCustomer() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof Customer customer) {
            return customer;
        }
        return null;
    }

    private Customer getAuthenticatedCustomer() {
        Customer customer = getOptionalAuthenticatedCustomer();
        if (customer != null) {
            return customer;
        }
        throw new IllegalArgumentException("Authentication required to access orders. Please sign in.");
    }
}
