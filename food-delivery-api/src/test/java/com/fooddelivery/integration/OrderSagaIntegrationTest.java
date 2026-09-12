package com.fooddelivery.integration;

import com.fooddelivery.common.dto.*;
import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.common.enums.PaymentMethod;
import com.fooddelivery.common.enums.PaymentStatus;
import com.fooddelivery.entity.Order;
import com.fooddelivery.entity.Restaurant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.Duration;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class OrderSagaIntegrationTest extends BaseIntegrationTest {

    @Test
    @DisplayName("Saga Happy Path: Cart -> Order -> Payment -> Kafka Event -> ORDER_PLACED")
    void testOrderCreationAndPaymentSagaFlow() throws Exception {
        // 1. Clear Redis cart
        mockMvc.perform(delete("/api/v1/cart")
                .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isOk());

        // 2. Select Restaurant and Menu Item
        Restaurant restaurant = restaurantRepository.findAll().stream()
                .filter(r -> "Noida".equalsIgnoreCase(r.getCity()))
                .findFirst()
                .orElseThrow();

        var menuItem = menuItemRepository.findByRestaurantIdAndIsAvailableTrue(restaurant.getId()).get(0);

        // 3. Add to Cart
        AddToCartRequest addReq = AddToCartRequest.builder()
                .restaurantId(restaurant.getId())
                .menuItemId(menuItem.getId())
                .quantity(2)
                .build();

        mockMvc.perform(post("/api/v1/cart/items")
                .header("Authorization", "Bearer " + customerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(addReq)))
                .andExpect(status().isOk());

        // 4. Create Order
        CreateOrderRequest orderReq = CreateOrderRequest.builder()
                .deliveryAddress("Suite 102, Cyber Tower, Sector 62, Noida")
                .deliveryLatitude(new BigDecimal("28.6280000"))
                .deliveryLongitude(new BigDecimal("77.3649000"))
                .contactPhone("+91 9876543210")
                .specialInstructions("Integration Test Order")
                .build();

        MvcResult orderResult = mockMvc.perform(post("/api/v1/orders")
                .header("Authorization", "Bearer " + customerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(orderReq)))
                .andExpect(status().isCreated())
                .andReturn();

        ApiResponse<OrderDTO> orderApiResponse = objectMapper.readValue(
                orderResult.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, OrderDTO.class)
        );

        assertNotNull(orderApiResponse.getData());
        Long orderId = orderApiResponse.getData().getId();
        assertEquals(OrderStatus.PAYMENT_PENDING, orderApiResponse.getData().getStatus());

        // 5. Process Payment
        PaymentRequest payReq = PaymentRequest.builder()
                .orderId(orderId)
                .idempotencyKey("saga-test-key-" + orderId)
                .paymentMethod(PaymentMethod.UPI)
                .amount(orderApiResponse.getData().getTotalAmount())
                .paymentDetails("upi:pay@testbank")
                .build();

        MvcResult payResult = mockMvc.perform(post("/api/v1/payments/process")
                .header("Authorization", "Bearer " + customerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payReq)))
                .andExpect(status().isOk())
                .andReturn();

        ApiResponse<PaymentResponse> payApiResponse = objectMapper.readValue(
                payResult.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, PaymentResponse.class)
        );

        assertNotNull(payApiResponse.getData());
        assertEquals(PaymentStatus.SUCCESS, payApiResponse.getData().getPaymentStatus());

        // 6. Verify Kafka Event & Saga State Machine reached ORDER_PLACED via Awaitility
        await().atMost(Duration.ofSeconds(6)).until(() -> {
            Order updated = orderRepository.findById(orderId).orElse(null);
            return updated != null && updated.getStatus() == OrderStatus.ORDER_PLACED;
        });

        Order finalOrder = orderRepository.findById(orderId).orElseThrow();
        assertEquals(OrderStatus.ORDER_PLACED, finalOrder.getStatus());
        assertNotNull(finalOrder.getDeliveryLatitude());
        assertNotNull(finalOrder.getDeliveryLongitude());
    }

    @Test
    @DisplayName("Payment Idempotency: Duplicate payment submission returns existing receipt without double charge")
    void testDuplicatePaymentIdempotency() throws Exception {
        // Fetch or create an order
        Restaurant restaurant = restaurantRepository.findAll().get(0);
        var menuItem = menuItemRepository.findByRestaurantIdAndIsAvailableTrue(restaurant.getId()).get(0);

        mockMvc.perform(delete("/api/v1/cart")
                .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/cart/items")
                .header("Authorization", "Bearer " + customerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(AddToCartRequest.builder()
                        .restaurantId(restaurant.getId())
                        .menuItemId(menuItem.getId())
                        .quantity(1)
                        .build())))
                .andExpect(status().isOk());

        MvcResult orderRes = mockMvc.perform(post("/api/v1/orders")
                .header("Authorization", "Bearer " + customerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(CreateOrderRequest.builder()
                        .deliveryAddress("Sector 18, Noida")
                        .contactPhone("+91 9876543210")
                        .build())))
                .andExpect(status().isCreated())
                .andReturn();

        ApiResponse<OrderDTO> orderApiResponse = objectMapper.readValue(
                orderRes.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, OrderDTO.class)
        );

        Long orderId = orderApiResponse.getData().getId();

        PaymentRequest payReq = PaymentRequest.builder()
                .orderId(orderId)
                .idempotencyKey("test-idem-key-" + orderId)
                .paymentMethod(PaymentMethod.CREDIT_CARD)
                .amount(orderApiResponse.getData().getTotalAmount())
                .build();

        // 1st attempt: success
        mockMvc.perform(post("/api/v1/payments/process")
                .header("Authorization", "Bearer " + customerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payReq)))
                .andExpect(status().isOk());

        // 2nd attempt with same idempotency key: should return 200 OK with cached receipt
        MvcResult duplicateRes = mockMvc.perform(post("/api/v1/payments/process")
                .header("Authorization", "Bearer " + customerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payReq)))
                .andExpect(status().isOk())
                .andReturn();

        ApiResponse<PaymentResponse> dupPayload = objectMapper.readValue(
                duplicateRes.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, PaymentResponse.class)
        );

        assertNotNull(dupPayload.getData());
        assertEquals(PaymentStatus.SUCCESS, dupPayload.getData().getPaymentStatus());
    }
}
