"use strict";
const $ = (id) => document.getElementById(id);
const categories = {
  ALL: "All notices",
  ANNOUNCEMENT: "Announcements",
  EXAM: "Exam schedules",
  EVENT: "Events",
  URGENT: "Urgent notices",
};
let profile = null;
let departments = { ALL: "Campus-wide" };
let audiences = [];
let notices = [],
  category = "ALL",
  selected = null,
  editing = null,
  toastTimer;
const canWrite = () =>
  profile?.status === "APPROVED" &&
  (profile.role === "ADMIN" ||
    (profile.role === "TEACHER" && profile.headDepartmentIds?.length > 0));
function message(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 5000);
}
function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function dateLabel(time) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(time));
}
async function reload() {
  if (!Notify.user) return;
  await Notify.request("/session");
  profile = Notify.user;
  applyAccountState();
  if (profile.status !== "APPROVED" || profile.mustChangePassword) return;
  applyProfile();
  [notices, audiences] = await Promise.all([
    Notify.request("/notices"),
    Notify.request("/audiences"),
  ]);
  render();
}
function permitted() {
  return notices;
}
function render() {
  const all = permitted();
  const query = $("search").value.trim().toLowerCase();
  const dept = $("department").value;
  const visible = all
    .filter(
      (n) =>
        (category === "ALL" || n.category === category) &&
        (dept === "ALL" ||
          n.department === (dept === "CAMPUS" ? "ALL" : dept)) &&
        (!query ||
          [
            n.title,
            n.content,
            n.author,
            n.department,
            n.audience,
            n.documentText,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)),
    )
    .sort((a, b) =>
      $("sort").value === "oldest"
        ? a.created - b.created
        : b.created - a.created,
    );
  $("totalCount").textContent = all.length;
  $("sectionTitle").textContent = categories[category];
  $("resultCount").textContent =
    `${visible.length} ${visible.length === 1 ? "notice" : "notices"}`;
  $("footerCount").textContent = $("resultCount").textContent;
  $("noticeList").innerHTML = visible
    .map(
      (n) =>
        `<article class="notice-row"><div class="notice-main"><span class="category ${n.category === "URGENT" ? "urgent" : ""}">${categories[n.category]}</span><h3><button class="notice-link" data-id="${escapeHTML(n.id)}">${escapeHTML(n.title)}</button></h3><p>${escapeHTML(n.content)}</p><div class="notice-meta"><span>${escapeHTML(n.author)}</span><span>${escapeHTML(departments[n.department] || "Department")}</span><span>${escapeHTML(n.audience)}</span><span>${escapeHTML(n.status)}</span>${n.file ? "<span>Attachment included</span>" : ""}</div></div><time class="notice-date" datetime="${new Date(n.created).toISOString()}">${dateLabel(n.created)}</time></article>`,
    )
    .join("");
  $("emptyState").hidden = visible.length > 0;
  const filtered = query || category !== "ALL" || dept !== "ALL";
  $("emptyTitle").textContent = filtered
    ? "No matching notices"
    : "No notices yet";
  $("emptyDescription").textContent = filtered
    ? "Try another search or clear your filters to see more notices."
    : "There are no notices available to your account yet.";
  $("emptyAction").textContent = filtered
    ? "Clear filters"
    : canWrite()
      ? "Create your first notice"
      : "My account";
  $("emptyAction").onclick = () => {
    if (filtered) resetFilters();
    else if (canWrite()) openComposer();
    else openAccount();
  };
  document.querySelectorAll("[data-category]").forEach((b) => {
    const active = b.dataset.category === category;
    b.classList.toggle("active", active);
    b.setAttribute("aria-current", active ? "page" : "false");
  });
}
function resetFilters() {
  category = "ALL";
  $("search").value = "";
  $("department").value = "ALL";
  render();
}
function applyProfile() {
  profile = Notify.user;
  departments = {
    ALL: "Campus-wide",
    ...Object.fromEntries(profile.departments.map((d) => [d.id, d.name])),
  };
  $("workspaceRole").textContent = profile.name;
  $("workspaceDept").textContent =
    profile.role === "ADMIN"
      ? "University administrator"
      : profile.departments.map((d) => d.code).join(", ") ||
        "No departments assigned";
  $("newNotice").hidden = !canWrite();
  $("manageButton").hidden = profile.role !== "ADMIN";
  $("connectionTitle").textContent = Notify.provisional
    ? "Provisional student session"
    : "University notice board";
  const previous = $("department").value;
  $("department").innerHTML =
    '<option value="ALL">All available notices</option><option value="CAMPUS">Campus-wide</option>' +
    profile.departments
      .map(
        (d) =>
          `<option value="${escapeHTML(d.id)}">${escapeHTML(d.name)}</option>`,
      )
      .join("");
  $("department").value = [
    "ALL",
    "CAMPUS",
    ...profile.departments.map((d) => d.id),
  ].includes(previous)
    ? previous
    : "ALL";
}
function openComposer(notice = null) {
  if (!canWrite()) return;
  editing = notice;
  $("composerForm").reset();
  $("composerError").textContent = "";
  $("composerTitle").textContent = notice ? "Edit notice" : "New notice";
  $("noticeDepartment").innerHTML = audiences
    .map(
      (a) =>
        `<option value="${escapeHTML(a.id)}">${escapeHTML(a.label)}</option>`,
    )
    .join("");
  if (!audiences.length) {
    message(
      "No publishing audiences are assigned. Ask your department head or administrator to create class groups.",
    );
    return;
  }
  $("noticeDepartment").disabled = !!notice;
  $("removeFileLabel").hidden = !notice?.file;
  $("noticeStatus").value = notice?.status || "DRAFT";
  $("noticeStatus").querySelector('[value="DRAFT"]').disabled =
    !!notice && notice.status !== "DRAFT";
  if (notice) {
    $("noticeCategory").value = notice.category;
    $("noticeDepartment").value = notice.groupId || notice.department;
    $("noticeTitle").value = notice.title;
    $("noticeContent").value = notice.content;
  }
  $("composerDialog").showModal();
  $("noticeTitle").focus();
}
async function openNotice(id) {
  try {
    selected = await Notify.request(`/notices/${id}`);
  } catch (e) {
    message(e.message);
    return;
  }
  if (!selected) return;
  $("detailsTitle").textContent = selected.title;
  $("detailsCategory").textContent = categories[selected.category];
  $("detailsCategory").className =
    `category ${selected.category === "URGENT" ? "urgent" : ""}`;
  $("detailsMeta").textContent =
  $("detailsContent").textContent = selected.content || "";
  const hasContent = Boolean(selected.content && selected.content.trim());
  $("detailsContent").hidden = !hasContent;
  if ($("noticeZoomBar")) $("noticeZoomBar").hidden = !hasContent;
  applyNoticeWebZoom(100);
  $("attachmentArea").replaceChildren();
  if (selected.file) {
    const container = document.createElement("div");
    container.className = "attachment-card";
    container.innerHTML = `
      <div class="attachment-meta">
        <span class="attachment-icon" aria-hidden="true">&#128196;</span>
        <div>
          <strong class="attachment-name">${Notify.escape(selected.file.name)}</strong>
          <div class="attachment-size">${(selected.file.size / 1024).toFixed(0)} KB &bull; Attached document</div>
        </div>
      </div>
    `;
    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "button primary";
    preview.textContent = "View Document";
    preview.onclick = () => window.openDocument(selected);
    container.append(preview);
    $("attachmentArea").append(container);
  }
  const editable = selected.canManage;
  $("editNotice").hidden = !editable;
  $("deleteNotice").hidden = !editable;
  $("detailsDialog").showModal();
}
$("navigation").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  category = button.dataset.category;
  render();
  closeMenu();
});
$("search").addEventListener("input", render);
$("department").addEventListener("change", render);
$("sort").addEventListener("change", render);
$("noticeList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (button) openNotice(button.dataset.id);
});
$("workspaceButton").onclick = openAccount;
$("changeView").onclick = openAccount;
$("newNotice").onclick = () => openComposer();
$("composerForm").onsubmit = (event) => {
  event.preventDefault();
  Notify.submit(event.target, async () => {
    const title = $("noticeTitle").value.trim(),
      content = $("noticeContent").value.trim();
    if (!title)
      throw new Error("Enter a notice title.");
    const body = new FormData();
    body.set("title", title);
    body.set("content", content);
    body.set("category", $("noticeCategory").value);
    const audience = audiences.find(
      (a) => a.id === $("noticeDepartment").value,
    );
    if (!audience) throw new Error("Choose an available audience.");
    body.set("departmentId", audience.departmentId);
    body.set("groupId", audience.groupId);
    body.set("status", $("noticeStatus").value);
    if (editing) body.set("version", editing.version);
    body.set("removeAttachment", String($("removeFile").checked));
    const file = $("noticeFile").files[0];
    if (file) body.set("file", file);
    await Notify.request(editing ? `/notices/${editing.id}` : "/notices", {
      method: editing ? "PUT" : "POST",
      body,
    });
    $("composerDialog").close();
    await reload();
    message("Notice saved.");
  });
};
$("editNotice").onclick = () => {
  $("detailsDialog").close();
  openComposer(selected);
};
$("deleteNotice").onclick = () => $("deleteDialog").showModal();
$("confirmDelete").onclick = async () => {
  try {
    await Notify.request(`/notices/${selected.id}`, {
      method: "DELETE",
      body: { version: selected.version },
    });
    $("deleteDialog").close();
    $("detailsDialog").close();
    await reload();
    message("Notice deleted.");
  } catch (e) {
    message(e.message);
  }
};
$("copyNotice").onclick = async () => {
  try {
    await navigator.clipboard.writeText(
      `${selected.title}\n\n${selected.content}\n\n${selected.author}`,
    );
    message("Notice text copied.");
  } catch {
    message("Clipboard unavailable. Select the notice text to copy it.");
  }
};
let noticeWebZoom = 100;
function applyNoticeWebZoom(val) {
  noticeWebZoom = Math.min(220, Math.max(80, val));
  if ($("detailsContent")) $("detailsContent").style.fontSize = `${(noticeWebZoom / 100) * 15}px`;
  if ($("detailsTitle")) $("detailsTitle").style.fontSize = `${(noticeWebZoom / 100) * 20}px`;
  if ($("noticeZoomLevel")) $("noticeZoomLevel").textContent = `${noticeWebZoom}%`;
}
if ($("noticeZoomIn")) $("noticeZoomIn").onclick = () => applyNoticeWebZoom(noticeWebZoom + 15);
if ($("noticeZoomOut")) $("noticeZoomOut").onclick = () => applyNoticeWebZoom(noticeWebZoom - 15);
if ($("noticeZoomReset")) $("noticeZoomReset").onclick = () => applyNoticeWebZoom(100);
document
  .querySelectorAll(".close-dialog")
  .forEach(
    (button) => (button.onclick = () => button.closest("dialog").close()),
  );
function closeMenu() {
  $("sidebar").classList.remove("open");
  $("menuButton").setAttribute("aria-expanded", "false");
  $("menuButton").setAttribute("aria-label", "Open navigation");
}
$("menuButton").onclick = () => {
  const open = $("sidebar").classList.toggle("open");
  $("menuButton").setAttribute("aria-expanded", String(open));
  $("menuButton").setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
};
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest("#sidebar, #menuButton")) closeMenu();
});
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("themeButton").textContent =
    theme === "dark" ? "Light theme" : "Dark theme";
  $("themeButton").setAttribute(
    "aria-label",
    `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
  );
}
$("themeButton").onclick = () => {
  const theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(theme);
  try {
    localStorage.setItem("notify_theme", theme);
  } catch {}
};
document.addEventListener("notify:message", (event) => message(event.detail));
document.addEventListener("notify:signed-in", async () => {
  try {
    await reload();
  } catch (e) {
    message(e.message);
  }
});
document.addEventListener("notify:signed-out", () => {
  profile = null;
  audiences = [];
  notices = [];
  selected = null;
  editing = null;
});
async function refreshPermissions() {
  if (Notify.user && document.visibilityState === "visible") {
    try {
      await reload();
    } catch (e) {
      message(e.message);
    }
  }
}
window.addEventListener("focus", refreshPermissions);
setInterval(refreshPermissions, 30000);
try {
  applyTheme(
    localStorage.getItem("notify_theme") === "dark" ? "dark" : "light",
  );
} catch {}
initializeAuth();
