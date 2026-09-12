package com.fooddelivery.config;

import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.repository.OrderRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Registers custom business metrics with the Micrometer/Prometheus registry.
 */
@Slf4j
@Configuration
public class MetricsConfig {

    @Bean
    public AtomicInteger activeWebSocketSessions() {
        return new AtomicInteger(0);
    }

    @Bean
    public Counter ordersPlacedCounter(MeterRegistry registry) {
        return Counter.builder("orders_placed_total")
                .description("Total number of orders placed")
                .tag("application", "food-delivery-api")
                .register(registry);
    }

    @Bean
    public Counter ordersDeliveredCounter(MeterRegistry registry) {
        return Counter.builder("orders_delivered_total")
                .description("Total number of orders successfully delivered")
                .tag("application", "food-delivery-api")
                .register(registry);
    }

    @Bean
    public Counter paymentsSuccessCounter(MeterRegistry registry) {
        return Counter.builder("payments_success_total")
                .description("Total number of successful payment transactions")
                .tag("application", "food-delivery-api")
                .register(registry);
    }

    @Bean
    public Counter paymentsFailedCounter(MeterRegistry registry) {
        return Counter.builder("payments_failed_total")
                .description("Total number of failed or rejected payment attempts")
                .tag("application", "food-delivery-api")
                .register(registry);
    }

    @Bean
    public Gauge activeWebSocketSessionsGauge(MeterRegistry registry, AtomicInteger activeWebSocketSessions) {
        return Gauge.builder("websocket_sessions_active", activeWebSocketSessions, AtomicInteger::get)
                .description("Number of active real-time GPS tracking WebSocket sessions")
                .tag("application", "food-delivery-api")
                .register(registry);
    }

    @Bean
    public Gauge ordersPendingGauge(MeterRegistry registry, OrderRepository orderRepository) {
        return Gauge.builder("orders_pending_gauge", orderRepository,
                        repo -> repo.countByStatus(OrderStatus.PAYMENT_PENDING))
                .description("Live count of orders in PAYMENT_PENDING state")
                .tag("application", "food-delivery-api")
                .register(registry);
    }

    @Bean
    public Gauge ordersInKitchenGauge(MeterRegistry registry, OrderRepository orderRepository) {
        return Gauge.builder("orders_in_kitchen_gauge", orderRepository,
                        repo -> repo.countByStatus(OrderStatus.PREPARING))
                .description("Live count of orders currently being prepared in kitchen")
                .tag("application", "food-delivery-api")
                .register(registry);
    }

    @Bean
    public Gauge ordersOutForDeliveryGauge(MeterRegistry registry, OrderRepository orderRepository) {
        return Gauge.builder("orders_out_for_delivery_gauge", orderRepository,
                        repo -> repo.countByStatus(OrderStatus.OUT_FOR_DELIVERY))
                .description("Live count of orders currently out for delivery")
                .tag("application", "food-delivery-api")
                .register(registry);
    }
}