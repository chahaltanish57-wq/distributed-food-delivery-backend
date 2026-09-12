package com.fooddelivery.integration;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.dto.AiChatRequestDTO;
import com.fooddelivery.dto.AiChatResponseDTO;
import com.fooddelivery.entity.Order;
import com.fooddelivery.entity.Restaurant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class AiAssistantIntegrationTest extends BaseIntegrationTest {

    @Test
    @DisplayName("AI Status: Service reports model configuration and supported capabilities")
    void testAiStatusEndpoint() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/ai/status"))
                .andExpect(status().isOk())
                .andReturn();

        Map<String, Object> statusMap = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                new TypeReference<Map<String, Object>>() {}
        );

        assertNotNull(statusMap.get("model"));
        assertNotNull(statusMap.get("provider"));
        assertTrue(statusMap.containsKey("capabilities"));

        @SuppressWarnings("unchecked")
        List<String> capabilities = (List<String>) statusMap.get("capabilities");
        assertFalse(capabilities.isEmpty());
        assertTrue(capabilities.stream().anyMatch(c -> c.contains("Live Order Tracking")));
    }

    @Test
    @DisplayName("AI Query: Live order inquiry returns tracked status and details")
    void testAiChatOrderTracking() throws Exception {
        Restaurant restaurant = restaurantRepository.findAll().get(0);

        Order order = orderRepository.save(Order.builder()
                .customer(testCustomer)
                .restaurant(restaurant)
                .status(OrderStatus.OUT_FOR_DELIVERY)
                .totalAmount(new BigDecimal("480.00"))
                .deliveryAddress("Sector 62, Noida")
                .deliveryLatitude(new BigDecimal("28.6280000"))
                .deliveryLongitude(new BigDecimal("77.3649000"))
                .build());

        AiChatRequestDTO request = AiChatRequestDTO.builder()
                .message("Where is order #" + order.getId() + "?")
                .currentOrderId(order.getId())
                .city("Noida")
                .build();

        MvcResult result = mockMvc.perform(post("/api/v1/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        AiChatResponseDTO response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                AiChatResponseDTO.class
        );

        assertNotNull(response.getReply());
        assertTrue(response.getReply().toLowerCase().contains(String.valueOf(order.getId())) ||
                   response.getReply().toLowerCase().contains("out for delivery") ||
                   response.getReply().toLowerCase().contains("on the way"));
        assertNotNull(response.getOrderDetails(), "Should attach order details payload");
        assertNotNull(response.getSuggestedChips());
    }

    @Test
    @DisplayName("AI Query: Dish recommendation grounded in DB filters by city and budget in INR")
    void testAiChatDishRecommendation() throws Exception {
        AiChatRequestDTO request = AiChatRequestDTO.builder()
                .message("Recommend biryani in Noida under 350")
                .city("Noida")
                .build();

        MvcResult result = mockMvc.perform(post("/api/v1/ai/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        AiChatResponseDTO response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                AiChatResponseDTO.class
        );

        assertNotNull(response.getReply());
        assertTrue(response.getReply().contains("₹") || response.getReply().toLowerCase().contains("biryani"));

        if (response.getRecommendations() != null && !response.getRecommendations().isEmpty()) {
            for (Map<String, Object> item : response.getRecommendations()) {
                assertNotNull(item.get("name"));
                assertNotNull(item.get("price"));
                double price = Double.parseDouble(item.get("price").toString());
                assertTrue(price <= 350.0, "Dish price should be under requested budget of ₹350");
            }
        }
    }
}
