"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    e = Notify.escape;
  async function load() {
    const groups = await Notify.request("/groups"),
      user = Notify.user;
    const departments = user.departments.filter(
      (d) =>
        d.active &&
        (user.role === "ADMIN" || user.headDepartmentIds.includes(d.id)),
    );
    $("groupsContent").innerHTML =
      (departments.length
        ? `<form data-action="create" class="management-card"><h3>Create a class group</h3><label>Department<select name="departmentId">${departments.map((d) => `<option value="${e(d.id)}">${e(d.name)}</option>`).join("")}</select></label><div class="form-row"><label>Batch / intake<input name="batch" required maxlength="40" placeholder="2024"></label><label>Class / semester<input name="className" required maxlength="80" placeholder="Semester 3"></label><label>Section<input name="section" required maxlength="30" placeholder="A"></label></div><p role="alert" class="form-error"></p><button type="submit" class="button primary">Create class</button></form>`
        : "") +
        (user.role === "STUDENT"
          ? "<p>Join the classes you attend. Groups are limited to your department. Joining gives you access to published class notices; leaving removes that access.</p>"
          : "<p>Teachers can send notices to classes in their assigned departments. Department heads can also broadcast to their own department.</p>") +
        groups
          .map(
            (g) =>
              `<article class="management-card"><h3>${e(g.label)}</h3><p>${e(g.department_name)} ? ${g.memberCount} students ? ${g.active ? "Active" : "Inactive"}</p>${user.role === "STUDENT" ? `<form data-action="${g.joined ? "leave" : "join"}" data-id="${e(g.id)}"><p role="alert" class="form-error"></p><button type="submit" class="button ${g.joined ? "secondary" : "primary"}">${g.joined ? "Leave class" : "Join class"}</button></form>` : ""}${g.canManage ? `<form data-action="edit" data-id="${e(g.id)}"><div class="form-row"><label>Batch<input name="batch" value="${e(g.batch)}" required maxlength="40"></label><label>Class<input name="className" value="${e(g.class_name)}" required maxlength="80"></label><label>Section<input name="section" value="${e(g.section)}" required maxlength="30"></label></div><label>Availability<select name="active"><option value="true" ${g.active ? "selected" : ""}>Active</option><option value="false" ${!g.active ? "selected" : ""}>Inactive</option></select></label><p role="alert" class="form-error"></p><button type="submit" class="button secondary">Save class</button></form>` : ""}</article>`,
          )
          .join("") || "<p>No class groups are available yet.</p>";
  }
  if ($("groupsButton")) {
    $("groupsButton").onclick = async () => {
      window.closeMenu?.();
      $("groupsDialog")?.showModal?.();
      if ($("groupsError")) $("groupsError").textContent = "";
      if ($("groupsContent")) $("groupsContent").textContent = "Loading classes...";
      try {
        await load();
      } catch (error) {
        if ($("groupsError")) $("groupsError").textContent = error.message;
      }
    };
  }
  $("groupsContent").onsubmit = (event) => {
    event.preventDefault();
    const form = event.target;
    Notify.submit(form, async () => {
      const body = Object.fromEntries(new FormData(form)),
        id = form.dataset.id;
      switch (form.dataset.action) {
        case "create":
          await Notify.request("/groups", { method: "POST", body });
          break;
        case "edit":
          await Notify.request(`/groups/${id}`, {
            method: "PATCH",
            body: { ...body, active: body.active === "true" },
          });
          break;
        case "join":
          await Notify.request(`/groups/${id}/join`, {
            method: "POST",
            body: {},
          });
          break;
        case "leave":
          await Notify.request(`/groups/${id}/membership`, {
            method: "DELETE",
            body: {},
          });
          break;
      }
      await load();
      document.dispatchEvent(new Event("notify:signed-in"));
    });
  };
  document.addEventListener("notify:signed-out", () => {
    $("groupsContent").replaceChildren();
    $("groupsDialog").close();
  });
})();
