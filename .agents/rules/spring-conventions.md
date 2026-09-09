# Food Delivery Backend Development Rules

## Tech Stack Guidelines
- Language: Java 21 LTS (utilize records, switch pattern matching, and sealed interfaces where appropriate).
- Framework: Spring Boot 3.3+.
- Build Tool: Maven (Multi-module architecture: common-dto, order-service, delivery-service, payment-service).
- Primary Database: PostgreSQL 16 with Flyway for version-controlled database migrations.
- In-Memory / Cache / Geospatial: Redis (Spring Data Redis, Redisson for distributed locks, Redis Geospatial for driver tracking).
- Messaging / Event-Driven: Apache Kafka (Spring Kafka with transactional producers, consumer groups, idempotency, and Dead Letter Queues).
- API Design: RESTful endpoints documented with OpenAPI 3 / Swagger (`/swagger-ui.html`).
- Containerization: Docker Compose for local infrastructure.

## Code Quality & Architecture
- Maintain Clean Architecture / Hexagonal principles (separation of Entities, DTOs, Repositories, Services, and Controllers).
- Never leak JPA entities directly to API responses; always map to immutable Java records/DTOs.
- Defensive error handling with global `@RestControllerAdvice` and RFC 7807 Problem Details.
- Write unit and integration tests (using Testcontainers for real PostgreSQL/Kafka testing).
