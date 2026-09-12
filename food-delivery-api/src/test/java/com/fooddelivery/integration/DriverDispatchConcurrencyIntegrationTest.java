package com.fooddelivery.integration;

import com.fooddelivery.common.dto.ApiResponse;
import com.fooddelivery.common.dto.DriverDTO;
import com.fooddelivery.common.dto.OrderDTO;
import com.fooddelivery.common.enums.DriverStatus;
import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.entity.DeliveryPartner;
import com.fooddelivery.entity.Order;
import com.fooddelivery.entity.Restaurant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class DriverDispatchConcurrencyIntegrationTest extends BaseIntegrationTest {

    @Test
    @DisplayName("Redis Geospatial: GEOSEARCH returns nearby drivers sorted by distance")
    void testRedisGeospatialNearbySearch() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/drivers/nearby")
                .param("latitude", "28.5708")
                .param("longitude", "77.3219")
                .param("radiusKm", "10.0"))
                .andExpect(status().isOk())
                .andReturn();

        ApiResponse<List<DriverDTO>> response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                objectMapper.getTypeFactory().constructParametricType(ApiResponse.class,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, DriverDTO.class))
        );

        assertNotNull(response.getData());
        assertFalse(response.getData().isEmpty(), "Expected at least 1 driver in Noida radius");

        // Verify sorted by distance
        List<DriverDTO> drivers = response.getData();
        for (int i = 0; i < drivers.size() - 1; i++) {
            assertTrue(drivers.get(i).getDistanceKm() <= drivers.get(i + 1).getDistanceKm(),
                    "Drivers should be sorted ascending by distance");
        }
    }

    @Test
    @DisplayName("Redisson Distributed Lock: Concurrent claim attempts allow exactly 1 winner and 409 for losers")
    void testConcurrentDriverClaimRaceCondition() throws Exception {
        Restaurant restaurant = restaurantRepository.findAll().get(0);

        // 1. Create Order directly in READY_FOR_PICKUP for testing dispatch
        Order order = orderRepository.save(Order.builder()
                .customer(testCustomer)
                .restaurant(restaurant)
                .status(OrderStatus.READY_FOR_PICKUP)
                .totalAmount(new BigDecimal("350.00"))
                .deliveryAddress("Sector 18, Noida")
                .deliveryLatitude(new BigDecimal("28.5708000"))
                .deliveryLongitude(new BigDecimal("77.3219000"))
                .build());

        Long orderId = order.getId();

        // 2. Fetch or prepare up to 4 available drivers
        List<DeliveryPartner> drivers = deliveryPartnerRepository.findAll().stream()
                .filter(d -> "Noida".equalsIgnoreCase(d.getCity()))
                .limit(4)
                .toList();

        // Reset drivers to AVAILABLE
        for (DeliveryPartner d : drivers) {
            d.setStatus(DriverStatus.AVAILABLE);
            deliveryPartnerRepository.save(d);
        }

        int threadCount = Math.min(4, drivers.size());
        assertTrue(threadCount >= 2, "Need at least 2 drivers for concurrency race test");

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        List<Future<Integer>> futures = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            final Long driverId = drivers.get(i).getId();
            futures.add(executor.submit(() -> {
                readyLatch.countDown();
                startLatch.await(); // Simultaneous blast
                MvcResult res = mockMvc.perform(post("/api/v1/drivers/" + driverId + "/orders/" + orderId + "/accept"))
                        .andReturn();
                return res.getResponse().getStatus();
            }));
        }

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown(); // Fire all threads at once

        int successCount = 0;
        int conflictCount = 0;

        for (Future<Integer> f : futures) {
            int statusCode = f.get(10, TimeUnit.SECONDS);
            if (statusCode == 200) successCount++;
            else if (statusCode == 409) conflictCount++;
        }

        executor.shutdown();

        // Exactly one driver must have won the lock!
        assertEquals(1, successCount, "Exactly 1 driver must succeed in claiming the order");
        assertEquals(threadCount - 1, conflictCount, "All other concurrent drivers must receive 409 Conflict");

        // Verify order in database
        Order updatedOrder = orderRepository.findById(orderId).orElseThrow();
        assertNotNull(updatedOrder.getDeliveryPartnerId(), "Order must have an assigned delivery partner");

        // Verify assigned driver is marked BUSY
        DeliveryPartner winner = deliveryPartnerRepository.findById(updatedOrder.getDeliveryPartnerId()).orElseThrow();
        assertEquals(DriverStatus.BUSY, winner.getStatus(), "Winner driver must be marked BUSY");
    }
}
