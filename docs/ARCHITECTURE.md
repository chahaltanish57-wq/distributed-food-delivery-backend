# Architecture & System Design Whitepaper: Distributed Food Delivery Platform

## Executive Summary
This document provides an in-depth architectural breakdown of the **Distributed Food Delivery Platform**, an enterprise-grade, event-driven distributed system inspired by Swiggy and Zomato. The platform is engineered to handle high-throughput food ordering, real-time geospatial driver dispatch, idempotent multi-method financial transactions, live GPS delivery tracking via WebSockets and OSRM, and conversational AI assistance powered by Google Gemini.

---

## 1. System Topology & Component Model

```mermaid
graph TB
    subgraph Client Tier
        CUST["Customer Web App<br/>(React 18 / Vite / Tailwind)"]
        KITCH["Kitchen Portal<br/>(/restaurant)"]
        DRIV["Driver Simulator & App<br/>(/driver)"]
    end

    subgraph Gateway & Security
        SEC["Spring Security Filter Chain<br/>(Stateless JWT / BCrypt / CORS)"]
    end

    subgraph Core Backend Services
        AUTH["Auth & Customer Service"]
        REST["Restaurant & Menu Service"]
        CART["Cart Service<br/>(Redis Hash TTL)"]
        ORDER["Order Service & FSM<br/>(Finite State Machine)"]
        PAY["Payment Service<br/>(Distributed Idempotency)"]
        KITCH_SVC["Kitchen Dispatch Service"]
        DISP["Driver Dispatch Engine<br/>(Redisson Distributed Lock)"]
        TRACK["Order Tracking Service<br/>(WebSocket STOMP Broker)"]
        AI["Gemini AI Service<br/>(Function Calling & Fallback)"]
    end

    subgraph Data & Event Infrastructure
        PG[("PostgreSQL 16<br/>(Flyway Migrations V1-V8)")]
        REDIS[("Redis 7<br/>(Geo / Caches / Redisson Locks)")]
        KAFKA{{"Apache Kafka 3.8 (KRaft)<br/>Topics: order.created, payment.completed, order.events.dlq"}}
        OSRM["OSRM Road Routing Engine<br/>(Project-OSRM / Leaflet)"]
        GEMINI["Google Gemini API<br/>(gemini-2.5-flash)"]
    end

    CUST --> SEC
    KITCH --> SEC
    DRIV --> SEC

    SEC --> AUTH
    SEC --> REST
    SEC --> CART
    SEC --> ORDER
    SEC --> PAY
    SEC --> KITCH_SVC
    SEC --> DISP
    SEC --> TRACK
    SEC --> AI

    AUTH --> PG
    REST --> PG
    CART --> REDIS
    ORDER --> PG
    PAY --> PG
    PAY --> REDIS
    KITCH_SVC --> PG
    DISP --> PG
    DISP --> REDIS
    TRACK --> PG
    TRACK --> REDIS
    TRACK -.-> OSRM
    AI --> PG
    AI -.-> GEMINI

    ORDER -->|Publish OrderCreated| KAFKA
    PAY -->|Publish PaymentCompleted| KAFKA
    KAFKA -->|Consume & Orchestrate Saga| ORDER
    KAFKA -->|Dead-Letter Queue| KAFKA
```

---

## 2. Database Schema & Flyway Migration Strategy

The system relies on PostgreSQL 16 managed by Flyway version-controlled migrations:

| Version | Migration Script | Purpose |
| :--- | :--- | :--- |
| **V1** | `V1__init_schema.sql` | Core schema: `customers`, `restaurants`, `menu_items`, `orders`, `order_items`, `payments`. |
| **V2** | `V2__seed_noida_dehradun_data.sql` | Initial authentic restaurants & menus in Noida and Dehradun with INR (₹) pricing. |
| **V3** | `V3__add_performance_indexes.sql` | High-cardinality B-tree and partial indexes on customer emails, restaurant city, order status, and timestamps. |
| **V4** | `V4__add_delivery_partners.sql` | `delivery_partners` table for driver dispatch, vehicle numbers, phone, active ratings, and status. |
| **V5** | `V5__seed_delivery_partners.sql` | Initial seed of 6 delivery partners located in Noida and Dehradun corridors. |
| **V6** | `V6__add_delivery_partner_id_to_orders.sql` | Foreign key referencing assigned driver on active order tickets. |
| **V7** | `V7__add_idempotency_to_payments.sql` | Unique constraint and index on `payments.idempotency_key` preventing double debits. |
| **V8** | `V8__add_delivery_coordinates_to_orders.sql` | Dedicated high-precision columns `delivery_latitude` and `delivery_longitude` (`DECIMAL(10, 7)`) for live routing. |

---

## 3. Distributed Order Saga Choreography

The platform implements the **Choreographed Saga Pattern** to ensure eventual consistency across Order, Payment, Inventory/Kitchen, and Driver subsystems without distributed 2PC locks.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer App
    participant OrderSvc as Order Service
    participant PaySvc as Payment Service
    participant Kafka as Apache Kafka (KRaft)
    participant SagaConsumer as Saga Event Consumer
    participant Kitchen as Kitchen Queue
    participant DriverEngine as Driver Dispatch

    Customer->>OrderSvc: POST /api/v1/orders (Address & Coordinates)
    OrderSvc->>OrderSvc: Advance FSM: CREATED -> PAYMENT_PENDING
    OrderSvc->>Kafka: Publish OrderCreatedEvent [Topic: order.created]
    OrderSvc-->>Customer: 201 Created (OrderDTO: PAYMENT_PENDING)

    Kafka->>SagaConsumer: Receive OrderCreatedEvent
    SagaConsumer->>Kitchen: Pre-allocate kitchen ticket queue

    Customer->>PaySvc: POST /api/v1/payments/process (IdempotencyKey, UPI)
    PaySvc->>PaySvc: Acquire Redis SETNX lock on idempotencyKey
    PaySvc->>PaySvc: Persist Payment Record (SUCCESS)
    PaySvc->>Kafka: Publish PaymentCompletedEvent [Topic: payment.completed]
    PaySvc-->>Customer: 200 OK (PaymentResponse)

    Kafka->>SagaConsumer: Receive PaymentCompletedEvent
    SagaConsumer->>OrderSvc: Transition FSM: PAYMENT_PENDING -> ORDER_PLACED
    SagaConsumer->>Kitchen: Activate ticket on Live Kitchen Dashboard
    SagaConsumer->>DriverEngine: Broadcast order availability to nearby drivers
```

### Saga Failure & Dead-Letter Queue (DLQ) Semantics
If payment processing fails or is declined:
1. `PaymentFailedEvent` is emitted to `payment.failed`.
2. Saga consumer triggers compensating transaction: transitions order to `PAYMENT_FAILED` or `CANCELLED`.
3. Erroneous messages that fail deserialization or trigger unhandled exceptions after 3 retry attempts are automatically routed to `order.events.dlq` with diagnostic headers:
   - `x-original-topic`
   - `x-exception-message`
   - `x-exception-stacktrace`

---

## 4. Concurrency Control: Redisson Distributed Locks & Redis Geo

### 4.1 Redis Geospatial Discovery
- Delivery driver GPS positions are indexed in Redis using `GEOADD drivers:geo <longitude> <latitude> <driverId>`.
- When an order enters `READY_FOR_PICKUP`, the dispatch engine queries drivers within a 5.0–10.0 km radius via Redis `GEOSEARCH`:
  ```text
  GEOSEARCH drivers:geo FROMLONLAT 77.3219 28.5708 BYRADIUS 10 km ASC WITHDIST WITHCOORD
  ```
- O(N+log(M)) lookup latency ensures sub-millisecond retrieval of the closest candidate drivers.

### 4.2 Race Condition Prevention via Redisson Distributed Lock
When multiple drivers attempt to claim the same order concurrently:
1. The backend acquires a Redisson distributed reentrant lock keyed on `lock:order:dispatch:{orderId}`:
   ```java
   RLock lock = redissonClient.getLock("lock:order:dispatch:" + orderId);
   boolean acquired = lock.tryLock(3, 8, TimeUnit.SECONDS);
   ```
2. **Lock Winner**:
   - Checks `order.getDeliveryPartnerId() == null`.
   - Binds `order.setDeliveryPartnerId(driverId)`.
   - Transitions driver status to `BUSY`.
   - Releases lock and returns `200 OK`.
3. **Lock Losers**:
   - Subsequent threads fail lock acquisition or observe `deliveryPartnerId != null`.
   - Immediately rejected with `409 Conflict` (`"Order has already been claimed by another driver"`).
   - Zero double-dispatch anomalies under high concurrency.

---

## 5. Real-Time Order Tracking & Road Routing Engine

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer Browser
    participant STOMP as WebSocket STOMP Broker
    participant Driver as Driver Simulator
    participant DispatchSvc as Dispatch Service
    participant OSRM as OSRM Public Routing API

    Customer->>STOMP: CONNECT /ws-delivery
    Customer->>STOMP: SUBSCRIBE /topic/orders/{orderId}/tracking
    Driver->>DispatchSvc: PATCH /api/v1/drivers/{id}/orders/{orderId}/pickup
    DispatchSvc->>DispatchSvc: Advance FSM -> OUT_FOR_DELIVERY
    DispatchSvc->>STOMP: Broadcast State (status: OUT_FOR_DELIVERY)
    STOMP-->>Customer: Received tracking payload

    loop Every 2 Seconds During Delivery
        Driver->>DispatchSvc: PATCH /api/v1/drivers/{id}/location (lat, lng)
        DispatchSvc->>STOMP: Broadcast Driver Location
        STOMP-->>Customer: Push {lat, lng, progressRatio, etaMinutes}
        Customer->>OSRM: Query Road Geometry (/route/v1/driving/...)
        OSRM-->>Customer: 55 Turn-by-Turn Waypoints
        Customer->>Customer: Animate Bike smoothly along street polyline
    end

    Driver->>DispatchSvc: PATCH /api/v1/drivers/{id}/orders/{orderId}/deliver
    DispatchSvc->>DispatchSvc: Advance FSM -> DELIVERED, Driver -> AVAILABLE
    DispatchSvc->>STOMP: Broadcast State (status: DELIVERED)
    STOMP-->>Customer: Order Delivered! Celebration Modal
```

### Proximity Guard & Dual-City Routing
To eliminate 0-meter route bugs when restaurants and customers share nominal coordinates:
- The system enforces a **1.2 km minimum geographic separation** between restaurant and customer dropoff.
- In **Noida**, orders automatically route across realistic traffic corridors (Sector 18 $\leftrightarrow$ Sector 29 $\leftrightarrow$ Sector 62).
- In **Dehradun**, orders navigate the historic foothill roads (Rajpur Road $\leftrightarrow$ Paltan Bazaar $\leftrightarrow$ Jakhan $\leftrightarrow$ Dakpatti).

---

## 6. Gemini AI Architecture & Function Calling

The AI Concierge integrates **Google Gemini 2.5 Flash** with native Function Calling:

```json
{
  "tools": [
    {
      "function_declarations": [
        {
          "name": "getOrderStatus",
          "description": "Retrieve live order state, driver details, and ETA",
          "parameters": {
            "type": "object",
            "properties": { "orderId": { "type": "integer" } },
            "required": ["orderId"]
          }
        },
        {
          "name": "recommendDishes",
          "description": "Recommend dishes filtered by city, keyword, and budget in INR (₹)",
          "parameters": {
            "type": "object",
            "properties": {
              "city": { "type": "string" },
              "cuisine": { "type": "string" },
              "maxPrice": { "type": "number" }
            }
          }
        }
      ]
    }
  ]
}
```

### High-Availability Fallback Engine
If the external Gemini API is unreachable, unconfigured, or rate-limited:
- The platform automatically falls back to an **in-memory intelligent rule engine**.
- Parses regex patterns for order tracking, cancellations, and city/budget queries (`"under 350"` $\to$ `maxPrice = 350.0`).
- Directly executes database queries against `MenuItemRepository` and `OrderRepository`, ensuring zero user disruption.
