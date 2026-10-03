-- Migration 0003: Additional audit and stats views

-- Composite index for daily stats query
CREATE INDEX IF NOT EXISTS idx_audit_date_type ON audit_events(DATE(created_at), event_type);

-- Index for stuck job detection
CREATE INDEX IF NOT EXISTS idx_jobs_status_started ON jobs(status, started_at);

-- Index for user email lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
