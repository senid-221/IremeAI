-- Ireme AI assessment engine: teacher-authored quizzes and automatically graded multiple-choice attempts.
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 180),
  instructions TEXT NOT NULL DEFAULT '',
  grade_level TEXT,
  language resource_language NOT NULL DEFAULT 'en',
  duration_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 1 AND 360),
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assessments_browse_idx ON assessments(is_published, grade_level, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS assessments_author_idx ON assessments(created_by, updated_at DESC);

CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL CHECK (question_order BETWEEN 1 AND 200),
  prompt TEXT NOT NULL CHECK (length(trim(prompt)) BETWEEN 3 AND 3000),
  options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 8),
  correct_option SMALLINT NOT NULL CHECK (correct_option BETWEEN 0 AND 7),
  explanation TEXT NOT NULL DEFAULT '',
  points NUMERIC(6,2) NOT NULL DEFAULT 1 CHECK (points > 0 AND points <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, question_order)
);
CREATE INDEX IF NOT EXISTS assessment_questions_order_idx ON assessment_questions(assessment_id, question_order);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score NUMERIC(8,2),
  max_score NUMERIC(8,2),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assessment_attempts_student_idx ON assessment_attempts(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS assessment_attempts_assessment_idx ON assessment_attempts(assessment_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS assessment_answers (
  id BIGSERIAL PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  selected_option SMALLINT CHECK (selected_option BETWEEN 0 AND 7),
  is_correct BOOLEAN NOT NULL,
  points_awarded NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  UNIQUE (attempt_id, question_id)
);
