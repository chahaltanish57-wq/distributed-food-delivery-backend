package com.fooddelivery.common.event;

import com.fooddelivery.common.dto.OrderItemDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderCreatedEvent implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long orderId;
    private Long customerId;
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private Long restaurantId;
    private String restaurantName;
    private String deliveryAddress;
    private BigDecimal totalAmount;
    private List<OrderItemDTO> items;
    private Instant createdAt;
}
