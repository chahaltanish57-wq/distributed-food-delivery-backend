package com.fooddelivery.common.dto;

import com.fooddelivery.common.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private Long customerId;
    private String customerName;
    private String customerEmail;
    private Long restaurantId;
    private String restaurantName;
    private String restaurantCity;
    private OrderStatus status;
    private BigDecimal totalAmount;
    private String deliveryAddress;
    private String contactPhone;
    private Integer estimatedDeliveryMinutes;

    @Builder.Default
    private List<OrderItemDTO> items = new ArrayList<>();

    private Instant createdAt;
    private Instant updatedAt;
}
