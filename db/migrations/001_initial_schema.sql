-- Ireme AI initial PostgreSQL schema.
-- Apply to a new database only after reviewing it for your deployment.
-- Authentication and API routes are intentionally not enabled by this schema alone.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_role AS ENUM ('student', 'teacher', 'school_admin', 'platform_admin');
CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE resource_language AS ENUM ('en', 'rw');
CREATE TYPE submission_status AS ENUM ('draft', 'submitted', 'reviewed');

CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school_code TEXT UNIQUE,
  district TEXT,
  province TEXT,
  country_code CHAR(2) NOT NULL DEFAULT 'RW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role account_role NOT NULL DEFAULT 'student',
  status account_status NOT NULL DEFAULT 'pending',
  preferred_language resource_language NOT NULL DEFAULT 'en',
  grade_level TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (length(trim(full_name)) BETWEEN 2 AND 160),
  CHECK (email = lower(trim(email)))
);

CREATE INDEX users_school_role_idx ON users(school_id, role);
CREATE INDEX users_status_idx ON users(status);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  academic_year SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, name, academic_year)
);

CREATE TABLE class_memberships (
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_role account_role NOT NULL CHECK (membership_role IN ('student', 'teacher')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_rw TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE learning_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('lesson', 'video', 'document', 'practice', 'link')),
  language resource_language NOT NULL DEFAULT 'en',
  grade_level TEXT,
  source_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX learning_resources_browse_idx
  ON learning_resources(is_published, language, grade_level, subject_id);

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_text TEXT,
  status submission_status NOT NULL DEFAULT 'draft',
  score NUMERIC(6,2),
  feedback TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id),
  CHECK (score IS NULL OR score >= 0)
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT,
  language resource_language NOT NULL DEFAULT 'en',
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX conversations_user_recent_idx ON conversations(user_id, updated_at DESC);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL CHECK (length(content) <= 20000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX conversation_messages_order_idx ON conversation_messages(conversation_id, created_at);

CREATE TABLE learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  resource_id UUID REFERENCES learning_resources(id) ON DELETE SET NULL,
  progress_percent SMALLINT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_id)
);

CREATE INDEX learning_progress_user_activity_idx ON learning_progress(user_id, last_activity_at DESC);

-- Only approved, traceable material should be used later for curriculum-grounded AI answers.
CREATE TABLE curriculum_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  publisher TEXT NOT NULL,
  source_url TEXT,
  grade_level TEXT,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  language resource_language NOT NULL DEFAULT 'en',
  publication_date DATE,
  checksum_sha256 CHAR(64),
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'archived')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (approval_status <> 'approved' OR approved_at IS NOT NULL)
);

CREATE INDEX curriculum_sources_approved_idx
  ON curriculum_sources(approval_status, subject_id, grade_level, language);
