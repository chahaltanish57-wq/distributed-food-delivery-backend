package com.fooddelivery.entity;

import com.fooddelivery.common.enums.DriverStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "delivery_partners")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliveryPartner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 20)
    private String phone;

    @Column(name = "vehicle_type", nullable = false, length = 50)
    private String vehicleType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private DriverStatus status = DriverStatus.AVAILABLE;

    @Column(name = "current_latitude", precision = 10, scale = 7)
    private BigDecimal currentLatitude;

    @Column(name = "current_longitude", precision = 10, scale = 7)
    private BigDecimal currentLongitude;

    @Column(length = 50)
    @Builder.Default
    private String city = "Noida";

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Builder.Default
    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();
}
