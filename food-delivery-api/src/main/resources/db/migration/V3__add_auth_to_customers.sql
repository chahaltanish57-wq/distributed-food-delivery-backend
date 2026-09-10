-- =============================================================================
-- V3__add_auth_to_customers.sql
-- =============================================================================
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'ROLE_CUSTOMER';