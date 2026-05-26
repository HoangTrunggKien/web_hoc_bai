-- GeoConnect 6 — Postgres schema
-- Idempotent: safe to run multiple times during development.

CREATE TABLE IF NOT EXISTS users (
  username                    text PRIMARY KEY,
  full_name                   text NOT NULL,
  role                        text NOT NULL CHECK (role IN ('admin','teacher','parent','student')),
  password_hash               text NOT NULL,
  contact                     text,
  phone                       text,
  student_code                text UNIQUE,
  selected_student_username   text REFERENCES users(username) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role    ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_contact ON users(lower(contact));

CREATE TABLE IF NOT EXISTS classes (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  code        text UNIQUE NOT NULL,
  teacher     text NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher);

CREATE TABLE IF NOT EXISTS enrollments (
  id            bigserial PRIMARY KEY,
  class_id      bigint NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student       text   NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student);

CREATE TABLE IF NOT EXISTS assignments (
  id            bigserial PRIMARY KEY,
  class_id      bigint NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  type          text,
  due_at        timestamptz,
  questions     jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments   jsonb NOT NULL DEFAULT '[]'::jsonb,
  assignment_url text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);

CREATE TABLE IF NOT EXISTS submissions (
  id              bigserial PRIMARY KEY,
  assignment_id   bigint NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student         text   NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  answers         jsonb,
  submission_file jsonb,
  score           numeric(5,2),
  feedback        text,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  graded_at       timestamptz,
  UNIQUE(assignment_id, student)
);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student);

CREATE TABLE IF NOT EXISTS lessons (
  id          bigserial PRIMARY KEY,
  class_id    bigint REFERENCES classes(id) ON DELETE CASCADE,
  title       text NOT NULL,
  chapter     int,
  description text,
  content     text,
  resources   jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration    int,
  lesson_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lessons_class   ON lessons(class_id);
CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON lessons(chapter);

CREATE TABLE IF NOT EXISTS class_posts (
  id           bigserial PRIMARY KEY,
  class_id     bigint NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  files        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by   text REFERENCES users(username) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_posts_class ON class_posts(class_id);

CREATE TABLE IF NOT EXISTS notifications (
  id           bigserial PRIMARY KEY,
  recipient    text NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  sender       text REFERENCES users(username) ON DELETE SET NULL,
  sender_name  text,
  title        text NOT NULL,
  message      text,
  type         text,
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient, is_read);

CREATE TABLE IF NOT EXISTS parent_students (
  parent      text NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  student     text NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent, student)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  action      text NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
