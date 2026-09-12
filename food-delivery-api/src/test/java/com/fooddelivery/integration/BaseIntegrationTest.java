package com.fooddelivery.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.config.JwtService;
import com.fooddelivery.entity.Customer;
import com.fooddelivery.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class BaseIntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected JwtService jwtService;

    @Autowired
    protected CustomerRepository customerRepository;

    @Autowired
    protected RestaurantRepository restaurantRepository;

    @Autowired
    protected MenuItemRepository menuItemRepository;

    @Autowired
    protected OrderRepository orderRepository;

    @Autowired
    protected DeliveryPartnerRepository deliveryPartnerRepository;

    @Autowired
    protected StringRedisTemplate redisTemplate;

    protected Customer testCustomer;
    protected String customerToken;

    @BeforeEach
    void setUpBase() {
        testCustomer = customerRepository.findByEmail("customer@swiggy.com")
                .orElseGet(() -> customerRepository.save(Customer.builder()
                        .email("customer@swiggy.com")
                        .passwordHash("$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG") // password123
                        .fullName("Rahul Sharma")
                        .phone("+91 9876543210")
                        .role("CUSTOMER")
                        .build()));

        customerToken = jwtService.generateToken(testCustomer);
    }
}
