package com.fooddelivery.service;

import com.fooddelivery.common.dto.PaymentRequest;
import com.fooddelivery.common.dto.PaymentResponse;
import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.common.enums.PaymentStatus;
import com.fooddelivery.entity.Customer;
import com.fooddelivery.entity.Order;
import com.fooddelivery.entity.Payment;
import com.fooddelivery.repository.OrderRepository;
import com.fooddelivery.repository.PaymentRepository;
import com.fooddelivery.common.event.PaymentCompletedEvent;
import com.fooddelivery.kafka.producer.PaymentEventProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private static final Duration IDEMPOTENCY_TTL = Duration.ofMinutes(10);
    private static final String IDEMPOTENCY_PREFIX = "idempotency:pay:";

    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;
    private final StringRedisTemplate redisTemplate;
    private final OrderStateMachine orderStateMachine;
    private final PaymentEventProducer paymentEventProducer;

    /**
     * Process payment with distributed Redis SETNX idempotency lock.
     */
    @Transactional
    public PaymentResponse processPayment(PaymentRequest request, Customer customer) {
        if (request.getIdempotencyKey() == null || request.getIdempotencyKey().isBlank()) {
            throw new IllegalArgumentException("Idempotency key is required for payment processing");
        }

        String redisKey = IDEMPOTENCY_PREFIX + request.getIdempotencyKey().trim();

        // 1. Acquire distributed lock using Redis SETNX
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(
                redisKey, 
                String.valueOf(request.getOrderId()), 
                IDEMPOTENCY_TTL
        );

        if (Boolean.FALSE.equals(acquired)) {
            log.warn("Duplicate payment request detected for idempotency key: {}", request.getIdempotencyKey());
            
            // Check if payment already succeeded in DB (Idempotent replay)
            Optional<Payment> existingPayment = paymentRepository.findByIdempotencyKey(request.getIdempotencyKey().trim());
            if (existingPayment.isPresent()) {
                log.info("Returning existing payment receipt for idempotency key: {}", request.getIdempotencyKey());
                return toResponse(existingPayment.get(), "Payment already processed successfully (Idempotent response)");
            }

            // Lock is held by in-flight transaction
            throw new IllegalStateException("A payment is already being processed for this request. Please wait a moment.");
        }

        try {
            // 2. Validate Order
            Order order = orderRepository.findWithDetailsById(request.getOrderId())
                    .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + request.getOrderId()));

            if (!order.getCustomer().getId().equals(customer.getId()) && !"ADMIN".equalsIgnoreCase(customer.getRole())) {
                throw new IllegalArgumentException("Unauthorized to pay for order #" + request.getOrderId());
            }

            // If order already paid, return existing payment
            if (order.getStatus() == OrderStatus.ORDER_PLACED) {
                Optional<Payment> existing = paymentRepository.findByOrderId(order.getId());
                if (existing.isPresent()) {
                    return toResponse(existing.get(), "Order has already been paid for.");
                }
            }

            if (order.getStatus() != OrderStatus.PAYMENT_PENDING) {
                throw new IllegalStateException("Order is not awaiting payment. Current status: " + order.getStatus());
            }

            if (request.getAmount() != null && request.getAmount().compareTo(order.getTotalAmount()) != 0) {
                throw new IllegalArgumentException(String.format(
                        "Payment amount (₹%s) does not match order total (₹%s)",
                        request.getAmount(), order.getTotalAmount()
                ));
            }

            // 3. Simulate payment processing (Payment Gateway Authorization)
            String transactionId = String.format("TXN_%s_%d_%s",
                    request.getPaymentMethod().name(),
                    System.currentTimeMillis(),
                    UUID.randomUUID().toString().substring(0, 6).toUpperCase()
            );

            // 4. Advance Order status to ORDER_PLACED via FSM
            orderStateMachine.validateTransition(order.getStatus(), OrderStatus.ORDER_PLACED);
            order.setStatus(OrderStatus.ORDER_PLACED);
            orderRepository.save(order);

            // 5. Persist Payment Record in PostgreSQL
            Payment payment = Payment.builder()
                    .order(order)
                    .idempotencyKey(request.getIdempotencyKey().trim())
                    .transactionId(transactionId)
                    .paymentMethod(request.getPaymentMethod())
                    .paymentStatus(PaymentStatus.SUCCESS)
                    .amount(order.getTotalAmount())
                    .build();

            Payment savedPayment = paymentRepository.save(payment);
            log.info("Payment #{} authorized for Order #{} [Txn: {}, Amount: ₹{}]",
                    savedPayment.getId(), order.getId(), transactionId, savedPayment.getAmount());

            // Publish Kafka PaymentCompletedEvent for distributed saga & notifications
            try {
                PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                        .paymentId(savedPayment.getId())
                        .orderId(order.getId())
                        .transactionId(savedPayment.getTransactionId())
                        .amount(savedPayment.getAmount())
                        .paymentMethod(savedPayment.getPaymentMethod())
                        .paymentStatus(savedPayment.getPaymentStatus())
                        .completedAt(savedPayment.getCreatedAt() != null ? savedPayment.getCreatedAt() : java.time.Instant.now())
                        .build();
                paymentEventProducer.publishPaymentCompleted(event);
            } catch (Exception ex) {
                log.error("Failed to emit PaymentCompletedEvent for Order #{}: {}", order.getId(), ex.getMessage(), ex);
            }

            return toResponse(savedPayment, "Payment completed successfully! Order placed.");

        } catch (Exception ex) {
            // In case of validation or system failure before DB persistence, release lock
            redisTemplate.delete(redisKey);
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentReceiptByOrderId(Long orderId, Customer customer) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + orderId));

        if (!order.getCustomer().getId().equals(customer.getId()) && !"ADMIN".equalsIgnoreCase(customer.getRole())) {
            throw new IllegalArgumentException("Unauthorized to view payment for order #" + orderId);
        }

        Payment payment = paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalArgumentException("No payment record found for order #" + orderId));

        return toResponse(payment, "Payment receipt retrieved successfully");
    }

    private PaymentResponse toResponse(Payment payment, String message) {
        return PaymentResponse.builder()
                .paymentId(payment.getId())
                .orderId(payment.getOrder().getId())
                .transactionId(payment.getTransactionId())
                .paymentMethod(payment.getPaymentMethod())
                .paymentStatus(payment.getPaymentStatus())
                .amount(payment.getAmount())
                .idempotencyKey(payment.getIdempotencyKey())
                .timestamp(payment.getCreatedAt())
                .message(message)
                .build();
    }
}
