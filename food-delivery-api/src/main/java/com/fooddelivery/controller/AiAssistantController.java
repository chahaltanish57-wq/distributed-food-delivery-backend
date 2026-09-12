package com.fooddelivery.controller;

import com.fooddelivery.dto.AiChatRequestDTO;
import com.fooddelivery.dto.AiChatResponseDTO;
import com.fooddelivery.service.GeminiAiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Tag(name = "AI Assistant & Recommendations", description = "Endpoints for Gemini AI Support Bot, Live Order Inquiries, and Dish Recommendations")
public class AiAssistantController {

    private final GeminiAiService geminiAiService;

    @PostMapping("/chat")
    @Operation(summary = "Chat with Swiggy AI Concierge", description = "Processes user query using Gemini Function Calling or intelligent rule engine to answer order questions and recommend dishes.")
    public ResponseEntity<AiChatResponseDTO> chat(@RequestBody AiChatRequestDTO request) {
        log.info("Received AI chat request: '{}' (orderId: {}, city: {})", 
                request.getMessage(), request.getCurrentOrderId(), request.getCity());
        AiChatResponseDTO response = geminiAiService.processChat(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/status")
    @Operation(summary = "Check AI service status and model provider", description = "Returns active AI configuration, model name, and enabled capabilities.")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(geminiAiService.getAiStatus());
    }
}
