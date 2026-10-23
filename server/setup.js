import { randomUUID } from "node:crypto";
import { openDatabase, transaction, audit } from "./db.js";
import { email, hashPassword } from "./security.js";
const address = email(process.env.ADMIN_EMAIL);
const encoded = await hashPassword(process.env.ADMIN_INITIAL_PASSWORD);
const db = openDatabase(process.env.DATABASE_PATH || "./var/notify.sqlite");
try {
  transaction(db, () => {
    const existing = db.prepare("SELECT * FROM users WHERE role='ADMIN'").get();
    if (process.argv.includes("--recover")) {
      if (!existing || existing.email !== address)
        throw new Error(
          "The configured administrator does not match the existing account.",
        );
      db.prepare(
        "UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?",
      ).run(encoded, existing.id);
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(existing.id);
      db.prepare("DELETE FROM auth_tokens WHERE user_id=?").run(existing.id);
      audit(db, existing.id, "ADMIN_OPERATOR_RECOVERY", existing.id);
    } else {
      if (existing)
        throw new Error(
          "An administrator already exists. Setup does not overwrite accounts.",
        );
      const id = randomUUID();
      db.prepare(
        "INSERT INTO users(id,email,name,role,status,password_hash,must_change_password,created_at) VALUES(?,?,'University administrator','ADMIN','APPROVED',?,1,?)",
      ).run(id, address, encoded, Date.now());
      audit(db, id, "ADMIN_PROVISIONED", id);
    }
  });
  console.log(
    "Administrator provisioned. A password change is required at first sign-in. Remove the initial password from the environment.",
  );
} finally {
  db.close();
}
