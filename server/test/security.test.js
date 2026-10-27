import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../db.js";
import { createApp } from "../app.js";
import { hashPassword, tokenHash } from "../security.js";
import { configuration } from "../config.js";
import { analyzeNoticeText } from "../notice-analysis.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const password = "Individual test passphrase 473!";
const origin = "http://localhost:8080";
async function fixture(
  t,
  { provisional = true, firstLogin = false, analyzeDocument } = {},
) {
  const db = openDatabase(":memory:"),
    adminId = randomUUID(),
    mail = [];
  const encoded = await hashPassword(password);
  db.prepare(
    "INSERT INTO users VALUES(?,?,'Admin','ADMIN','APPROVED',?,?,?)",
  ).run(adminId, "admin@nwu.ac.bd", encoded, firstLogin ? 1 : 0, Date.now());
  const app = await createApp({
    db,
    origin,
    secret: "test-secret-that-is-longer-than-32-characters",
    provisional,
    sendMail: async (message) => mail.push(message),
    analyzeDocument,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(
    () =>
      new Promise((r) =>
        server.close(() => {
          db.close();
          r();
        }),
      ),
  );
  function client() {
    let cookie = "",
      csrf = "";
    return {
      get cookie() {
        return cookie;
      },
      get csrf() {
        return csrf;
      },
      async request(path, method = "GET", body, headers = {}) {
        const multipart = body instanceof FormData;
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}/api${path}`,
          {
            method,
            headers: {
              Origin: origin,
              ...(body && !multipart
                ? { "Content-Type": "application/json" }
                : {}),
              Cookie: cookie,
              "X-CSRF-Token": csrf,
              ...headers,
            },
            body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
          },
        );
        const set = response.headers.get("set-cookie");
        if (set) cookie = set.split(";")[0];
        const type = response.headers.get("content-type") || "";
        const data = type.includes("json")
          ? await response.json()
          : await response.text();
        if (data.csrfToken) csrf = data.csrfToken;
        return { status: response.status, data, headers: response.headers };
      },
    };
  }
  const admin = client();
  assert.equal(
    (
      await admin.request("/auth/login", "POST", {
        email: "admin@nwu.ac.bd",
        password,
      })
    ).status,
    200,
  );
  async function department(code) {
    const r = await admin.request("/admin/departments", "POST", {
      code,
      name: `Department ${code}`,
    });
    assert.equal(r.status, 201);
    return r.data.id;
  }
  async function teacher(name, depts, approve = true) {
    const c = client(),
      address = `${name.toLowerCase().replaceAll(" ", ".")}@nwu.ac.bd`;
    const r = await c.request("/auth/register", "POST", {
      email: address,
      name,
      password,
      requestedDepartmentIds: depts,
      institutionalInfo: "Staff record for institutional review",
    });
    assert.equal(r.status, 201);
    const id = r.data.user.id;
    if (approve) {
      assert.equal(
        (
          await admin.request(`/admin/users/${id}/status`, "PATCH", {
            status: "APPROVED",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await admin.request(`/admin/teachers/${id}/departments`, "PUT", {
            departmentIds: depts,
          })
        ).status,
        200,
      );
      assert.equal(
        (await c.request("/auth/login", "POST", { email: address, password }))
          .status,
        200,
      );
    }
    return { client: c, id, email: address, teacherId: r.data.user.teacherId };
  }
  async function student(id, dept) {
    const c = client();
    assert.equal(
      (
        await admin.request("/admin/students", "POST", {
          studentId: id,
          email: `${id}@nwu.ac.bd`,
          name: "Directory student",
          departmentId: dept,
        })
      ).status,
      201,
    );
    const r = await c.request("/auth/student", "POST", {
      studentId: id,
      email: `${id}@nwu.ac.bd`,
    });
    return { client: c, result: r };
  }
  async function group(dept, section = "A") {
    const r = await admin.request("/groups", "POST", {
      departmentId: dept,
      batch: "2024",
      className: "Semester 3",
      section,
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data.id;
  }
  async function notice(c, dept, status = "PUBLISHED") {
    const role = (await c.request("/session")).data.user.role;
    const groupId =
      role === "TEACHER"
        ? db
            .prepare(
              "SELECT id FROM class_groups WHERE department_id=? LIMIT 1",
            )
            .get(dept)?.id || (await group(dept))
        : null;
    const r = await c.request("/notices", "POST", {
      groupId,
      title: "An authorized notice",
      content: "Actual content supplied by the author.",
      category: "ANNOUNCEMENT",
      departmentId: dept,
      status,
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data;
  }
  return {
    db,
    admin,
    adminId,
    client,
    department,
    teacher,
    student,
    notice,
    group,
    mail,
  };
}

test("admin bootstrap is restricted until password change; sessions are opaque and revoked on change", async (t) => {
  const f = await fixture(t, { firstLogin: true });
  assert.equal((await f.admin.request("/admin/users")).status, 403);
  const response = await f.admin.request("/session");
  assert.equal(response.data.user.mustChangePassword, true);
  assert(!JSON.stringify(response.data).includes("password_hash"));
  assert(
    !f.db
      .prepare("SELECT token_hash FROM sessions")
      .get()
      .token_hash.includes(f.admin.cookie.split("=")[1]),
  );
  assert.equal(
    (
      await f.admin.request("/account/password", "POST", {
        currentPassword: password,
        newPassword: "Replacement admin passphrase 429!",
      })
    ).status,
    200,
  );
  assert.equal((await f.admin.request("/session")).status, 401);
  assert.equal(
    (
      await f.admin.request("/auth/login", "POST", {
        email: "admin@nwu.ac.bd",
        password: "Replacement admin passphrase 429!",
      })
    ).status,
    200,
  );
  assert.equal((await f.admin.request("/admin/users")).status, 200);
});
test("directory-backed student sign-in cannot change department or escalate roles", async (t) => {
  const f = await fixture(t),
    a = await f.department("CSE"),
    b = await f.department("EEE");
  const s = await f.student("20242024010", a);
  assert.equal(s.result.status, 200);
  assert.equal(s.result.data.provisional, true);
  for (const path of ["/admin/users", "/admin/departments", "/admin/audit"])
    assert.equal((await s.client.request(path)).status, 403);
  assert.equal(
    (
      await s.client.request("/account/profile", "PATCH", {
        name: "Student",
        role: "ADMIN",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await s.client.request("/auth/student", "POST", {
        studentId: "20242024010",
        email: "20242024010@nwu.ac.bd",
        departmentId: b,
        role: "ADMIN",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await s.client.request("/notices", "POST", {
        title: "Bad",
        content: "Bad",
        category: "EVENT",
        departmentId: a,
        status: "PUBLISHED",
      })
    ).status,
    403,
  );
  const own = await f.notice(f.admin, a),
    broadcast = await f.notice(f.admin, null);
  await f.notice(f.admin, b);
  await f.notice(f.admin, a, "DRAFT");
  await f.notice(f.admin, a, "ARCHIVED");
  assert.deepEqual(
    new Set((await s.client.request("/notices")).data.map((n) => n.id)),
    new Set([own.id, broadcast.id]),
  );
  assert.equal(
    (
      await f.client().request("/auth/student", "POST", {
        studentId: "20242025020",
        email: "20242025020@nwu.ac.bd",
      })
    ).status,
    401,
  );
});
test("pending/rejected/suspended teachers cannot publish or activate themselves", async (t) => {
  const f = await fixture(t),
    dept = await f.department("CSE"),
    p = await f.teacher("Pending Teacher", [dept], false);
  assert.equal((await p.client.request("/notices")).status, 403);
  assert.equal(
    (
      await p.client.request(`/admin/users/${p.id}/status`, "PATCH", {
        status: "APPROVED",
      })
    ).status,
    403,
  );
  await f.admin.request(`/admin/users/${p.id}/status`, "PATCH", {
    status: "REJECTED",
    reason: "Contact your department with a staff appointment record.",
  });
  assert.equal((await p.client.request("/session")).status, 401);
  assert.equal(
    (
      await p.client.request("/auth/login", "POST", {
        email: p.email,
        password,
      })
    ).data.user.status,
    "REJECTED",
  );
  assert.equal((await p.client.request("/notices")).status, 403);
  await f.admin.request(`/admin/users/${p.id}/status`, "PATCH", {
    status: "SUSPENDED",
  });
  assert.equal(
    (
      await p.client.request("/auth/login", "POST", {
        email: p.email,
        password,
      })
    ).status,
    401,
  );
});
test("teachers have multiple current department assignments, no self-assignment or broadcast access", async (t) => {
  const f = await fixture(t),
    a = await f.department("CSE"),
    b = await f.department("EEE"),
    c = await f.department("BBA"),
    teacher = await f.teacher("faculty", [a, b]);
  const own = await f.notice(teacher.client, a);
  await f.notice(f.admin, b);
  const other = await f.notice(f.admin, c);
  await f.notice(f.admin, null);
  assert.equal((await teacher.client.request("/notices")).data.length, 3);
  assert.equal(
    (await teacher.client.request(`/notices/${other.id}`)).status,
    404,
  );
  assert.equal(
    (
      await teacher.client.request(
        `/admin/teachers/${teacher.id}/departments`,
        "PUT",
        { departmentIds: [c] },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await teacher.client.request("/notices", "POST", {
        title: "Broadcast",
        content: "No",
        category: "EVENT",
        departmentId: null,
        status: "PUBLISHED",
      })
    ).status,
    403,
  );
  await f.admin.request(`/admin/teachers/${teacher.id}/departments`, "PUT", {
    departmentIds: [b],
  });
  assert.equal(
    (await teacher.client.request(`/notices/${own.id}`)).status,
    404,
  );
  assert.equal(
    (await teacher.client.request("/session")).data.user.departments.length,
    1,
  );
});
test("head privileges are scoped, immediately revoked, and reassign without stale session permissions", async (t) => {
  const f = await fixture(t),
    a = await f.department("CSE"),
    b = await f.department("EEE"),
    first = await f.teacher("first", [a, b]),
    second = await f.teacher("second", [a, b]);
  const na = await f.notice(second.client, a),
    nb = await f.notice(second.client, b),
    draft = await f.notice(second.client, a, "DRAFT");
  await f.admin.request(`/admin/departments/${a}/head`, "PUT", {
    teacherUserId: first.id,
  });
  assert.equal(
    (await first.client.request(`/notices/${na.id}/history`)).status,
    200,
  );
  assert.equal(
    (await first.client.request(`/notices/${nb.id}/history`)).status,
    404,
  );
  assert.equal(
    (await first.client.request(`/notices/${draft.id}`)).status,
    404,
  );
  await f.admin.request(`/admin/departments/${a}/head`, "PUT", {
    teacherUserId: second.id,
  });
  assert.equal(
    (await first.client.request(`/notices/${na.id}/history`)).status,
    404,
  );
  const firstNotice = await f.notice(first.client, a);
  assert.equal(
    (await second.client.request(`/notices/${firstNotice.id}/history`)).status,
    200,
  );
  await f.admin.request(`/admin/departments/${a}/head`, "PUT", {
    teacherUserId: null,
  });
  assert.equal(
    (await second.client.request(`/notices/${firstNotice.id}/history`)).status,
    404,
  );
  assert.equal(
    f.db.prepare("SELECT count(*) AS count FROM department_heads").get().count,
    0,
  );
});
test("notice author impersonation, IDOR, scope changes, and stale versions are rejected", async (t) => {
  const f = await fixture(t),
    dept = await f.department("CSE"),
    one = await f.teacher("one", [dept]),
    two = await f.teacher("two", [dept]),
    n = await f.notice(one.client, dept);
  assert.equal(
    (await two.client.request(`/notices/${n.id}`, "DELETE", { version: 1 }))
      .status,
    404,
  );
  const payload = {
    groupId: n.groupId,
    title: "Edited",
    content: "Changed details",
    category: "EXAM",
    departmentId: dept,
    status: "PUBLISHED",
    version: 1,
  };
  assert.equal(
    (
      await one.client.request(`/notices/${n.id}`, "PUT", {
        ...payload,
        authorId: two.id,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await one.client.request(`/notices/${n.id}`, "PUT", {
        ...payload,
        departmentId: null,
      })
    ).status,
    400,
  );
  assert.equal(
    (await one.client.request(`/notices/${n.id}`, "PUT", payload)).status,
    200,
  );
  assert.equal(
    (await one.client.request(`/notices/${n.id}`, "PUT", payload)).status,
    409,
  );
  assert.equal(
    (await f.admin.request(`/notices/${n.id}/history`)).data.length,
    2,
  );
  assert.equal(
    (await f.admin.request(`/notices/${n.id}`, "DELETE", { version: 2 }))
      .status,
    200,
  );
  assert.equal((await one.client.request(`/notices/${n.id}`)).status, 404);
});
test("duplicate identities, malformed data and conflicting assignments fail without partial writes", async (t) => {
  const f = await fixture(t),
    a = await f.department("CSE"),
    b = await f.department("EEE"),
    teacher = await f.teacher("faculty", [a]);
  assert.equal(
    (
      await f.admin.request("/admin/departments", "POST", {
        code: "cse",
        name: "Duplicate",
      })
    ).status,
    409,
  );
  await f.student("20242024010", a);
  assert.equal(
    (
      await f.admin.request("/admin/students", "POST", {
        studentId: "20242024010",
        email: "20242024010@nwu.ac.bd",
        name: "Duplicate",
        departmentId: b,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.client().request("/auth/student", "POST", {
        studentId: "20242024010",
        email: "20242025020@nwu.ac.bd",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.admin.request(
        `/admin/teachers/${teacher.id}/departments`,
        "PUT",
        { departmentIds: [a, a] },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.admin.request(
        `/admin/teachers/${teacher.id}/departments`,
        "PUT",
        { departmentIds: [b, "missing"] },
      )
    ).status,
    400,
  );
  assert.equal(
    (await teacher.client.request("/session")).data.user.departments[0].id,
    a,
  );
  assert.equal(
    (
      await f.admin.request(`/admin/departments/${b}/head`, "PUT", {
        teacherUserId: teacher.id,
      })
    ).status,
    400,
  );
  assert.throws(() =>
    f.db
      .prepare("UPDATE teacher_profiles SET teacher_id=? WHERE user_id=?")
      .run("changed", teacher.id),
  );
  assert.throws(() =>
    f.db
      .prepare("INSERT INTO department_heads VALUES(?,?,?,?)")
      .run(b, teacher.id, f.adminId, Date.now()),
  );
  assert.throws(() =>
    f.db.prepare("UPDATE users SET role=? WHERE id=?").run("ADMIN", teacher.id),
  );
  assert.equal(
    f.db
      .prepare("SELECT count(*) AS count FROM users WHERE role='STUDENT'")
      .get().count,
    1,
  );
});
test("suspending a head cascades assignments and invalidates sessions", async (t) => {
  const f = await fixture(t),
    a = await f.department("CSE"),
    teacher = await f.teacher("faculty", [a]);
  await f.admin.request(`/admin/departments/${a}/head`, "PUT", {
    teacherUserId: teacher.id,
  });
  await f.admin.request(`/admin/users/${teacher.id}/status`, "PATCH", {
    status: "SUSPENDED",
  });
  assert.equal((await teacher.client.request("/notices")).status, 401);
  assert.equal(
    f.db.prepare("SELECT count(*) AS count FROM department_heads").get().count,
    0,
  );
  assert.equal(
    f.db.prepare("SELECT count(*) AS count FROM teacher_departments").get()
      .count,
    0,
  );
});
test("CSRF, origin checks, cookie flags, no-cache and CSP protect sessions", async (t) => {
  const f = await fixture(t);
  const c = f.client();
  const login = await c.request("/auth/login", "POST", {
    email: "admin@nwu.ac.bd",
    password,
  });
  assert.match(login.headers.get("set-cookie"), /HttpOnly/);
  assert.match(login.headers.get("set-cookie"), /SameSite=Strict/);
  assert.equal(
    (
      await c.request(
        "/admin/departments",
        "POST",
        { code: "CSE", name: "Computer science" },
        { "X-CSRF-Token": "wrong" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await c.request(
        "/auth/logout",
        "POST",
        {},
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await c.request("/auth/logout", "POST", {}, { Origin: "" })).status,
    403,
  );
  const r = await c.request("/session");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(r.headers.get("content-security-policy"), /script-src 'self'/);
  assert.equal((await c.request("/auth/logout", "POST", {})).status, 200);
  assert.equal((await c.request("/session")).status, 401);
});
test("password reset tokens are hashed, expiring, one-use and revoke existing sessions", async (t) => {
  const f = await fixture(t),
    a = await f.department("CSE"),
    teacher = await f.teacher("faculty", [a]),
    c = f.client();
  const known = await c.request("/auth/reset/request", "POST", {
      email: teacher.email,
    }),
    unknown = await c.request("/auth/reset/request", "POST", {
      email: "absent@nwu.ac.bd",
    });
  assert.deepEqual(known.data, unknown.data);
  assert.equal(f.mail.length, 1);
  const token = f.mail[0].text.match(/#reset=([\w-]+)/)[1];
  assert.equal(
    f.db.prepare("SELECT token_hash FROM auth_tokens").get().token_hash,
    tokenHash(token),
  );
  const reset = { token, password: "New teacher passphrase 892!" };
  assert.equal(
    (await c.request("/auth/reset/complete", "POST", reset)).status,
    200,
  );
  assert.equal((await teacher.client.request("/session")).status, 401);
  assert.equal(
    (await c.request("/auth/reset/complete", "POST", reset)).status,
    400,
  );
  assert.equal(
    (
      await c.request("/auth/login", "POST", {
        email: teacher.email,
        password: reset.password,
      })
    ).status,
    200,
  );
  await c.request("/auth/reset/request", "POST", { email: teacher.email });
  const expired = f.mail.at(-1).text.match(/#reset=([\w-]+)/)[1];
  f.db.prepare("UPDATE auth_tokens SET expires_at=0").run();
  assert.equal(
    (
      await c.request("/auth/reset/complete", "POST", {
        token: expired,
        password,
      })
    ).status,
    400,
  );
});
test("verified student login consumes a single-use email token without trusting client identity", async (t) => {
  const f = await fixture(t, { provisional: false }),
    a = await f.department("CSE"),
    s = await f.student("20242024010", a);
  assert.equal(s.result.status, 202);
  assert.equal((await s.client.request("/notices")).status, 401);
  const token = f.mail[0].text.match(/#verify=([\w-]+)/)[1];
  const r = await s.client.request("/auth/student/verify", "POST", { token });
  assert.equal(r.status, 200);
  assert.equal(r.data.provisional, false);
  assert.equal(
    (await f.client().request("/auth/student/verify", "POST", { token }))
      .status,
    400,
  );
});
test("login/reset throttling is persistent and generic", async (t) => {
  const f = await fixture(t),
    c = f.client();
  let r;
  for (let i = 0; i < 11; i++)
    r = await c.request("/auth/login", "POST", {
      email: "unknown@nwu.ac.bd",
      password: "wrong",
    });
  assert.equal(r.status, 429);
  for (let i = 0; i < 6; i++)
    r = await c.request("/auth/reset/request", "POST", {
      email: "unknown@nwu.ac.bd",
    });
  assert.equal(r.status, 429);
  assert(
    f.db.prepare("SELECT count(*) AS count FROM rate_limits").get().count > 0,
  );
});
test("production fails closed without verified student delivery and admin MFA gate configuration", () => {
  assert.throws(() =>
    configuration({
      NODE_ENV: "production",
      APP_ORIGIN: "https://notify.example",
    }),
  );
  assert.throws(() =>
    configuration({
      NODE_ENV: "production",
      APP_ORIGIN: "https://notify.example",
      ADMIN_MFA_GATEWAY_CONFIRMED: "true",
      SMTP_HOST: "mail.example",
      MAIL_FROM: "notify@nwu.ac.bd",
      ALLOW_PROVISIONAL_STUDENTS: "true",
    }),
  );
});

test("attachments require current notice authorization and preserve uploaded bytes", async (t) => {
  const f = await fixture(t),
    a = await f.department("CSE"),
    b = await f.department("EEE");
  const teacher = await f.teacher("faculty", [a]),
    student = await f.student("20242024010", a),
    other = await f.student("20242025020", b);
  const groupId = await f.group(a);
  assert.equal(
    (await student.client.request(`/groups/${groupId}/join`, "POST", {}))
      .status,
    200,
  );
  const data = new FormData();
  for (const [key, value] of Object.entries({
    groupId,
    title: "Attached notice",
    content: "Read the original attachment.",
    category: "EXAM",
    departmentId: a,
    status: "DRAFT",
  }))
    data.set(key, value);
  const bytes = "%PDF-1.4\noriginal-test-content";
  data.set(
    "file",
    new Blob([bytes], { type: "application/pdf" }),
    "original.pdf",
  );
  const created = await teacher.client.request("/notices", "POST", data);
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal(
    (await student.client.request(`/notices/${id}/attachment`)).status,
    404,
  );
  assert.equal(
    (await other.client.request(`/notices/${id}/attachment`)).status,
    404,
  );
  assert.equal(
    (await f.client().request(`/notices/${id}/attachment`)).status,
    401,
  );
  assert.equal(
    (await teacher.client.request(`/notices/${id}/attachment`)).data,
    bytes,
  );
  data.delete("file");
  data.set("version", "1");
  data.set("status", "PUBLISHED");
  assert.equal(
    (await teacher.client.request(`/notices/${id}`, "PUT", data)).status,
    200,
  );
  const download = await student.client.request(`/notices/${id}/attachment`);
  assert.equal(download.data, bytes);
  assert.match(download.headers.get("content-disposition"), /^attachment;/);
  assert.equal(
    (await other.client.request(`/notices/${id}/attachment`)).status,
    404,
  );
  data.set("version", "2");
  data.set(
    "file",
    new Blob(["<script>bad</script>"], { type: "application/pdf" }),
    "bad.pdf",
  );
  assert.equal(
    (await teacher.client.request(`/notices/${id}`, "PUT", data)).status,
    400,
  );
  assert.equal(
    (await teacher.client.request(`/notices/${id}/attachment`)).data,
    bytes,
  );
  await f.admin.request(`/admin/teachers/${teacher.id}/departments`, "PUT", {
    departmentIds: [],
  });
  assert.equal(
    (await teacher.client.request(`/notices/${id}/attachment`)).status,
    404,
  );
});
test("registration rejects privileged fields, duplicates and weak passwords without account activation", async (t) => {
  const f = await fixture(t),
    dept = await f.department("CSE"),
    c = f.client();
  const body = {
    name: "Faculty",
    email: "faculty@nwu.ac.bd",
    password,
    requestedDepartmentIds: [dept],
    institutionalInfo: "Appointment reference",
  };
  for (const injected of [
    { role: "ADMIN" },
    { status: "APPROVED" },
    { isDepartmentHead: true },
    { departmentIds: [dept] },
  ])
    assert.equal(
      (await c.request("/auth/register", "POST", { ...body, ...injected }))
        .status,
      400,
    );
  assert.equal(
    (await c.request("/auth/register", "POST", { ...body, password: "short" }))
      .status,
    400,
  );
  assert.equal((await c.request("/auth/register", "POST", body)).status, 201);
  assert.equal((await c.request("/auth/register", "POST", body)).status, 409);
  const user = f.db
    .prepare("SELECT * FROM users WHERE email='faculty@nwu.ac.bd'")
    .get();
  assert.equal(user.status, "PENDING");
  assert.match(user.password_hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(
    f.db
      .prepare("SELECT count(*) AS n FROM teacher_departments WHERE user_id=?")
      .get(user.id).n,
    0,
  );
});
test("SQLite migrations are persistent, idempotent, and enforce one head per department", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "notify-test-")),
    path = join(dir, "data.sqlite");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let db = openDatabase(path);
  db.prepare(
    "INSERT INTO departments VALUES('d','CSE','Computer science',1,1)",
  ).run();
  db.close();
  db = openDatabase(path);
  try {
    assert.equal(
      db.prepare("SELECT count(*) AS n FROM schema_migrations").get().n,
      3,
    );
    assert.equal(
      db.prepare("SELECT name FROM departments WHERE id='d'").get().name,
      "Computer science",
    );
    const hash = await hashPassword(password);
    db.prepare(
      "INSERT INTO users VALUES('admin','admin@nwu.ac.bd','Admin','ADMIN','APPROVED',?,0,1)",
    ).run(hash);
    for (const id of ["t1", "t2"]) {
      db.prepare(
        "INSERT INTO users VALUES(?,?,?,'TEACHER','APPROVED',?,0,1)",
      ).run(id, `${id}@nwu.ac.bd`, id, hash);
      db.prepare(
        "INSERT INTO teacher_profiles(user_id,teacher_id,institutional_info) VALUES(?,?,?)",
      ).run(id, `T-${id}`, "Record");
      db.prepare("INSERT INTO teacher_departments VALUES(?,'d')").run(id);
    }
    db.prepare("INSERT INTO department_heads VALUES('d','t1','admin',1)").run();
    assert.throws(() =>
      db
        .prepare("INSERT INTO department_heads VALUES('d','t2','admin',1)")
        .run(),
    );
    db.exec("BEGIN IMMEDIATE");
    db.prepare("DELETE FROM department_heads WHERE department_id='d'").run();
    assert.throws(() =>
      db
        .prepare(
          "INSERT INTO department_heads VALUES('d','unassigned','admin',1)",
        )
        .run(),
    );
    db.exec("ROLLBACK");
    assert.equal(
      db
        .prepare("SELECT user_id FROM department_heads WHERE department_id='d'")
        .get().user_id,
      "t1",
    );
  } finally {
    db.close();
  }
});

test("class membership is immediate, department-bound, and enforced for notices and previews", async (t) => {
  const f = await fixture(t),
    a = await f.department("CSE"),
    b = await f.department("EEE");
  const ga = await f.group(a),
    gb = await f.group(a, "B"),
    other = await f.group(b);
  const teacher = await f.teacher("Class teacher", [a]);
  const student = await f.student("20242024010", a),
    outsider = await f.student("20242025020", b);
  const teacherAudiences = await teacher.client.request("/audiences");
  assert.equal(teacherAudiences.status, 200);
  assert(teacherAudiences.data.some((choice) => choice.groupId === ga));
  assert(teacherAudiences.data.some((choice) => choice.groupId === gb));
  assert(!teacherAudiences.data.some((choice) => choice.groupId === other));
  assert(!teacherAudiences.data.some((choice) => !choice.groupId));
  assert.equal((await student.client.request("/groups")).data.length, 2);
  assert.equal(
    (await student.client.request(`/groups/${other}/join`, "POST", {})).status,
    404,
  );
  assert.equal(
    (
      await student.client.request(`/groups/${ga}/join`, "POST", {
        userId: outsider.result.data.user.id,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await teacher.client.request("/groups", "POST", {
        departmentId: a,
        batch: "2025",
        className: "Year 1",
        section: "A",
      })
    ).status,
    403,
  );
  const data = {
    title: "Section A exam",
    content: "Bring your ID",
    category: "EXAM",
    departmentId: a,
    groupId: ga,
    status: "PUBLISHED",
  };
  const n = await teacher.client.request("/notices", "POST", data);
  assert.equal(n.status, 201);
  assert.equal(
    (await student.client.request(`/notices/${n.data.id}`)).status,
    404,
  );
  assert.equal(
    (await student.client.request(`/groups/${ga}/join`, "POST", {})).status,
    200,
  );
  assert.equal(
    (await student.client.request(`/groups/${ga}/join`, "POST", {})).status,
    200,
  );
  assert.equal(
    (await student.client.request(`/notices/${n.data.id}`)).status,
    200,
  );
  assert.equal(
    (await outsider.client.request(`/notices/${n.data.id}`)).status,
    404,
  );
  assert.equal(
    (
      await teacher.client.request("/notices", "POST", {
        ...data,
        groupId: other,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await teacher.client.request("/notices", "POST", {
        ...data,
        groupId: null,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await teacher.client.request(`/notices/${n.data.id}`, "PUT", {
        ...data,
        groupId: gb,
        version: 1,
      })
    ).status,
    400,
  );
  const pdf = Buffer.from("%PDF-1.4 test");
  f.db
    .prepare("INSERT INTO attachments VALUES(?,?,?,?,?)")
    .run(n.data.id, "test.pdf", "application/pdf", pdf.length, pdf);
  f.db
    .prepare(
      "INSERT INTO document_previews(notice_id,source_hash,status,pdf,updated_at) VALUES(?,?,'READY',?,?)",
    )
    .run(n.data.id, "test", pdf, Date.now());
  f.db
    .prepare("INSERT INTO document_pages VALUES(?,1,?)")
    .run(n.data.id, Buffer.from("test-image"));
  for (const suffix of [
    "document",
    "document/pdf",
    "document/pages/1",
    "attachment",
  ]) {
    assert.equal(
      (await student.client.request(`/notices/${n.data.id}/${suffix}`)).status,
      200,
    );
    assert.equal(
      (await outsider.client.request(`/notices/${n.data.id}/${suffix}`)).status,
      404,
    );
  }
  assert.equal(
    (await student.client.request(`/groups/${ga}/membership`, "DELETE", {}))
      .status,
    200,
  );
  assert.equal(
    (await student.client.request(`/notices/${n.data.id}/document/pdf`)).status,
    404,
  );
  await student.client.request(`/groups/${ga}/join`, "POST", {});
  await f.admin.request(
    `/admin/students/${student.result.data.user.id}/department`,
    "PUT",
    { departmentId: b },
  );
  assert.equal(
    f.db
      .prepare("SELECT count(*) n FROM group_memberships WHERE user_id=?")
      .get(student.result.data.user.id).n,
    0,
  );
  assert.equal(
    (await student.client.request(`/notices/${n.data.id}`)).status,
    401,
  );
  await student.client.request("/auth/student", "POST", {
    studentId: "20242024010",
    email: "20242024010@nwu.ac.bd",
  });
  assert.equal(
    (await student.client.request(`/notices/${n.data.id}`)).status,
    404,
  );
});

test("only admins broadcast university-wide; heads broadcast only their current department", async (t) => {
  const f = await fixture(t),
    a = await f.department("CSE"),
    b = await f.department("EEE"),
    teacher = await f.teacher("Head teacher", [a, b]);
  const data = {
    title: "Department meeting",
    content: "Meeting details",
    category: "ANNOUNCEMENT",
    departmentId: a,
    status: "PUBLISHED",
  };
  assert.equal(
    (await teacher.client.request("/notices", "POST", data)).status,
    403,
  );
  await f.admin.request(`/admin/departments/${a}/head`, "PUT", {
    teacherUserId: teacher.id,
  });
  const n = await teacher.client.request("/notices", "POST", data);
  assert.equal(n.status, 201);
  assert.equal(
    (
      await teacher.client.request("/notices", "POST", {
        ...data,
        departmentId: b,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await teacher.client.request("/notices", "POST", {
        ...data,
        departmentId: null,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await teacher.client.request("/groups", "POST", {
        departmentId: a,
        batch: "2024",
        className: "Semester 1",
        section: "A",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await teacher.client.request("/groups", "POST", {
        departmentId: b,
        batch: "2024",
        className: "Semester 1",
        section: "A",
      })
    ).status,
    403,
  );
  await f.admin.request(`/admin/departments/${a}/head`, "PUT", {
    teacherUserId: null,
  });
  assert.equal(
    (await teacher.client.request("/notices", "POST", data)).status,
    403,
  );
  assert.equal(
    (
      await teacher.client.request(`/notices/${n.data.id}`, "PUT", {
        ...data,
        version: 1,
      })
    ).status,
    404,
  );
  assert.equal(
    (await f.admin.request("/notices", "POST", { ...data, departmentId: null }))
      .status,
    201,
  );
});

test("class duplicates, inactive groups, and invalid membership constraints fail safely", async (t) => {
  const f = await fixture(t),
    a = await f.department("CSE"),
    b = await f.department("EEE"),
    g = await f.group(a);
  const student = await f.student("20242024010", b);
  assert.throws(() =>
    f.db
      .prepare("INSERT INTO group_memberships VALUES(?,?,?)")
      .run(g, student.result.data.user.id, Date.now()),
  );
  const data = {
    departmentId: a,
    batch: "2024",
    className: "Semester 3",
    section: "A",
  };
  assert.equal((await f.admin.request("/groups", "POST", data)).status, 409);
  assert.equal(
    (
      await f.admin.request(`/groups/${g}`, "PATCH", {
        batch: "2024",
        className: "Semester 3",
        section: "A",
        active: false,
      })
    ).status,
    200,
  );
  const teacher = await f.teacher("Class faculty", [a]);
  assert.equal((await teacher.client.request("/audiences")).data.length, 0);
  assert.equal(
    (
      await teacher.client.request("/notices", "POST", {
        title: "Inactive",
        content: "No",
        category: "EXAM",
        departmentId: a,
        groupId: g,
        status: "PUBLISHED",
      })
    ).status,
    403,
  );
});

test("student self-enrollment accepts ID or email, rejects duplicates, and never accepts privileges", async (t) => {
  const f = await fixture(t),
    dept = await f.department("CSE"),
    c = f.client();
  const body = {
    identifier: " 20242024010@NWU.AC.BD ",
    name: "First student",
    departmentId: dept,
  };
  const joined = await c.request("/auth/student", "POST", body);
  assert.equal(joined.status, 200);
  assert.equal(joined.data.user.role, "STUDENT");
  assert.equal(joined.data.provisional, true);
  const originalId = joined.data.user.id;
  assert.equal(
    (await c.request("/auth/student", "POST", { ...body, role: "ADMIN" }))
      .status,
    400,
  );
  assert.equal(
    (
      await c.request("/auth/student", "POST", {
        ...body,
        identifier: "20242024010",
      })
    ).status,
    409,
  );
  const returning = await c.request("/auth/student", "POST", {
    identifier: "20242024010",
  });
  assert.equal(returning.status, 200);
  assert.equal(returning.data.user.id, originalId);
  assert.equal(
    (
      await c.request("/auth/student", "POST", {
        identifier: "20242024010@nwu.ac.bd",
      })
    ).data.user.id,
    originalId,
  );
  assert.equal(
    (
      await c.request("/auth/student", "POST", {
        ...body,
        identifier: "20242025020@other.edu",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await c.request("/auth/student", "POST", {
        ...body,
        identifier: "20242025020",
        departmentId: "invalid",
      })
    ).status,
    400,
  );
  assert.equal((await c.request("/admin/users")).status, 403);
  assert.equal(
    f.db.prepare("SELECT count(*) n FROM student_identities").get().n,
    1,
  );
});

test("document analysis selects sourced closure and exam facts without inventing dates", () => {
  const closure = analyzeNoticeText(
    "NORTH WESTERN UNIVERSITY\nNOTICE\nThe university will be closed form 4 October to 21 October.\nClasses resume on 22 October.",
  );
  assert.equal(
    closure.title,
    "The university will be closed from 4 October to 21 October",
  );
  assert.equal(closure.category, "ANNOUNCEMENT");
  assert(closure.keywords[0].includes("21 October"));
  assert(
    !closure.keywords.some((phrase) => phrase === "NORTH WESTERN UNIVERSITY"),
  );
  const exam = analyzeNoticeText(
    "NOTICE\nExams for the Department of CSE will start on 5 November.\nPlease consult the exam routine.",
  );
  assert.equal(exam.category, "EXAM");
  assert.match(exam.title, /Department of CSE.*5 November/);
  assert(!exam.title.includes("21 October"));
  assert.equal(analyzeNoticeText("NOTICE\nBy order").needsReview, true);
});

test("long scanned notice summaries keep the event, venue, and a separate deadline", () => {
  const notice = [
    "North Western University",
    "Committed to World Class Education",
    "Ref: NWU/CSE/Notice/Thesis/Defense/2026/09/22",
    "Date: 22-09-2026",
    "DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING",
    "Notice Regarding",
    "Thesis Defense",
    "The Department of Computer Science and Engineering announces that the Thesis Defense Board for",
    "CSE-4100 and CSE-4200 for the students of Fall 2022 (HSC Intake) and Spring 2023 (Diploma",
    "Intake), enrolled in the B.Sc. in Computer Science and Engineering program, will be held on Tuesday,",
    "6 October 2026, from 9:45 AM in Rooms 702 and 704.",
    "All concerned students are required to complete their thesis presentation, final report, and other",
    "necessary academic requirements in consultation with their respective supervisors and second",
    "examiners before appearing before the Defense Board.",
    "All students must clear their outstanding University dues on or before 30 September 2026. Students",
    "who fail to clear all outstanding dues within the specified deadline will not be permitted to appear",
    "before the Thesis Defense Board.",
    "Students are advised to follow the instructions of their supervisors and second examiners.",
    "M. Raihan",
    "Head",
    "CC:",
    "1. Registrar, NWU",
    "2. Exam Controller, NWU",
  ].join("\n");
  const result = analyzeNoticeText(notice);
  assert.equal(
    result.title,
    "Thesis Defense for CSE-4100 and CSE-4200 on 6 October 2026",
  );
  assert.match(result.summary, /CSE-4100 and CSE-4200/);
  assert.match(result.summary, /6 October 2026/);
  assert.match(result.summary, /9:45 AM/);
  assert.match(result.summary, /Rooms 702 and 704/);
  assert.match(result.summary, /thesis presentation/);
  assert.match(result.summary, /30 September 2026/);
  assert(!result.summary.includes("Registrar, NWU"));
  assert(!result.summary.includes("Exam Controller, NWU"));
  assert(!result.summary.includes("Ref:"));
  assert.equal(analyzeNoticeText("Exam Controller, NWU.").title, "");
});

test("generic notice summaries retain the main action without requiring a known category", () => {
  const notice = analyzeNoticeText(
    [
      "UNIVERSITY OFFICE",
      "Notice regarding student research grant applications",
      "Applications for the student research grant are now available to all final-year students.",
      "Submit the signed proposal and supervisor endorsement to the research office by 15 December 2026.",
      "A review committee will publish its decision on 10 January 2027.",
      "CC:",
      "1. University Website",
    ].join("\n"),
  );
  assert.match(notice.title, /research grant applications/i);
  assert.match(notice.summary, /signed proposal/);
  assert.match(notice.summary, /15 December 2026/);
  assert.match(notice.summary, /10 January 2027/);
  assert(!notice.summary.includes("University Website"));
  const fields = analyzeNoticeText(
    [
      "Notice Regarding Library Orientation",
      "Date: 8 January 2027",
      "Venue: Central Library, Room 201.",
      "Submit questions to library@nwu.ac.bd by 6 January 2027.",
    ].join("\n"),
  );
  assert.match(fields.summary, /8 January 2027/);
  assert.match(fields.summary, /Central Library, Room 201/);
  assert.match(fields.summary, /library@nwu.ac.bd/);
});

test("generic scanned headings use the event in the body and keep schedule facts", () => {
  const notice = analyzeNoticeText(
    [
      "North Western University",
      "Ref:NWU/Reg/Orientation/SP & Fall-26/Notice/2026/529",
      "Date: 8 September 2026",
      "Notice",
      "This is to inform all Hon’ble Deans of Faculties, Heads of Departments, Section Heads, and",
      'faculty members that the ‘Central Orientation Program-2026" for the newly admitted students',
      "of the ‘Spring & Fall 2026? Semester will be held according to the following schedule:",
      "Date & Time Day Venue",
      "September 10, 2026",
      "Auditorium,",
      "2.45 PM",
      "Thursday | Divisional Commissioner's Office, Khulna",
      "We are pleased to announce that Professor Dr. A. B. M. Obaidul Islam will attend as Chief Guest.",
      "By order of the authority,",
      "Copy forwarded for necessary action to:",
      "1. Controller of Examinations",
    ].join("\n"),
  );
  assert.equal(
    notice.title,
    "Central Orientation Program-2026 on September 10, 2026",
  );
  assert.match(notice.summary, /newly admitted students/);
  assert.match(notice.summary, /September 10, 2026/);
  assert.match(notice.summary, /2\.45 PM/);
  assert.match(notice.summary, /Divisional Commissioner's Office, Khulna/);
  assert(!/following schedule|Copy forwarded|N\w+\/Reg\//i.test(notice.title));
  assert(!notice.summary.includes("Controller of Examinations"));
});

test("closure titles keep the actual day or full range, not the document issue date", () => {
  const singleDay = analyzeNoticeText(
    [
      "North Western University",
      "Ref : NWU/Reg./Ashura/Notice/2026/337",
      "Date: 25 June 2026",
      "Notice",
      "It is hereby notified to all concerned that North Western University will remain closed",
      "on June 26, 2026, on account of Ashura, as per the declared holidays.",
      "(Dr. Sk. Shafiqur Rahman)",
      "Registrar",
      "Copy to (Not according to seniority)",
      "1. Treasurer",
    ].join("\n"),
  );
  assert.equal(
    singleDay.title,
    "North Western University closed on June 26, 2026 for Ashura",
  );
  assert.match(singleDay.summary, /June 26, 2026/);
  assert(!singleDay.summary.includes("25 June 2026"));
  assert(!singleDay.title.includes("25 June 2026"));
  const range = analyzeNoticeText(
    [
      "Date: 1 October 2026",
      "Notice",
      "It is hereby notified to all concerned that North Western University will remain closed from 4 October to 21 October 2026 for the autumn break.",
      "Classes resume on 22 October 2026.",
    ].join("\n"),
  );
  assert.match(range.title, /4 October to 21 October 2026/);
  assert(!/\b1 October 2026\b/.test(range.title));
  assert.match(range.summary, /22 October 2026/);
  const longSubject = analyzeNoticeText(
    [
      "Notice",
      "It is hereby notified to all concerned that students of the Department of Computer Science and Engineering who are completing their final research projects must submit the signed report to their supervisors by 15 December 2026.",
    ].join("\n"),
  );
  assert.match(longSubject.title, /15 December 2026/);
  assert(longSubject.title.length <= 120);
});

test("OCR boilerplate and clipped clauses do not become notice titles", () => {
  const notice = analyzeNoticeText(
    [
      "Ref: NWU/Reg./Christmas/Notice/2025/973",
      "Date: 23 Dec 2025",
      "Notice",
      "Tt is hereby notified to all concerned that North Western University will remain closed",
      "on Thursday, December 25, 2025, on the occasion of Christmas Day.",
      "(Dr. Sk. Shafiqur Rahman)",
      "Registrar",
      "Copy to (Not according to seniority)",
    ].join("\n"),
  );
  assert.equal(
    notice.title,
    "North Western University closed on Thursday, December 25, 2025 for Christmas Day",
  );
  assert.match(notice.summary, /^North Western University will remain closed/);
  assert(!/\bTt\b|hereby notified|on the$/i.test(notice.title));
  assert(!notice.summary.includes("23 Dec 2025"));
});

test("multi-deadline notices and revised orders retain their actual subject", () => {
  const retake = analyzeNoticeText(
    [
      "North Western University",
      "Department of English Language and Literature",
      "Notice",
      "Students with backlog courses are required to apply for the Retake Examination by September 15, 2026.",
      "Students with a grade below B and GPA below 3.00 may apply for Course Improvement by September 15, 2026.",
      "Students seeking re-check of answer scripts must submit a form and Tk. 500 per course by September 12, 2026.",
      "CC:",
      "1. Registrar, NWU",
    ].join("\n"),
  );
  assert.match(retake.title, /Retake Examination/);
  assert.match(retake.title, /Course Improvement/);
  assert.match(retake.title, /September 15, 2026/);
  assert.match(retake.summary, /September 15, 2026/);
  assert.match(retake.summary, /September 12, 2026/);
  const order = analyzeNoticeText(
    [
      "Office Order (Revised)",
      "Mr. Hasibul Hossain Sumon is released from the duties of Head of the Department of Law.",
      "The board assigned the responsibility of serving as Head of the Department of Law to Mr. Aroj Ali, Assistant Professor.",
      "Mr. Aroj Ali will also serve as Acting Dean of the Faculty of Law.",
      "This Office Order will be effective from August 1, 2026.",
      "Copy forwarded for necessary action to:",
    ].join("\n"),
  );
  assert.match(order.title, /Aroj Ali.*Head of the Department of Law/);
  assert.match(order.title, /August 1, 2026/);
  assert.match(order.summary, /Hasibul Hossain Sumon/);
  assert.match(order.summary, /Aroj Ali/);
  assert.match(order.summary, /August 1, 2026/);
});

test("revised admission tables become a dated title and readable schedule", () => {
  const notice = analyzeNoticeText(
    [
      "North Western University",
      "Date:",
      "July 1, 2026",
      "Notice (Revised)",
      "Itis hereby notified to inform all prospective students seeking admission (Fall-2026) to",
      "the Department of Law at North Western University that the admission process will be",
      "conducted according to the following schedule.",
      "[Saja",
      "Tie]",
      "Admission Form Distribution & Receipt",
      "9 July 2026 till 4 pm",
      "Eligible List Published",
      "10 July 2026",
      "Admit Card Distribution",
      "11, 13 and 14 July 2026",
      "4, | Admission Test",
      "18 July 2026",
      "10 am—11 am",
      "5, | Result Publish",
      "18 July 2026 at 4 pm",
      "By order of the authorities;",
      "Copy sent for your kind information and necessary action",
    ].join("\n"),
  );
  assert.match(notice.title, /Department of Law admission schedule/i);
  assert.match(notice.title, /9–18 July 2026/);
  assert.match(
    notice.summary,
    /Admit card distribution: 11, 13 and 14 July 2026/,
  );
  assert.match(notice.summary, /Admission test: 18 July 2026, 10 am–11 am/);
  assert.match(notice.summary, /Results? publish/i);
  assert(!/Saja|Copy sent|Notice \(Revised\)/i.test(notice.summary));
  assert.equal(notice.needsReview, false);
});

test("scanned admit-card notices use the heading and department collection dates", () => {
  const notice = analyzeNoticeText(
    [
      "Office of the Controller of Examinations",
      "North Western University, Khulna",
      "23 June 2026",
      "Notice Regarding Issue of Admit Card",
      "All concerned students are hereby informed that the time for registration has been extended by",
      "the registrar's office up to 25th of June 2026 considering the busy schedule of classes.",
      "Without the payment clearance and consent from prior authority the Office of the",
      "Controller of Examinations will not issue any Admit Card. Students of the following",
      "department can collect their admit cards from the office of the Controller of Examinations",
      "Departments: -",
      "CSE- 27, 29 & 30 June",
      "EEE- 27, 29 & 30 June",
      "CIVIL-27, 29 & 30 June",
      "Person & Event",
      "Place of Issue",
      "Ground Floor, Office of the Controller of Examinations (Building-2)",
      "Without any exceptional case, no admit card will be issued after the deadline.",
      "Copy for information & necessary action:",
    ].join("\n"),
  );
  assert.match(notice.title, /Issue of Admit Card for CSE, EEE and CIVIL/);
  assert.match(notice.title, /27, 29 and 30 June/);
  assert.match(notice.summary, /25th of June 2026/);
  assert.match(notice.summary, /Ground Floor.*Building 2/);
  assert(
    !/Person & Event|Copy for information|registrar's office up to/i.test(
      notice.summary,
    ),
  );
});

test("analysis upload is staff-only and never publishes a notice by itself", async (t) => {
  let calls = 0;
  const f = await fixture(t, {
    analyzeDocument: async (file) => {
      calls++;
      assert.equal(file.originalname, "closure.pdf");
      return analyzeNoticeText(
        "University will be closed from 4 October to 21 October.",
      );
    },
  });
  const dept = await f.department("CSE"),
    teacher = await f.teacher("doc teacher", [dept]),
    student = await f.student("20242024010", dept),
    document = new FormData();
  document.set(
    "file",
    new Blob(["%PDF-1.4\nplaceholder"], { type: "application/pdf" }),
    "closure.pdf",
  );
  assert.equal(
    (await student.client.request("/notices/analyze", "POST", document)).status,
    403,
  );
  assert.equal(
    (await f.client().request("/notices/analyze", "POST", document)).status,
    401,
  );
  const pending = await f.teacher("pending doc", [dept], false);
  assert.equal(
    (await pending.client.request("/notices/analyze", "POST", document)).status,
    403,
  );
  assert.equal(
    (await teacher.client.request("/notices/analyze", "POST", new FormData()))
      .status,
    400,
  );
  const analyzed = await teacher.client.request(
    "/notices/analyze",
    "POST",
    document,
  );
  assert.equal(analyzed.status, 200);
  assert.match(analyzed.data.title, /closed from 4 October to 21 October/);
  assert.equal(calls, 1);
  assert.equal(f.db.prepare("SELECT count(*) n FROM notices").get().n, 0);
  const saved = await f.notice(teacher.client, dept, "DRAFT");
  const stored = Buffer.from("%PDF-1.4\nplaceholder");
  f.db
    .prepare("INSERT INTO attachments VALUES(?,?,?,?,?)")
    .run(saved.id, "closure.pdf", "application/pdf", stored.length, stored);
  assert.equal(
    (await student.client.request(`/notices/${saved.id}/analyze`, "POST", {}))
      .status,
    404,
  );
  assert.equal(
    (await pending.client.request(`/notices/${saved.id}/analyze`, "POST", {}))
      .status,
    403,
  );
  const reanalyzed = await teacher.client.request(
    `/notices/${saved.id}/analyze`,
    "POST",
    {},
  );
  assert.equal(reanalyzed.status, 200);
  assert.match(reanalyzed.data.summary, /closed from 4 October/);
  assert.equal(calls, 2);
  assert.equal(
    f.db.prepare("SELECT content FROM notices WHERE id=?").get(saved.id)
      .content,
    "Actual content supplied by the author.",
  );
  const invalid = new FormData();
  invalid.set(
    "file",
    new Blob(["plain text"], { type: "application/pdf" }),
    "bad.pdf",
  );
  assert.equal(
    (await teacher.client.request("/notices/analyze", "POST", invalid)).status,
    400,
  );
});
