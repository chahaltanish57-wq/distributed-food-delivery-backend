package com.fooddelivery.config;

import com.fooddelivery.entity.Customer;
import com.fooddelivery.entity.MenuItem;
import com.fooddelivery.entity.Restaurant;
import com.fooddelivery.repository.CustomerRepository;
import com.fooddelivery.repository.MenuItemRepository;
import com.fooddelivery.repository.RestaurantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;
    private final CustomerRepository customerRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        seedCustomer();
        seedRestaurants();
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
                .address("Apartment 4B, Indiranagar, Bangalore")
                .role("ROLE_CUSTOMER")
                .build();
        customerRepository.save(demoCustomer);
        log.info("Demo customer seeded successfully!");
    }

    private void seedRestaurants() {
        if (restaurantRepository.count() > 0) {
            log.info("Database already seeded with restaurants. Skipping seeder.");
            return;
        }

        log.info("Seeding database with initial restaurants and menu items...");

        // 1. Pizza Paradiso
        Restaurant r1 = Restaurant.builder()
                .name("Pizza Paradiso")
                .description("Artisanal wood-fired sourdough pizzas, fresh burrata, and authentic Italian pasta.")
                .address("104 Indiranagar 100ft Road, Bangalore")
                .latitude(new BigDecimal("12.9783692"))
                .longitude(new BigDecimal("77.6408356"))
                .rating(new BigDecimal("4.7"))
                .cuisineType("Italian, Pizzas, Pasta")
                .deliveryTimeMins(25)
                .imageUrl("https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80")
                .build();
        Restaurant savedR1 = restaurantRepository.save(r1);

        menuItemRepository.saveAll(List.of(
                MenuItem.builder().restaurant(savedR1).name("Margherita Basilico").description("San Marzano tomato sauce, fresh buffalo mozzarella, fresh basil, extra virgin olive oil.").price(new BigDecimal("12.99")).category("Pizzas").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(savedR1).name("Spicy Pepperoni & Hot Honey").description("Classic pepperoni slices, mozzarella, smoked chili flakes with a drizzle of organic hot honey.").price(new BigDecimal("15.99")).category("Pizzas").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(savedR1).name("Truffle Wild Mushroom Pasta").description("Fettuccine in creamy truffle cream sauce, sautéed portobello, and grated aged parmesan.").price(new BigDecimal("14.49")).category("Pastas").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1621996346565-e3d5d628169e?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(savedR1).name("Classic Tiramisu").description("Espresso-soaked ladyfingers layered with whipped mascarpone and Valrhona cocoa.").price(new BigDecimal("6.50")).category("Desserts").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=500&q=80").build()
        ));

        // 2. Biryani Junction
        Restaurant r2 = Restaurant.builder()
                .name("Biryani Junction & Royal Kebabs")
                .description("Slow-cooked Hyderabadi Dum Biryani made with long-grain basmati and secret spices.")
                .address("42 Koramangala 5th Block, Bangalore")
                .latitude(new BigDecimal("12.9351929"))
                .longitude(new BigDecimal("77.6244807"))
                .rating(new BigDecimal("4.8"))
                .cuisineType("Biryani, Mughlai, North Indian")
                .deliveryTimeMins(35)
                .imageUrl("https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80")
                .build();
        Restaurant savedR2 = restaurantRepository.save(r2);

        menuItemRepository.saveAll(List.of(
                MenuItem.builder().restaurant(savedR2).name("Royal Chicken Dum Biryani").description("Served with rich Mirchi ka Salan and cucumber raita.").price(new BigDecimal("14.99")).category("Biryani").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(savedR2).name("Paneer Tikka Dum Biryani").description("Charcoal-grilled cottage cheese cubes simmered in aromatic saffron rice.").price(new BigDecimal("12.49")).category("Biryani").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(savedR2).name("Mutton Galouti Kebab (4 pcs)").description("Melt-in-your-mouth spiced minced lamb patties with mint chutney.").price(new BigDecimal("15.99")).category("Starters").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(savedR2).name("Warm Shahi Gulab Jamun (2 pcs)").description("Deep-fried milk dumplings soaked in cardamom saffron syrup.").price(new BigDecimal("4.49")).category("Desserts").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=80").build()
        ));

        // 3. Burger Craft & Shakes
        Restaurant r3 = Restaurant.builder()
                .name("Burger Craft & Shakes")
                .description("Handcrafted smash burgers, brioche buns, crinkle cut fries, and thick shakes.")
                .address("88 Church Street, Central Bangalore")
                .latitude(new BigDecimal("12.9749969"))
                .longitude(new BigDecimal("77.6083072"))
                .rating(new BigDecimal("4.6"))
                .cuisineType("Burgers, American, Fast Food")
                .deliveryTimeMins(20)
                .imageUrl("https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80")
                .build();
        Restaurant savedR3 = restaurantRepository.save(r3);

        menuItemRepository.saveAll(List.of(
                MenuItem.builder().restaurant(savedR3).name("Signature Double Smash Burger").description("Two prime beef patties, double aged cheddar, caramelized onions, house burger sauce on toasted brioche.").price(new BigDecimal("11.99")).category("Burgers").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(savedR3).name("Spicy Buttermilk Crispy Chicken").description("Crispy fried chicken breast, pickled jalapeños, slaw, sriracha mayo.").price(new BigDecimal("10.99")).category("Burgers").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(savedR3).name("Truffle Parmesan Fries").description("Crispy crinkle fries tossed in black truffle oil, rosemary, and shaved parmesan.").price(new BigDecimal("5.49")).category("Sides").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(savedR3).name("Salted Caramel Pretzel Shake").description("Vanilla bean ice cream blended with salted caramel, topped with whipped cream and crushed pretzels.").price(new BigDecimal("6.29")).category("Beverages").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=500&q=80").build()
        ));

        // 4. Green Bowl & Smoothies
        Restaurant r4 = Restaurant.builder()
                .name("Green Bowl & Organic Kitchen")
                .description("Wholesome grain bowls, organic salads, cold-pressed juices, and healthy superfoods.")
                .address("21 HSR Layout Sector 4, Bangalore")
                .latitude(new BigDecimal("12.9116225"))
                .longitude(new BigDecimal("77.6473789"))
                .rating(new BigDecimal("4.9"))
                .cuisineType("Healthy, Salads, Smoothies, Vegan")
                .deliveryTimeMins(18)
                .imageUrl("https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80")
                .build();
        Restaurant savedR4 = restaurantRepository.save(r4);

        menuItemRepository.saveAll(List.of(
                MenuItem.builder().restaurant(savedR4).name("Mediterranean Falafel Bowl").description("Crispy herb falafels, roasted garlic hummus, quinoa, kalamata olives, cucumber salad, tahini dressing.").price(new BigDecimal("11.49")).category("Bowls").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(savedR4).name("Grilled Teriyaki Chicken Salad").description("Organic mixed greens, edamame, shredded carrots, grilled chicken breast, sesame ginger glaze.").price(new BigDecimal("12.99")).category("Bowls").isVegetarian(false).imageUrl("https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80").build(),
                MenuItem.builder().restaurant(savedR4).name("Acai Berry Superfood Smoothie").description("Organic acai, blueberries, banana, chia seeds, almond milk.").price(new BigDecimal("6.99")).category("Beverages").isVegetarian(true).imageUrl("https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=500&q=80").build()
        ));

        log.info("Seeding complete! 4 restaurants and 15 menu items added successfully.");
    }
}