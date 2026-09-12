package com.fooddelivery.integration;

import com.fooddelivery.common.dto.ApiResponse;
import com.fooddelivery.common.dto.OrderDTO;
import com.fooddelivery.common.enums.DriverStatus;
import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.entity.DeliveryPartner;
import com.fooddelivery.entity.Order;
import com.fooddelivery.entity.Restaurant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class KitchenAndDeliveryIntegrationTest extends BaseIntegrationTest {

    @Test
    @DisplayName("Lifecycle: Full Kitchen Preparation Ladder -> Driver Assignment -> Delivery Flow")
    void testKitchenPreparationLadderAndDeliveryLifecycle() throws Exception {
        Restaurant restaurant = restaurantRepository.findAll().get(0);
        DeliveryPartner driver = deliveryPartnerRepository.findAll().stream()
                .filter(d -> d.getCity().equalsIgnoreCase(restaurant.getCity()))
                .findFirst()
                .orElseThrow();

        // Ensure driver is AVAILABLE
        driver.setStatus(DriverStatus.AVAILABLE);
        deliveryPartnerRepository.save(driver);

        // 1. Seed Order in ORDER_PLACED state
        Order order = orderRepository.save(Order.builder()
                .customer(testCustomer)
                .restaurant(restaurant)
                .status(OrderStatus.ORDER_PLACED)
                .totalAmount(new BigDecimal("450.00"))
                .deliveryAddress("Suite 404, Tech Hub, Sector 62, Noida")
                .deliveryLatitude(new BigDecimal("28.6280000"))
                .deliveryLongitude(new BigDecimal("77.3649000"))
                .build());

        Long orderId = order.getId();

        // 2. Kitchen accepts order -> RESTAURANT_ACCEPTED
        MvcResult acceptResult = mockMvc.perform(patch("/api/v1/kitchen/orders/" + orderId + "/accept"))
                .andExpect(status().isOk())
                .andReturn();

        ApiResponse<OrderDTO> acceptResp = objectMapper.readValue(
                acceptResult.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, OrderDTO.class)
        );
        assertEquals(OrderStatus.RESTAURANT_ACCEPTED, acceptResp.getData().getStatus());

        // 3. Kitchen starts cooking -> PREPARING
        MvcResult cookingResult = mockMvc.perform(patch("/api/v1/kitchen/orders/" + orderId + "/start-cooking"))
                .andExpect(status().isOk())
                .andReturn();

        ApiResponse<OrderDTO> cookingResp = objectMapper.readValue(
                cookingResult.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, OrderDTO.class)
        );
        assertEquals(OrderStatus.PREPARING, cookingResp.getData().getStatus());

        // 4. Kitchen marks food ready -> READY_FOR_PICKUP
        MvcResult readyResult = mockMvc.perform(patch("/api/v1/kitchen/orders/" + orderId + "/food-ready"))
                .andExpect(status().isOk())
                .andReturn();

        ApiResponse<OrderDTO> readyResp = objectMapper.readValue(
                readyResult.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, OrderDTO.class)
        );
        assertEquals(OrderStatus.READY_FOR_PICKUP, readyResp.getData().getStatus());

        // 5. Driver claims / accepts order
        mockMvc.perform(post("/api/v1/drivers/" + driver.getId() + "/orders/" + orderId + "/accept"))
                .andExpect(status().isOk());

        // 6. Driver picks up food -> OUT_FOR_DELIVERY
        MvcResult pickupResult = mockMvc.perform(patch("/api/v1/drivers/" + driver.getId() + "/orders/" + orderId + "/pickup"))
                .andExpect(status().isOk())
                .andReturn();

        ApiResponse<OrderDTO> pickupResp = objectMapper.readValue(
                pickupResult.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, OrderDTO.class)
        );
        assertEquals(OrderStatus.OUT_FOR_DELIVERY, pickupResp.getData().getStatus());

        // 7. Driver delivers food -> DELIVERED
        MvcResult deliverResult = mockMvc.perform(patch("/api/v1/drivers/" + driver.getId() + "/orders/" + orderId + "/deliver"))
                .andExpect(status().isOk())
                .andReturn();

        ApiResponse<OrderDTO> deliverResp = objectMapper.readValue(
                deliverResult.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class, OrderDTO.class)
        );
        assertEquals(OrderStatus.DELIVERED, deliverResp.getData().getStatus());

        // 8. Assert DB persistence and Driver state reset
        Order dbOrder = orderRepository.findById(orderId).orElseThrow();
        assertEquals(OrderStatus.DELIVERED, dbOrder.getStatus());

        DeliveryPartner updatedDriver = deliveryPartnerRepository.findById(driver.getId()).orElseThrow();
        assertEquals(DriverStatus.AVAILABLE, updatedDriver.getStatus(), "Driver should return to AVAILABLE after delivery");
    }

    @Test
    @DisplayName("State Machine Guard: Illegal direct jump from PREPARING to DELIVERED is rejected with 400")
    void testIllegalStateTransitionGuard() throws Exception {
        Restaurant restaurant = restaurantRepository.findAll().get(0);
        DeliveryPartner driver = deliveryPartnerRepository.findAll().get(0);

        Order order = orderRepository.save(Order.builder()
                .customer(testCustomer)
                .restaurant(restaurant)
                .status(OrderStatus.PREPARING)
                .deliveryPartnerId(driver.getId())
                .totalAmount(new BigDecimal("299.00"))
                .deliveryAddress("Paltan Bazaar, Dehradun")
                .deliveryLatitude(new BigDecimal("30.3204000"))
                .deliveryLongitude(new BigDecimal("78.0382000"))
                .build());

        Long orderId = order.getId();

        // Attempt illegal jump directly from PREPARING -> DELIVERED
        mockMvc.perform(patch("/api/v1/drivers/" + driver.getId() + "/orders/" + orderId + "/deliver"))
                .andExpect(status().isBadRequest());

        // Verify state remains PREPARING in database
        Order afterOrder = orderRepository.findById(orderId).orElseThrow();
        assertEquals(OrderStatus.PREPARING, afterOrder.getStatus(), "Order status must remain PREPARING after illegal transition attempt");
    }

    @Test
    @DisplayName("Kitchen Rejection: Restaurant rejects overloaded ticket -> RESTAURANT_REJECTED")
    void testKitchenRejection() throws Exception {
        Restaurant restaurant = restaurantRepository.findAll().get(0);

        Order order = orderRepository.save(Order.builder()
                .customer(testCustomer)
                .restaurant(restaurant)
                .status(OrderStatus.ORDER_PLACED)
                .totalAmount(new BigDecimal("600.00"))
                .deliveryAddress("Sector 29, Noida")
                .deliveryLatitude(new BigDecimal("28.5672000"))
                .deliveryLongitude(new BigDecimal("77.3342000"))
                .build());

        Long orderId = order.getId();

        mockMvc.perform(patch("/api/v1/kitchen/orders/" + orderId + "/reject")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("reason", "Kitchen capacity reached"))))
                .andExpect(status().isOk());

        Order rejectedOrder = orderRepository.findById(orderId).orElseThrow();
        assertEquals(OrderStatus.RESTAURANT_REJECTED, rejectedOrder.getStatus());
    }
}
