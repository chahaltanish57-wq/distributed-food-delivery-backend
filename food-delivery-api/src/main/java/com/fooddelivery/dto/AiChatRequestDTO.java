package com.fooddelivery.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiChatRequestDTO {
    private String message;

    @JsonAlias({"orderId", "currentOrderId"})
    private Long currentOrderId;

    private String city;
    private List<ChatMessageDTO> history;

    public Long getOrderId() {
        return currentOrderId;
    }
}
