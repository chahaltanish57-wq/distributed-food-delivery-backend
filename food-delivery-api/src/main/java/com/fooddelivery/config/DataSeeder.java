package com.fooddelivery.config;

import com.fooddelivery.common.enums.DriverStatus;
import com.fooddelivery.entity.Customer;
import com.fooddelivery.entity.DeliveryPartner;
import com.fooddelivery.entity.MenuItem;
import com.fooddelivery.entity.Restaurant;
import com.fooddelivery.repository.CustomerRepository;
import com.fooddelivery.repository.DeliveryPartnerRepository;
import com.fooddelivery.repository.MenuItemRepository;
import com.fooddelivery.repository.RestaurantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;
    private final CustomerRepository customerRepository;
    private final DeliveryPartnerRepository deliveryPartnerRepository;
    private final StringRedisTemplate redisTemplate;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        seedCustomer();
        seedRestaurants();
        seedDeliveryPartners();
    }

    private void seedCustomer() {
        if (customerRepository.count() > 0) {
            return;
        }

        log.info("Seeding default demo customer: customer@swiggy.com");
        Customer demoCustomer = Customer.builder()
                .fullName("John Doe")
                .email("customer@swiggy.com")
                .phone("+91 9876543210")
                .passwordHash(passwordEncoder.encode("password123"))
                .address("Sector 18, Noida")
                .role("ROLE_CUSTOMER")
                .build();
        customerRepository.save(demoCustomer);
    }

    private void seedRestaurants() {
        if (restaurantRepository.count() > 0) {
            log.info("Restaurants and menus already seeded. Skipping seeder.");
            return;
        }

        log.info("Seeding authentic Noida and Dehradun restaurants with INR pricing...");

        // =========================================================================
        // NOIDA RESTAURANTS
        // =========================================================================

        // 1. Brahmaputra Street Bites & Chaat (Noida)
        Restaurant n1 = restaurantRepository.save(Restaurant.builder()
                .name("Brahmaputra Street Bites & Chaat")
                .description("Iconic Noida Sector 29 night market street food, kathi rolls, spicy chaats, and kurkure momos.")
                .address("Brahmaputra Commercial Complex, Sector 29, Noida")
                .city("Noida")
                .latitude(new BigDecimal("28.5672000"))
                .longitude(new BigDecimal("77.3342000"))
                .rating(new BigDecimal("4.7"))
                .cuisineType("North Indian, Street Food, Rolls")
                .deliveryTimeMins(22)
                .imageUrl("https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80")
                .build());

        menuItemRepository.saveAll(List.of(
                MenuItem.builder().restaurant(n1).name("Double Chicken Kathi Roll").description("Flaky layered paratha stuffed with juicy spiced chicken tikka, eggs, mint chutney, and pickled onions. Price: \u20B9249.").price(new BigDecimal("249.00")).category("Rolls").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(n1).name("Dahi Bhalla & Papdi Chaat").description("Soft lentil vadas and crunchy papdis smothered in chilled sweet spiced curd, saunth, and pomegranate. Price: \u20B9149.").price(new BigDecimal("149.00")).category("Chaat").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(n1).name("Crispy Kurkure Paneer Momos (8 pcs)").description("Deep-fried crunchy coated momos with spicy cottage cheese filling, served with red chili garlic dip. Price: \u20B9189.").price(new BigDecimal("189.00")).category("Momos").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(n1).name("Shahi Rabri Kulfi Falooda").description("Rich condensed milk kulfi topped with falooda noodles, chilled thick rabri, and rose water syrup. Price: \u20B9129.").price(new BigDecimal("129.00")).category("Desserts").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=500&q=80").build()
        ));

        // 2. Desi Rasoi & Mughlai Darbar (Noida)
        Restaurant n2 = restaurantRepository.save(Restaurant.builder()
                .name("Desi Rasoi & Mughlai Darbar")
                .description("Authentic Mughlai curries, slow-cooked dal makhani, tender kebabs, and fragrant biryanis.")
                .address("Sector 18 Market, Near Wave Mall, Noida")
                .city("Noida")
                .latitude(new BigDecimal("28.5708000"))
                .longitude(new BigDecimal("77.3219000"))
                .rating(new BigDecimal("4.8"))
                .cuisineType("Mughlai, North Indian, Biryani")
                .deliveryTimeMins(30)
                .imageUrl("https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80")
                .build());

        menuItemRepository.saveAll(List.of(
                MenuItem.builder().restaurant(n2).name("Butter Chicken & 2 Garlic Naans Combo").description("Tender tandoori chicken simmered in a velvet cashew-tomato makhani gravy with 2 freshly made garlic naans. Price: \u20B9379.").price(new BigDecimal("379.00")).category("Combos").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(n2).name("Slow-Cooked Dal Makhani & Jeera Rice").description("Urad lentils slow-cooked for 16 hours with cream and white butter, served with fragrant cumin basmati rice. Price: \u20B9269.").price(new BigDecimal("269.00")).category("Mains").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(n2).name("Lucknowi Mutton Dum Biryani").description("Marinated goat meat slow-steamed in a sealed clay pot with aged basmati rice and pure saffron. Price: \u20B9429.").price(new BigDecimal("429.00")).category("Biryani").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(n2).name("Paneer Tikka Lababdar").description("Tandoori paneer cubes cooked in a spiced onion, tomato, and bell pepper gravy finished with cream. Price: \u20B9319.").price(new BigDecimal("319.00")).category("Mains").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=500&q=80").build()
        ));

        // 3. The Burger Club & Shakes (Noida)
        Restaurant n3 = restaurantRepository.save(Restaurant.builder()
                .name("The Burger Club & Shakes")
                .description("Juicy smash burgers, crispy chicken wings, peri-peri loaded fries, and thick shakes.")
                .address("Logix Cyber Park, Sector 62, Noida")
                .city("Noida")
                .latitude(new BigDecimal("28.6280000"))
                .longitude(new BigDecimal("77.3649000"))
                .rating(new BigDecimal("4.5"))
                .cuisineType("Burgers, American, Fast Food")
                .deliveryTimeMins(20)
                .imageUrl("https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80")
                .build());

        menuItemRepository.saveAll(List.of(
                MenuItem.builder().restaurant(n3).name("Double Cheese Smash Burger").description("Two prime smashed patties, double cheddar cheese, grilled onions, and house burger sauce in a brioche bun. Price: \u20B9229.").price(new BigDecimal("229.00")).category("Burgers").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(n3).name("Spicy Crispy Chicken Burger").description("Crispy coated chicken breast fillet, pickled jalapeÃ±os, lettuce, and sriracha mayo. Price: \u20B9199.").price(new BigDecimal("199.00")).category("Burgers").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(n3).name("Peri Peri Loaded Cheese Fries").description("Crispy crinkle fries generously dusted with spicy peri-peri rub and drizzled with warm cheddar sauce. Price: \u20B9139.").price(new BigDecimal("139.00")).category("Sides").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(n3).name("Belgian Dark Chocolate Thickshake").description("Dense chocolate milkshake blended with melted dark chocolate fudge and chocolate shavings. Price: \u20B9169.").price(new BigDecimal("169.00")).category("Beverages").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=500&q=80").build()
        ));

        // =========================================================================
        // DEHRADUN RESTAURANTS
        // =========================================================================

        // 4. Kalsang Cafe & Tibetan Kitchen (Dehradun)
        Restaurant d1 = restaurantRepository.save(Restaurant.builder()
                .name("Kalsang Cafe & Tibetan Kitchen")
                .description("Legendary Dehradun eatery famous for authentic Tibetan Momos, Thukpa, Tingmo, and Asian noodles.")
                .address("88 Rajpur Road, Near Jakhan, Dehradun")
                .city("Dehradun")
                .latitude(new BigDecimal("30.3458000"))
                .longitude(new BigDecimal("78.0648000"))
                .rating(new BigDecimal("4.9"))
                .cuisineType("Tibetan, Asian, Momos, Thukpa")
                .deliveryTimeMins(25)
                .imageUrl("https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80")
                .build());

        menuItemRepository.saveAll(List.of(
                MenuItem.builder().restaurant(d1).name("Chicken Devil Momos (8 pcs)").description("Steamed chicken momos tossed in Kalsang's signature fiery red hot garlic chutney and spring onions. Price: \u20B9199.").price(new BigDecimal("199.00")).category("Momos").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(d1).name("Himalayan Vegetable Thukpa").description("Hearty hot noodle soup with fresh mountain vegetables, bok choy, garlic, and coriander in ginger broth. Price: \u20B9189.").price(new BigDecimal("189.00")).category("Soups").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(d1).name("Tibetan Tingmo & Chilli Paneer").description("Two fluffy spiral steamed bread buns served with spicy wok-tossed mountain chilli paneer. Price: \u20B9239.").price(new BigDecimal("239.00")).category("Mains").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(d1).name("Authentic Tibetan Butter Tea").description("Traditional Himalayan salted butter tea brewed with green tea leaves and churned yak butter. Price: \u20B999.").price(new BigDecimal("99.00")).category("Beverages").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=500&q=80").build()
        ));

        // 5. Kumar Sweet House & Pahadi Rasoi (Dehradun)
        Restaurant d2 = restaurantRepository.save(Restaurant.builder()
                .name("Kumar Sweet House & Pahadi Rasoi")
                .description("Heritage sweets shop and authentic Garhwali Pahadi dining since 1950 in the heart of Doon valley.")
                .address("Paltan Bazaar, Near Clock Tower, Dehradun")
                .city("Dehradun")
                .latitude(new BigDecimal("30.3244000"))
                .longitude(new BigDecimal("78.0418000"))
                .rating(new BigDecimal("4.8"))
                .cuisineType("Pahadi, North Indian, Sweets")
                .deliveryTimeMins(20)
                .imageUrl("https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80")
                .build());

        menuItemRepository.saveAll(List.of(
                MenuItem.builder().restaurant(d2).name("Traditional Pahadi Kafuli & Rice").description("Authentic Garhwali curry made with mountain spinach and fenugreek leaves, served with hot basmati rice. Price: \u20B9249.").price(new BigDecimal("249.00")).category("Pahadi Thali").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(d2).name("Aloo Ke Gutke & Puri (4 pcs)").description("Famous Kumaoni style fried baby potatoes seasoned with jamboo and local jakhiya seeds, with 4 hot puris. Price: \u20B9159.").price(new BigDecimal("159.00")).category("Breakfast").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(d2).name("Dehradun Bal Mithai Box (400g)").description("The crowned sweet of Uttarakhand: roasted dark brown khoya fudge coated in white sugar balls. Price: \u20B9280.").price(new BigDecimal("280.00")).category("Mithai").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(d2).name("Desi Ghee Jalebi & Rabri (250g)").description("Spiral saffron jalebis fried in pure desi ghee and immersed in thick cardamom malai rabri. Price: \u20B9140.").price(new BigDecimal("140.00")).category("Mithai").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=500&q=80").build()
        ));

        // 6. Orchard Cafe & Bakery (Dehradun)
        Restaurant d3 = restaurantRepository.save(Restaurant.builder()
                .name("Orchard Cafe & Bakery")
                .description("Scenic Himalayan foothill cafe serving wood-fired artisanal pizzas, stroganoff, and baked walnut treats.")
                .address("Dakpatti, Foothills of Rajpur Road, Dehradun")
                .city("Dehradun")
                .latitude(new BigDecimal("30.3812000"))
                .longitude(new BigDecimal("78.0891000"))
                .rating(new BigDecimal("4.7"))
                .cuisineType("Cafe, Italian, Bakery, Continental")
                .deliveryTimeMins(28)
                .imageUrl("https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80")
                .build());

        menuItemRepository.saveAll(List.of(
                MenuItem.builder().restaurant(d3).name("Wood-Fired Farmhouse Veg Pizza").description("Hand-stretched thin crust pizza loaded with bell peppers, sweet corn, mushrooms, black olives, and mozzarella. Price: \u20B9349.").price(new BigDecimal("349.00")).category("Pizzas").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(d3).name("Creamy Grilled Chicken Stroganoff").description("Seared chicken breast slices simmered in a velvety mushroom paprika cream sauce, served with buttered herb rice. Price: \u20B9379.").price(new BigDecimal("379.00")).category("Mains").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1621996346565-e3d5d628169e?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(d3).name("Warm Walnut Brownie with Hot Chocolate Fudge").description("Freshly baked rich chocolate brownie packed with local mountain walnuts, topped with dark chocolate sauce. Price: \u20B9179.").price(new BigDecimal("179.00")).category("Bakery").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(d3).name("Iced Hazelnut Cafe Mocha").description("Double shot of cold espresso shaken with dark chocolate sauce, roasted hazelnut syrup, and milk. Price: \u20B9159.").price(new BigDecimal("159.00")).category("Beverages").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=500&q=80").build()
        ));

        log.info("Seeding complete! 6 restaurants (3 in Noida, 3 in Dehradun) and 24 items with INR pricing created successfully.");
    }

    private void seedDeliveryPartners() {
        if (deliveryPartnerRepository.count() == 0) {
            log.info("Seeding authentic delivery partners for Noida and Dehradun...");

            List<DeliveryPartner> drivers = List.of(
                    // 1. Noida Sector 18 (near Desi Rasoi)
                    DeliveryPartner.builder()
                            .name("Amit Sharma")
                            .phone("+91 9811100001")
                            .vehicleType("Hero Splendor (Motorcycle)")
                            .status(DriverStatus.AVAILABLE)
                            .currentLatitude(new BigDecimal("28.5700000"))
                            .currentLongitude(new BigDecimal("77.3220000"))
                            .city("Noida")
                            .isActive(true)
                            .build(),

                    // 2. Noida Sector 62 (near The Burger Club)
                    DeliveryPartner.builder()
                            .name("Rohan Verma")
                            .phone("+91 9811100002")
                            .vehicleType("TVS Apache RTR (Motorcycle)")
                            .status(DriverStatus.AVAILABLE)
                            .currentLatitude(new BigDecimal("28.6270000"))
                            .currentLongitude(new BigDecimal("77.3650000"))
                            .city("Noida")
                            .isActive(true)
                            .build(),

                    // 3. Noida Sector 29 (near Brahmaputra Market)
                    DeliveryPartner.builder()
                            .name("Vikram Singh")
                            .phone("+91 9811100003")
                            .vehicleType("Honda Activa 6G (Scooter)")
                            .status(DriverStatus.AVAILABLE)
                            .currentLatitude(new BigDecimal("28.5665000"))
                            .currentLongitude(new BigDecimal("77.3340000"))
                            .city("Noida")
                            .isActive(true)
                            .build(),

                    // 4. Dehradun Rajpur Road / Jakhan (near Kalsang)
                    DeliveryPartner.builder()
                            .name("Deepak Rawat")
                            .phone("+91 9811100004")
                            .vehicleType("Royal Enfield Hunter (Motorcycle)")
                            .status(DriverStatus.AVAILABLE)
                            .currentLatitude(new BigDecimal("30.3460000"))
                            .currentLongitude(new BigDecimal("78.0650000"))
                            .city("Dehradun")
                            .isActive(true)
                            .build(),

                    // 5. Dehradun Clock Tower / Paltan Bazaar (near Kumar Sweet House)
                    DeliveryPartner.builder()
                            .name("Suresh Negi")
                            .phone("+91 9811100005")
                            .vehicleType("Suzuki Access 125 (Scooter)")
                            .status(DriverStatus.AVAILABLE)
                            .currentLatitude(new BigDecimal("30.3240000"))
                            .currentLongitude(new BigDecimal("78.0420000"))
                            .city("Dehradun")
                            .isActive(true)
                            .build(),

                    // 6. Dehradun Foothills / Dakpatti (near Orchard Cafe)
                    DeliveryPartner.builder()
                            .name("Manoj Joshi")
                            .phone("+91 9811100006")
                            .vehicleType("Bajaj Pulsar NS200 (Motorcycle)")
                            .status(DriverStatus.AVAILABLE)
                            .currentLatitude(new BigDecimal("30.3800000"))
                            .currentLongitude(new BigDecimal("78.0880000"))
                            .city("Dehradun")
                            .isActive(true)
                            .build()
            );

            deliveryPartnerRepository.saveAll(drivers);
            log.info("Saved 6 delivery partners to database.");
        }

        // Index all active drivers into Redis Geospatial key "drivers:geo"
        List<DeliveryPartner> allDrivers = deliveryPartnerRepository.findByIsActiveTrue();
        for (DeliveryPartner d : allDrivers) {
            if (d.getCurrentLatitude() != null && d.getCurrentLongitude() != null) {
                // Redis Geo Point: (x = longitude, y = latitude)
                redisTemplate.opsForGeo().add(
                        "drivers:geo",
                        new Point(d.getCurrentLongitude().doubleValue(), d.getCurrentLatitude().doubleValue()),
                        String.valueOf(d.getId())
                );
            }
        }
        log.info("Indexed {} delivery partners into Redis Geospatial key [drivers:geo].", allDrivers.size());
    }
}