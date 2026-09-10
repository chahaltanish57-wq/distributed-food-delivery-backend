package com.fooddelivery.common.dto;

import com.fooddelivery.common.enums.PaymentMethod;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequest implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long orderId;
    private String idempotencyKey;
    private PaymentMethod paymentMethod;
    private BigDecimal amount;
    private String paymentDetails;
}
