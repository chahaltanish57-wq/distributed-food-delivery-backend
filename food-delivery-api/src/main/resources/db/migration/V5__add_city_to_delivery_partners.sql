-- =============================================================================
-- V5__add_city_to_delivery_partners.sql: Add city column for multi-city dispatch
-- =============================================================================

ALTER TABLE delivery_partners 
ADD COLUMN IF NOT EXISTS city VARCHAR(50) DEFAULT 'Noida';
