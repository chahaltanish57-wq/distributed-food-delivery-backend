# 🛵 Distributed Food Delivery Platform (Swiggy / Zomato Architecture)

[![Java 17](https://img.shields.io/badge/Java-17-orange.svg)](https://openjdk.org/projects/jdk/17/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3+-green.svg)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.x-red.svg)](https://redis.io/)
[![Apache Kafka](https://img.shields.io/badge/Kafka-3.8%20(KRaft)-black.svg)](https://kafka.apache.org/)
[![Redisson](https://img.shields.io/badge/Redisson-3.35-critical.svg)](https://redisson.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-OSM%20%2B%20OSRM-199900.svg)](https://leafletjs.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-8E75B2.svg)](https://ai.google.dev/)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)
[![Prometheus](https://img.shields.io/badge/Prometheus-v2.53-E6522C.svg)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-11.1-F46800.svg)](https://grafana.com/)

An enterprise-grade, event-driven distributed food delivery platform inspired by **Swiggy** and **Zomato**. Engineered to demonstrate production-grade distributed systems patterns: **Choreographed Saga Pattern** with Apache Kafka, **Order Finite State Machines**, **Redis Geospatial Indexing**, **Redisson Distributed Locks** to eliminate driver dispatch race conditions, **Real-Time Live Driver GPS Tracking** via STOMP WebSockets and OSRM turn-by-turn road interpolation, and an intelligent **AI Support Concierge** powered by **Google Gemini 2.5 Flash Function Calling**.

> **Dual-City Localization**: Exclusively engineered for **Noida** (Sector 18, 62, 29) and **Dehradun** (Rajpur Road, Paltan Bazaar, Jakhan, Dakpatti) with all catalog pricing strictly denominated in **Indian Rupees (₹)**.

---

## 🗺️ System Topology & Architecture

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

## ⚡ Core Engineering Highlights

### 1. Distributed Saga Choreography (Apache Kafka 3.8 KRaft)
- Replaces brittle 2-Phase Commit (2PC) with asynchronous, choreographed event-driven Sagas.
- **Topics**: `order.created`, `payment.completed`, `payment.failed`, and `order.events.dlq`.
- Emits events with partition keys on `orderId` guaranteeing in-order processing per customer order.
- Features resilient consumer error handling with Spring Kafka `DeadLetterPublishingRecoverer` routing corrupted payloads to the Dead-Letter Queue (DLQ).

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer App
    participant OrderSvc as Order Service
    participant PaySvc as Payment Service
    participant Kafka as Apache Kafka (KRaft)
    participant SagaConsumer as Saga Event Consumer
    participant Kitchen as Kitchen Queue

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
```

### 2. High-Concurrency Driver Dispatch (Redisson Distributed Locks & Redis Geo)
- Driver positions are continuously indexed in Redis via `GEOADD drivers:geo <lng> <lat> <driverId>`.
- Orders in `READY_FOR_PICKUP` discover available drivers within a 5.0–10.0 km radius via Redis `GEOSEARCH` in sub-millisecond O(N+log(M)) time.
- **Race Condition Immunity**: When multiple drivers tap "Accept Delivery" simultaneously, the service acquires a Redisson distributed reentrant lock (`lock:order:dispatch:{orderId}`).
- **Zero Double-Assignment**: Exactly **1 driver wins (200 OK)** while losing drivers instantly receive **409 Conflict** with zero double-dispatch bugs. Verified under multi-threaded concurrency testing.

### 3. Real-Time Driver Movement & OSRM Road Routing
- Real-time communication powered by **Spring WebSocket STOMP Broker** over `/ws-delivery` and `/topic/orders/{orderId}/tracking`.
- Uses **Leaflet**, **OpenStreetMap tiles**, and **Project-OSRM** to query authentic street road geometry between restaurant and customer dropoff.
- Features **Sub-Step Polyline Interpolation**: As the driver simulator moves between GPS updates, the delivery bike marker interpolates along actual street geometry rather than straight line coordinates.
- Built-in **Proximity Separation Guard** guarantees at least 1.2 km of separation between restaurant and dropoff, eliminating 0-meter frozen-marker bugs.

### 4. Google Gemini AI Support Concierge & Function Calling
- Powered by `gemini-2.5-flash` with native **Function Calling**:
  - `getOrderStatus(orderId)`: Retrieves real-time status, ETA, and assigned driver details.
  - `recommendDishes(city, cuisine, maxPrice)`: Grounded menu search filtered by Noida/Dehradun and budget in INR (₹).
  - `cancelOrder(orderId)`: Validates order state machine eligibility and processes instant cancellations.
- **High-Availability Fallback Engine**: If the Gemini API is offline or unconfigured, an in-memory rule and regex engine transparently handles queries against PostgreSQL with zero customer disruption.

### 5. Production Testing Suite (10/10 Green Integration Tests)
- Automated Spring Boot Integration Test Suite (`@ActiveProfiles("test")`) testing directly against live Docker containers (`localhost:5433`, `localhost:6379`, `localhost:9092`).
- Uses `Awaitility 4.2.2` for resilient asynchronous polling of Kafka Saga events.
- **10/10 Tests Passed**:
  - `OrderSagaIntegrationTest`: Full Cart $\to$ Order $\to$ Payment $\to$ Kafka Saga $\to$ `ORDER_PLACED`, plus payment idempotency.
  - `DriverDispatchConcurrencyIntegrationTest`: Redis `GEOSEARCH` distance ordering and 4-thread Redisson lock race condition.
  - `KitchenAndDeliveryIntegrationTest`: Full 6-step lifecycle (`ORDER_PLACED` $\to$ `DELIVERED`), FSM illegal transition rejection (400 Bad Request), and kitchen ticket rejection.
  - `AiAssistantIntegrationTest`: Model status, live order inquiry, and database-grounded dish recommendations under budget in ₹.

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Backend Core** | Java 17 / 21 LTS, Spring Boot 3.3.3 | Enterprise microservice backend with Spring Web, Data JPA, Security, and Validation |
| **Distributed Messaging** | Apache Kafka 3.8.0 (KRaft) | High-throughput distributed event streaming without Zookeeper dependency |
| **In-Memory & Locks** | Redis 7 (Alpine), Redisson 3.35.0 | Redis Hashes (Cart), Redis Geo (`GEOADD`/`GEOSEARCH`), and Redisson distributed locks |
| **Relational Database** | PostgreSQL 16 (Alpine), Flyway | ACID relational persistence with versioned schema migrations (V1–V8) |
| **Frontend UI** | React 18, Vite 5, Tailwind CSS | High-performance SPA with Lucide icons, Dark mode, and responsive views |
| **Maps & Routing** | Leaflet 1.9, OpenStreetMap, OSRM | Real-world map rendering, tile caching, and turn-by-turn road geometry interpolation |
| **Real-Time Streaming** | Spring WebSocket, STOMP, SockJS | Bi-directional messaging for driver GPS updates and order status push |
| **Artificial Intelligence** | Google Gemini 2.5 Flash API | Conversational AI concierge with Function Calling and smart local fallback |
| **Testing & CI** | JUnit 5, MockMvc, Awaitility 4.2.2 | Automated integration test suite validating real broker and DB interactions |

---

## 📊 Observability Stack (Prometheus + Grafana)

Real-time production metrics collected via **Micrometer → Prometheus → Grafana** with a pre-built auto-provisioned dashboard. Opens instantly at `http://localhost:3000` — no login required.

![Grafana Dashboard — Full Overview](docs/grafana-dashboard.png)
*Full dashboard: HTTP request rate (0.455 req/s), API p99 latency (107ms), 6 orders placed, latency percentile breakdown, and live Kafka pipeline status.*

![Grafana Dashboard — Business Metrics](docs/grafana-metrics.png)
*Payment success/failure counters (idempotency in action), live order status by Kafka stage, JVM heap memory, and HikariCP connection pool.*

### Metrics Tracked

| Metric | Type | Description |
| :--- | :--- | :--- |
| `orders_placed_total` | Counter | Increments on every successful order creation |
| `orders_delivered_total` | Counter | Increments when order reaches `DELIVERED` state |
| `payments_success_total` | Counter | Tracks successful payment authorizations |
| `payments_failed_total` | Counter | Tracks duplicate/rejected payments (idempotency proof) |
| `websocket_sessions_active` | Gauge | Live count of active GPS tracking WebSocket sessions |
| `orders_pending_gauge` | Gauge | Real-time DB-backed count of `PAYMENT_PENDING` orders |
| `orders_in_kitchen_gauge` | Gauge | Real-time count of orders currently `PREPARING` |
| `orders_out_for_delivery_gauge` | Gauge | Real-time count of `OUT_FOR_DELIVERY` orders |
| `http_server_requests_seconds` | Histogram | p50/p95/p99 latency percentiles per endpoint |
| `hikaricp_connections_active` | Gauge | Live DB connection pool utilization |
| `jvm_memory_used_bytes` | Gauge | JVM heap and non-heap memory breakdown |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running with WSL2 backend on Windows or native Linux/macOS)
- [Java 17 or 21 JDK](https://adoptium.net/)
- [Node.js 18+](https://nodejs.org/) & `npm`
- [Maven 3.8+](https://maven.apache.org/)

### 1. Launch Docker Infrastructure
```bash
# Start PostgreSQL, Redis, Apache Kafka, and Kafka UI
docker compose up -d

# Verify all containers are healthy
docker compose ps
```

| Service | Port | Dashboard / Tool |
| :--- | :--- | :--- |
| **PostgreSQL 16** | `5433` (external) $\to$ `5432` | `psql -h localhost -p 5433 -U postgres -d food_delivery_db` |
| **Redis 7** | `6379` | `redis-cli -p 6379` |
| **Apache Kafka** | `9092` | Kafka Broker (KRaft mode) |
| **Kafka UI** | `8085` | [http://localhost:8085](http://localhost:8085) |
| **Prometheus** | `9090` | [http://localhost:9090](http://localhost:9090) — metrics query UI & target health |
| **Grafana** | `3000` | [http://localhost:3000](http://localhost:3000) — pre-built dashboard, no login required |

### 2. Start the Backend API
```bash
cd food-delivery-api

# Build and run the Spring Boot service
mvn clean package -DskipTests
java -jar target/food-delivery-api-1.0.0-SNAPSHOT.jar
```
Backend API will be live at [http://localhost:8080](http://localhost:8080) with Swagger UI at [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html).

### 3. Start the Frontend Application
```bash
cd food-delivery-frontend

# Install dependencies and start Vite dev server
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```
Frontend Web Portal will be live at [http://localhost:5173](http://localhost:5173).

---

## 🔑 Demo Credentials & Portals

| Role | Portal URL | Demo Account | Password | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | [http://localhost:5173](http://localhost:5173) | `customer@swiggy.com` | `password123` | Browse catalog in Noida/Dehradun, build cart, checkout in ₹, track orders live. |
| **Kitchen Staff** | [http://localhost:5173/restaurant](http://localhost:5173/restaurant) | *No login needed* | N/A | View incoming order tickets, sound chimes, Accept $\to$ Cook $\to$ Food Ready. |
| **Delivery Driver** | [http://localhost:5173/driver](http://localhost:5173/driver) | *No login needed* | N/A | Discover nearby delivery runs, claim orders with Redisson locks, drive live GPS route. |
| **API Docs** | [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) | *Open API* | N/A | Interactive Swagger UI documentation with all REST endpoints. |
| **Kafka Dashboard**| [http://localhost:8085](http://localhost:8085) | *Open UI* | N/A | Monitor topics, consumer lag, and partition distributions. |

---

## 📋 Comprehensive API Matrix

| Module | Method | Endpoint | Description |
| :--- | :---: | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/register` | Register customer account with BCrypt password hashing. |
| **Auth** | `POST` | `/api/v1/auth/login` | Authenticate customer credentials and return stateless JWT. |
| **Restaurants**| `GET` | `/api/v1/restaurants` | List restaurants filtered by city (`Noida`, `Dehradun`) and cuisine. |
| **Restaurants**| `GET` | `/api/v1/restaurants/{id}/menu` | Retrieve menu items categorized by Appetizers, Mains, Biryani, Desserts. |
| **Cart** | `GET` | `/api/v1/cart` | Fetch user's active Redis cart with subtotals and TTL. |
| **Cart** | `POST` | `/api/v1/cart/items` | Add item to cart (enforces single-restaurant policy). |
| **Cart** | `DELETE`| `/api/v1/cart` | Clear active cart. |
| **Orders** | `POST` | `/api/v1/orders` | Create order with delivery address, GPS coordinates, and special instructions. |
| **Orders** | `GET` | `/api/v1/orders/{id}` | Get detailed order status, items, restaurant info, and timestamps. |
| **Payments** | `POST` | `/api/v1/payments/process` | Process idempotent payment (UPI, Card, COD) and emit Kafka event. |
| **Kitchen** | `GET` | `/api/v1/kitchen/restaurants/{id}/orders` | Fetch active kitchen tickets (`ORDER_PLACED`, `PREPARING`, etc.). |
| **Kitchen** | `PATCH`| `/api/v1/kitchen/orders/{id}/accept` | Kitchen accepts incoming ticket (`RESTAURANT_ACCEPTED`). |
| **Kitchen** | `PATCH`| `/api/v1/kitchen/orders/{id}/start-cooking` | Kitchen begins food preparation (`PREPARING`). |
| **Kitchen** | `PATCH`| `/api/v1/kitchen/orders/{id}/food-ready` | Kitchen marks order ready for driver pickup (`READY_FOR_PICKUP`). |
| **Drivers** | `GET` | `/api/v1/drivers/nearby` | Discover nearby drivers via Redis `GEOSEARCH` within given radius. |
| **Drivers** | `POST` | `/api/v1/drivers/{id}/orders/{orderId}/accept`| Claim delivery run with Redisson distributed lock. |
| **Drivers** | `PATCH`| `/api/v1/drivers/{id}/orders/{orderId}/pickup`| Driver picks up food from restaurant (`OUT_FOR_DELIVERY`). |
| **Drivers** | `PATCH`| `/api/v1/drivers/{id}/orders/{orderId}/deliver`| Driver completes delivery to customer (`DELIVERED`). |
| **Tracking** | `GET` | `/api/v1/tracking/orders/{id}` | Fetch current live tracking state, driver coordinates, and progress. |
| **AI Bot** | `POST` | `/api/v1/ai/chat` | Chat with Gemini AI Concierge with Function Calling & smart fallback. |
| **AI Bot** | `GET` | `/api/v1/ai/status` | Retrieve AI service health, model name, and supported capabilities. |

---

## 🧪 Automated Testing Verification

Execute the complete end-to-end integration test suite:
```bash
cd food-delivery-api
mvn test -Dtest=*IntegrationTest
```

Expected output:
```
[INFO] Running com.fooddelivery.integration.AiAssistantIntegrationTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.fooddelivery.integration.DriverDispatchConcurrencyIntegrationTest
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.fooddelivery.integration.KitchenAndDeliveryIntegrationTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.fooddelivery.integration.OrderSagaIntegrationTest
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
[INFO] Results:
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

---

## 📄 Documentation Links
- [Detailed System Architecture Whitepaper](docs/ARCHITECTURE.md)

---

## 👨‍💻 Author & Contributions
Built by **Tanish Chahal** as an enterprise-grade demonstration of distributed systems engineering, high-concurrency event-driven architecture, and modern full-stack web applications.
