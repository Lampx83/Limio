import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "feedbackme.db");

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

function createDb(): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

export const db: Database.Database = global.__db ?? createDb();
if (process.env.NODE_ENV !== "production") global.__db = db;

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS institutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      contact_email TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student','instructor','institution_admin','system_admin')),
      institution_id INTEGER REFERENCES institutions(id) ON DELETE SET NULL,
      experiment_condition TEXT CHECK(experiment_condition IN ('control','personalized')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learning_styles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      active_reflective INTEGER NOT NULL,
      sensing_intuitive INTEGER NOT NULL,
      visual_verbal INTEGER NOT NULL,
      sequential_global INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      institution_id INTEGER REFERENCES institutions(id) ON DELETE SET NULL,
      owner_instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS course_enrollments (
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_in_course TEXT NOT NULL CHECK(role_in_course IN ('student','instructor','ta')),
      enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY(course_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS consent_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      consent_text_version TEXT NOT NULL,
      consented INTEGER NOT NULL DEFAULT 0,
      consented_at TEXT
    );

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      institution_id INTEGER REFERENCES institutions(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      template TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      order_idx INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      learning_objectives TEXT NOT NULL,
      rubric TEXT NOT NULL,
      min_words INTEGER NOT NULL DEFAULT 80,
      order_idx INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      time_spent_sec INTEGER NOT NULL DEFAULT 0,
      edit_count INTEGER NOT NULL DEFAULT 0,
      paste_count INTEGER NOT NULL DEFAULT 0,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
      condition TEXT NOT NULL CHECK(condition IN ('control','personalized')),
      raw_response TEXT NOT NULL,
      feed_up TEXT,
      feed_back_task TEXT,
      feed_back_process TEXT,
      feed_back_self_reg TEXT,
      feed_forward TEXT,
      metacog_prompt TEXT,
      score INTEGER,
      reviewed_by INTEGER REFERENCES users(id),
      instructor_notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','approved','revised')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS behavioral_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS srl_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      phase TEXT NOT NULL CHECK(phase IN ('pre','post')),
      responses TEXT NOT NULL,
      score_total REAL,
      score_forethought REAL,
      score_performance REAL,
      score_reflection REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, phase)
    );

    CREATE TABLE IF NOT EXISTS learning_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('video','pdf','quiz','slides','file','link','poll','discussion')),
      title TEXT NOT NULL,
      description TEXT,
      video_url TEXT,            -- YouTube embed URL
      pdf_url TEXT,              -- External PDF URL
      reading_text TEXT,         -- Plain text content
      quiz_data TEXT,            -- JSON [{q, options[], correct_idx, explanation}]
      external_url TEXT,         -- Cho slides (iframe), file (download), link (external)
      duration_min INTEGER,
      order_idx INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discussion_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL REFERENCES learning_materials(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES discussion_posts(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS peer_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT,
      score INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','submitted')),
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      submitted_at TEXT,
      UNIQUE(submission_id, reviewer_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      payload TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_announcements_course ON announcements(course_id);
    CREATE INDEX IF NOT EXISTS idx_disc_material ON discussion_posts(material_id);
    CREATE INDEX IF NOT EXISTS idx_peer_submission ON peer_reviews(submission_id);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);

    CREATE TABLE IF NOT EXISTS material_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      material_id INTEGER NOT NULL REFERENCES learning_materials(id) ON DELETE CASCADE,
      data TEXT,                 -- JSON: quiz answers, watch %, reflection text
      score INTEGER,             -- cho quiz: 0-100
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, material_id)
    );

    CREATE TABLE IF NOT EXISTS material_feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interaction_id INTEGER NOT NULL UNIQUE REFERENCES material_interactions(id) ON DELETE CASCADE,
      condition TEXT NOT NULL CHECK(condition IN ('control','personalized')),
      raw_response TEXT NOT NULL,
      summary TEXT,
      strengths TEXT,
      gaps TEXT,
      next_steps TEXT,
      metacog_prompt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_materials_module ON learning_materials(module_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_user ON material_interactions(user_id);

    CREATE TABLE IF NOT EXISTS learning_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      target_date TEXT,
      strategy TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','abandoned')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_goals_user ON learning_goals(user_id);
    CREATE INDEX IF NOT EXISTS idx_reflections_user ON reflections(user_id);

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS impersonations (
      session_token TEXT PRIMARY KEY REFERENCES sessions(token) ON DELETE CASCADE,
      original_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_logs_user ON behavioral_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_logs_assignment ON behavioral_logs(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
  `);
}

export type UserRole =
  | "student"
  | "instructor"
  | "institution_admin"
  | "system_admin";
export type ExperimentCondition = "control" | "personalized";

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  institution_id: number | null;
  experiment_condition: ExperimentCondition | null;
  created_at: string;
}

export interface InstitutionRow {
  id: number;
  code: string;
  name: string;
  address: string | null;
  contact_email: string | null;
  created_at: string;
}
