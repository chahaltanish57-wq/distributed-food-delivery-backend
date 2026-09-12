package com.fooddelivery.service;

import com.fooddelivery.common.dto.CreateOrderRequest;
import com.fooddelivery.common.dto.CartDTO;
import com.fooddelivery.common.dto.CartItemDTO;
import com.fooddelivery.common.dto.OrderDTO;
import com.fooddelivery.common.dto.OrderItemDTO;
import com.fooddelivery.common.enums.OrderStatus;
import com.fooddelivery.entity.Customer;
import com.fooddelivery.entity.MenuItem;
import com.fooddelivery.entity.Order;
import com.fooddelivery.entity.OrderItem;
import com.fooddelivery.entity.Restaurant;
import com.fooddelivery.repository.MenuItemRepository;
import com.fooddelivery.repository.OrderRepository;
import com.fooddelivery.repository.RestaurantRepository;
import com.fooddelivery.common.event.OrderCreatedEvent;
import com.fooddelivery.kafka.producer.OrderEventProducer;
import io.micrometer.core.instrument.Counter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;
    private final CartService cartService;
    private final OrderStateMachine orderStateMachine;
    private final OrderEventProducer orderEventProducer;
    private final Counter ordersPlacedCounter;
    private final Counter ordersDeliveredCounter;

    /**
     * Convert active Redis cart into persistent PostgreSQL Order in PAYMENT_PENDING state.
     */
    @Transactional
    public OrderDTO createOrder(Customer customer, CreateOrderRequest request) {
        String cartKey = "cart:user:" + customer.getId();
        CartDTO cart = cartService.getCart(cartKey);

        if (cart.getItems() == null || cart.getItems().isEmpty()) {
            throw new IllegalArgumentException("Cannot place order: Cart is empty. Please add items before checkout.");
        }

        if (cart.getRestaurantId() == null) {
            throw new IllegalArgumentException("Cannot place order: Invalid restaurant in cart.");
        }

        Restaurant restaurant = restaurantRepository.findById(cart.getRestaurantId())
                .orElseThrow(() -> new IllegalArgumentException("Restaurant not found with id: " + cart.getRestaurantId()));

        String deliveryAddress = request.getDeliveryAddress();
        if (deliveryAddress == null || deliveryAddress.trim().isEmpty()) {
            deliveryAddress = customer.getAddress() != null && !customer.getAddress().isBlank() 
                    ? customer.getAddress() 
                    : restaurant.getAddress() + " (Nearby Area)";
        }

        BigDecimal restLat = restaurant.getLatitude() != null ? restaurant.getLatitude() : new BigDecimal("28.5672000");
        BigDecimal restLng = restaurant.getLongitude() != null ? restaurant.getLongitude() : new BigDecimal("77.3342000");

        BigDecimal custLat = request.getDeliveryLatitude();
        BigDecimal custLng = request.getDeliveryLongitude();

        // If client did not provide coordinates or provided coordinates virtually on top of restaurant (< 200m),
        // assign authentic distinct residential dropoff coordinates in the same city.
        if (custLat == null || custLng == null ||
                (Math.abs(custLat.doubleValue() - restLat.doubleValue()) < 0.002 &&
                 Math.abs(custLng.doubleValue() - restLng.doubleValue()) < 0.002)) {

            if ("Dehradun".equalsIgnoreCase(restaurant.getCity())) {
                if (Math.abs(restLat.doubleValue() - 30.3244) < 0.01) {
                    custLat = new BigDecimal("30.3421000"); // Rajpur Road
                    custLng = new BigDecimal("78.0583000");
                } else {
                    custLat = new BigDecimal("30.3244000"); // Paltan Bazaar
                    custLng = new BigDecimal("78.0418000");
                }
            } else {
                if (Math.abs(restLat.doubleValue() - 28.5672) < 0.005) {
                    custLat = new BigDecimal("28.5708000"); // Sector 18
                    custLng = new BigDecimal("77.3219000");
                } else {
                    custLat = new BigDecimal("28.5672000"); // Sector 29
                    custLng = new BigDecimal("77.3342000");
                }
            }
        }

        Order order = Order.builder()
                .customer(customer)
                .restaurant(restaurant)
                .status(OrderStatus.PAYMENT_PENDING)
                .totalAmount(cart.getGrandTotal())
                .deliveryAddress(deliveryAddress.trim())
                .deliveryLatitude(custLat)
                .deliveryLongitude(custLng)
                .build();

        for (CartItemDTO cItem : cart.getItems()) {
            MenuItem menuItem = menuItemRepository.findById(cItem.getMenuItemId())
                    .orElseThrow(() -> new IllegalArgumentException("Menu item no longer exists: " + cItem.getMenuItemId()));

            OrderItem orderItem = OrderItem.builder()
                    .menuItem(menuItem)
                    .itemName(cItem.getName())
                    .quantity(cItem.getQuantity())
                    .pricePerUnit(cItem.getPrice())
                    .totalPrice(cItem.getSubtotal())
                    .build();

            order.addOrderItem(orderItem);
        }

        Order savedOrder = orderRepository.save(order);
        ordersPlacedCounter.increment();
        log.info("Order #{} placed successfully for Customer {} with total amount ₹{}",
                savedOrder.getId(), customer.getEmail(), savedOrder.getTotalAmount());

        // Atomically wipe the temporary cart from Redis
        cartService.clearCart(cartKey);

        OrderDTO orderDTO = toDTO(savedOrder, request.getContactPhone() != null ? request.getContactPhone() : customer.getPhone());

        // Publish Kafka OrderCreatedEvent for distributed saga & kitchen dispatch
        try {
            OrderCreatedEvent event = OrderCreatedEvent.builder()
                    .orderId(savedOrder.getId())
                    .customerId(customer.getId())
                    .customerName(customer.getFullName())
                    .customerEmail(customer.getEmail())
                    .customerPhone(orderDTO.getContactPhone())
                    .restaurantId(restaurant.getId())
                    .restaurantName(restaurant.getName())
                    .deliveryAddress(savedOrder.getDeliveryAddress())
                    .totalAmount(savedOrder.getTotalAmount())
                    .items(orderDTO.getItems())
                    .createdAt(savedOrder.getCreatedAt() != null ? savedOrder.getCreatedAt() : java.time.Instant.now())
                    .build();
            orderEventProducer.publishOrderCreated(event);
        } catch (Exception ex) {
            log.error("Failed to emit OrderCreatedEvent for Order #{}: {}", savedOrder.getId(), ex.getMessage(), ex);
        }

        return orderDTO;
    }

    @Transactional(readOnly = true)
    public OrderDTO getOrderById(Long orderId, Customer customer) {
        Order order = orderRepository.findWithDetailsById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + orderId));

        if (!order.getCustomer().getId().equals(customer.getId()) && !"ADMIN".equalsIgnoreCase(customer.getRole())) {
            throw new IllegalArgumentException("Unauthorized to access order #" + orderId);
        }

        return toDTO(order, customer.getPhone());
    }

    @Transactional(readOnly = true)
    public List<OrderDTO> getCustomerOrders(Customer customer) {
        return orderRepository.findByCustomerIdOrderByCreatedAtDesc(customer.getId())
                .stream()
                .map(o -> toDTO(o, customer.getPhone()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<OrderDTO> getAllRecentOrders() {
        return orderRepository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))
                .stream()
                .limit(20)
                .map(o -> toDTO(o, o.getCustomer() != null ? o.getCustomer().getPhone() : null))
                .collect(Collectors.toList());
    }

    /**
     * Transition order status using the Finite State Machine engine.
     */
    @Transactional
    public OrderDTO updateOrderStatus(Long orderId, OrderStatus nextStatus) {
        Order order = orderRepository.findWithDetailsById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + orderId));

        if (order.getStatus() == nextStatus) {
            return toDTO(order, order.getCustomer() != null ? order.getCustomer().getPhone() : null);
        }

        orderStateMachine.validateTransition(order.getStatus(), nextStatus);

        order.setStatus(nextStatus);
        Order updated = orderRepository.save(order);
        log.info("Order #{} status transitioned to {}", orderId, nextStatus);

        if (nextStatus == OrderStatus.DELIVERED) {
            ordersDeliveredCounter.increment();
        }

        return toDTO(updated, updated.getCustomer().getPhone());
    }

    public OrderDTO toDTO(Order order, String contactPhone) {
        int deliveryTime = order.getRestaurant() != null && order.getRestaurant().getDeliveryTimeMins() != null
                ? order.getRestaurant().getDeliveryTimeMins()
                : 25;

        List<OrderItemDTO> items = order.getOrderItems().stream()
                .map(i -> OrderItemDTO.builder()
                        .id(i.getId())
                        .menuItemId(i.getMenuItem().getId())
                        .itemName(i.getItemName())
                        .quantity(i.getQuantity())
                        .pricePerUnit(i.getPricePerUnit())
                        .totalPrice(i.getTotalPrice())
                        .build())
                .collect(Collectors.toList());

        return OrderDTO.builder()
                .id(order.getId())
                .customerId(order.getCustomer().getId())
                .customerName(order.getCustomer().getFullName())
                .customerEmail(order.getCustomer().getEmail())
                .restaurantId(order.getRestaurant().getId())
                .restaurantName(order.getRestaurant().getName())
                .restaurantCity(order.getRestaurant().getCity())
                .status(order.getStatus())
                .totalAmount(order.getTotalAmount())
                .deliveryAddress(order.getDeliveryAddress())
                .contactPhone(contactPhone)
                .estimatedDeliveryMinutes(deliveryTime)
                .items(items)
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }
}
