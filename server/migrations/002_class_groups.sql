CREATE TABLE class_groups (
 id TEXT PRIMARY KEY, department_id TEXT NOT NULL REFERENCES departments(id),
 batch TEXT NOT NULL, class_name TEXT NOT NULL, section TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 UNIQUE(department_id,batch,class_name,section)
);
CREATE TABLE group_memberships (
 group_id TEXT NOT NULL REFERENCES class_groups(id), user_id TEXT NOT NULL REFERENCES student_identities(user_id), joined_at INTEGER NOT NULL,
 PRIMARY KEY(group_id,user_id)
);
CREATE TRIGGER valid_group_member BEFORE INSERT ON group_memberships
WHEN NOT EXISTS(SELECT 1 FROM class_groups g JOIN student_identities s ON s.department_id=g.department_id JOIN users u ON u.id=s.user_id JOIN departments d ON d.id=g.department_id WHERE g.id=NEW.group_id AND s.user_id=NEW.user_id AND g.active=1 AND d.active=1 AND u.status='APPROVED')
BEGIN SELECT RAISE(ABORT,'Invalid class membership'); END;
CREATE TRIGGER remove_transferred_memberships AFTER UPDATE OF department_id ON student_identities
BEGIN DELETE FROM group_memberships WHERE user_id=NEW.user_id; END;
CREATE TRIGGER immutable_group_department BEFORE UPDATE OF department_id ON class_groups
BEGIN SELECT RAISE(ABORT,'Group department is immutable'); END;
ALTER TABLE notices ADD COLUMN group_id TEXT REFERENCES class_groups(id);
CREATE INDEX notice_group ON notices(group_id,status);
CREATE INDEX membership_user ON group_memberships(user_id);
CREATE TRIGGER valid_notice_group BEFORE INSERT ON notices WHEN NEW.group_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM class_groups WHERE id=NEW.group_id AND department_id=NEW.department_id AND active=1)
BEGIN SELECT RAISE(ABORT,'Invalid notice class'); END;
CREATE TRIGGER immutable_notice_group BEFORE UPDATE OF group_id ON notices
BEGIN SELECT RAISE(ABORT,'Notice class is immutable'); END;
CREATE TABLE document_previews (
 notice_id TEXT PRIMARY KEY REFERENCES attachments(notice_id) ON DELETE CASCADE,
 source_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('PENDING','PROCESSING','READY','FAILED')),
 pdf BLOB, extracted_text TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL
);
CREATE TABLE document_pages (
 notice_id TEXT NOT NULL REFERENCES document_previews(notice_id) ON DELETE CASCADE,
 page INTEGER NOT NULL, image BLOB NOT NULL, PRIMARY KEY(notice_id,page)
);
