package com.fooddelivery.service;

import com.fooddelivery.common.dto.AuthResponse;
import com.fooddelivery.common.dto.LoginRequest;
import com.fooddelivery.common.dto.RegisterRequest;
import com.fooddelivery.config.JwtService;
import com.fooddelivery.entity.Customer;
import com.fooddelivery.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final CustomerRepository customerRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (customerRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered: " + request.getEmail());
        }
        if (customerRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("Phone number already in use: " + request.getPhone());
        }

        Customer customer = Customer.builder()
                .fullName(request.getFullName())
                .email(request.getEmail().toLowerCase().trim())
                .phone(request.getPhone().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .address(request.getAddress())
                .role("ROLE_CUSTOMER")
                .build();

        Customer saved = customerRepository.save(customer);
        String token = jwtService.generateToken(saved);

        return AuthResponse.builder()
                .token(token)
                .customerId(saved.getId())
                .fullName(saved.getFullName())
                .email(saved.getEmail())
                .phone(saved.getPhone())
                .address(saved.getAddress())
                .role(saved.getRole())
                .build();
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        Customer customer = customerRepository.findByEmail(request.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), customer.getPasswordHash())) {
            throw new RuntimeException("Invalid email or password");
        }

        String token = jwtService.generateToken(customer);

        return AuthResponse.builder()
                .token(token)
                .customerId(customer.getId())
                .fullName(customer.getFullName())
                .email(customer.getEmail())
                .phone(customer.getPhone())
                .address(customer.getAddress())
                .role(customer.getRole())
                .build();
    }

    @Transactional(readOnly = true)
    public AuthResponse getProfile(Customer customer) {
        String token = jwtService.generateToken(customer);
        return AuthResponse.builder()
                .token(token)
                .customerId(customer.getId())
                .fullName(customer.getFullName())
                .email(customer.getEmail())
                .phone(customer.getPhone())
                .address(customer.getAddress())
                .role(customer.getRole())
                .build();
    }
}