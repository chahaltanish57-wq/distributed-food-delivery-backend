package com.fooddelivery.common.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddToCartRequest implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long restaurantId;
    private Long menuItemId;

    @Builder.Default
    private Integer quantity = 1;

    private boolean forceReplace;
}
