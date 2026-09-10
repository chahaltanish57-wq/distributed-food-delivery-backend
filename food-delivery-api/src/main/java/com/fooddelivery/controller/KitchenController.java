package com.fooddelivery.controller;

import com.fooddelivery.common.dto.ApiResponse;
import com.fooddelivery.common.dto.OrderDTO;
import com.fooddelivery.service.KitchenOrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/kitchen")
@RequiredArgsConstructor
@Tag(name = "Kitchen Dashboard APIs", description = "Endpoints for restaurant kitchen staff to view tickets and progress order preparation")
public class KitchenController {

    private final KitchenOrderService kitchenOrderService;

    @GetMapping("/restaurants/{restaurantId}/orders")
    @Operation(summary = "Get active kitchen orders", description = "Fetches active tickets for the kitchen dashboard (ORDER_PLACED, RESTAURANT_ACCEPTED, PREPARING, READY_FOR_PICKUP).")
    public ResponseEntity<ApiResponse<List<OrderDTO>>> getKitchenOrders(
            @PathVariable("restaurantId") Long restaurantId) {
        List<OrderDTO> orders = kitchenOrderService.getActiveKitchenOrders(restaurantId);
        return ResponseEntity.ok(ApiResponse.success(orders, "Active kitchen orders fetched successfully"));
    }

    @PatchMapping("/orders/{orderId}/accept")
    @Operation(summary = "Accept order", description = "Kitchen accepts the ticket (ORDER_PLACED -> RESTAURANT_ACCEPTED).")
    public ResponseEntity<ApiResponse<OrderDTO>> acceptOrder(@PathVariable("orderId") Long orderId) {
        OrderDTO updated = kitchenOrderService.acceptOrder(orderId);
        return ResponseEntity.ok(ApiResponse.success(updated, "Order accepted by kitchen"));
    }

    @PatchMapping("/orders/{orderId}/start-cooking")
    @Operation(summary = "Start cooking", description = "Kitchen begins food preparation (RESTAURANT_ACCEPTED -> PREPARING).")
    public ResponseEntity<ApiResponse<OrderDTO>> startCooking(@PathVariable("orderId") Long orderId) {
        OrderDTO updated = kitchenOrderService.startCooking(orderId);
        return ResponseEntity.ok(ApiResponse.success(updated, "Order preparation in progress"));
    }

    @PatchMapping("/orders/{orderId}/food-ready")
    @Operation(summary = "Mark food ready", description = "Kitchen marks order ready for driver pickup (PREPARING -> READY_FOR_PICKUP).")
    public ResponseEntity<ApiResponse<OrderDTO>> markFoodReady(@PathVariable("orderId") Long orderId) {
        OrderDTO updated = kitchenOrderService.markFoodReady(orderId);
        return ResponseEntity.ok(ApiResponse.success(updated, "Food is ready for driver pickup"));
    }

    @PatchMapping("/orders/{orderId}/reject")
    @Operation(summary = "Reject order", description = "Kitchen rejects ticket if kitchen is overwhelmed (ORDER_PLACED -> RESTAURANT_REJECTED).")
    public ResponseEntity<ApiResponse<OrderDTO>> rejectOrder(
            @PathVariable("orderId") Long orderId,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = (body != null && body.containsKey("reason")) ? body.get("reason") : "Kitchen capacity reached";
        OrderDTO updated = kitchenOrderService.rejectOrder(orderId, reason);
        return ResponseEntity.ok(ApiResponse.success(updated, "Order rejected by kitchen"));
    }
}
