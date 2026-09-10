package com.fooddelivery.exception;

import lombok.Getter;

@Getter
public class RestaurantConflictException extends RuntimeException {
    private final Long currentRestaurantId;
    private final String currentRestaurantName;
    private final Long newRestaurantId;

    public RestaurantConflictException(Long currentRestaurantId, String currentRestaurantName, Long newRestaurantId) {
        super(String.format("Cart already contains items from '%s'. Replace cart to add items from a new restaurant.", currentRestaurantName));
        this.currentRestaurantId = currentRestaurantId;
        this.currentRestaurantName = currentRestaurantName;
        this.newRestaurantId = newRestaurantId;
    }
}
