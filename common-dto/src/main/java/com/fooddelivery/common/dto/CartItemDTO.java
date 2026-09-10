package com.fooddelivery.common.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartItemDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long menuItemId;
    private String name;
    private BigDecimal price;
    private Integer quantity;
    private Boolean isVegetarian;
    private String imageUrl;
    private BigDecimal subtotal;
}
