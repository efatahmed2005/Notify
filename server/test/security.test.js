import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../db.js";
import { createApp } from "../app.js";
import { hashPassword, tokenHash } from "../security.js";
import { configuration } from "../config.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const password = "Individual test passphrase 473!";
const origin = "http://localhost:8080";
async function fixture(t, { provisional = true, firstLogin = false } = {}) {
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
      2,
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
