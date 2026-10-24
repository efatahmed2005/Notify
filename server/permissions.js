import { fail } from "./security.js";
export function identity(db, user) {
  const departments =
    user.role === "ADMIN"
      ? db.prepare("SELECT * FROM departments ORDER BY code").all()
      : user.role === "TEACHER"
        ? db
            .prepare(
              "SELECT d.* FROM departments d JOIN teacher_departments t ON t.department_id=d.id WHERE t.user_id=? AND d.active=1 ORDER BY d.code",
            )
            .all(user.id)
        : db
            .prepare(
              "SELECT d.* FROM departments d JOIN student_identities s ON s.department_id=d.id WHERE s.user_id=? AND d.active=1",
            )
            .all(user.id);
  const heads = db
    .prepare("SELECT department_id FROM department_heads WHERE user_id=?")
    .all(user.id)
    .map((r) => r.department_id);
  const teacher = db
    .prepare(
      "SELECT teacher_id,decision_reason FROM teacher_profiles WHERE user_id=?",
    )
    .get(user.id);
  const student = db
    .prepare("SELECT student_id FROM student_identities WHERE user_id=?")
    .get(user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: !!user.must_change_password,
    departments,
    headDepartmentIds: heads,
    teacherId: teacher?.teacher_id,
    decisionReason: teacher?.decision_reason,
    studentId: student?.student_id,
  };
}
export function requireApproved(user) {
  if (user.status !== "APPROVED" || user.must_change_password)
    fail(403, "This account does not have access to this operation.");
}
export function isHead(db, user, dept) {
  return (
    user.role === "TEACHER" &&
    !!db
      .prepare(
        "SELECT 1 FROM department_heads WHERE user_id=? AND department_id=?",
      )
      .get(user.id, dept)
  );
}
export function assigned(db, user, dept) {
  if (!dept) return user.role === "ADMIN";
  if (user.role === "ADMIN")
    return !!db.prepare("SELECT 1 FROM departments WHERE id=?").get(dept);
  if (
    !db.prepare("SELECT 1 FROM departments WHERE id=? AND active=1").get(dept)
  )
    return false;
  if (user.role === "TEACHER")
    return !!db
      .prepare(
        "SELECT 1 FROM teacher_departments WHERE user_id=? AND department_id=?",
      )
      .get(user.id, dept);
  return !!db
    .prepare(
      "SELECT 1 FROM student_identities WHERE user_id=? AND department_id=?",
    )
    .get(user.id, dept);
}
export function canManage(db, user, notice) {
  if (
    user.status !== "APPROVED" ||
    user.must_change_password ||
    notice.status === "DELETED"
  )
    return false;
  if (user.role === "ADMIN") return true;
  return (
    user.role === "TEACHER" &&
    assigned(db, user, notice.department_id) &&
    (!notice.group_id
      ? isHead(db, user, notice.department_id)
      : !!db
          .prepare("SELECT 1 FROM class_groups WHERE id=? AND active=1")
          .get(notice.group_id)) &&
    (notice.author_id === user.id ||
      (notice.status !== "DRAFT" && isHead(db, user, notice.department_id)))
  );
}
export function canRead(db, user, notice) {
  if (
    user.status !== "APPROVED" ||
    user.must_change_password ||
    notice.status === "DELETED"
  )
    return false;
  if (canManage(db, user, notice)) return true;
  return (
    notice.status === "PUBLISHED" &&
    (notice.department_id === null ||
      assigned(db, user, notice.department_id)) &&
    (!notice.group_id ||
      (!!db
        .prepare("SELECT 1 FROM class_groups WHERE id=? AND active=1")
        .get(notice.group_id) &&
        (user.role !== "STUDENT" ||
          !!db
            .prepare(
              "SELECT 1 FROM group_memberships WHERE group_id=? AND user_id=?",
            )
            .get(notice.group_id, user.id))))
  );
}
