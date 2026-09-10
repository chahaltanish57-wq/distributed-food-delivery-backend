package com.fooddelivery.kafka.producer;

import com.fooddelivery.common.event.PaymentCompletedEvent;
import com.fooddelivery.config.KafkaTopicConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void publishPaymentCompleted(PaymentCompletedEvent event) {
        String key = String.valueOf(event.getOrderId());
        log.info("[Kafka Producer] Emitting PaymentCompletedEvent for Order #{} (Txn: {}) to topic [{}]",
                event.getOrderId(), event.getTransactionId(), KafkaTopicConfig.PAYMENT_COMPLETED_TOPIC);

        CompletableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send(KafkaTopicConfig.PAYMENT_COMPLETED_TOPIC, key, event);

        future.whenComplete((result, ex) -> {
            if (ex == null) {
                log.info("[Kafka Producer] Successfully sent PaymentCompletedEvent for Order #{} to partition [{}] with offset [{}]",
                        event.getOrderId(),
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
            } else {
                log.error("[Kafka Producer] Failed to send PaymentCompletedEvent for Order #{}: {}",
                        event.getOrderId(), ex.getMessage(), ex);
            }
        });
    }
}
