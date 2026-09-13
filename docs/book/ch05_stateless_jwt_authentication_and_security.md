# Chapter 5: Security at the Perimeter: Stateless JWT Authentication & Spring Security
## Architecting Scalable Systems: From First Principles to Production

---

## 1. The Real-World Disaster Scenario: The "Leaked Hash" & The Broken Session

To understand why enterprise platforms secure their perimeter the way they do, we must examine two historic real-world engineering catastrophes.

### Disaster 1: The LinkedIn 2012 SHA-1 Password Leak
In 2012, professional networking platform LinkedIn suffered a massive database breach. Over **6.5 million user passwords were stolen**. 

Why was the fallout so catastrophic? 
Because the engineering team stored passwords using **plain, unsalted SHA-1 cryptographic hashes**. 

```
                               THE UNSALTED HASH DISASTER
                               
User Password: "password123" ──► Plain SHA-1 ──► 40bd001563085fc35165329ea1ff5c5ecbdbbeef
                                                            │
                                                            ▼
                                           Hacker searches pre-computed
                                           "Rainbow Table" of 10 billion hashes.
                                           Cracks password in 0.0001 seconds! 💥
```

Because modern graphics cards (GPUs) can calculate billions of SHA-1 hashes per second, hackers downloaded the leaked database, compared the hashes against pre-computed dictionaries called **Rainbow Tables**, and **cracked over 90% of all user accounts within a few hours**.

Had LinkedIn used **salted, adaptive cryptographic algorithms like BCrypt**, cracking those passwords would have required centuries of computing power.

---

### Disaster 2: The Multi-Server Stateful Session Collapse
Imagine you are running a food delivery platform using traditional **Stateful HTTP Sessions** (`HttpSession` / `JSESSIONID`).

When customer Rahul logs in, Server A creates a session object in its local memory:
`sessions.put("JSESSIONID_987", UserDetails(Rahul, id=5))`

At 8:15 PM, 50,000 customers are logged in across your backend cluster:
- 25,000 sessions live in **Server A's RAM**.
- 25,000 sessions live in **Server B's RAM**.

Suddenly, Server A experiences a hardware failure or is restarted for a routine software update.

```
                  ┌─────────────────────────────────────────────────────────┐
                  │              STATEFUL SESSION DISASTER                  │
                  │                                                         │
25,000 Customers  │  Server A crashes or restarts for deployment            │
Active in Cart    │                                                         │
                  │                           │                             │
                  │                           ▼                             │
                  │             25,000 SESSIONS IN RAM VANISH!              │
                  │                           │                             │
                  │                           ▼                             │
                  │       💥 25,000 CUSTOMERS ARE INSTANTLY LOGGED OUT      │
                  │       Shopping carts freeze mid-payment.                │
                  │       Customer support queue explodes.                  │
                  └─────────────────────────────────────────────────────────┘
```

Every single user connected to Server A is abruptly kicked out to the login screen. Their active checkout sessions are destroyed. When they log back in, their requests hit Server B, overloading it and triggering a cascading crash.

To survive in high-availability distributed environments, modern systems abandon stateful server sessions in favor of **Stateless JSON Web Tokens (JWT)** and **Adaptive Salting (BCrypt)**.

---

## 2. First-Principles Theory: Authentication & Cryptography Demystified

Before inspecting Spring Boot code, let us break down the mathematical and architectural foundations of application security.

### 2.1 Authentication vs. Authorization
These two words sound similar but perform completely different jobs:
- **Authentication (AuthN)**: *"Who are you?"*
  - Verifying the user's identity (e.g., verifying that the person typing `rahul@gmail.com` knows the secret password).
- **Authorization (AuthZ)**: *"What are you allowed to do?"*
  - Verifying permissions (e.g., Rahul is a `ROLE_CUSTOMER` and is allowed to view his own orders, but he is **forbidden** from accessing the Kitchen Portal `/api/v1/kitchen/orders` or canceling another customer's food).

---

### 2.2 What is a JSON Web Token (JWT)?
A **JWT (JSON Web Token)** is an open standard (RFC 7519) that defines a compact, self-contained way of securely transmitting information between a client (browser/mobile app) and a server as a JSON object.

Unlike stateful sessions where the server must store session data in its own database or memory, **a JWT is completely stateless**. The server stores **nothing**. The token itself contains all the user's identity data, signed cryptographically by the server.

A JWT looks like a long string of random characters separated by two dots (`.`):
```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJyYWh1bEBnbWFpbC5jb20iLCJjdXN0b21lcklkIjo1LCJyb2xlIjoiUk9MRV9DVVNUT01FUiJ9.s7zT8kX0K8X6P1L3V9W4R7M2Q5J8H1Y4Z7C9B2N5M8K
```

It consists of **three distinct parts**:

```
 ┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
 │       1. HEADER         │ . │       2. PAYLOAD        │ . │      3. SIGNATURE       │
 │  Metadata & Algorithm   │   │  User Identity & Claims │   │  Tamper-Proof Seal      │
 └─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
```

#### Part 1: The Header (Base64-encoded JSON)
Specifies the type of token and the cryptographic hashing algorithm used:
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

#### Part 2: The Payload / Claims (Base64-encoded JSON)
Contains the actual identity data (called **Claims**):
```json
{
  "sub": "customer@swiggy.com",
  "customerId": 5,
  "fullName": "Rahul Sharma",
  "role": "ROLE_CUSTOMER",
  "iat": 1789219488,
  "exp": 1789305888
}
```
- `sub` (Subject): The primary identifier (email).
- `iat` (Issued At): Timestamp when the token was created.
- `exp` (Expiration): Timestamp when the token automatically becomes invalid (e.g., 24 hours later).

> **Crucial Security Warning**: The Header and Payload are **NOT encrypted**; they are merely **Base64-encoded**! Anyone who intercepts the token can read the email and customer ID. Therefore, **never store passwords, credit card numbers, or secret API keys inside a JWT payload!**

#### Part 3: The Signature (The Tamper-Proof Seal)
This is where the mathematical magic happens. How does the server know a hacker didn't intercept the token and change `"customerId": 5` to `"customerId": 1` (the administrator)?

When the server generates the token, it takes the encoded Header, the encoded Payload, and combines them with a **top-secret cryptographic key** known only to the backend server:

$$\text{Signature} = \text{HMAC-SHA256}\Big(\text{Base64}(Header) + \text{"."} + \text{Base64}(Payload),\; \text{SECRET\_KEY}\Big)$$

If an attacker changes even a single letter in the payload (changing `customerId` from `5` to `1`), the signature generated by that modified payload will not match the signature at the end of the token. The server immediately detects tampering and **rejects the request in 0.1 milliseconds without touching the database!**

---

### 2.3 Password Hashing: Why BCrypt?
Why can't we use simple MD5 or SHA-256 for passwords?

1. **Reversible Encryption vs. One-Way Hashing**:
   - Encryption is two-way: you can encrypt plaintext with a key, and decrypt it back to plaintext.
   - Hashing is strictly **one-way**: you can turn `"password123"` into a hash, but mathematically you can **never** reverse the hash back into `"password123"`.
2. **The Danger of Fast Hashes**:
   - Standard algorithms like SHA-256 were designed for high-speed file checksums. A modern GPU can compute **10 billion SHA-256 hashes every single second**. An attacker with a gaming PC can brute-force an 8-character password in minutes.
3. **The BCrypt Solution: Adaptive Work Factor & Salting**:
   - **Salting**: Before hashing, BCrypt generates a cryptographic random string of 16 bytes called a **Salt** and appends it to the password. Even if 1,000 users have the exact same password (`"password123"`), every single one of them gets a completely unique hash in PostgreSQL! Pre-computed Rainbow Tables become 100% useless.
   - **Adaptive Work Factor (Cost Factor)**: BCrypt is intentionally designed to be **computationally slow**. In our backend, we configure BCrypt with cost factor `10` ($2^{10} = 1,024$ internal rounds of key expansion). Hashing a password takes ~80 milliseconds on a modern CPU. While 80ms is imperceptible to a human logging in once, it makes cracking millions of passwords computationally impossible for an attacker!

```
                       BCRYPT HASH ANATOMY
  $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
  └──┬─┘└─┬┘└──────────┬─────────┘└─────────────┬─────────────┘
     │    │            │                         │
 Algorithm Cost     16-Byte Salt        24-Byte Encrypted Hash
 (BCrypt) (2^10)  (Unique per user)     (Impossible to reverse)
```

---

## 3. The Spring Security Filter Chain Pipeline

If you have never worked with Spring Boot, how does it physically intercept incoming HTTP traffic?

When an HTTP request arrives from the internet at our application's port (`8080`), it does not immediately enter our `@RestController`. Instead, it must walk down an obstacle course called the **Security Filter Chain**:

```mermaid
flowchart TD
    REQ["Incoming HTTP Request<br/>(e.g., POST /api/v1/orders)<br/>Header: Authorization: Bearer eyJhbGci..."] --> F1
    
    subgraph "Spring Security Filter Chain"
        F1["1. CorsFilter<br/>(Validates Origin: localhost:5173)"] -->|Pass| F2
        F2["2. CsrfFilter<br/>(Disabled for Stateless APIs)"] -->|Pass| F3
        F3["3. JwtAuthenticationFilter<br/>(Extracts Bearer Token & Verifies HMAC Signature)"]
        
        F3 -->|Valid Token| POPULATE["Populate SecurityContextHolder<br/>(Attach Customer entity to Thread)"]
        POPULATE --> F4["4. AuthorizationFilter<br/>(Checks route permissions: permitAll vs authenticated)"]
        F3 -->|No Token / Invalid| F4
    end

    F4 -->|Authorized| CONTROLLER["Target Controller<br/>(e.g., OrderController.createOrder)"]
    F4 -->|Denied| REJECT["403 Forbidden / 401 Unauthorized<br/>(Request blocked at perimeter!)"]
```

### The Nightclub Bouncer Analogy
Think of the Spring Security Filter Chain like entering an exclusive nightclub:
1. **`CorsFilter`** is the street guard: *"Are you coming from an approved neighborhood (our React frontend at `localhost:5173`)?"*
2. **`JwtAuthenticationFilter`** is the ID checker at the door: *"Show me your wristband (JWT). Is the security hologram intact? Has the date expired?"* If valid, the guard stamps your hand with your identity (**`SecurityContextHolder`**).
3. **`AuthorizationFilter`** is the VIP room bouncer: *"Anyone can browse the public restaurant menus (`permitAll`), but only customers with a stamped hand can enter the order checkout room (`authenticated`)."*

---

## 4. Production Code Anatomy: Codebase Walkthrough

Let us inspect the real production code files that implement this security architecture in our repository.

### 4.1 The Security Architecture Blueprint: `SecurityConfig.java`

This file is the master brain of our application's perimeter defense:

```java
package com.fooddelivery.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.CorsFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final CorsFilter corsFilter;

    /**
     * Declares the BCrypt password hashing bean used across registration and login.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Constructs the HTTP security pipeline.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // 1. Disable CSRF (Cross-Site Request Forgery) because JWTs are stored in
                // memory/headers, not ambient browser cookies, making CSRF attacks impossible.
                .csrf(AbstractHttpConfigurer::disable)

                // 2. Insert CORS and JWT validation filters at the very beginning of the chain
                .addFilterBefore(corsFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)

                // 3. Enforce STATELESS session policy: Spring Boot will NEVER create
                // an HttpSession or allocate server RAM for sessions!
                .sessionManagement(session -> 
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // 4. Fine-grained URL perimeter authorization rules
                .authorizeHttpRequests(auth -> auth
                        // Public Endpoints: Accessible by anyone without a token
                        .requestMatchers(
                                "/api/v1/auth/**",         // Customer registration & login
                                "/api/v1/restaurants/**",  // Browsing menus and catalogs
                                "/api/v1/kitchen/**",      // Kitchen display portal
                                "/api/v1/cart/**",         // Guest shopping cart
                                "/api/v1/drivers/**",      // Driver dispatch simulator
                                "/api/v1/tracking/**",     // Real-time tracking
                                "/api/v1/orders/**",       // Order placement and status
                                "/api/v1/ai/**",           // Gemini AI concierge
                                "/ws-delivery/**",         // STOMP WebSocket handshake
                                "/swagger-ui/**",          // Interactive API documentation
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/actuator/**",            // Prometheus metrics scraping
                                "/error"
                        ).permitAll()
                        
                        // All other endpoints require a cryptographically valid JWT
                        .anyRequest().authenticated()
                );

        return http.build();
    }
}
```

---

### 4.2 The Interceptor: `JwtAuthenticationFilter.java`

This filter executes on **every single incoming HTTP request** before the request ever reaches any controller:

```java
package com.fooddelivery.config;

import com.fooddelivery.entity.Customer;
import com.fooddelivery.repository.CustomerRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final CustomerRepository customerRepository;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        // 1. Inspect the standard HTTP Authorization header
        final String authHeader = request.getHeader("Authorization");
        
        // If header is missing or does not start with "Bearer ", pass request downstream
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Strip "Bearer " prefix (first 7 characters) to isolate raw token string
        final String jwt = authHeader.substring(7);
        try {
            // 3. Cryptographically verify signature and extract user email
            final String userEmail = jwtService.extractEmail(jwt);

            // If email is valid and thread has not already been authenticated
            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                Customer customer = customerRepository.findByEmail(userEmail).orElse(null);

                // 4. Verify token has not expired and belongs to this customer
                if (customer != null && jwtService.isTokenValid(jwt, customer)) {
                    
                    // 5. Create an authenticated token containing user identity and roles
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            customer,
                            null,
                            Collections.singletonList(new SimpleGrantedAuthority(customer.getRole()))
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    // 6. ATTACH IDENTITY TO CURRENT EXECUTION THREAD!
                    // Any downstream controller can now call SecurityContextHolder to get current user!
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (Exception ex) {
            // Invalid or expired token: continue down the chain as an anonymous user
        }

        // 7. Pass request to the next filter in the chain
        filterChain.doFilter(request, response);
    }
}
```

---

### 4.3 The Cryptographic Engine: `JwtService.java`

This service performs the actual HMAC-SHA256 signature generation and mathematical verification using the standard `io.jsonwebtoken` (JJWT) library:

```java
package com.fooddelivery.config;

import com.fooddelivery.entity.Customer;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class JwtService {

    // 256-bit secret key used to compute the HMAC-SHA256 mathematical signature
    private static final String SECRET = "swiggy_distributed_super_secret_jwt_key_2026_production_grade_token_key_123456";
    private static final long EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 Hours in milliseconds

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Generates a signed JWT for an authenticated customer.
     */
    public String generateToken(Customer customer) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("customerId", customer.getId());
        claims.put("fullName", customer.getFullName());
        claims.put("role", customer.getRole());

        return Jwts.builder()
                .claims(claims)                          // Custom claims payload
                .subject(customer.getEmail())            // Primary subject
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + EXPIRATION_MS))
                .signWith(getSigningKey())               // Cryptographic seal
                .compact();
    }

    public String extractEmail(String token) {
        return extractAllClaims(token).getSubject();
    }

    public boolean isTokenValid(String token, Customer customer) {
        final String email = extractEmail(token);
        return (email.equals(customer.getEmail())) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractAllClaims(token).getExpiration().before(new Date());
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())  // Recomputes signature; throws exception if tampered!
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
```

---

### 4.4 The Authentication Service: `AuthService.java`

Notice how clean and readable our registration and login methods are:

```java
package com.fooddelivery.service;

import com.fooddelivery.common.dto.*;
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

        Customer customer = Customer.builder()
                .fullName(request.getFullName())
                .email(request.getEmail().toLowerCase().trim())
                .phone(request.getPhone().trim())
                // BCRYPT HASHING: Raw password is NEVER stored in PostgreSQL!
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
                .role(saved.getRole())
                .build();
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        Customer customer = customerRepository.findByEmail(request.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        // Verifies submitted raw password against salted BCrypt hash
        if (!passwordEncoder.matches(request.getPassword(), customer.getPasswordHash())) {
            throw new RuntimeException("Invalid email or password");
        }

        String token = jwtService.generateToken(customer);
        return AuthResponse.builder()
                .token(token)
                .customerId(customer.getId())
                .fullName(customer.getFullName())
                .email(customer.getEmail())
                .role(customer.getRole())
                .build();
    }
}
```

---

## 5. War Stories & Real Debugging Logs

In our actual coding sessions, we encountered two significant security roadblocks:

### War Story 1: The Actuator 403 Forbidden Blocker
- **The Symptom**: When we added Prometheus monitoring to our Spring Boot backend, Prometheus attempted to scrape `http://localhost:8080/actuator/prometheus` every 5 seconds. Every single scrape failed with:
  ```
  ERROR: The remote server returned an error: (403) Forbidden.
  ```
  Prometheus targets remained red, and Grafana showed zero metrics.
- **The Root Cause**: Look back at `SecurityConfig.java`. The last line was:
  `.anyRequest().authenticated()`
  Spring Security was doing its job! Because Prometheus is an automated background scraper, it does not possess a customer JWT Bearer token. Spring Security intercepted the request and threw an immediate `403 Forbidden`.
- **The Architectural Fix**: We updated the `requestMatchers` whitelist inside `SecurityConfig.java` to explicitly permit actuator metric endpoints:
  ```java
  .requestMatchers(
          "/actuator/**",  // Whitelisted for Prometheus scraping
          "/error"
  ).permitAll()
  ```
  After this single-line fix, Prometheus immediately received HTTP 200 responses, and the Grafana dashboard came to life.

### War Story 2: The CORS Preflight Rejection
- **The Symptom**: In our React frontend running on `http://localhost:5173`, calling `fetch("http://localhost:8080/api/v1/orders")` failed in Google Chrome with:
  ```
  Access to fetch at 'http://localhost:8080/api/v1/orders' from origin 'http://localhost:5173' 
  has been blocked by CORS policy: Response to preflight request doesn't pass access control check.
  ```
- **The Root Cause**: Browsers enforce **CORS (Cross-Origin Resource Sharing)** for security. Because port `5173` (React Vite) does not match port `8080` (Spring Boot), Chrome sends an automatic HTTP `OPTIONS` request (called a **Preflight Request**) before the real `POST` request to ask: *"Do you permit calls from port 5173?"*
  Because our Spring Security filter chain was checking for JWTs before handling CORS, the `OPTIONS` request was blocked!
- **The Architectural Fix**: In `SecurityConfig.java`, we positioned `corsFilter` **before** the authentication filter:
  ```java
  .addFilterBefore(corsFilter, UsernamePasswordAuthenticationFilter.class)
  ```
  This guarantees browser preflight checks receive an immediate `200 OK` with headers `Access-Control-Allow-Origin: *`, unblocking the frontend.

---

## 6. Senior Engineering Interview Cheat-Sheet

### Q1: "Why did you choose Stateless JWTs over traditional Server Sessions for your food delivery platform?"
> **Strong Answer**: 
> *"Traditional HTTP sessions (`HttpSession`) are stateful, requiring each backend instance to store session objects in memory or synchronize them across a shared session cluster. In a high-traffic microservices architecture deployed across multiple horizontal instances, stateful sessions introduce sticky-session routing bottlenecks and force users to re-authenticate whenever an instance restarts.
> 
> By utilizing JSON Web Tokens (JWT), authentication is 100% stateless. The token contains all user claims (`customerId`, `role`, `email`) and is cryptographically signed using HMAC-SHA256. Any backend instance can verify the token's validity in sub-millisecond time by checking the cryptographic signature without performing a database lookup or session memory access, enabling effortless horizontal auto-scaling."*

### Q2: "How does BCrypt protect user passwords compared to standard algorithms like SHA-256 or MD5?"
> **Strong Answer**: 
> *"Standard cryptographic algorithms like SHA-256 and MD5 are designed for high throughput; modern GPUs can calculate billions of SHA-256 hashes per second, making stolen password databases vulnerable to dictionary and Rainbow Table attacks.
> 
> BCrypt incorporates two critical defenses:
> 1. **Automatic Salting**: It prepends a cryptographically secure 16-byte random salt to every password before hashing, guaranteeing that identical passwords produce completely distinct hashes, rendering Rainbow Tables useless.
> 2. **Adaptive Work Factor**: BCrypt uses an exponential cost parameter (we use cost factor 10, executing $2^{10} = 1,024$ rounds). This introduces an intentional ~80ms computational delay per hash, making mass brute-force attacks computationally and financially impossible for an attacker."*

### Q3: "What is the primary architectural vulnerability of stateless JWTs, and how do you mitigate it in production?"
> **Strong Answer**: 
> *"The primary trade-off of stateless JWTs is **Revocation Inability**. Because the server does not store session state, if a customer's phone is stolen or a token is compromised, the token remains mathematically valid until its expiration timestamp (`exp`) passes.
> 
> In production, this is mitigated via two patterns:
> 1. **Short Expiration Windows**: Issuing short-lived access tokens (e.g., 15 minutes) paired with a securely stored Refresh Token.
> 2. **Distributed Blacklisting / Blocklisting**: For high-risk operations (such as user logout or password resets), we store the revoked token's signature or JTI (JWT ID) in Redis with an expiration matching the token's remaining TTL. The `JwtAuthenticationFilter` performs an $O(1)$ lookup in Redis; if the token is in the blacklist, it is rejected immediately."*

---

### 📌 Chapter 5 Key Takeaways Checklist
- [x] Passwords must never be encrypted (reversible); they must be one-way hashed using salted, adaptive algorithms (BCrypt).
- [x] Stateful sessions break horizontal scalability; stateless JWTs allow any server instance to authenticate requests independently.
- [x] A JWT consists of three parts: Header (algorithm), Payload (claims), and Signature (HMAC-SHA256 tamper-proof seal).
- [x] Base64 is not encryption; never store secrets or credit cards in a JWT payload.
- [x] The Spring Security Filter Chain intercepts every HTTP request before it reaches controllers.
- [x] `JwtAuthenticationFilter` verifies tokens and populates `SecurityContextHolder` on the current execution thread.
- [x] Public endpoints (`/api/v1/auth/**`, `/actuator/**`) are whitelisted via `requestMatchers().permitAll()`.
