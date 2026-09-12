package com.fooddelivery.common.dto;

import com.fooddelivery.common.enums.DriverStatus;
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
public class DriverDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private String name;
    private String phone;
    private String vehicleType;
    private DriverStatus status;
    private BigDecimal currentLatitude;
    private BigDecimal currentLongitude;
    private String city;
    private Double distanceKm;
    private Boolean isActive;
    private Instant createdAt;
}
