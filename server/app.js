import express from "express";
import { queueDocument } from "./documents.js";
import { groupRoutes, groupLabel } from "./groups.js";
import helmet from "helmet";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { transaction, audit } from "./db.js";
import {
  randomToken,
  tokenHash,
  safeEqual,
  fail,
  fields,
  text,
  email,
  studentIdentity,
  hashPassword,
  checkPassword,
  throttle,
} from "./security.js";
import {
  identity,
  requireApproved,
  assigned,
  canRead,
  canManage,
  isHead,
} from "./permissions.js";

export async function createApp({
  db,
  origin,
  secret,
  production = false,
  provisional = false,
  sendMail = null,
}) {
  if (!secret || secret.length < 32)
    throw new Error("RATE_LIMIT_SECRET must contain at least 32 characters.");
  if (production && (new URL(origin).protocol !== "https:" || provisional))
    throw new Error("Production requires HTTPS and verified student login.");
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    const reqOrigin = req.get("Origin");
    const reqHost = req.get("Host");
    const isAllowed =
      Boolean(reqOrigin) &&
      (reqOrigin === origin ||
        (reqHost && (reqOrigin === `http://${reqHost}` || reqOrigin === `https://${reqHost}`)) ||
        (!production &&
          (reqOrigin === "null" ||
            /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(reqOrigin) ||
            /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(reqOrigin) ||
            /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(reqOrigin) ||
            /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+(:\d+)?$/.test(reqOrigin))));
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !isAllowed)
      return res.status(403).json({ error: "Request origin is not allowed." });
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  const dummyHash = await hashPassword(randomToken());
  const cookieName = production ? "__Host-notify_session" : "notify_session";
  const cookieOptions = {
    httpOnly: true,
    secure: production,
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };
  function limit(req, scope, max = 20, account) {
    throttle(db, secret, scope, req.ip, max);
    if (account)
      throttle(
        db,
        secret,
        `${scope}:account`,
        String(account).trim().toLowerCase(),
        Math.max(5, Math.floor(max / 2)),
      );
  }
  function cleanExpired() {
    db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
    db.prepare("DELETE FROM auth_tokens WHERE expires_at<?").run(Date.now());
  }
  function session(req, res, user, verified = true) {
    cleanExpired();
    const token = randomToken(),
      csrf = randomToken(),
      now = Date.now();
    db.prepare("INSERT INTO sessions VALUES(?,?,?,?,?,?)").run(
      tokenHash(token),
      user.id,
      csrf,
      now,
      now + cookieOptions.maxAge,
      verified ? 1 : 0,
    );
    res.cookie(cookieName, token, cookieOptions);
    return {
      user: identity(db, user),
      csrfToken: csrf,
      provisional: !verified,
    };
  }
  function authenticate(req, res, next) {
    const token = (req.get("Cookie") || "")
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    if (!token || token.length > 128)
      return res.status(401).json({ error: "Sign in to continue." });
    const found = db
      .prepare("SELECT * FROM sessions WHERE token_hash=? AND expires_at>?")
      .get(tokenHash(token), Date.now());
    const user =
      found && db.prepare("SELECT * FROM users WHERE id=?").get(found.user_id);
    if (!user || ["SUSPENDED", "DEACTIVATED"].includes(user.status))
      return res.status(401).json({ error: "Sign in to continue." });
    req.user = user;
    req.session = found;
    if (
      !["GET", "HEAD"].includes(req.method) &&
      !safeEqual(req.get("X-CSRF-Token"), found.csrf_token)
    )
      return res
        .status(403)
        .json({ error: "Invalid request token. Refresh and try again." });
    next();
  }
  const approved = (req, res, next) => {
    requireApproved(req.user);
    next();
  };
  const admin = (req, res, next) => {
    requireApproved(req.user);
    if (req.user.role !== "ADMIN")
      fail(403, "Administrator access is required.");
    next();
  };
  const revoke = (id) =>
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
  function departmentIds(value, allowEmpty = false) {
    if (
      !Array.isArray(value) ||
      value.length > 30 ||
      (!allowEmpty && !value.length) ||
      new Set(value).size !== value.length ||
      value.some((v) => typeof v !== "string")
    )
      fail(400, "Choose valid, distinct departments.");
    for (const id of value)
      if (
        !db.prepare("SELECT 1 FROM departments WHERE id=? AND active=1").get(id)
      )
        fail(400, "A selected department is unavailable.");
    return value;
  }
  async function deliverToken(user, purpose) {
    if (!sendMail) return;
    const token = randomToken(),
      now = Date.now();
    transaction(db, () => {
      db.prepare("DELETE FROM auth_tokens WHERE user_id=? AND purpose=?").run(
        user.id,
        purpose,
      );
      db.prepare("INSERT INTO auth_tokens VALUES(?,?,?,?,?)").run(
        tokenHash(token),
        user.id,
        purpose,
        now + 15 * 60 * 1000,
        now,
      );
    });
    // Do not make account-recovery response time depend on SMTP delivery.
    Promise.resolve()
      .then(() =>
        sendMail({
          to: user.email,
          subject:
            purpose === "RESET"
              ? "Reset your Notify password"
              : "Sign in to Notify",
          text: `Open this link within 15 minutes: ${origin}/#${purpose === "RESET" ? "reset" : "verify"}=${token}\n\nIf you did not request this, ignore this message.`,
        }),
      )
      .catch(() => {
        try {
          db.prepare("DELETE FROM auth_tokens WHERE token_hash=?").run(
            tokenHash(token),
          );
        } catch {
          /* Server may be shutting down. */
        }
      });
  }
  app.get("/api/config", (req, res) =>
    res.json({
      provisionalStudents: provisional,
      emailVerification: !!sendMail,
    }),
  );
  app.get("/api/departments/public", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,code,name FROM departments WHERE active=1 ORDER BY code",
        )
        .all(),
    ),
  );
  app.post("/api/auth/login", async (req, res) => {
    fields(req.body, ["email", "password"]);
    limit(req, "login", 20, req.body.email);
    const address = email(req.body.email);
    let user = db
      .prepare(
        "SELECT * FROM users WHERE email=? AND role IN ('ADMIN','TEACHER')",
      )
      .get(address);
    const originalHash = user?.password_hash;
    const valid = await checkPassword(
      user?.password_hash || dummyHash,
      req.body.password,
    );
    user = user && db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
    if (
      !user ||
      !valid ||
      user.password_hash !== originalHash ||
      ["SUSPENDED", "DEACTIVATED"].includes(user.status)
    )
      fail(401, "Unable to sign in with these credentials.");
    audit(db, user.id, "LOGIN", user.id);
    res.json(session(req, res, user));
  });
  app.post("/api/auth/register", async (req, res) => {
    fields(req.body, [
      "name",
      "email",
      "password",
      "requestedDepartmentIds",
      "institutionalInfo",
    ]);
    limit(req, "register", 8);
    const address = email(req.body.email),
      name = text(req.body.name, "Full name", 2, 100),
      info = text(
        req.body.institutionalInfo,
        "Institutional information",
        5,
        1000,
      );
    if (/^\d+@/.test(address))
      fail(400, "Use your faculty email address for teacher registration.");
    const requested = departmentIds(req.body.requestedDepartmentIds),
      encoded = await hashPassword(req.body.password);
    if (db.prepare("SELECT 1 FROM users WHERE email=?").get(address))
      fail(
        409,
        "Registration could not be completed. If you already registered, sign in or use account recovery.",
      );
    const id = randomUUID(),
      teacherId = `T-${randomUUID().toUpperCase()}`;
    transaction(db, () => {
      departmentIds(requested);
      db.prepare(
        "INSERT INTO users(id,email,name,role,status,password_hash,created_at) VALUES(?,?,?,'TEACHER','PENDING',?,?)",
      ).run(id, address, name, encoded, Date.now());
      db.prepare(
        "INSERT INTO teacher_profiles(user_id,teacher_id,institutional_info) VALUES(?,?,?)",
      ).run(id, teacherId, info);
      for (const dept of requested)
        db.prepare("INSERT INTO teacher_requests VALUES(?,?)").run(id, dept);
      audit(db, id, "TEACHER_REGISTERED", id, {
        requestedDepartmentIds: requested,
      });
    });
    res
      .status(201)
      .json(
        session(req, res, db.prepare("SELECT * FROM users WHERE id=?").get(id)),
      );
  });
  app.post("/api/auth/student", async (req, res) => {
    fields(req.body, [
      "identifier",
      "studentId",
      "email",
      "name",
      "departmentId",
    ]);
    const { id, address } = studentIdentity(req.body);
    limit(req, "student-login", 15, address);
    const registered = db
      .prepare("SELECT user_id FROM student_identities WHERE student_id=?")
      .get(id);
    if (
      (provisional || !sendMail) &&
      req.body.identifier !== undefined &&
      (req.body.name || req.body.departmentId)
    ) {
      if (
        registered ||
        db.prepare("SELECT 1 FROM users WHERE email=?").get(address)
      )
        fail(
          409,
          "This student identity is already registered. Sign in using only your ID or email.",
        );
      const name = text(req.body.name || `Student ${id}`, "Full name", 2, 100),
        department = text(req.body.departmentId, "Department", 1, 100);
      const deptRow = db
        .prepare(
          "SELECT id FROM departments WHERE (id=? OR code=? COLLATE NOCASE) AND active=1",
        )
        .get(department, department);
      if (!deptRow)
        fail(400, "Choose an active department.");
      transaction(db, () => {
        const userId = randomUUID();
        db.prepare(
          "INSERT INTO users(id,email,name,role,status,created_at) VALUES(?,?,?,'STUDENT','APPROVED',?)",
        ).run(userId, address, name, Date.now());
        db.prepare("INSERT INTO student_identities VALUES(?,?,?)").run(
          id,
          userId,
          deptRow.id,
        );
        audit(db, userId, "STUDENT_REGISTERED", userId, {
          departmentId: deptRow.id,
        });
      });
    }
    const user = db
      .prepare(
        "SELECT u.* FROM users u JOIN student_identities s ON s.user_id=u.id JOIN departments d ON d.id=s.department_id WHERE s.student_id=? AND u.email=? AND u.status='APPROVED' AND d.active=1",
      )
      .get(id, address);
    if (provisional || !sendMail) {
      if (!user)
        fail(
          401,
          "Unable to sign in. New students must enter their name and department. Existing students should contact the university if access is unavailable.",
        );
      audit(db, user.id, "PROVISIONAL_STUDENT_LOGIN", user.id);
      return res.json(session(req, res, user, false));
    }
    if (!sendMail)
      fail(
        503,
        "Student email verification is not configured. Contact the university.",
      );
    if (user) await deliverToken(user, "STUDENT_VERIFY");
    res.status(202).json({
      message:
        "If the details match the student directory, a sign-in link will be sent to your university email.",
    });
  });
  app.post("/api/auth/student/verify", (req, res) => {
    fields(req.body, ["token"]);
    limit(req, "student-verify", 15);
    const token = text(req.body.token, "Verification token", 32, 128);
    const found = db
      .prepare(
        "SELECT * FROM auth_tokens WHERE token_hash=? AND purpose='STUDENT_VERIFY' AND expires_at>?",
      )
      .get(tokenHash(token), Date.now());
    const user =
      found &&
      db
        .prepare(
          "SELECT * FROM users WHERE id=? AND role='STUDENT' AND status='APPROVED'",
        )
        .get(found.user_id);
    if (!user) fail(400, "The sign-in link is invalid or expired.");
    db.prepare("DELETE FROM auth_tokens WHERE token_hash=?").run(
      found.token_hash,
    );
    audit(db, user.id, "VERIFIED_STUDENT_LOGIN", user.id);
    res.json(session(req, res, user, true));
  });
  app.post("/api/auth/reset/request", async (req, res) => {
    fields(req.body, ["email"]);
    limit(req, "reset-request", 8, req.body.email);
    const address = email(req.body.email),
      user = db
        .prepare("SELECT * FROM users WHERE email=? AND role!='STUDENT'")
        .get(address);
    if (user) await deliverToken(user, "RESET");
    res.json({
      message:
        "If this account is eligible, recovery instructions will be sent to its university email. If no email arrives, contact the administrator.",
    });
  });
  app.post("/api/auth/reset/complete", async (req, res) => {
    fields(req.body, ["token", "password"]);
    limit(req, "reset-complete", 10);
    const key = tokenHash(text(req.body.token, "Recovery token", 32, 128));
    const encoded = await hashPassword(req.body.password);
    transaction(db, () => {
      const token = db
        .prepare(
          "SELECT * FROM auth_tokens WHERE token_hash=? AND purpose='RESET' AND expires_at>?",
        )
        .get(key, Date.now());
      if (!token) fail(400, "The recovery link is invalid or expired.");
      db.prepare(
        "UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?",
      ).run(encoded, token.user_id);
      db.prepare("DELETE FROM auth_tokens WHERE user_id=?").run(token.user_id);
      revoke(token.user_id);
      audit(db, token.user_id, "PASSWORD_RESET", token.user_id);
    });
    res.json({ message: "Password updated. Sign in again." });
  });
  app.get("/api/session", authenticate, (req, res) =>
    res.json({
      user: identity(db, req.user),
      csrfToken: req.session.csrf_token,
      provisional: !req.session.verified,
    }),
  );
  app.post("/api/auth/logout", authenticate, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
      req.session.token_hash,
    );
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
    res.json({ ok: true });
  });
  app.post("/api/account/password", authenticate, async (req, res) => {
    fields(req.body, ["currentPassword", "newPassword"]);
    limit(req, "change-password", 10, req.user.id);
    if (
      req.user.role === "STUDENT" ||
      !(await checkPassword(req.user.password_hash, req.body.currentPassword))
    )
      fail(400, "The current password could not be verified.");
    if (req.body.currentPassword === req.body.newPassword)
      fail(400, "Choose a different password.");
    const encoded = await hashPassword(req.body.newPassword);
    transaction(db, () => {
      if (
        !db
          .prepare("SELECT 1 FROM sessions WHERE token_hash=? AND expires_at>?")
          .get(req.session.token_hash, Date.now()) ||
        !db
          .prepare(
            "UPDATE users SET password_hash=?,must_change_password=0 WHERE id=? AND password_hash=?",
          )
          .run(encoded, req.user.id, req.user.password_hash).changes
      )
        fail(401, "Sign in again before changing your password.");
      revoke(req.user.id);
      db.prepare("DELETE FROM auth_tokens WHERE user_id=?").run(req.user.id);
      audit(db, req.user.id, "PASSWORD_CHANGED", req.user.id);
    });
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
    res.json({ message: "Password updated. Sign in again." });
  });
  app.patch("/api/account/profile", authenticate, (req, res) => {
    fields(req.body, ["name"]);
    const name = text(req.body.name, "Full name", 2, 100);
    db.prepare("UPDATE users SET name=? WHERE id=?").run(name, req.user.id);
    audit(db, req.user.id, "PROFILE_UPDATED", req.user.id);
    res.json({ ok: true });
  });

  app.use("/api/admin", authenticate, admin);
  app.get("/api/admin/departments", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT d.*,h.user_id AS headUserId,u.name AS headName FROM departments d LEFT JOIN department_heads h ON h.department_id=d.id LEFT JOIN users u ON u.id=h.user_id ORDER BY d.code",
        )
        .all(),
    ),
  );
  app.post("/api/admin/departments", (req, res) => {
    fields(req.body, ["code", "name"]);
    const code = text(req.body.code, "Code", 2, 12).toUpperCase(),
      name = text(req.body.name, "Department name", 2, 120);
    if (!/^[A-Z][A-Z0-9_-]+$/.test(code) || code === "ALL")
      fail(400, "Use a unique department code.");
    const id = randomUUID();
    transaction(db, () => {
      db.prepare(
        "INSERT INTO departments(id,code,name,created_at) VALUES(?,?,?,?)",
      ).run(id, code, name, Date.now());
      audit(db, req.user.id, "DEPARTMENT_CREATED", id, { code, name });
    });
    res.status(201).json({ id });
  });
  app.patch("/api/admin/departments/:id", (req, res) => {
    fields(req.body, ["name", "active"]);
    const name = text(req.body.name, "Department name", 2, 120);
    if (typeof req.body.active !== "boolean")
      fail(400, "Specify department availability.");
    transaction(db, () => {
      if (
        !db
          .prepare("UPDATE departments SET name=?,active=? WHERE id=?")
          .run(name, req.body.active ? 1 : 0, req.params.id).changes
      )
        fail(404, "Department not found.");
      if (!req.body.active)
        db.prepare("DELETE FROM department_heads WHERE department_id=?").run(
          req.params.id,
        );
      audit(db, req.user.id, "DEPARTMENT_UPDATED", req.params.id, {
        name,
        active: req.body.active,
      });
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/users", (req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM users ORDER BY created_at DESC")
        .all()
        .map((u) => ({
          ...identity(db, u),
          requestedDepartmentIds: db
            .prepare(
              "SELECT department_id FROM teacher_requests WHERE user_id=?",
            )
            .all(u.id)
            .map((d) => d.department_id),
          institutionalInfo: db
            .prepare(
              "SELECT institutional_info FROM teacher_profiles WHERE user_id=?",
            )
            .get(u.id)?.institutional_info,
        })),
    ),
  );
  app.patch("/api/admin/users/:id/status", (req, res) => {
    fields(req.body, ["status", "reason"]);
    const status = req.body.status,
      reason = req.body.reason ? text(req.body.reason, "Reason", 1, 1000) : "";
    if (!["APPROVED", "REJECTED", "SUSPENDED", "DEACTIVATED"].includes(status))
      fail(400, "Invalid account status.");
    const target = db
      .prepare("SELECT * FROM users WHERE id=? AND role!='ADMIN'")
      .get(req.params.id);
    if (!target) fail(404, "Account not found.");
    if (target.role === "STUDENT" && status === "REJECTED")
      fail(
        400,
        "Student accounts can be activated, suspended, or deactivated.",
      );
    if (status === "REJECTED" && !reason)
      fail(400, "Provide a reason and resubmission guidance.");
    transaction(db, () => {
      db.prepare("UPDATE users SET status=? WHERE id=?").run(status, target.id);
      db.prepare(
        "UPDATE teacher_profiles SET decision_reason=?,reviewed_by=?,reviewed_at=? WHERE user_id=?",
      ).run(reason, req.user.id, Date.now(), target.id);
      if (status === "APPROVED" && target.role === "TEACHER") {
        const existingAssignments = db
          .prepare("SELECT 1 FROM teacher_departments WHERE user_id=?")
          .get(target.id);
        if (!existingAssignments) {
          const reqDepts = db
            .prepare("SELECT department_id FROM teacher_requests WHERE user_id=?")
            .all(target.id);
          for (const r of reqDepts) {
            db.prepare("INSERT OR IGNORE INTO teacher_departments VALUES(?,?)").run(
              target.id,
              r.department_id,
            );
          }
        }
      }
      revoke(target.id);
      audit(db, req.user.id, "ACCOUNT_STATUS_CHANGED", target.id, {
        from: target.status,
        to: status,
        reason,
      });
    });
    res.json({ ok: true });
  });
  app.put("/api/admin/teachers/:id/departments", (req, res) => {
    fields(req.body, ["departmentIds"]);
    const ids = departmentIds(req.body.departmentIds, true);
    const target = db
      .prepare(
        "SELECT * FROM users WHERE id=? AND role='TEACHER' AND status='APPROVED'",
      )
      .get(req.params.id);
    if (!target) fail(400, "Choose an approved teacher.");
    transaction(db, () => {
      const current = db
        .prepare(
          "SELECT department_id FROM teacher_departments WHERE user_id=?",
        )
        .all(target.id)
        .map((d) => d.department_id);
      for (const id of current)
        if (!ids.includes(id))
          db.prepare(
            "DELETE FROM teacher_departments WHERE user_id=? AND department_id=?",
          ).run(target.id, id);
      for (const id of ids)
        if (!current.includes(id))
          db.prepare("INSERT INTO teacher_departments VALUES(?,?)").run(
            target.id,
            id,
          );
      audit(db, req.user.id, "TEACHER_DEPARTMENTS_CHANGED", target.id, {
        from: current,
        to: ids,
      });
    });
    res.json({ ok: true });
  });
  app.put("/api/admin/departments/:id/head", (req, res) => {
    fields(req.body, ["teacherUserId"]);
    const teacher = req.body.teacherUserId;
    if (teacher !== null && typeof teacher !== "string")
      fail(400, "Choose a teacher or remove the assignment.");
    if (
      !db
        .prepare("SELECT 1 FROM departments WHERE id=? AND active=1")
        .get(req.params.id)
    )
      fail(404, "Department not found.");
    if (
      teacher &&
      !db
        .prepare(
          "SELECT 1 FROM teacher_departments t JOIN users u ON u.id=t.user_id WHERE t.user_id=? AND t.department_id=? AND u.status='APPROVED' AND u.role='TEACHER'",
        )
        .get(teacher, req.params.id)
    )
      fail(
        400,
        "The head must be an approved teacher assigned to this department.",
      );
    transaction(db, () => {
      const old = db
        .prepare("SELECT user_id FROM department_heads WHERE department_id=?")
        .get(req.params.id);
      db.prepare("DELETE FROM department_heads WHERE department_id=?").run(
        req.params.id,
      );
      if (teacher)
        db.prepare("INSERT INTO department_heads VALUES(?,?,?,?)").run(
          req.params.id,
          teacher,
          req.user.id,
          Date.now(),
        );
      audit(db, req.user.id, "DEPARTMENT_HEAD_CHANGED", req.params.id, {
        from: old?.user_id || null,
        to: teacher,
      });
    });
    res.json({ ok: true });
  });
  app.post("/api/admin/students", (req, res) => {
    fields(req.body, ["studentId", "email", "name", "departmentId"]);
    const { id, address } = studentIdentity(req.body),
      name = text(req.body.name, "Student name", 2, 100);
    departmentIds([req.body.departmentId]);
    const userId = randomUUID();
    transaction(db, () => {
      db.prepare(
        "INSERT INTO users(id,email,name,role,status,created_at) VALUES(?,?,?,'STUDENT','APPROVED',?)",
      ).run(userId, address, name, Date.now());
      db.prepare("INSERT INTO student_identities VALUES(?,?,?)").run(
        id,
        userId,
        req.body.departmentId,
      );
      audit(db, req.user.id, "STUDENT_PROVISIONED", userId, {
        studentId: id,
        departmentId: req.body.departmentId,
      });
    });
    res.status(201).json({ id: userId });
  });
  app.put("/api/admin/students/:id/department", (req, res) => {
    fields(req.body, ["departmentId"]);
    departmentIds([req.body.departmentId]);
    transaction(db, () => {
      if (
        !db
          .prepare(
            "UPDATE student_identities SET department_id=? WHERE user_id=?",
          )
          .run(req.body.departmentId, req.params.id).changes
      )
        fail(404, "Student not found.");
      revoke(req.params.id);
      audit(db, req.user.id, "STUDENT_DEPARTMENT_CHANGED", req.params.id, {
        departmentId: req.body.departmentId,
      });
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/audit", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT a.*,u.name AS actorName FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 200",
        )
        .all(),
    ),
  );

  groupRoutes(app, db, authenticate, approved);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024,
      files: 1,
      fields: 9,
      fieldSize: 24 * 1024,
    },
  }).single("file");
  const uploadLimit = (req, res, next) => {
    if (req.user.role === "STUDENT")
      fail(403, "Students cannot publish notices.");
    limit(req, "notice-write", 60);
    next();
  };
  function noticeData(req, existing) {
    fields(req.body, [
      "title",
      "content",
      "category",
      "departmentId",
      "status",
      "version",
      "removeAttachment",
      "groupId",
    ]);
    const title = text(req.body.title, "Title", 1, 120),
      content = text(req.body.content, "Notice details", 1, 5000),
      category = req.body.category,
      status = req.body.status;
    if (
      !["ANNOUNCEMENT", "EXAM", "EVENT", "URGENT"].includes(category) ||
      !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)
    )
      fail(400, "Choose a valid category and publication status.");
    if (existing && existing.status !== "DRAFT" && status === "DRAFT")
      fail(400, "Published notices can be archived, not returned to drafts.");
    const department =
      req.body.departmentId === null || req.body.departmentId === ""
        ? null
        : req.body.departmentId;
    if (department !== null && typeof department !== "string")
      fail(400, "Choose a valid department.");
    if (existing && department !== existing.department_id)
      fail(
        400,
        "A notice cannot move between departments. Create a new notice instead.",
      );
    if (req.user.role === "STUDENT" || !assigned(db, req.user, department))
      fail(403, "You cannot publish in this department.");
    const group = req.body.groupId || null;
    if (group !== null && typeof group !== "string")
      fail(400, "Choose a valid class.");
    if (existing && group !== existing.group_id)
      fail(400, "The notice audience cannot be changed. Create a new notice.");
    if (
      group &&
      !db
        .prepare(
          "SELECT 1 FROM class_groups WHERE id=? AND department_id=? AND active=1",
        )
        .get(group, department)
    )
      fail(403, "This class is not available in the selected department.");
    if (
      !group &&
      req.user.role !== "ADMIN" &&
      !isHead(db, req.user, department)
    )
      fail(
        403,
        "Only the department head can broadcast to this department. Choose a class instead.",
      );
    if (req.file) {
      const { buffer, originalname, size } = req.file;
      const ext = originalname.split(".").pop().toLowerCase();
      const signature =
        ext === "pdf"
          ? buffer.subarray(0, 5).toString() === "%PDF-"
          : ["docx", "xlsx"].includes(ext)
            ? buffer
                .subarray(0, 4)
                .equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
            : ["doc", "xls"].includes(ext)
              ? buffer
                  .subarray(0, 8)
                  .equals(
                    Buffer.from([
                      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
                    ]),
                  )
              : false;
      if (!signature || !size)
        fail(400, "Choose a valid PDF, Word, or Excel document.");
      req.file.safeName = originalname
        .replace(/[^a-zA-Z0-9._ -]/g, "_")
        .slice(-120);
      req.file.safeMime = {
        pdf: "application/pdf",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }[ext];
    }
    return { title, content, category, status, department, group };
  }
  function saveAttachment(req, id) {
    if (
      req.body.removeAttachment === "true" ||
      req.body.removeAttachment === true
    )
      db.prepare("DELETE FROM attachments WHERE notice_id=?").run(id);
    if (req.file)
      db.prepare(
        "INSERT INTO attachments VALUES(?,?,?,?,?) ON CONFLICT(notice_id) DO UPDATE SET name=excluded.name,mime_type=excluded.mime_type,size=excluded.size,data=excluded.data",
      ).run(
        id,
        req.file.safeName,
        req.file.safeMime,
        req.file.size,
        req.file.buffer,
      );
    if (req.file) queueDocument(db, id);
  }
  function revision(req, id) {
    const notice = db.prepare("SELECT * FROM notices WHERE id=?").get(id);
    const attachment = db
      .prepare("SELECT name,mime_type,size FROM attachments WHERE notice_id=?")
      .get(id);
    db.prepare(
      "INSERT INTO notice_revisions(notice_id,actor_id,version,snapshot,created_at) VALUES(?,?,?,?,?)",
    ).run(
      id,
      req.user.id,
      notice.version,
      JSON.stringify({ ...notice, attachment }),
      Date.now(),
    );
    audit(db, req.user.id, "NOTICE_" + notice.status, id, {
      version: notice.version,
      departmentId: notice.department_id,
    });
  }
  function serialize(req, n) {
    const file = db
      .prepare("SELECT name,size FROM attachments WHERE notice_id=?")
      .get(n.id);
    const author = db
      .prepare("SELECT name,role FROM users WHERE id=?")
      .get(n.author_id);
    return {
      id: n.id,
      title: n.title,
      content: n.content,
      category: n.category,
      status: n.status,
      department: n.department_id || "ALL",
      groupId: n.group_id,
      audience: n.group_id
        ? groupLabel(
            db.prepare("SELECT * FROM class_groups WHERE id=?").get(n.group_id),
          )
        : n.department_id
          ? "Department broadcast"
          : "University-wide broadcast",
      authorId: n.author_id,
      author: author.name,
      authorRole: author.role,
      created: n.created_at,
      updated: n.updated_at,
      publishedAt: n.published_at,
      version: n.version,
      file: file || null,
      documentText:
        db
          .prepare(
            "SELECT extracted_text FROM document_previews WHERE notice_id=? AND status='READY'",
          )
          .get(n.id)?.extracted_text || "",
      canManage: canManage(db, req.user, n),
    };
  }
  function findNotice(req, manage = false) {
    const n = db.prepare("SELECT * FROM notices WHERE id=?").get(req.params.id);
    if (!n || !(manage ? canManage(db, req.user, n) : canRead(db, req.user, n)))
      fail(404, "Notice not found.");
    return n;
  }
  app.use("/api/notices", authenticate, approved);
  app.get("/api/notices", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT * FROM notices WHERE status!='DELETED' ORDER BY created_at DESC",
        )
        .all()
        .filter((n) => canRead(db, req.user, n))
        .map((n) => serialize(req, n)),
    ),
  );
  app.get("/api/notices/:id", (req, res) =>
    res.json(serialize(req, findNotice(req))),
  );
  app.get("/api/notices/:id/attachment", (req, res) => {
    findNotice(req);
    const file = db
      .prepare("SELECT * FROM attachments WHERE notice_id=?")
      .get(req.params.id);
    if (!file) fail(404, "Attachment not found.");
    res
      .set({
        "Content-Type": file.mime_type,
        "Content-Disposition": `attachment; filename="${file.name.replaceAll('"', "_")}"`,
        "Content-Length": String(file.size),
      })
      .send(Buffer.from(file.data));
  });
  app.get("/api/notices/:id/document", (req, res) => {
    findNotice(req);
    const preview = db
      .prepare(
        "SELECT status,error,extracted_text,updated_at FROM document_previews WHERE notice_id=?",
      )
      .get(req.params.id);
    if (!preview) fail(404, "Document not found.");
    res.json({
      ...preview,
      pageCount: db
        .prepare("SELECT count(*) count FROM document_pages WHERE notice_id=?")
        .get(req.params.id).count,
    });
  });
  app.get("/api/notices/:id/document/pages/:page", (req, res) => {
    findNotice(req);
    const page = db
      .prepare("SELECT image FROM document_pages WHERE notice_id=? AND page=?")
      .get(req.params.id, Number(req.params.page));
    if (!page) fail(404, "Document page not available.");
    res.type("png").send(Buffer.from(page.image));
  });
  app.get("/api/notices/:id/document/pdf", (req, res) => {
    findNotice(req);
    const file = db
      .prepare("SELECT * FROM attachments WHERE notice_id=?")
      .get(req.params.id);
    const preview = db
      .prepare(
        "SELECT pdf FROM document_previews WHERE notice_id=? AND status='READY'",
      )
      .get(req.params.id);
    const pdf =
      file?.mime_type === "application/pdf" ? file.data : preview?.pdf;
    if (!pdf)
      fail(
        409,
        "The document preview is still processing or could not be prepared. You can download the original file.",
      );
    res
      .set("Content-Disposition", 'attachment; filename="notice-preview.pdf"')
      .type("pdf")
      .send(Buffer.from(pdf));
  });
  app.post("/api/notices/:id/document/retry", (req, res) => {
    findNotice(req, true);
    fields(req.body, []);
    limit(req, "document-retry", 10);
    queueDocument(db, req.params.id);
    res.json({ ok: true });
  });
  app.get("/api/notices/:id/history", (req, res) => {
    findNotice(req, true);
    res.json(
      db
        .prepare(
          "SELECT version,snapshot,created_at,actor_id FROM notice_revisions WHERE notice_id=? ORDER BY version DESC",
        )
        .all(req.params.id),
    );
  });
  app.post(
    "/api/notices",
    uploadLimit,
    upload,
    authenticate,
    approved,
    (req, res) => {
      const data = noticeData(req),
        id = randomUUID(),
        now = Date.now();
      transaction(db, () => {
        db.prepare(
          "INSERT INTO notices(id,author_id,department_id,title,content,category,status,created_at,updated_at,published_at,group_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          req.user.id,
          data.department,
          data.title,
          data.content,
          data.category,
          data.status,
          now,
          now,
          data.status === "PUBLISHED" ? now : null,
          data.group,
        );
        saveAttachment(req, id);
        revision(req, id);
      });
      res
        .status(201)
        .json(
          serialize(
            req,
            db.prepare("SELECT * FROM notices WHERE id=?").get(id),
          ),
        );
    },
  );
  app.put(
    "/api/notices/:id",
    uploadLimit,
    upload,
    authenticate,
    approved,
    (req, res) => {
      const existing = findNotice(req, true),
        data = noticeData(req, existing);
      if (Number(req.body.version) !== existing.version)
        fail(409, "This notice changed. Refresh before editing.");
      transaction(db, () => {
        db.prepare(
          "UPDATE notices SET title=?,content=?,category=?,status=?,updated_at=?,published_at=COALESCE(published_at,?),version=version+1 WHERE id=?",
        ).run(
          data.title,
          data.content,
          data.category,
          data.status,
          Date.now(),
          data.status === "PUBLISHED" ? Date.now() : null,
          existing.id,
        );
        saveAttachment(req, existing.id);
        revision(req, existing.id);
      });
      res.json(
        serialize(
          req,
          db.prepare("SELECT * FROM notices WHERE id=?").get(existing.id),
        ),
      );
    },
  );
  app.delete("/api/notices/:id", (req, res) => {
    fields(req.body, ["version"]);
    const existing = findNotice(req, true);
    if (Number(req.body.version) !== existing.version)
      fail(409, "This notice changed. Refresh before deleting.");
    transaction(db, () => {
      db.prepare(
        "UPDATE notices SET status='DELETED',updated_at=?,version=version+1 WHERE id=?",
      ).run(Date.now(), existing.id);
      db.prepare("DELETE FROM attachments WHERE notice_id=?").run(existing.id);
      revision(req, existing.id);
    });
    res.json({ ok: true });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use(
    express.static(fileURLToPath(new URL("../web/", import.meta.url)), {
      index: "index.html",
      dotfiles: "deny",
    }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const constraint = String(error.message).includes("constraint failed");
    const status =
      error.status ||
      (error instanceof multer.MulterError ? 400 : constraint ? 409 : 500);
    res.status(status).json({
      error:
        status === 500
          ? "The request could not be completed."
          : constraint
            ? "This record conflicts with an existing record."
            : error instanceof multer.MulterError
              ? "Attachment exceeds the supported upload limits."
              : error.message,
    });
  });
  return app;
}
