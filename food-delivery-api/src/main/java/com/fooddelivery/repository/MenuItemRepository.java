package com.fooddelivery.repository;

import com.fooddelivery.entity.MenuItem;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {
    List<MenuItem> findByRestaurantIdAndIsAvailableTrue(Long restaurantId);
    List<MenuItem> findByRestaurantIdAndCategoryIgnoreCase(Long restaurantId, String category);

    @EntityGraph(attributePaths = {"restaurant"})
    @Query("SELECT m FROM MenuItem m WHERE m.isAvailable = true " +
           "AND LOWER(COALESCE(m.restaurant.city, '')) LIKE LOWER(CONCAT('%', :city, '%')) " +
           "AND (LOWER(COALESCE(m.restaurant.cuisineType, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "     OR LOWER(COALESCE(m.category, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "     OR LOWER(m.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "     OR LOWER(COALESCE(m.description, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND m.price <= :maxPrice")
    List<MenuItem> searchRecommendations(@Param("city") String city,
                                         @Param("keyword") String keyword,
                                         @Param("maxPrice") BigDecimal maxPrice);
}