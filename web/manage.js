"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    e = Notify.escape;
  let departments = [],
    users = [],
    tab = "departments";
  document.addEventListener("notify:signed-out", () => {
    departments = [];
    users = [];
  });
  const options = (selected = [], activeOnly = true) =>
    departments
      .filter((d) => !activeOnly || d.active)
      .map(
        (d) =>
          `<option value="${e(d.id)}" ${selected.includes(d.id) ? "selected" : ""}>${e(d.name)} (${e(d.code)})</option>`,
      )
      .join("");
  async function load() {
    [departments, users] = await Promise.all([
      Notify.request("/admin/departments"),
      Notify.request("/admin/users"),
    ]);
    await render();
  }
  async function render() {
    $("manageError").textContent = "";
    document.querySelectorAll("[data-manage-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.manageTab === tab);
      b.setAttribute("aria-pressed", String(b.dataset.manageTab === tab));
    });
    if (tab === "departments") {
      $("manageContent").innerHTML =
        `<form data-action="create-department" class="management-card"><h3>Create department</h3><div class="form-row"><label>Code<input name="code" required maxlength="12" pattern="[A-Za-z][A-Za-z0-9_-]+"></label><label>Department name<input name="name" required maxlength="120"></label></div><p role="alert" class="form-error"></p><button type="submit" class="button primary">Create department</button></form><h3>Departments and heads</h3>${
          departments.length
            ? departments
                .map(
                  (d) =>
                    `<article class="management-card"><h3>${e(d.name)} <small>${e(d.code)}</small></h3><p>Current head: ${e(d.headName || "Not assigned")}</p><form data-action="edit-department" data-id="${e(d.id)}"><label>Department name<input name="name" value="${e(d.name)}" required maxlength="120"></label><label>Availability<select name="active"><option value="true" ${d.active ? "selected" : ""}>Active</option><option value="false" ${!d.active ? "selected" : ""}>Inactive</option></select></label><p class="field-help">Making a department inactive removes its head assignment and blocks department access.</p><p role="alert" class="form-error"></p><button type="submit" class="button secondary">Update department</button></form>${
                      d.active
                        ? `<form data-action="assign-head" data-id="${e(d.id)}"><label>Department head<select name="teacherUserId"><option value="">No head assigned</option>${users
                            .filter(
                              (u) =>
                                u.role === "TEACHER" &&
                                u.status === "APPROVED" &&
                                u.departments.some((x) => x.id === d.id),
                            )
                            .map(
                              (u) =>
                                `<option value="${e(u.id)}" ${u.id === d.headUserId ? "selected" : ""}>${e(u.name)} - ${e(u.teacherId)}</option>`,
                            )
                            .join(
                              "",
                            )}</select></label><p class="field-help">Only approved teachers assigned to this department are eligible. Reassignment takes effect immediately.</p><p role="alert" class="form-error"></p><button type="submit" class="button primary">Save head assignment</button></form>`
                        : ""
                    }</article>`,
                )
                .join("")
            : "<p>No departments have been created.</p>"
        }`;
    } else if (tab === "teachers") {
      const teachers = users.filter((u) => u.role === "TEACHER");
      $("manageContent").innerHTML =
        `<h3>Teacher registrations and assignments</h3><label class="management-filter">Filter by department<select id="manageDepartmentFilter"><option value="">All departments</option>${options([], false)}</select></label>${
          teachers.length
            ? teachers
                .map(
                  (u) =>
                    `<article class="management-card user-record" data-departments="${e([...u.departments.map((d) => d.id), ...u.requestedDepartmentIds].join(" "))}"><h3>${e(u.name)}</h3><p>${e(u.email)}<br>${e(u.teacherId)}</p><p><strong>${e(u.status)}</strong></p><p>Institutional information: ${e(u.institutionalInfo)}</p><p>Requested: ${e(u.requestedDepartmentIds.map((id) => departments.find((d) => d.id === id)?.name || id).join(", "))}</p><p>Head responsibilities: ${e(
                      departments
                        .filter((d) => d.headUserId === u.id)
                        .map((d) => d.name)
                        .join(", ") || "None",
                    )}</p>${statusForm(u)}${u.status === "APPROVED" ? `<form data-action="assign-departments" data-id="${e(u.id)}"><label>Assigned departments<select name="departmentIds" multiple size="4">${options(u.departments.map((d) => d.id))}</select></label><p class="field-help">Hold Ctrl or Command to select multiple departments. Clearing a department also removes its head assignment for this teacher.</p><p role="alert" class="form-error"></p><button type="submit" class="button primary">Save assignments</button></form>` : ""}</article>`,
                )
                .join("")
            : "<p>No teacher registrations yet.</p>"
        }`;
    } else if (tab === "students") {
      const students = users.filter((u) => u.role === "STUDENT");
      $("manageContent").innerHTML =
        `<form data-action="create-student" class="management-card"><h3>Add a student directory entry</h3><p class="field-help">Use verified university enrollment records. Students cannot select or change their own department.</p><label>Student ID<input name="studentId" required inputmode="numeric" pattern="[0-9]{11}" minlength="11" maxlength="11"></label><label>University email<input name="email" type="email" required></label><label>Full name<input name="name" maxlength="100" required></label><label>Department<select name="departmentId" required><option value="">Select department</option>${options()}</select></label><p role="alert" class="form-error"></p><button type="submit" class="button primary">Add student</button></form><h3>Student directory</h3><label class="management-filter">Filter by department<select id="manageDepartmentFilter"><option value="">All departments</option>${options([], false)}</select></label>${students.map((u) => `<article class="management-card user-record" data-departments="${e(u.departments.map((d) => d.id).join(" "))}"><h3>${e(u.name)}</h3><p>${e(u.studentId)}<br>${e(u.email)} - ${e(u.status)}</p><form data-action="student-department" data-id="${e(u.id)}"><label>Department<select name="departmentId">${options(u.departments.map((d) => d.id))}</select></label><p role="alert" class="form-error"></p><button type="submit" class="button secondary">Update department</button></form>${statusForm(u)}</article>`).join("") || "<p>No students have been added.</p>"}`;
    } else {
      const logs = await Notify.request("/admin/audit");
      $("manageContent").innerHTML =
        `<h3>Recent administrative and notice history</h3><p class="field-help">Showing up to 200 recent events. Passwords and session secrets are never included.</p><div class="table-scroll"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody>${logs.map((l) => `<tr><td>${e(new Date(l.created_at).toLocaleString())}</td><td>${e(l.actorName || "System")}</td><td>${e(l.action)}</td><td>${e(l.target_id)}</td><td>${e(l.details)}</td></tr>`).join("")}</tbody></table></div>`;
    }
    const filter = $("manageDepartmentFilter");
    if (filter)
      filter.onchange = () =>
        document
          .querySelectorAll(".user-record")
          .forEach(
            (row) =>
              (row.hidden =
                !!filter.value &&
                !row.dataset.departments.split(" ").includes(filter.value)),
          );
  }
  function statusForm(user) {
    const statuses =
      user.role === "STUDENT"
        ? ["APPROVED", "SUSPENDED", "DEACTIVATED"]
        : ["APPROVED", "REJECTED", "SUSPENDED", "DEACTIVATED"];
    return `<form data-action="account-status" data-id="${e(user.id)}"><label>Account decision<select name="status" required><option value="">Choose a decision</option>${statuses.map((s) => `<option value="${s}">${s.charAt(0) + s.slice(1).toLowerCase()}</option>`).join("")}</select></label><label>Reason and next steps<textarea name="reason" maxlength="1000" rows="2" placeholder="Required when rejecting a registration"></textarea></label><p class="field-help">Approval does not automatically assign departments. Suspension or deactivation removes assignments and signs the user out.</p><p role="alert" class="form-error"></p><button type="submit" class="button secondary">Save decision</button></form>`;
  }
  $("manageButton").onclick = async () => {
    if (Notify.user?.role !== "ADMIN") return;
    $("manageDialog").showModal();
    $("manageContent").textContent = "Loading administration...";
    try {
      await load();
    } catch (error) {
      $("manageError").textContent = error.message;
    }
  };
  document.querySelectorAll("[data-manage-tab]").forEach(
    (button) =>
      (button.onclick = async () => {
        tab = button.dataset.manageTab;
        try {
          await render();
        } catch (error) {
          $("manageError").textContent = error.message;
        }
      }),
  );
  $("manageContent").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    Notify.submit(form, async () => {
      const data = new FormData(form),
        body = Object.fromEntries(data),
        id = form.dataset.id;
      switch (form.dataset.action) {
        case "create-department":
          await Notify.request("/admin/departments", { method: "POST", body });
          break;
        case "edit-department":
          await Notify.request(`/admin/departments/${id}`, {
            method: "PATCH",
            body: { ...body, active: body.active === "true" },
          });
          break;
        case "assign-head":
          await Notify.request(`/admin/departments/${id}/head`, {
            method: "PUT",
            body: { teacherUserId: body.teacherUserId || null },
          });
          break;
        case "account-status":
          await Notify.request(`/admin/users/${id}/status`, {
            method: "PATCH",
            body,
          });
          break;
        case "assign-departments":
          await Notify.request(`/admin/teachers/${id}/departments`, {
            method: "PUT",
            body: { departmentIds: data.getAll("departmentIds") },
          });
          break;
        case "create-student":
          await Notify.request("/admin/students", { method: "POST", body });
          break;
        case "student-department":
          await Notify.request(`/admin/students/${id}/department`, {
            method: "PUT",
            body,
          });
          break;
      }
      await load();
      document.dispatchEvent(new Event("notify:signed-in"));
      document.dispatchEvent(
        new CustomEvent("notify:message", { detail: "Changes saved." }),
      );
    });
  });
})();
