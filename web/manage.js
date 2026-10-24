"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    e = Notify.escape;
  let departments = [],
    users = [],
    tab = "teachers"; // Default to teachers so admin immediately sees approvals

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
        `<form data-action="create-department" class="management-card">
          <h3>Create department</h3>
          <div class="form-row">
            <label>Code<input name="code" required maxlength="12" pattern="[A-Za-z][A-Za-z0-9_-]+" placeholder="e.g. CSE"></label>
            <label>Department name<input name="name" required maxlength="120" placeholder="e.g. Computer Science & Engineering"></label>
          </div>
          <p role="alert" class="form-error"></p>
          <button type="submit" class="button primary">Create department</button>
        </form>
        <h3>Departments &amp; Assigned Heads</h3>
        ${
          departments.length
            ? departments
                .map(
                  (d) =>
                    `<article class="management-card">
                      <h3>${e(d.name)} <small>${e(d.code)}</small></h3>
                      <p><strong>Current head:</strong> ${e(d.headName || "Not assigned")}</p>
                      <form data-action="edit-department" data-id="${e(d.id)}">
                        <label>Department name<input name="name" value="${e(d.name)}" required maxlength="120"></label>
                        <label>Availability
                          <select name="active">
                            <option value="true" ${d.active ? "selected" : ""}>Active</option>
                            <option value="false" ${!d.active ? "selected" : ""}>Inactive</option>
                          </select>
                        </label>
                        <p role="alert" class="form-error"></p>
                        <button type="submit" class="button secondary">Update department</button>
                      </form>
                      ${
                        d.active
                          ? `<form data-action="assign-head" data-id="${e(d.id)}" style="margin-top:14px">
                              <label>Department head
                                <select name="teacherUserId">
                                  <option value="">No head assigned</option>
                                  ${users
                                    .filter(
                                      (u) =>
                                        u.role === "TEACHER" &&
                                        u.status === "APPROVED" &&
                                        u.departments.some((x) => x.id === d.id),
                                    )
                                    .map(
                                      (u) =>
                                        `<option value="${e(u.id)}" ${u.id === d.headUserId ? "selected" : ""}>${e(u.name)} (${e(u.email)})</option>`,
                                    )
                                    .join("")}
                                </select>
                              </label>
                              <p role="alert" class="form-error"></p>
                              <button type="submit" class="button primary">Save head assignment</button>
                            </form>`
                          : ""
                      }
                    </article>`,
                )
                .join("")
            : "<p>No departments have been created.</p>"
        }`;
    } else {
      // Teachers tab
      const teachers = users
        .filter((u) => u.role === "TEACHER")
        .sort((a, b) => {
          const rank = (status) =>
            status === "PENDING" ? 0 : status === "APPROVED" ? 1 : 2;
          const diff = rank(a.status) - rank(b.status);
          if (diff !== 0) return diff;
          return a.name.localeCompare(b.name);
        });

      $("manageContent").innerHTML =
        `<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px">
          <h3 style="margin:0">Teacher Registrations &amp; Approvals</h3>
          <label class="management-filter" style="margin:0">
            <span>Filter department:</span>
            <select id="manageDepartmentFilter">
              <option value="">All departments</option>
              ${options([], false)}
            </select>
          </label>
        </div>
        ${
          teachers.length
            ? teachers
                .map((u) => {
                  const isPending = u.status === "PENDING";
                  const isApproved = u.status === "APPROVED";
                  const requestedDeptNames = u.requestedDepartmentIds
                    .map((id) => departments.find((d) => d.id === id)?.name || id)
                    .join(", ");
                  const assignedDeptNames = u.departments
                    .map((d) => d.name)
                    .join(", ");
                  const headDepts = departments
                    .filter((d) => d.headUserId === u.id)
                    .map((d) => d.name)
                    .join(", ");

                  return `<article class="management-card user-record" data-departments="${e([...u.departments.map((d) => d.id), ...u.requestedDepartmentIds].join(" "))}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
                      <div>
                        <h3 style="margin:0 0 4px">${e(u.name)}</h3>
                        <p style="margin:0; color:var(--muted); font-size:13px">${e(u.email)} &bull; <code>${e(u.teacherId)}</code></p>
                      </div>
                      <span class="status-pill ${u.status.toLowerCase()}">${e(u.status)}</span>
                    </div>

                    <div style="font-size:13px; line-height:1.6; margin:10px 0; padding:10px; background:var(--soft); border-radius:6px">
                      <div><strong>Requested department:</strong> ${e(requestedDeptNames || "None")}</div>
                      ${assignedDeptNames ? `<div><strong>Assigned department(s):</strong> ${e(assignedDeptNames)}</div>` : ""}
                      ${headDepts ? `<div><strong style="color:var(--brand)">Head of:</strong> ${e(headDepts)}</div>` : ""}
                      <div><strong>Institutional details:</strong> ${e(u.institutionalInfo || "None provided")}</div>
                    </div>

                    ${
                      isPending
                        ? `<div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:14px; padding-top:10px; border-top:1px solid var(--line)">
                            <form data-action="quick-approve" data-id="${e(u.id)}" style="display:inline">
                              <button type="submit" class="button primary">Approve Registration</button>
                            </form>
                            <form data-action="quick-reject" data-id="${e(u.id)}" style="display:inline-flex; gap:6px; align-items:center">
                              <input name="reason" placeholder="Rejection reason" required style="width:200px; padding:6px 10px; font-size:12px">
                              <button type="submit" class="button destructive">Reject</button>
                            </form>
                          </div>`
                        : isApproved
                          ? `<div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--line)">
                              <form data-action="assign-departments" data-id="${e(u.id)}">
                                <label style="font-weight:600; margin-bottom:6px">Department assignments:
                                  <select name="departmentIds" multiple size="3" style="margin-top:4px">
                                    ${options(u.departments.map((d) => d.id))}
                                  </select>
                                </label>
                                <p class="field-help" style="margin:4px 0 8px">Hold Ctrl or Cmd to select multiple departments.</p>
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px">
                                  <button type="submit" class="button primary">Save Department Assignments</button>
                                  <button type="button" class="button secondary" data-suspend-id="${e(u.id)}" style="color:#b91c1c">Suspend</button>
                                </div>
                              </form>
                            </div>`
                          : `<div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--line)">
                              <form data-action="quick-approve" data-id="${e(u.id)}" style="display:inline">
                                <button type="submit" class="button primary">Re-activate / Approve</button>
                              </form>
                            </div>`
                    }
                  </article>`;
                })
                .join("")
            : "<p>No teacher registrations yet.</p>"
        }`;
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

  $("manageButton").onclick = async () => {
    if (Notify.user?.role !== "ADMIN") return;
    window.closeMenu?.();
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

  $("manageContent").addEventListener("click", async (event) => {
    const suspendBtn = event.target.closest("[data-suspend-id]");
    if (suspendBtn) {
      const id = suspendBtn.dataset.suspendId;
      if (confirm("Suspend this teacher account?")) {
        try {
          await Notify.request(`/admin/users/${id}/status`, {
            method: "PATCH",
            body: { status: "SUSPENDED", reason: "Administrative suspension" },
          });
          await load();
          document.dispatchEvent(new Event("notify:signed-in"));
          document.dispatchEvent(
            new CustomEvent("notify:message", { detail: "Account suspended." }),
          );
        } catch (err) {
          $("manageError").textContent = err.message;
        }
      }
    }
  });

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
        case "quick-approve":
          await Notify.request(`/admin/users/${id}/status`, {
            method: "PATCH",
            body: { status: "APPROVED", reason: "" },
          });
          break;
        case "quick-reject":
          await Notify.request(`/admin/users/${id}/status`, {
            method: "PATCH",
            body: { status: "REJECTED", reason: body.reason || "Registration not approved" },
          });
          break;
        case "assign-departments":
          await Notify.request(`/admin/teachers/${id}/departments`, {
            method: "PUT",
            body: { departmentIds: data.getAll("departmentIds") },
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
