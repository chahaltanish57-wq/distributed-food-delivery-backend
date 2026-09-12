package com.fooddelivery.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Standard WebSocket STOMP endpoint (used by @stomp/stompjs)
        registry.addEndpoint("/ws-delivery")
                .setAllowedOriginPatterns("*");

        // SockJS fallback STOMP endpoint
        registry.addEndpoint("/ws-delivery")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Simple in-memory message broker for subscription topics (e.g. /topic/orders/{orderId}/tracking)
        registry.enableSimpleBroker("/topic");
        // Prefix for messages destined for methods annotated with @MessageMapping
        registry.setApplicationDestinationPrefixes("/app");
    }
}
