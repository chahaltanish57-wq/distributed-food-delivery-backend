package com.fooddelivery.kafka.producer;

import com.fooddelivery.common.event.OrderCreatedEvent;
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
public class OrderEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void publishOrderCreated(OrderCreatedEvent event) {
        String key = String.valueOf(event.getOrderId());
        log.info("[Kafka Producer] Emitting OrderCreatedEvent for Order #{} to topic [{}]",
                event.getOrderId(), KafkaTopicConfig.ORDER_CREATED_TOPIC);

        CompletableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send(KafkaTopicConfig.ORDER_CREATED_TOPIC, key, event);

        future.whenComplete((result, ex) -> {
            if (ex == null) {
                log.info("[Kafka Producer] Successfully sent OrderCreatedEvent for Order #{} to partition [{}] with offset [{}]",
                        event.getOrderId(),
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
            } else {
                log.error("[Kafka Producer] Failed to send OrderCreatedEvent for Order #{}: {}",
                        event.getOrderId(), ex.getMessage(), ex);
            }
        });
    }
}
