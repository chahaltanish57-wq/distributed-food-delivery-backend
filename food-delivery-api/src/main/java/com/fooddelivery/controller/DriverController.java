package com.fooddelivery.controller;

import com.fooddelivery.common.dto.ApiResponse;
import com.fooddelivery.common.dto.DriverDTO;
import com.fooddelivery.common.dto.OrderDTO;
import com.fooddelivery.service.DriverDispatchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/drivers")
@RequiredArgsConstructor
@Tag(name = "Driver Dispatch & Geospatial APIs", description = "Endpoints for driver simulator, geospatial discovery, and Redisson-locked delivery runs")
public class DriverController {

    private final DriverDispatchService driverDispatchService;

    @GetMapping
    @Operation(summary = "Get all drivers", description = "Lists active delivery drivers with current GPS coordinates.")
    public ResponseEntity<ApiResponse<List<DriverDTO>>> getAllDrivers() {
        List<DriverDTO> drivers = driverDispatchService.getAllDrivers();
        return ResponseEntity.ok(ApiResponse.success(drivers, "Delivery drivers retrieved successfully"));
    }

    @GetMapping("/{driverId}")
    @Operation(summary = "Get driver by ID", description = "Retrieves driver profile and status.")
    public ResponseEntity<ApiResponse<DriverDTO>> getDriver(@PathVariable("driverId") Long driverId) {
        DriverDTO driver = driverDispatchService.getDriverById(driverId);
        return ResponseEntity.ok(ApiResponse.success(driver, "Driver profile retrieved"));
    }

    @GetMapping("/nearby")
    @Operation(summary = "Find nearby drivers", description = "Uses Redis Geospatial GEOSEARCH to locate drivers within a given radius in KM.")
    public ResponseEntity<ApiResponse<List<DriverDTO>>> getNearbyDrivers(
            @RequestParam("latitude") BigDecimal latitude,
            @RequestParam("longitude") BigDecimal longitude,
            @RequestParam(value = "radiusKm", defaultValue = "5.0") double radiusKm) {
        List<DriverDTO> nearby = driverDispatchService.findNearbyDrivers(latitude, longitude, radiusKm);
        return ResponseEntity.ok(ApiResponse.success(nearby, "Nearby drivers located via Redis Geo"));
    }

    @GetMapping("/{driverId}/available-orders")
    @Operation(summary = "Get available delivery runs", description = "Retrieves nearby orders awaiting pickup within 6km radius of the driver.")
    public ResponseEntity<ApiResponse<List<OrderDTO>>> getAvailableOrders(@PathVariable("driverId") Long driverId) {
        List<OrderDTO> runs = driverDispatchService.getAvailableOrdersForDriver(driverId);
        return ResponseEntity.ok(ApiResponse.success(runs, "Available delivery runs fetched successfully"));
    }

    @GetMapping("/{driverId}/active-mission")
    @Operation(summary = "Get active delivery mission", description = "Retrieves the currently accepted and in-progress order for the driver.")
    public ResponseEntity<ApiResponse<OrderDTO>> getActiveMission(@PathVariable("driverId") Long driverId) {
        OrderDTO mission = driverDispatchService.getActiveMission(driverId);
        return ResponseEntity.ok(ApiResponse.success(mission, "Active mission retrieved"));
    }

    @PatchMapping("/{driverId}/location")
    @Operation(summary = "Update driver GPS coordinates", description = "Updates driver coordinates in PostgreSQL and Redis Geo index (GEOADD).")
    public ResponseEntity<ApiResponse<DriverDTO>> updateLocation(
            @PathVariable("driverId") Long driverId,
            @RequestBody Map<String, BigDecimal> coords) {
        BigDecimal lat = coords.get("latitude");
        BigDecimal lng = coords.get("longitude");
        DriverDTO updated = driverDispatchService.updateDriverLocation(driverId, lat, lng);
        return ResponseEntity.ok(ApiResponse.success(updated, "Driver location updated and indexed in Redis Geo"));
    }

    @PostMapping("/{driverId}/orders/{orderId}/accept")
    @Operation(summary = "Accept delivery run", description = "Claims delivery run using Redisson distributed lock to prevent duplicate driver assignment.")
    public ResponseEntity<ApiResponse<OrderDTO>> acceptDelivery(
            @PathVariable("driverId") Long driverId,
            @PathVariable("orderId") Long orderId) {
        OrderDTO assigned = driverDispatchService.acceptDelivery(driverId, orderId);
        return ResponseEntity.ok(ApiResponse.success(assigned, "Delivery run accepted! Proceed to restaurant for pickup."));
    }

    @PatchMapping("/{driverId}/orders/{orderId}/pickup")
    @Operation(summary = "Pick up food from restaurant", description = "Transitions order status to OUT_FOR_DELIVERY.")
    public ResponseEntity<ApiResponse<OrderDTO>> pickupOrder(
            @PathVariable("driverId") Long driverId,
            @PathVariable("orderId") Long orderId) {
        OrderDTO updated = driverDispatchService.pickupOrder(driverId, orderId);
        return ResponseEntity.ok(ApiResponse.success(updated, "Order picked up! Navigate to customer address."));
    }

    @PatchMapping("/{driverId}/orders/{orderId}/deliver")
    @Operation(summary = "Complete delivery to customer", description = "Transitions order status to DELIVERED and marks driver AVAILABLE.")
    public ResponseEntity<ApiResponse<OrderDTO>> completeDelivery(
            @PathVariable("driverId") Long driverId,
            @PathVariable("orderId") Long orderId) {
        OrderDTO updated = driverDispatchService.completeDelivery(driverId, orderId);
        return ResponseEntity.ok(ApiResponse.success(updated, "Delivery completed successfully! Payout credited."));
    }
}
