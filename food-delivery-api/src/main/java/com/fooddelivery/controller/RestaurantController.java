package com.fooddelivery.controller;

import com.fooddelivery.common.dto.ApiResponse;
import com.fooddelivery.common.dto.MenuItemDTO;
import com.fooddelivery.common.dto.RestaurantDTO;
import com.fooddelivery.service.RestaurantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/restaurants")
@RequiredArgsConstructor
@Tag(name = "Restaurant & Menu APIs", description = "Endpoints to browse restaurants and menus")
public class RestaurantController {

    private final RestaurantService restaurantService;

    @GetMapping
    @Operation(summary = "Get all active restaurants", description = "Returns a list of all operating restaurants with ratings and cuisine tags.")
    public ResponseEntity<ApiResponse<List<RestaurantDTO>>> getAllRestaurants() {
        List<RestaurantDTO> restaurants = restaurantService.getAllActiveRestaurants();
        return ResponseEntity.ok(ApiResponse.success(restaurants, "Restaurants fetched successfully"));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get restaurant by ID", description = "Returns restaurant details including full menu items.")
    public ResponseEntity<ApiResponse<RestaurantDTO>> getRestaurantById(@PathVariable("id") Long id) {
        RestaurantDTO restaurant = restaurantService.getRestaurantById(id);
        return ResponseEntity.ok(ApiResponse.success(restaurant, "Restaurant details retrieved"));
    }

    @GetMapping("/{id}/menu")
    @Operation(summary = "Get menu items for a restaurant", description = "Returns available dishes for a specific restaurant, with optional category filter.")
    public ResponseEntity<ApiResponse<List<MenuItemDTO>>> getMenuItems(
            @PathVariable("id") Long id,
            @RequestParam(name = "category", required = false) String category) {
        List<MenuItemDTO> items = restaurantService.getMenuItems(id, category);
        return ResponseEntity.ok(ApiResponse.success(items, "Menu items fetched successfully"));
    }

    @PostMapping
    @Operation(summary = "Create a new restaurant", description = "Registers a new restaurant in the platform.")
    public ResponseEntity<ApiResponse<RestaurantDTO>> createRestaurant(@RequestBody RestaurantDTO dto) {
        RestaurantDTO created = restaurantService.createRestaurant(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(created, "Restaurant created successfully"));
    }

    @PostMapping("/{id}/menu")
    @Operation(summary = "Add a menu item", description = "Adds a new dish/beverage to a restaurant's menu.")
    public ResponseEntity<ApiResponse<MenuItemDTO>> addMenuItem(
            @PathVariable("id") Long id,
            @RequestBody MenuItemDTO dto) {
        MenuItemDTO created = restaurantService.addMenuItem(id, dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(created, "Menu item added successfully"));
    }
}