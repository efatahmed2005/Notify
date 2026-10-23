import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
export function openDatabase(filename) {
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  if (!db.prepare("SELECT 1 FROM schema_migrations WHERE version=1").get()) {
    transaction(db, () => {
      db.exec(
        readFileSync(
          new URL("./migrations/001_initial.sql", import.meta.url),
          "utf8",
        ),
      );
      db.prepare("INSERT INTO schema_migrations VALUES(1,?)").run(Date.now());
    });
  }
  return db;
}
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function audit(db, actor, action, target, details = {}) {
  db.prepare(
    "INSERT INTO audit_logs(actor_id,action,target_id,details,created_at) VALUES(?,?,?,?,?)",
  ).run(
    actor || null,
    action,
    target || null,
    JSON.stringify(details),
    Date.now(),
  );
}
