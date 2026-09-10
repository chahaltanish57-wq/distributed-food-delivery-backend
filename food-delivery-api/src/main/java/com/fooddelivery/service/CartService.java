package com.fooddelivery.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.dto.AddToCartRequest;
import com.fooddelivery.common.dto.CartDTO;
import com.fooddelivery.common.dto.CartItemDTO;
import com.fooddelivery.entity.MenuItem;
import com.fooddelivery.entity.Restaurant;
import com.fooddelivery.exception.RestaurantConflictException;
import com.fooddelivery.repository.MenuItemRepository;
import com.fooddelivery.repository.RestaurantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CartService {

    private static final Duration CART_TTL = Duration.ofHours(24);
    private static final BigDecimal FREE_DELIVERY_THRESHOLD = new BigDecimal("500.00");
    private static final BigDecimal STANDARD_DELIVERY_FEE = new BigDecimal("40.00");
    private static final BigDecimal GST_RATE = new BigDecimal("0.05");

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final MenuItemRepository menuItemRepository;
    private final RestaurantRepository restaurantRepository;

    /**
     * Retrieve active cart by cart key.
     */
    public CartDTO getCart(String cartKey) {
        String json = redisTemplate.opsForValue().get(cartKey);
        if (json == null || json.isBlank()) {
            return CartDTO.builder()
                    .cartKey(cartKey)
                    .items(new ArrayList<>())
                    .build();
        }
        try {
            CartDTO cart = objectMapper.readValue(json, CartDTO.class);
            cart.setCartKey(cartKey);
            return cart;
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize cart for key {}: {}", cartKey, e.getMessage());
            return CartDTO.builder().cartKey(cartKey).items(new ArrayList<>()).build();
        }
    }

    /**
     * Add item to cart with single-restaurant enforcement.
     */
    public CartDTO addToCart(String cartKey, AddToCartRequest request) {
        CartDTO cart = getCart(cartKey);

        // Check single-restaurant constraint
        if (cart.getRestaurantId() != null && !cart.getItems().isEmpty()
                && !cart.getRestaurantId().equals(request.getRestaurantId())) {
            if (!request.isForceReplace()) {
                throw new RestaurantConflictException(
                        cart.getRestaurantId(),
                        cart.getRestaurantName(),
                        request.getRestaurantId()
                );
            }
            // User confirmed replace: clear old items
            cart.getItems().clear();
        }

        // Fetch MenuItem from DB
        MenuItem menuItem = menuItemRepository.findById(request.getMenuItemId())
                .orElseThrow(() -> new IllegalArgumentException("Menu item not found: " + request.getMenuItemId()));

        if (!menuItem.getRestaurant().getId().equals(request.getRestaurantId())) {
            throw new IllegalArgumentException("Menu item does not belong to the specified restaurant");
        }

        if (!Boolean.TRUE.equals(menuItem.getIsAvailable())) {
            throw new IllegalArgumentException("Menu item is currently unavailable");
        }

        // Set or update restaurant metadata
        Restaurant restaurant = menuItem.getRestaurant();
        cart.setRestaurantId(restaurant.getId());
        cart.setRestaurantName(restaurant.getName());
        cart.setCity(restaurant.getCity());

        // Update item quantity if present, or add new item
        Optional<CartItemDTO> existingItemOpt = cart.getItems().stream()
                .filter(i -> i.getMenuItemId().equals(menuItem.getId()))
                .findFirst();

        int qtyToAdd = request.getQuantity() != null && request.getQuantity() > 0 ? request.getQuantity() : 1;

        if (existingItemOpt.isPresent()) {
            CartItemDTO existingItem = existingItemOpt.get();
            int newQty = existingItem.getQuantity() + qtyToAdd;
            existingItem.setQuantity(newQty);
            existingItem.setSubtotal(existingItem.getPrice().multiply(BigDecimal.valueOf(newQty)));
        } else {
            CartItemDTO newItem = CartItemDTO.builder()
                    .menuItemId(menuItem.getId())
                    .name(menuItem.getName())
                    .price(menuItem.getPrice())
                    .quantity(qtyToAdd)
                    .isVegetarian(menuItem.getIsVegetarian())
                    .imageUrl(menuItem.getImageUrl())
                    .subtotal(menuItem.getPrice().multiply(BigDecimal.valueOf(qtyToAdd)))
                    .build();
            cart.getItems().add(newItem);
        }

        recalculateTotals(cart);
        saveCart(cartKey, cart);
        return cart;
    }

    /**
     * Increment or decrement quantity of an item (+1 or -1).
     */
    public CartDTO updateItemQuantity(String cartKey, Long menuItemId, int delta) {
        CartDTO cart = getCart(cartKey);
        if (cart.getItems().isEmpty()) {
            return cart;
        }

        Optional<CartItemDTO> itemOpt = cart.getItems().stream()
                .filter(i -> i.getMenuItemId().equals(menuItemId))
                .findFirst();

        if (itemOpt.isPresent()) {
            CartItemDTO item = itemOpt.get();
            int newQty = item.getQuantity() + delta;
            if (newQty <= 0) {
                cart.getItems().remove(item);
            } else {
                item.setQuantity(newQty);
                item.setSubtotal(item.getPrice().multiply(BigDecimal.valueOf(newQty)));
            }
        }

        if (cart.getItems().isEmpty()) {
            clearCart(cartKey);
            return CartDTO.builder().cartKey(cartKey).items(new ArrayList<>()).build();
        }

        recalculateTotals(cart);
        saveCart(cartKey, cart);
        return cart;
    }

    /**
     * Remove an item from the cart.
     */
    public CartDTO removeItem(String cartKey, Long menuItemId) {
        CartDTO cart = getCart(cartKey);
        cart.getItems().removeIf(i -> i.getMenuItemId().equals(menuItemId));

        if (cart.getItems().isEmpty()) {
            clearCart(cartKey);
            return CartDTO.builder().cartKey(cartKey).items(new ArrayList<>()).build();
        }

        recalculateTotals(cart);
        saveCart(cartKey, cart);
        return cart;
    }

    /**
     * Completely clear the cart from Redis.
     */
    public void clearCart(String cartKey) {
        redisTemplate.delete(cartKey);
    }

    /**
     * Merge guest cart into customer cart upon login.
     */
    public CartDTO mergeGuestCart(String guestCartKey, String userCartKey) {
        CartDTO guestCart = getCart(guestCartKey);
        if (guestCart.getItems().isEmpty()) {
            return getCart(userCartKey);
        }

        CartDTO userCart = getCart(userCartKey);
        if (userCart.getItems().isEmpty()) {
            // Simply re-save guest cart under user cart key
            guestCart.setCartKey(userCartKey);
            saveCart(userCartKey, guestCart);
            clearCart(guestCartKey);
            return guestCart;
        }

        // If user already had a cart from the same restaurant, merge items
        if (userCart.getRestaurantId() != null && userCart.getRestaurantId().equals(guestCart.getRestaurantId())) {
            for (CartItemDTO gItem : guestCart.getItems()) {
                Optional<CartItemDTO> match = userCart.getItems().stream()
                        .filter(u -> u.getMenuItemId().equals(gItem.getMenuItemId()))
                        .findFirst();
                if (match.isPresent()) {
                    match.get().setQuantity(match.get().getQuantity() + gItem.getQuantity());
                    match.get().setSubtotal(match.get().getPrice().multiply(BigDecimal.valueOf(match.get().getQuantity())));
                } else {
                    userCart.getItems().add(gItem);
                }
            }
            recalculateTotals(userCart);
            saveCart(userCartKey, userCart);
            clearCart(guestCartKey);
            return userCart;
        }

        // Different restaurants: guest cart takes precedence
        guestCart.setCartKey(userCartKey);
        saveCart(userCartKey, guestCart);
        clearCart(guestCartKey);
        return guestCart;
    }

    private void recalculateTotals(CartDTO cart) {
        BigDecimal itemTotal = BigDecimal.ZERO;
        int totalCount = 0;

        for (CartItemDTO item : cart.getItems()) {
            itemTotal = itemTotal.add(item.getSubtotal());
            totalCount += item.getQuantity();
        }

        BigDecimal deliveryFee = itemTotal.compareTo(FREE_DELIVERY_THRESHOLD) >= 0 || totalCount == 0
                ? BigDecimal.ZERO
                : STANDARD_DELIVERY_FEE;

        BigDecimal gst = itemTotal.multiply(GST_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal grandTotal = itemTotal.add(deliveryFee).add(gst);

        cart.setItemTotal(itemTotal);
        cart.setDeliveryFee(deliveryFee);
        cart.setGst(gst);
        cart.setGrandTotal(grandTotal);
        cart.setTotalItemCount(totalCount);
    }

    private void saveCart(String cartKey, CartDTO cart) {
        try {
            String json = objectMapper.writeValueAsString(cart);
            redisTemplate.opsForValue().set(cartKey, json, CART_TTL);
        } catch (JsonProcessingException e) {
            log.error("Error serializing cart for key {}: {}", cartKey, e.getMessage(), e);
            throw new RuntimeException("Could not persist cart to Redis", e);
        }
    }
}
