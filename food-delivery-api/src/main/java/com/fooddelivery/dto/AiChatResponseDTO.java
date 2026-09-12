package com.fooddelivery.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiChatResponseDTO {
    private String reply;
    private String intent;
    private boolean aiPowered;
    private String modelUsed;
    private Map<String, Object> orderDetails;
    private List<Map<String, Object>> recommendations;
    private List<String> suggestedChips;
}
