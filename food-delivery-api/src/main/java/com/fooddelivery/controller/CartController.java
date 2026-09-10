package com.fooddelivery.controller;

import com.fooddelivery.common.dto.AddToCartRequest;
import com.fooddelivery.common.dto.ApiResponse;
import com.fooddelivery.common.dto.CartDTO;
import com.fooddelivery.entity.Customer;
import com.fooddelivery.service.CartService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/cart")
@RequiredArgsConstructor
@Tag(name = "Shopping Cart APIs", description = "High-performance Redis-backed shopping cart endpoints")
public class CartController {

    private final CartService cartService;

    @GetMapping
    @Operation(summary = "Get active cart", description = "Fetches the current user's or guest's cart from Redis.")
    public ResponseEntity<ApiResponse<CartDTO>> getCart(HttpServletRequest request) {
        String cartKey = resolveCartKey(request);
        CartDTO cart = cartService.getCart(cartKey);
        return ResponseEntity.ok(ApiResponse.success(cart, "Cart retrieved successfully"));
    }

    @PostMapping("/items")
    @Operation(summary = "Add item to cart", description = "Adds a dish to the Redis cart, enforcing single-restaurant rule.")
    public ResponseEntity<ApiResponse<CartDTO>> addItem(
            @RequestBody AddToCartRequest req,
            HttpServletRequest request
    ) {
        String cartKey = resolveCartKey(request);
        CartDTO cart = cartService.addToCart(cartKey, req);
        return ResponseEntity.ok(ApiResponse.success(cart, "Item added to cart"));
    }

    @PatchMapping("/items/{menuItemId}")
    @Operation(summary = "Update item quantity", description = "Adjusts item quantity by delta (+1 or -1). Removes item if quantity reaches 0.")
    public ResponseEntity<ApiResponse<CartDTO>> updateQuantity(
            @PathVariable("menuItemId") Long menuItemId,
            @RequestParam(name = "delta", defaultValue = "1") int delta,
            HttpServletRequest request
    ) {
        String cartKey = resolveCartKey(request);
        CartDTO cart = cartService.updateItemQuantity(cartKey, menuItemId, delta);
        return ResponseEntity.ok(ApiResponse.success(cart, "Cart updated"));
    }

    @DeleteMapping("/items/{menuItemId}")
    @Operation(summary = "Remove item from cart", description = "Deletes a specific menu item from the Redis cart.")
    public ResponseEntity<ApiResponse<CartDTO>> removeItem(
            @PathVariable("menuItemId") Long menuItemId,
            HttpServletRequest request
    ) {
        String cartKey = resolveCartKey(request);
        CartDTO cart = cartService.removeItem(cartKey, menuItemId);
        return ResponseEntity.ok(ApiResponse.success(cart, "Item removed from cart"));
    }

    @DeleteMapping
    @Operation(summary = "Clear cart", description = "Empties the entire cart from Redis.")
    public ResponseEntity<ApiResponse<Void>> clearCart(HttpServletRequest request) {
        String cartKey = resolveCartKey(request);
        cartService.clearCart(cartKey);
        return ResponseEntity.ok(ApiResponse.success(null, "Cart cleared successfully"));
    }

    @PostMapping("/merge")
    @Operation(summary = "Merge guest cart into user account", description = "Transfers guest cart items to authenticated user on login.")
    public ResponseEntity<ApiResponse<CartDTO>> mergeCart(
            @RequestParam("guestSessionId") String guestSessionId,
            HttpServletRequest request
    ) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Customer customer)) {
            return ResponseEntity.badRequest().body(ApiResponse.error("User must be authenticated to merge cart"));
        }

        String guestKey = "cart:guest:" + guestSessionId;
        String userKey = "cart:user:" + customer.getId();
        CartDTO mergedCart = cartService.mergeGuestCart(guestKey, userKey);
        return ResponseEntity.ok(ApiResponse.success(mergedCart, "Guest cart merged successfully"));
    }

    private String resolveCartKey(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof Customer customer) {
            return "cart:user:" + customer.getId();
        }

        String sessionId = request.getHeader("X-Session-Id");
        if (sessionId != null && !sessionId.isBlank()) {
            return "cart:guest:" + sessionId.trim();
        }

        throw new IllegalArgumentException("Cart session missing. Provide X-Session-Id header or log in.");
    }
}
