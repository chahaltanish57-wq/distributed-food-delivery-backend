package com.fooddelivery.service;

import com.fooddelivery.common.dto.MenuItemDTO;
import com.fooddelivery.common.dto.RestaurantDTO;
import com.fooddelivery.entity.MenuItem;
import com.fooddelivery.entity.Restaurant;
import com.fooddelivery.repository.MenuItemRepository;
import com.fooddelivery.repository.RestaurantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RestaurantService {

    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;

    @Transactional(readOnly = true)
    public List<RestaurantDTO> getAllActiveRestaurants(String city) {
        List<Restaurant> restaurants;
        if (city != null && !city.isBlank()) {
            restaurants = restaurantRepository.findAllByCityIgnoreCaseAndIsActiveTrue(city.trim());
        } else {
            restaurants = restaurantRepository.findAllByIsActiveTrue();
        }
        return restaurants.stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RestaurantDTO getRestaurantById(Long id) {
        Restaurant restaurant = restaurantRepository.findByIdAndIsActiveTrue(id)
                .orElseThrow(() -> new RuntimeException("Restaurant not found with id: " + id));
        RestaurantDTO dto = mapToDTO(restaurant);
        dto.setMenuItems(getMenuItems(id, null));
        return dto;
    }

    @Transactional(readOnly = true)
    public List<MenuItemDTO> getMenuItems(Long restaurantId, String category) {
        List<MenuItem> items;
        if (category != null && !category.isBlank()) {
            items = menuItemRepository.findByRestaurantIdAndCategoryIgnoreCase(restaurantId, category);
        } else {
            items = menuItemRepository.findByRestaurantIdAndIsAvailableTrue(restaurantId);
        }
        return items.stream().map(this::mapMenuItemToDTO).collect(Collectors.toList());
    }

    @Transactional
    public RestaurantDTO createRestaurant(RestaurantDTO dto) {
        Restaurant restaurant = Restaurant.builder()
                .name(dto.getName())
                .description(dto.getDescription())
                .address(dto.getAddress())
                .city(dto.getCity() != null ? dto.getCity() : "Noida")
                .latitude(dto.getLatitude())
                .longitude(dto.getLongitude())
                .rating(dto.getRating() != null ? dto.getRating() : new java.math.BigDecimal("4.5"))
                .imageUrl(dto.getImageUrl())
                .cuisineType(dto.getCuisineType())
                .deliveryTimeMins(dto.getDeliveryTimeMins() != null ? dto.getDeliveryTimeMins() : 30)
                .isActive(true)
                .build();
        Restaurant saved = restaurantRepository.save(restaurant);
        return mapToDTO(saved);
    }

    @Transactional
    public MenuItemDTO addMenuItem(Long restaurantId, MenuItemDTO dto) {
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new RuntimeException("Restaurant not found with id: " + restaurantId));

        MenuItem item = MenuItem.builder()
                .restaurant(restaurant)
                .name(dto.getName())
                .description(dto.getDescription())
                .price(dto.getPrice())
                .category(dto.getCategory())
                .isVegetarian(dto.getIsVegetarian() != null ? dto.getIsVegetarian() : false)
                .isAvailable(true)
                .imageUrl(dto.getImageUrl())
                .build();

        MenuItem saved = menuItemRepository.save(item);
        return mapMenuItemToDTO(saved);
    }

    public RestaurantDTO mapToDTO(Restaurant r) {
        return RestaurantDTO.builder()
                .id(r.getId())
                .name(r.getName())
                .description(r.getDescription())
                .address(r.getAddress())
                .city(r.getCity())
                .latitude(r.getLatitude())
                .longitude(r.getLongitude())
                .rating(r.getRating())
                .imageUrl(r.getImageUrl())
                .cuisineType(r.getCuisineType())
                .deliveryTimeMins(r.getDeliveryTimeMins())
                .isActive(r.getIsActive())
                .build();
    }

    public MenuItemDTO mapMenuItemToDTO(MenuItem m) {
        return MenuItemDTO.builder()
                .id(m.getId())
                .restaurantId(m.getRestaurant().getId())
                .name(m.getName())
                .description(m.getDescription())
                .price(m.getPrice())
                .category(m.getCategory())
                .isVegetarian(m.getIsVegetarian())
                .isAvailable(m.getIsAvailable())
                .imageUrl(m.getImageUrl())
                .build();
    }
}