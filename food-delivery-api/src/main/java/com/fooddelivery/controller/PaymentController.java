package com.fooddelivery.controller;

import com.fooddelivery.common.dto.ApiResponse;
import com.fooddelivery.common.dto.PaymentRequest;
import com.fooddelivery.common.dto.PaymentResponse;
import com.fooddelivery.entity.Customer;
import com.fooddelivery.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Tag(name = "Payment & Idempotency APIs", description = "Endpoints for idempotent payment processing and receipt retrieval")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/process")
    @Operation(summary = "Process order payment", description = "Authorizes payment with Redis SETNX idempotency locks, advancing order to ORDER_PLACED.")
    public ResponseEntity<ApiResponse<PaymentResponse>> processPayment(@RequestBody PaymentRequest request) {
        Customer customer = getAuthenticatedCustomer();
        PaymentResponse response = paymentService.processPayment(request, customer);
        return ResponseEntity.ok(ApiResponse.success(response, response.getMessage()));
    }

    @GetMapping("/order/{orderId}")
    @Operation(summary = "Get payment receipt by order ID", description = "Retrieves payment status, transaction ID, and details for a specific order.")
    public ResponseEntity<ApiResponse<PaymentResponse>> getReceipt(@PathVariable("orderId") Long orderId) {
        Customer customer = getAuthenticatedCustomer();
        PaymentResponse response = paymentService.getPaymentReceiptByOrderId(orderId, customer);
        return ResponseEntity.ok(ApiResponse.success(response, response.getMessage()));
    }

    private Customer getAuthenticatedCustomer() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof Customer customer) {
            return customer;
        }
        throw new IllegalArgumentException("Authentication required for payment operations. Please log in.");
    }
}
