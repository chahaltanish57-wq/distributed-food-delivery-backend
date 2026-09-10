package com.fooddelivery.kafka.consumer;

import com.fooddelivery.common.event.OrderCreatedEvent;
import com.fooddelivery.common.event.PaymentCompletedEvent;
import com.fooddelivery.config.KafkaTopicConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class OrderSagaConsumer {

    /**
     * Consumes OrderCreatedEvent from topic 'order.created'.
     * Simulates Kitchen ticket generation and inventory reservation.
     */
    @KafkaListener(topics = KafkaTopicConfig.ORDER_CREATED_TOPIC, groupId = "food-delivery-saga-group")
    public void handleOrderCreated(
            OrderCreatedEvent event,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
            @Header(KafkaHeaders.OFFSET) long offset) {

        log.info("================================================================================");
        log.info("[Kafka Consumer] Received OrderCreatedEvent from Topic [{}] Partition [{}] Offset [{}]",
                topic, partition, offset);
        log.info("  Order ID: #{}", event.getOrderId());
        log.info("  Restaurant: {} (ID: {})", event.getRestaurantName(), event.getRestaurantId());
        log.info("  Customer: {} ({})", event.getCustomerName(), event.getCustomerPhone());
        log.info("  Total Amount: INR {}", event.getTotalAmount());
        log.info("  Items Count: {}", event.getItems() != null ? event.getItems().size() : 0);
        log.info("  [Saga Step 1] -> Kitchen ticket auto-generated and dispatched to restaurant queue.");
        log.info("  [Saga Step 2] -> Awaiting payment confirmation event...");
        log.info("================================================================================");

        // Test hook to demonstrate DLQ: if special flag is in delivery address or customer name, simulate failure
        if (event.getDeliveryAddress() != null && event.getDeliveryAddress().contains("TRIGGER_DLQ_POISON")) {
            log.error("[Kafka Consumer] Simulated poison pill detected for Order #{}. Throwing unhandled exception to trigger retry and DLQ!",
                    event.getOrderId());
            throw new RuntimeException("Simulated poison pill unrecoverable error for DLQ verification");
        }
    }

    /**
     * Consumes PaymentCompletedEvent from topic 'payment.completed'.
     * Simulates sending customer confirmation and triggering driver dispatch saga.
     */
    @KafkaListener(topics = KafkaTopicConfig.PAYMENT_COMPLETED_TOPIC, groupId = "food-delivery-saga-group")
    public void handlePaymentCompleted(
            PaymentCompletedEvent event,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
            @Header(KafkaHeaders.OFFSET) long offset) {

        log.info("================================================================================");
        log.info("[Kafka Consumer] Received PaymentCompletedEvent from Topic [{}] Partition [{}] Offset [{}]",
                topic, partition, offset);
        log.info("  Order ID: #{}", event.getOrderId());
        log.info("  Transaction ID: {}", event.getTransactionId());
        log.info("  Method: {}", event.getPaymentMethod());
        log.info("  Amount: INR {}", event.getAmount());
        log.info("  Status: {}", event.getPaymentStatus());
        log.info("  [Saga Step 3] -> Notification dispatched: 'Payment of INR {} confirmed! Restaurant is preparing your food.'",
                event.getAmount());
        log.info("  [Saga Step 4] -> Signal sent to Driver Dispatch Engine (Day 10)...");
        log.info("================================================================================");
    }
}
