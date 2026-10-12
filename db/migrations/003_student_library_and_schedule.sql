-- Ireme AI persistent student library and study sessions.
-- Apply after 001_initial_schema.sql and 002_learning_persistence_indexes.sql.

CREATE TABLE IF NOT EXISTS user_saved_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_key TEXT NOT NULL CHECK (length(resource_key) BETWEEN 1 AND 80),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 180),
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 120),
  resource_type TEXT NOT NULL CHECK (length(resource_type) BETWEEN 1 AND 80),
  duration TEXT NOT NULL CHECK (length(duration) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_key)
);

CREATE INDEX IF NOT EXISTS user_saved_resources_recent_idx
  ON user_saved_resources(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 160),
  scheduled_for TIMESTAMPTZ,
  duration_minutes SMALLINT NOT NULL DEFAULT 45 CHECK (duration_minutes BETWEEN 5 AND 360),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_study_sessions_schedule_idx
  ON user_study_sessions(user_id, scheduled_for NULLS LAST, created_at);
