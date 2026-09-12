package com.fooddelivery.controller;

import com.fooddelivery.common.dto.ApiResponse;
import com.fooddelivery.common.dto.TrackingUpdateDTO;
import com.fooddelivery.service.OrderTrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/tracking")
@RequiredArgsConstructor
@Tag(name = "Order Tracking & WebSocket Telemetry APIs", description = "Live GPS tracking snapshots and STOMP broadcast controls")
public class OrderTrackingController {

    private final OrderTrackingService orderTrackingService;

    @GetMapping("/orders/{orderId}")
    @Operation(summary = "Get current tracking snapshot", description = "Retrieves current order state, driver location, and route details.")
    public ResponseEntity<ApiResponse<TrackingUpdateDTO>> getTrackingSnapshot(@PathVariable("orderId") Long orderId) {
        TrackingUpdateDTO snapshot = orderTrackingService.getTrackingSnapshot(orderId);
        return ResponseEntity.ok(ApiResponse.success(snapshot, "Tracking snapshot retrieved"));
    }

    @PostMapping("/orders/{orderId}/ping")
    @Operation(summary = "Manually update & broadcast driver telemetry", description = "Pings GPS coordinates and broadcasts to /topic/orders/{orderId}/tracking.")
    public ResponseEntity<ApiResponse<TrackingUpdateDTO>> pingDriverLocation(
            @PathVariable("orderId") Long orderId,
            @RequestBody Map<String, Object> body) {
        BigDecimal lat = body.get("latitude") != null ? new BigDecimal(body.get("latitude").toString()) : null;
        BigDecimal lng = body.get("longitude") != null ? new BigDecimal(body.get("longitude").toString()) : null;
        Double heading = body.get("headingDegrees") != null ? Double.parseDouble(body.get("headingDegrees").toString()) : 45.0;

        TrackingUpdateDTO updated = orderTrackingService.pingDriverLocation(orderId, lat, lng, heading);
        return ResponseEntity.ok(ApiResponse.success(updated, "Telemetry broadcasted over STOMP"));
    }

    @PostMapping("/orders/{orderId}/simulate-step")
    @Operation(summary = "Simulate step along delivery path", description = "Interpolates driver movement between restaurant and customer dropoff (0.0 to 1.0).")
    public ResponseEntity<ApiResponse<TrackingUpdateDTO>> simulateStep(
            @PathVariable("orderId") Long orderId,
            @RequestParam(value = "progressRatio", defaultValue = "0.25") double progressRatio) {
        TrackingUpdateDTO stepped = orderTrackingService.simulateStep(orderId, progressRatio);
        return ResponseEntity.ok(ApiResponse.success(stepped, "Step simulated and broadcasted over STOMP"));
    }

    /**
     * Inbound STOMP Message Handler:
     * Drivers can send STOMP frames directly to /app/orders/{orderId}/location
     */
    @MessageMapping("/orders/{orderId}/location")
    public void handleInboundDriverLocation(
            @DestinationVariable("orderId") Long orderId,
            @Payload Map<String, Object> payload) {
        log.info("[STOMP Inbound] Received location message for Order #{}: {}", orderId, payload);
        BigDecimal lat = payload.get("latitude") != null ? new BigDecimal(payload.get("latitude").toString()) : null;
        BigDecimal lng = payload.get("longitude") != null ? new BigDecimal(payload.get("longitude").toString()) : null;
        Double heading = payload.get("headingDegrees") != null ? Double.parseDouble(payload.get("headingDegrees").toString()) : null;

        orderTrackingService.pingDriverLocation(orderId, lat, lng, heading);
    }
}
