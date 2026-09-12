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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

        Order order = Order.builder()
                .customer(customer)
                .restaurant(restaurant)
                .status(OrderStatus.PAYMENT_PENDING)
                .totalAmount(cart.getGrandTotal())
                .deliveryAddress(deliveryAddress.trim())
                .deliveryLatitude(request.getDeliveryLatitude() != null ? request.getDeliveryLatitude() : restaurant.getLatitude())
                .deliveryLongitude(request.getDeliveryLongitude() != null ? request.getDeliveryLongitude() : restaurant.getLongitude())
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
        log.info("Order #{} placed successfully for Customer {} with total amount ₹{}",
                savedOrder.getId(), customer.getEmail(), savedOrder.getTotalAmount());

        // Atomically wipe the temporary cart from Redis
        cartService.clearCart(cartKey);

        OrderDTO orderDTO = toDTO(savedOrder, request.getContactPhone() != null ? request.getContactPhone() : customer.getPhone());

        // Day 8: Publish Kafka OrderCreatedEvent for distributed saga & kitchen dispatch
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
