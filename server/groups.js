import { randomUUID } from "node:crypto";
import { fields, text, fail } from "./security.js";
import { assigned, isHead } from "./permissions.js";
import { audit, transaction } from "./db.js";
export const groupLabel = (g) =>
  `${g.batch} · ${g.class_name} · Section ${g.section}`;
export function groupRoutes(app, db, authenticate, approved) {
  const manage = (user, department) =>
    assigned(db, user, department) &&
    (user.role === "ADMIN" || isHead(db, user, department));
  const lookup = (req) => {
    const g = db
      .prepare("SELECT * FROM class_groups WHERE id=?")
      .get(req.params.id);
    if (!g || !assigned(db, req.user, g.department_id))
      fail(404, "Class group not found.");
    return g;
  };
  app.use("/api/groups", authenticate, approved);
  app.get("/api/groups", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT g.*,d.name department_name FROM class_groups g JOIN departments d ON d.id=g.department_id ORDER BY d.code,g.batch,g.class_name,g.section",
        )
        .all()
        .filter(
          (g) =>
            assigned(db, req.user, g.department_id) &&
            (g.active || manage(req.user, g.department_id)),
        )
        .map((g) => ({
          ...g,
          label: groupLabel(g),
          canManage: manage(req.user, g.department_id),
          joined: !!db
            .prepare(
              "SELECT 1 FROM group_memberships WHERE group_id=? AND user_id=?",
            )
            .get(g.id, req.user.id),
          memberCount: db
            .prepare(
              "SELECT count(*) count FROM group_memberships WHERE group_id=?",
            )
            .get(g.id).count,
        })),
    ),
  );
  app.post("/api/groups", (req, res) => {
    fields(req.body, ["departmentId", "batch", "className", "section"]);
    const dept = text(req.body.departmentId, "Department", 1, 100);
    if (!manage(req.user, dept))
      fail(
        403,
        "Only the administrator or this department's head can create classes.",
      );
    const id = randomUUID();
    transaction(db, () => {
      db.prepare("INSERT INTO class_groups VALUES(?,?,?,?,?,1,?,?)").run(
        id,
        dept,
        text(req.body.batch, "Batch", 1, 40),
        text(req.body.className, "Class", 1, 80),
        text(req.body.section, "Section", 1, 30),
        req.user.id,
        Date.now(),
      );
      audit(db, req.user.id, "CLASS_CREATED", id);
    });
    res.status(201).json({ id });
  });
  app.patch("/api/groups/:id", (req, res) => {
    const g = lookup(req);
    if (!manage(req.user, g.department_id))
      fail(403, "You cannot manage this class.");
    fields(req.body, ["batch", "className", "section", "active"]);
    if (typeof req.body.active !== "boolean")
      fail(400, "Choose class availability.");
    transaction(db, () => {
      db.prepare(
        "UPDATE class_groups SET batch=?,class_name=?,section=?,active=? WHERE id=?",
      ).run(
        text(req.body.batch, "Batch", 1, 40),
        text(req.body.className, "Class", 1, 80),
        text(req.body.section, "Section", 1, 30),
        Number(req.body.active),
        g.id,
      );
      audit(db, req.user.id, "CLASS_UPDATED", g.id, {
        active: req.body.active,
      });
    });
    res.json({ ok: true });
  });
  app.post("/api/groups/:id/join", (req, res) => {
    fields(req.body, []);
    const g = lookup(req);
    if (req.user.role !== "STUDENT" || !g.active)
      fail(403, "Only students in this department can join an active class.");
    transaction(db, () => {
      db.prepare(
        "INSERT INTO group_memberships VALUES(?,?,?) ON CONFLICT DO NOTHING",
      ).run(g.id, req.user.id, Date.now());
      audit(db, req.user.id, "CLASS_JOINED", g.id);
    });
    res.json({ ok: true });
  });
  app.delete("/api/groups/:id/membership", (req, res) => {
    fields(req.body, []);
    const g = lookup(req);
    if (req.user.role !== "STUDENT")
      fail(403, "Only students can leave a class.");
    transaction(db, () => {
      db.prepare(
        "DELETE FROM group_memberships WHERE group_id=? AND user_id=?",
      ).run(g.id, req.user.id);
      audit(db, req.user.id, "CLASS_LEFT", g.id);
    });
    res.json({ ok: true });
  });
  app.get("/api/audiences", authenticate, approved, (req, res) => {
    if (req.user.role === "STUDENT") return res.json([]);
    const options = [];
    if (req.user.role === "ADMIN")
      options.push({
        id: "ALL",
        departmentId: "",
        groupId: "",
        label: "University-wide broadcast",
      });
    for (const d of db
      .prepare("SELECT * FROM departments WHERE active=1 ORDER BY code")
      .all()) {
      if (!assigned(db, req.user, d.id)) continue;
      if (manage(req.user, d.id)) {
        options.push({
          id: d.id,
          departmentId: d.id,
          groupId: "",
          label: `${d.name} (${d.code}) - Department broadcast`,
        });
      }
      for (const g of db
        .prepare(
          "SELECT * FROM class_groups WHERE department_id=? AND active=1 ORDER BY batch,class_name,section",
        )
        .all(d.id)) {
        options.push({
          id: g.id,
          departmentId: d.id,
          groupId: g.id,
          label: `${d.name} (${d.code}) - ${groupLabel(g)}`,
        });
      }
    }
    res.json(options);
  });
}
