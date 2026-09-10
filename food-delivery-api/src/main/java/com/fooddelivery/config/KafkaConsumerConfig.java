package com.fooddelivery.config;

import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.common.TopicPartition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Slf4j
@Configuration
@EnableKafka
public class KafkaConsumerConfig {

    @Bean
    public DefaultErrorHandler errorHandler(KafkaOperations<Object, Object> kafkaOperations) {
        // Route unrecoverable/failed messages to order.events.dlq
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                kafkaOperations,
                (record, ex) -> {
                    log.error("Kafka consumer failed processing record from topic [{}] key [{}]. Routing to DLQ topic [{}]. Reason: {}",
                            record.topic(), record.key(), KafkaTopicConfig.ORDER_EVENTS_DLQ_TOPIC, ex.getMessage());
                    return new TopicPartition(KafkaTopicConfig.ORDER_EVENTS_DLQ_TOPIC, record.partition() % 3);
                }
        );

        // Fixed back-off: 1 second interval, 2 retries (total 3 attempts)
        FixedBackOff backOff = new FixedBackOff(1000L, 2L);
        return new DefaultErrorHandler(recoverer, backOff);
    }
}
