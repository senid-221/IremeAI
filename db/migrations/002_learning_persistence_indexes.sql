-- Ireme AI persistence support indexes.
-- Apply after 001_initial_schema.sql.

-- PostgreSQL UNIQUE constraints allow multiple NULL values. This partial unique index
-- makes subject-level progress safely upsertable while resource progress keeps its
-- existing UNIQUE(user_id, resource_id) constraint.
CREATE UNIQUE INDEX IF NOT EXISTS learning_progress_user_subject_unique
  ON learning_progress(user_id, subject_id)
  WHERE subject_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversation_messages_recent_idx
  ON conversation_messages(conversation_id, created_at DESC);
