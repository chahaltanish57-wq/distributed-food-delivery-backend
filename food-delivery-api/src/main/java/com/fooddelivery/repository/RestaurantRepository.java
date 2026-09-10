package com.fooddelivery.repository;

import com.fooddelivery.entity.Restaurant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RestaurantRepository extends JpaRepository<Restaurant, Long> {
    List<Restaurant> findAllByIsActiveTrue();
    List<Restaurant> findAllByCityIgnoreCaseAndIsActiveTrue(String city);
    Optional<Restaurant> findByIdAndIsActiveTrue(Long id);
}