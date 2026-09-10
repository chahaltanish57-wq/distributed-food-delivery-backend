-- =============================================================================
-- V4__add_city_to_restaurants.sql
-- =============================================================================
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS city VARCHAR(50) DEFAULT 'Noida';
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);