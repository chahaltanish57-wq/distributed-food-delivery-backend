package com.fooddelivery.common.dto;

import com.fooddelivery.common.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrackingUpdateDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long orderId;
    private OrderStatus orderStatus;

    // Driver telemetry
    private Long driverId;
    private String driverName;
    private String driverPhone;
    private String vehicleType;
    private BigDecimal currentLatitude;
    private BigDecimal currentLongitude;
    private Double headingDegrees;

    // Route and ETA
    private Double distanceRemainingKm;
    private Integer etaMinutes;
    private Integer progressPercent;

    // Restaurant details
    private Long restaurantId;
    private String restaurantName;
    private String restaurantAddress;
    private BigDecimal restaurantLatitude;
    private BigDecimal restaurantLongitude;

    // Customer dropoff details
    private String customerName;
    private String deliveryAddress;
    private BigDecimal deliveryLatitude;
    private BigDecimal deliveryLongitude;

    private String message;
    private Instant timestamp;
}
