package com.fooddelivery.kafka.consumer;

import com.fooddelivery.config.KafkaTopicConfig;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class DeadLetterQueueConsumer {

    /**
     * Consumes failed/poison messages redirected to DLQ topic 'order.events.dlq'.
     */
    @KafkaListener(topics = KafkaTopicConfig.ORDER_EVENTS_DLQ_TOPIC, groupId = "food-delivery-dlq-group")
    public void handleDlqMessage(ConsumerRecord<String, Object> record) {
        log.warn("********************************************************************************");
        log.warn("[DEAD LETTER QUEUE (DLQ)] Poison message captured!");
        log.warn("  Topic: [{}] | Partition: [{}] | Offset: [{}]", record.topic(), record.partition(), record.offset());
        log.warn("  Key: [{}]", record.key());
        log.warn("  Payload: {}", record.value());
        log.warn("  Action: Alert logged for operations review. Message safely preserved in DLQ topic.");
        log.warn("********************************************************************************");
    }
}
