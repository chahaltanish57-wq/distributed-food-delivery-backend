# 🚚 Distributed Food Delivery Backend (Swiggy / Zomato Architecture)

[![Java 21](https://img.shields.io/badge/Java-21-orange.svg)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3+-green.svg)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.x-red.svg)](https://redis.io/)
[![Apache Kafka](https://img.shields.io/badge/Kafka-3.8%20(KRaft)-black.svg)](https://kafka.apache.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)

An enterprise-grade, event-driven backend for a food delivery platform inspired by Swiggy and Zomato. Built to demonstrate real-world distributed systems concepts: **Event-Driven Architecture (EDA)**, **Saga Pattern for distributed transactions**, **Order State Machines**, **Redis Geospatial Driver Dispatch**, and **Concurrency Control with Distributed Locks**.

---

## 🗺️ System Architecture

```
[Customer App]         [Restaurant Portal]         [Delivery Partner App]
       │                       │                             │
       └───────────────────────┼─────────────────────────────┘
                               ▼
                   [Spring Cloud API Gateway]
                               │
       ┌───────────────┬───────┴───────┬───────────────┐
       ▼               ▼               ▼               ▼
[Order Service] [Payment Service] [Delivery Svc] [Restaurant Svc]
  (State Machine) (Idempotency)   (Redis Geo)     (Catalog/Menu)
       │               │               │               │
       └───────────────┼───────────────┼───────────────┘
                       ▼               ▼
            [Apache Kafka]     [Redis (Cache/Locks)]
                   │
                   ▼
       [Notification Service]  ──▶  (WebSockets / STOMP)
                   │
                   ▼
         [AI Service (Gemini)] ──▶  (Support Bot, ETA, Recommender)
```

---

## 📅 14-Day Build Progress

- [x] **Day 1: Infrastructure & Docker Compose (PostgreSQL, Redis, Kafka KRaft, Kafka UI)**
- [x] **Day 2: Project Scaffolding & Database Schema (Flyway + PostgreSQL)**: Project Scaffolding & Database Schema (Flyway + PostgreSQL)
- [ ] **Day 3**: Restaurant & Menu Service (CRUD + Swagger UI)
- [ ] **Day 4**: Customer Accounts & Stateless JWT Security
- [ ] **Day 5**: Shopping Cart Engine with Redis (TTL Caching)
- [ ] **Day 6**: Order State Machine Engine
- [ ] **Day 7**: Payment Service with Distributed Idempotency
- [ ] **Day 8**: Apache Kafka Event-Driven Saga
- [ ] **Day 9**: Restaurant Kitchen Workflow & Timeout Handling
- [ ] **Day 10**: Redis Geospatial & Driver Dispatch (Redisson Locks)
- [ ] **Day 11**: Real-Time Live Tracking (WebSockets / STOMP)
- [ ] **Day 12**: AI Integrations with Gemini API (Support & Recommender)
- [ ] **Day 13**: Integration Testing with Testcontainers
- [ ] **Day 14**: System Showcase, Benchmarks & Portfolio Polish

---

## 🚀 Day 1: Local Infrastructure Quickstart

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Running with WSL2 backend on Windows)
* [Java 21 JDK](https://adoptium.net/)
* Git

### Start the Infrastructure
```bash
# 1. Start all backing containers (Postgres, Redis, Kafka, Kafka UI)
docker compose up -d

# 2. View running containers
docker compose ps
```

### Exposed Services & Endpoints

| Service | Port | Description | Web Dashboard |
| :--- | :--- | :--- | :--- |
| **PostgreSQL 16** | `5433` | Relational database (`food_delivery_db`) | Via DBeaver or psql |
| **Redis 7** | `6379` | In-memory cache & geospatial store | `redis-cli` |
| **Apache Kafka (KRaft)** | `9092` | Event bus for distributed sagas | N/A |
| **Kafka UI** | `8085` | Web dashboard to monitor topics & messages | [http://localhost:8085](http://localhost:8085) |

---

## 🛠️ Tech Stack & Key Design Patterns
* **Language & Framework**: Java 21 LTS, Spring Boot 3.3+
* **Distributed Messaging**: Apache Kafka with KRaft (Zookeeper-less)
* **High-Speed Cache & Geo**: Redis (Geospatial indexing via `GEOADD`/`GEOSEARCH`, Redisson Distributed Locks)
* **Persistent Storage**: PostgreSQL 16 with Flyway migrations
* **AI Capabilities**: Google Gemini API for intelligent customer support & ETA forecasting
