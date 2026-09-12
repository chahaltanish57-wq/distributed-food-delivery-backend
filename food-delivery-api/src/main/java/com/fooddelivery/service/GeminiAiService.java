package com.fooddelivery.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.dto.AiChatRequestDTO;
import com.fooddelivery.dto.AiChatResponseDTO;
import com.fooddelivery.dto.ChatMessageDTO;
import com.fooddelivery.entity.DeliveryPartner;
import com.fooddelivery.entity.MenuItem;
import com.fooddelivery.entity.Order;
import com.fooddelivery.repository.DeliveryPartnerRepository;
import com.fooddelivery.repository.MenuItemRepository;
import com.fooddelivery.repository.OrderRepository;
import com.fooddelivery.repository.RestaurantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeminiAiService {

    private final OrderRepository orderRepository;
    private final MenuItemRepository menuItemRepository;
    private final RestaurantRepository restaurantRepository;
    private final DeliveryPartnerRepository deliveryPartnerRepository;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api.key:${GEMINI_API_KEY:}}")
    private String geminiApiKey;

    @Value("${gemini.model:${GEMINI_MODEL:gemini-2.5-flash}}")
    private String geminiModel;

    private final RestTemplate restTemplate = new RestTemplate();

    private static final String GEMINI_API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    /**
     * Main conversation handler for customer queries.
     * Uses Google Gemini Live API with Function Calling when an API key is available;
     * otherwise falls back seamlessly to the internal deterministic conversational tool engine.
     */
    public AiChatResponseDTO processChat(AiChatRequestDTO request) {
        String userMsg = request.getMessage() != null ? request.getMessage().trim() : "";
        if (userMsg.isEmpty()) {
            return AiChatResponseDTO.builder()
                    .reply("Hello! I am your Swiggy AI Concierge. How can I assist you today? You can ask me to track your active order, check food recommendations, or help cancel an order.")
                    .intent("GREETING")
                    .aiPowered(false)
                    .suggestedChips(List.of("Where is my order?", "Recommend bestsellers in Noida", "Suggest desserts under ₹250"))
                    .build();
        }

        // Check if live Gemini API key is provided
        if (geminiApiKey != null && !geminiApiKey.isBlank() && !geminiApiKey.contains("YOUR_GEMINI_API_KEY")) {
            try {
                return callGeminiWithTools(request);
            } catch (Exception e) {
                log.warn("Gemini API call encountered an error: {}. Falling back to internal engine.", e.getMessage());
            }
        }

        // Deterministic intelligent fallback engine
        return processWithFallbackEngine(request);
    }

    /**
     * Check if Gemini API is configured and operational
     */
    public Map<String, Object> getAiStatus() {
        boolean configured = geminiApiKey != null && !geminiApiKey.isBlank() && !geminiApiKey.contains("YOUR_GEMINI_API_KEY");
        Map<String, Object> status = new HashMap<>();
        status.put("configured", configured);
        status.put("model", geminiModel);
        status.put("provider", configured ? "Google Gemini Live AI (" + geminiModel + ")" : "Swiggy Rule & Tool Fallback Engine");
        status.put("capabilities", List.of("Live Order Tracking", "Order Cancellation", "Dishes & Combos Recommendation in ₹", "Dual-City Support (Noida & Dehradun)"));
        return status;
    }

    // ==========================================
    // GEMINI API FUNCTION CALLING INTEGRATION
    // ==========================================

    private AiChatResponseDTO callGeminiWithTools(AiChatRequestDTO request) throws Exception {
        String url = String.format(GEMINI_API_URL, geminiModel, geminiApiKey);

        Map<String, Object> payload = buildGeminiPayload(request);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && !candidates.isEmpty()) {
                JsonNode firstCandidate = candidates.get(0);
                JsonNode parts = firstCandidate.path("content").path("parts");

                for (JsonNode part : parts) {
                    if (part.has("functionCall")) {
                        JsonNode fnCall = part.path("functionCall");
                        String fnName = fnCall.path("name").asText();
                        JsonNode args = fnCall.path("args");

                        return handleGeminiToolExecution(fnName, args, request);
                    } else if (part.has("text")) {
                        String textReply = part.path("text").asText();
                        return AiChatResponseDTO.builder()
                                .reply(textReply)
                                .intent("GENERAL_AI_CHAT")
                                .aiPowered(true)
                                .modelUsed(geminiModel)
                                .suggestedChips(generateDefaultChips(request.getCurrentOrderId()))
                                .build();
                    }
                }
            }
        }

        return processWithFallbackEngine(request);
    }

    private Map<String, Object> buildGeminiPayload(AiChatRequestDTO request) {
        Map<String, Object> payload = new LinkedHashMap<>();

        // System Instruction
        Map<String, Object> systemInstruction = new LinkedHashMap<>();
        systemInstruction.put("parts", List.of(Map.of(
                "text", "You are Swiggy Genie, the friendly, witty, and highly helpful AI customer assistant for Swiggy Food Delivery serving Noida and Dehradun. " +
                        "All prices must strictly be in Indian Rupees (₹). " +
                        "When users ask about order tracking or status, use the 'getOrderStatus' tool. " +
                        "When users want to cancel an order, use the 'cancelOrder' tool. " +
                        "When users ask for recommendations, bestsellers, or cuisines, use the 'recommendDishes' tool. " +
                        "Keep responses polite, punchy, and helpful."
        )));
        payload.put("system_instruction", systemInstruction);

        // Contents (conversation turns)
        List<Map<String, Object>> contents = new ArrayList<>();
        if (request.getHistory() != null) {
            for (ChatMessageDTO historyMsg : request.getHistory()) {
                String role = "model".equalsIgnoreCase(historyMsg.getRole()) || "assistant".equalsIgnoreCase(historyMsg.getRole())
                        ? "model" : "user";
                contents.add(Map.of(
                        "role", role,
                        "parts", List.of(Map.of("text", historyMsg.getContent()))
                ));
            }
        }
        contents.add(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", request.getMessage()))
        ));
        payload.put("contents", contents);

        // Function Declarations / Tools
        Map<String, Object> getOrderStatusDeclaration = Map.of(
                "name", "getOrderStatus",
                "description", "Retrieve live real-time status, ETA, restaurant details, and assigned delivery partner for an order by ID.",
                "parameters", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "orderId", Map.of("type", "integer", "description", "The numeric order ID to track")
                        ),
                        "required", List.of("orderId")
                )
        );

        Map<String, Object> cancelOrderDeclaration = Map.of(
                "name", "cancelOrder",
                "description", "Cancel an eligible order before preparation starts and initiate a refund.",
                "parameters", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "orderId", Map.of("type", "integer", "description", "The numeric order ID to cancel")
                        ),
                        "required", List.of("orderId")
                )
        );

        Map<String, Object> recommendDishesDeclaration = Map.of(
                "name", "recommendDishes",
                "description", "Recommend top dishes and combos filtered by city (Noida or Dehradun), cuisine/keyword, and budget in INR (₹).",
                "parameters", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "city", Map.of("type", "string", "description", "City name: 'Noida' or 'Dehradun'"),
                                "cuisine", Map.of("type", "string", "description", "Cuisine or dish search keyword, e.g. Biryani, Burger, Pizza, Sweet"),
                                "maxPrice", Map.of("type", "number", "description", "Maximum price limit in Indian Rupees (₹)")
                        )
                )
        );

        payload.put("tools", List.of(Map.of(
                "function_declarations", List.of(getOrderStatusDeclaration, cancelOrderDeclaration, recommendDishesDeclaration)
        )));

        return payload;
    }

    private AiChatResponseDTO handleGeminiToolExecution(String fnName, JsonNode args, AiChatRequestDTO request) {
        log.info("Gemini invoked tool '{}' with args: {}", fnName, args);

        if ("getOrderStatus".equalsIgnoreCase(fnName)) {
            Long orderId = args.has("orderId") ? args.path("orderId").asLong() : request.getCurrentOrderId();
            if (orderId == null) orderId = 15L; // Default to active demo order
            Map<String, Object> orderDetails = executeGetOrderStatus(orderId);

            String reply = formatOrderStatusReply(orderDetails);
            return AiChatResponseDTO.builder()
                    .reply(reply)
                    .intent("ORDER_STATUS")
                    .aiPowered(true)
                    .modelUsed(geminiModel)
                    .orderDetails(orderDetails)
                    .suggestedChips(List.of("Track on Live GPS Map", "Can I cancel this order?", "Suggest desserts to add"))
                    .build();

        } else if ("cancelOrder".equalsIgnoreCase(fnName)) {
            Long orderId = args.has("orderId") ? args.path("orderId").asLong() : request.getCurrentOrderId();
            if (orderId == null) orderId = 15L;
            Map<String, Object> cancelRes = executeCancelOrder(orderId);

            return AiChatResponseDTO.builder()
                    .reply((String) cancelRes.get("message"))
                    .intent("CANCEL_ORDER")
                    .aiPowered(true)
                    .modelUsed(geminiModel)
                    .orderDetails(cancelRes)
                    .suggestedChips(List.of("View my orders", "Recommend food in Noida", "Talk to human support"))
                    .build();

        } else if ("recommendDishes".equalsIgnoreCase(fnName)) {
            String city = args.has("city") && !args.path("city").isNull() ? args.path("city").asText() : request.getCity();
            String cuisine = args.has("cuisine") && !args.path("cuisine").isNull() ? args.path("cuisine").asText() : null;
            Double maxPrice = args.has("maxPrice") && !args.path("maxPrice").isNull() ? args.path("maxPrice").asDouble() : null;

            List<Map<String, Object>> dishes = executeRecommendDishes(city, cuisine, maxPrice);
            String reply = formatRecommendationsReply(dishes, city, cuisine, maxPrice);

            return AiChatResponseDTO.builder()
                    .reply(reply)
                    .intent("RECOMMENDATIONS")
                    .aiPowered(true)
                    .modelUsed(geminiModel)
                    .recommendations(dishes)
                    .suggestedChips(List.of("Biryani under ₹350", "Desserts in Noida", "Fastest delivery items"))
                    .build();
        }

        return processWithFallbackEngine(request);
    }

    // ==========================================
    // FALLBACK INTELLIGENT RULE & TOOL ENGINE
    // ==========================================

    private AiChatResponseDTO processWithFallbackEngine(AiChatRequestDTO request) {
        String query = request.getMessage().toLowerCase();
        Long orderId = extractOrderId(request.getMessage(), request.getCurrentOrderId());

        // 1. Order Status & Live Tracking queries
        if (query.contains("track") || query.contains("where") || query.contains("status") || query.contains("eta") || query.contains("delivery partner") || query.contains("order")) {
            if (query.contains("cancel") || query.contains("refund") || query.contains("stop")) {
                // Cancellation intent
                Map<String, Object> cancelResult = executeCancelOrder(orderId);
                return AiChatResponseDTO.builder()
                        .reply((String) cancelResult.get("message"))
                        .intent("CANCEL_ORDER")
                        .aiPowered(false)
                        .orderDetails(cancelResult)
                        .suggestedChips(List.of("Check my refund status", "Order something else", "Help center"))
                        .build();
            }

            Map<String, Object> orderDetails = executeGetOrderStatus(orderId);
            String reply = formatOrderStatusReply(orderDetails);

            return AiChatResponseDTO.builder()
                    .reply(reply)
                    .intent("ORDER_STATUS")
                    .aiPowered(false)
                    .orderDetails(orderDetails)
                    .suggestedChips(List.of("View Live GPS Map", "Contact Delivery Partner", "Cancel this order"))
                    .build();
        }

        // 2. Cancellation queries
        if (query.contains("cancel") || query.contains("refund") || query.contains("mistake")) {
            Map<String, Object> cancelResult = executeCancelOrder(orderId);
            return AiChatResponseDTO.builder()
                    .reply((String) cancelResult.get("message"))
                    .intent("CANCEL_ORDER")
                    .aiPowered(false)
                    .orderDetails(cancelResult)
                    .suggestedChips(List.of("View order history", "Recommend fresh snacks", "Support hotline"))
                    .build();
        }

        // 3. Recommendation & Menu queries
        if (query.contains("recommend") || query.contains("suggest") || query.contains("hungry") ||
                query.contains("craving") || query.contains("biryani") || query.contains("pizza") ||
                query.contains("burger") || query.contains("dessert") || query.contains("sweet") ||
                query.contains("food") || query.contains("eat") || query.contains("bestseller") ||
                query.contains("under") || query.contains("budget")) {

            String city = detectCity(request);
            String keyword = extractKeyword(query);
            Double maxPrice = extractPrice(query);

            List<Map<String, Object>> recommendations = executeRecommendDishes(city, keyword, maxPrice);
            String reply = formatRecommendationsReply(recommendations, city, keyword, maxPrice);

            return AiChatResponseDTO.builder()
                    .reply(reply)
                    .intent("RECOMMENDATIONS")
                    .aiPowered(false)
                    .recommendations(recommendations)
                    .suggestedChips(List.of("Show veg only", "Dishes under ₹250", "Switch to Dehradun"))
                    .build();
        }

        // 4. General Conversational Greeting
        return AiChatResponseDTO.builder()
                .reply("👋 Namaste! I'm your Swiggy AI Assistant. I can track your live orders across Noida and Dehradun, help you cancel eligible orders, or recommend mouth-watering dishes right from our menu! What would you like to explore?")
                .intent("GREETING")
                .aiPowered(false)
                .suggestedChips(List.of(
                        "Where is my order #" + (orderId != null ? orderId : 15) + "?",
                        "Recommend Biryani in Noida",
                        "Best Desserts under ₹300"
                ))
                .build();
    }

    // ==========================================
    // CORE TOOL EXECUTIONS (GROUNDED IN DB)
    // ==========================================

    @Transactional(readOnly = true)
    public Map<String, Object> executeGetOrderStatus(Long orderId) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (orderId == null) {
            result.put("error", "No order ID specified.");
            return result;
        }

        Optional<Order> orderOpt = orderRepository.findWithDetailsById(orderId);
        if (orderOpt.isEmpty()) {
            result.put("orderId", orderId);
            result.put("found", false);
            result.put("error", "We couldn't locate Order #" + orderId + " in our records. Please verify the order number.");
            return result;
        }

        Order order = orderOpt.get();
        result.put("found", true);
        result.put("orderId", order.getId());
        result.put("status", order.getStatus().name());
        result.put("totalAmount", order.getTotalAmount());
        result.put("deliveryAddress", order.getDeliveryAddress());
        result.put("createdAt", order.getCreatedAt() != null ? order.getCreatedAt().toString() : "");

        if (order.getRestaurant() != null) {
            result.put("restaurantId", order.getRestaurant().getId());
            result.put("restaurantName", order.getRestaurant().getName());
            result.put("restaurantCity", order.getRestaurant().getCity());
            result.put("etaMinutes", order.getRestaurant().getDeliveryTimeMins() != null ? order.getRestaurant().getDeliveryTimeMins() : 25);
        } else {
            result.put("restaurantName", "Swiggy Select Partner");
            result.put("etaMinutes", 25);
        }

        if (order.getDeliveryPartnerId() != null) {
            Optional<DeliveryPartner> partnerOpt = deliveryPartnerRepository.findById(order.getDeliveryPartnerId());
            if (partnerOpt.isPresent()) {
                DeliveryPartner dp = partnerOpt.get();
                result.put("driverName", dp.getName());
                result.put("driverPhone", dp.getPhone());
                result.put("driverVehicle", dp.getVehicleType());
                result.put("driverRating", "4.8");
            } else {
                result.put("driverName", "Rahul Sharma");
                result.put("driverPhone", "+91 98765 43210");
            }
        } else {
            result.put("driverName", "Rahul Sharma (Assigned)");
            result.put("driverPhone", "+91 98765 43210");
        }

        result.put("itemCount", order.getOrderItems() != null ? order.getOrderItems().size() : 0);
        return result;
    }

    @Transactional
    public Map<String, Object> executeCancelOrder(Long orderId) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (orderId == null) {
            result.put("success", false);
            result.put("message", "Please specify an order ID to cancel.");
            return result;
        }

        Optional<Order> orderOpt = orderRepository.findWithDetailsById(orderId);
        if (orderOpt.isEmpty()) {
            result.put("success", false);
            result.put("message", "Order #" + orderId + " was not found.");
            return result;
        }

        Order order = orderOpt.get();
        OrderStatus currentStatus = order.getStatus();

        if (currentStatus == OrderStatus.CANCELLED) {
            result.put("success", false);
            result.put("message", "Order #" + orderId + " is already cancelled.");
            return result;
        }

        if (currentStatus == OrderStatus.DELIVERED) {
            result.put("success", false);
            result.put("message", "Order #" + orderId + " has already been delivered and cannot be cancelled.");
            return result;
        }

        if (currentStatus == OrderStatus.OUT_FOR_DELIVERY || currentStatus == OrderStatus.READY_FOR_PICKUP) {
            result.put("success", false);
            result.put("message", "Order #" + orderId + " is already on the bike with our delivery partner and cannot be cancelled automatically. Please contact live customer support.");
            return result;
        }

        // Eligible for instant cancellation
        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);

        result.put("success", true);
        result.put("orderId", orderId);
        result.put("message", String.format("Order #%d has been successfully cancelled. A full refund of ₹%.2f has been initiated to your source payment method and should reflect in 2-4 hours. 💳",
                orderId, order.getTotalAmount()));
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> executeRecommendDishes(String city, String keyword, Double maxPrice) {
        String searchCity = (city != null && !city.isBlank()) ? city.trim() : "";
        String searchKeyword = (keyword != null && !keyword.isBlank()) ? keyword.trim() : "";
        BigDecimal priceLimit = (maxPrice != null && maxPrice > 0) ? BigDecimal.valueOf(maxPrice) : BigDecimal.valueOf(999999);

        List<MenuItem> items = menuItemRepository.searchRecommendations(searchCity, searchKeyword, priceLimit);

        // Fallback to general city search if specific filter returned no results
        if (items.isEmpty() && !searchKeyword.isEmpty()) {
            items = menuItemRepository.searchRecommendations(searchCity, "", priceLimit);
        }
        if (items.isEmpty()) {
            items = menuItemRepository.searchRecommendations("", "", priceLimit);
        }

        List<Map<String, Object>> list = new ArrayList<>();
        int count = 0;
        for (MenuItem item : items) {
            if (count >= 5) break; // Return top 5 recommendations

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", item.getId());
            map.put("name", item.getName());
            map.put("description", item.getDescription());
            map.put("price", item.getPrice());
            map.put("category", item.getCategory());
            map.put("isVegetarian", Boolean.TRUE.equals(item.getIsVegetarian()));
            map.put("imageUrl", item.getImageUrl());

            if (item.getRestaurant() != null) {
                map.put("restaurantId", item.getRestaurant().getId());
                map.put("restaurantName", item.getRestaurant().getName());
                map.put("restaurantCity", item.getRestaurant().getCity());
                map.put("rating", item.getRestaurant().getRating());
            }
            list.add(map);
            count++;
        }
        return list;
    }

    // ==========================================
    // HELPER FORMATTERS & UTILITIES
    // ==========================================

    private String formatOrderStatusReply(Map<String, Object> details) {
        if (Boolean.FALSE.equals(details.get("found"))) {
            return (String) details.get("error");
        }

        Long orderId = (Long) details.get("orderId");
        String status = (String) details.get("status");
        String restName = (String) details.get("restaurantName");
        String driverName = (String) details.get("driverName");
        Integer eta = (Integer) details.get("etaMinutes");
        BigDecimal total = (BigDecimal) details.get("totalAmount");

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("🛵 **Order #%d Status**: **%s**\n\n", orderId, status.replace('_', ' ')));
        sb.append(String.format("• **Restaurant**: %s\n", restName));
        sb.append(String.format("• **Delivery Partner**: %s\n", driverName));
        sb.append(String.format("• **Estimated ETA**: ~%d minutes\n", eta != null ? eta : 25));
        sb.append(String.format("• **Total Amount**: ₹%.2f\n\n", total != null ? total : BigDecimal.ZERO));

        if ("OUT_FOR_DELIVERY".equalsIgnoreCase(status)) {
            sb.append("⚡ Your delivery partner is riding toward your address! Click **\"View Live GPS Map\"** below to watch live on OpenStreetMap.");
        } else if ("DELIVERED".equalsIgnoreCase(status)) {
            sb.append("🎉 Your meal has arrived! Hope you enjoyed your food. Let us know if you need anything else!");
        } else if ("PREPARING".equalsIgnoreCase(status) || "RESTAURANT_ACCEPTED".equalsIgnoreCase(status)) {
            sb.append("🍳 The chef is carefully packing your warm meal. Driver will pick it up soon!");
        } else {
            sb.append("Your order is being actively processed by our dispatch center.");
        }

        return sb.toString();
    }

    private String formatRecommendationsReply(List<Map<String, Object>> dishes, String city, String keyword, Double maxPrice) {
        if (dishes.isEmpty()) {
            return "Sorry, I couldn't find any dishes matching your query in " + (city != null ? city : "Noida") + ". How about exploring our bestsellers?";
        }

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("✨ Here are our top hand-picked recommendations in **%s**", city != null ? city : "Noida"));
        if (keyword != null && !keyword.isBlank()) {
            sb.append(String.format(" for **\"%s\"**", keyword));
        }
        if (maxPrice != null) {
            sb.append(String.format(" under **₹%.0f**", maxPrice));
        }
        sb.append(":\n\n");

        for (Map<String, Object> d : dishes) {
            String vegIcon = Boolean.TRUE.equals(d.get("isVegetarian")) ? "🟢" : "🔴";
            sb.append(String.format("%s **%s** — **₹%s**\n", vegIcon, d.get("name"), d.get("price")));
            sb.append(String.format("   *%s* (⭐ %s)\n", d.get("restaurantName"), d.get("rating")));
        }
        sb.append("\n👉 You can add any dish directly to your cart using the cards below!");
        return sb.toString();
    }

    private Long extractOrderId(String msg, Long defaultId) {
        if (msg == null) return defaultId;
        Matcher m = Pattern.compile("(?:order|#|id)\\s*#?(\\d+)", Pattern.CASE_INSENSITIVE).matcher(msg);
        if (m.find()) {
            try {
                return Long.parseLong(m.group(1));
            } catch (NumberFormatException ignored) {}
        }
        return defaultId != null ? defaultId : 15L;
    }

    private String detectCity(AiChatRequestDTO req) {
        String msg = req.getMessage().toLowerCase();
        if (msg.contains("dehradun") || msg.contains("doon") || msg.contains("rajpur") || msg.contains("paltan")) {
            return "Dehradun";
        }
        if (msg.contains("noida") || msg.contains("sector")) {
            return "Noida";
        }
        return req.getCity() != null ? req.getCity() : "Noida";
    }

    private String extractKeyword(String query) {
        if (query.contains("biryani")) return "Biryani";
        if (query.contains("pizza")) return "Pizza";
        if (query.contains("burger")) return "Burger";
        if (query.contains("dessert") || query.contains("sweet") || query.contains("cake") || query.contains("gulab")) return "Dessert";
        if (query.contains("north indian") || query.contains("curry") || query.contains("paneer")) return "North Indian";
        if (query.contains("chinese") || query.contains("noodle") || query.contains("momo")) return "Chinese";
        if (query.contains("snack") || query.contains("samosa") || query.contains("roll")) return "Snack";
        return null;
    }

    private Double extractPrice(String query) {
        Matcher m = Pattern.compile("(?:under|below|less than|max|₹|rs\\.?)\\s*(\\d+)", Pattern.CASE_INSENSITIVE).matcher(query);
        if (m.find()) {
            try {
                return Double.parseDouble(m.group(1));
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private List<String> generateDefaultChips(Long orderId) {
        List<String> chips = new ArrayList<>();
        if (orderId != null) {
            chips.add("Where is order #" + orderId + "?");
        } else {
            chips.add("Where is order #15?");
        }
        chips.add("Recommend Biryani in Noida");
        chips.add("Desserts under ₹250");
        return chips;
    }
}
