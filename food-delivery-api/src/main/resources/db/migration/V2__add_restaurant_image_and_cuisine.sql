-- =============================================================================
-- V2__add_restaurant_image_and_cuisine.sql
-- =============================================================================
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS cuisine_type VARCHAR(100) DEFAULT 'Multi-Cuisine',
ADD COLUMN IF NOT EXISTS delivery_time_mins INT DEFAULT 30;