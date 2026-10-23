CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
CREATE TABLE departments (
 id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at INTEGER NOT NULL
);
CREATE TABLE users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('ADMIN','TEACHER','STUDENT')),
 status TEXT NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED','SUSPENDED','DEACTIVATED')),
 password_hash TEXT, must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1)),
 created_at INTEGER NOT NULL,
 CHECK((role='STUDENT' AND password_hash IS NULL) OR (role!='STUDENT' AND password_hash IS NOT NULL))
);
CREATE UNIQUE INDEX single_admin ON users(role) WHERE role='ADMIN';
CREATE TABLE teacher_profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id), teacher_id TEXT NOT NULL UNIQUE,
 institutional_info TEXT NOT NULL, decision_reason TEXT NOT NULL DEFAULT '', reviewed_by TEXT REFERENCES users(id), reviewed_at INTEGER
);
CREATE TRIGGER immutable_teacher_id BEFORE UPDATE OF teacher_id ON teacher_profiles
BEGIN SELECT RAISE(ABORT,'Teacher ID is immutable'); END;
CREATE TABLE student_identities (
 student_id TEXT PRIMARY KEY CHECK(length(student_id)=11 AND student_id NOT GLOB '*[^0-9]*'),
 user_id TEXT NOT NULL UNIQUE REFERENCES users(id), department_id TEXT NOT NULL REFERENCES departments(id)
);
CREATE TRIGGER valid_student_insert BEFORE INSERT ON student_identities
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND role='STUDENT' AND email=NEW.student_id || '@nwu.ac.bd')
BEGIN SELECT RAISE(ABORT,'Invalid student identity'); END;
CREATE TRIGGER immutable_student_identity BEFORE UPDATE OF student_id,user_id ON student_identities
BEGIN SELECT RAISE(ABORT,'Student identity is immutable'); END;
CREATE TABLE teacher_requests (
 user_id TEXT NOT NULL REFERENCES teacher_profiles(user_id), department_id TEXT NOT NULL REFERENCES departments(id),
 PRIMARY KEY(user_id,department_id)
);
CREATE TABLE teacher_departments (
 user_id TEXT NOT NULL REFERENCES teacher_profiles(user_id), department_id TEXT NOT NULL REFERENCES departments(id),
 PRIMARY KEY(user_id,department_id)
);
CREATE TRIGGER approved_assignment BEFORE INSERT ON teacher_departments
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND role='TEACHER' AND status='APPROVED')
BEGIN SELECT RAISE(ABORT,'Teacher must be approved'); END;
CREATE TABLE department_heads (
 department_id TEXT PRIMARY KEY REFERENCES departments(id), user_id TEXT NOT NULL,
 assigned_by TEXT NOT NULL REFERENCES users(id), assigned_at INTEGER NOT NULL,
 FOREIGN KEY(user_id,department_id) REFERENCES teacher_departments(user_id,department_id) ON DELETE CASCADE
);
CREATE TRIGGER revoke_inactive_teacher AFTER UPDATE OF status ON users WHEN NEW.status!='APPROVED'
BEGIN DELETE FROM department_heads WHERE user_id=NEW.id; DELETE FROM teacher_departments WHERE user_id=NEW.id; END;
CREATE TRIGGER immutable_user_identity BEFORE UPDATE OF id,email,role ON users
BEGIN SELECT RAISE(ABORT,'Account identity is immutable'); END;
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf_token TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 verified INTEGER NOT NULL CHECK(verified IN (0,1))
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE auth_tokens (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('RESET','STUDENT_VERIFY')), expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX tokens_user ON auth_tokens(user_id,purpose);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL);
CREATE TABLE notices (
 id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id), department_id TEXT REFERENCES departments(id),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120), content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 5000),
 category TEXT NOT NULL CHECK(category IN ('ANNOUNCEMENT','EXAM','EVENT','URGENT')),
 status TEXT NOT NULL CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED','DELETED')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, published_at INTEGER,
 version INTEGER NOT NULL DEFAULT 1,
 CHECK(status!='PUBLISHED' OR published_at IS NOT NULL)
);
CREATE INDEX notice_scope ON notices(department_id,status,created_at);
CREATE TRIGGER admin_broadcast BEFORE INSERT ON notices
WHEN NEW.department_id IS NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.author_id AND role='ADMIN')
BEGIN SELECT RAISE(ABORT,'Only administrators can broadcast'); END;
CREATE TRIGGER immutable_notice_scope BEFORE UPDATE OF author_id,department_id,created_at ON notices
BEGIN SELECT RAISE(ABORT,'Notice author and scope are immutable'); END;
CREATE TABLE attachments (
 notice_id TEXT PRIMARY KEY REFERENCES notices(id), name TEXT NOT NULL, mime_type TEXT NOT NULL,
 size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 26214400), data BLOB NOT NULL
);
CREATE TABLE notice_revisions (
 id INTEGER PRIMARY KEY, notice_id TEXT NOT NULL REFERENCES notices(id), actor_id TEXT NOT NULL REFERENCES users(id),
 version INTEGER NOT NULL, snapshot TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(notice_id,version)
);
CREATE TABLE audit_logs (
 id INTEGER PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL,
 target_id TEXT, details TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
);
CREATE INDEX audit_time ON audit_logs(created_at);
