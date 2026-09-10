package com.fooddelivery.common.event;

import com.fooddelivery.common.enums.PaymentMethod;
import com.fooddelivery.common.enums.PaymentStatus;
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
public class PaymentCompletedEvent implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long paymentId;
    private Long orderId;
    private String transactionId;
    private BigDecimal amount;
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private Instant completedAt;
}
