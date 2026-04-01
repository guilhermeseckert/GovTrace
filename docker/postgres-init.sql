-- Enable pg_trgm extension for fuzzy entity name matching (INFRA-02)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify extension is active
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';
