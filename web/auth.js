"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  let recoveryToken = "";
  function showPanel(name) {
    document
      .querySelectorAll("[data-auth-panel]")
      .forEach((panel) => (panel.hidden = panel.dataset.authPanel !== name));
    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.authTab === name);
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.authTab === name),
      );
    });
    $("authMessage").textContent = "";
  }
  function signedIn() {
    document.dispatchEvent(new Event("notify:signed-in"));
  }
  function signedOut() {
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    $("appLayout").hidden = true;
    $("accountState").hidden = true;
    $("authScreen").hidden = false;
    $("noticeList").replaceChildren();
    for (const id of [
      "detailsContent",
      "detailsTitle",
      "detailsMeta",
      "attachmentArea",
      "accountDetails",
      "manageContent",
    ])
      $(id).replaceChildren();
    $("composerForm").reset();
    $("passwordForm").reset();
    showPanel("student");
  }
  document.addEventListener("notify:signed-out", signedOut);
  document
    .querySelectorAll("[data-auth-tab]")
    .forEach(
      (button) => (button.onclick = () => showPanel(button.dataset.authTab)),
    );
  $("studentLoginForm").onsubmit = (event) => {
    event.preventDefault();
    Notify.submit(event.target, async () => {
      const result = await Notify.request("/auth/student", {
        method: "POST",
        body: {
          studentId: $("studentId").value.trim(),
          email: $("studentEmail").value.trim(),
        },
      });
      if (result.user) signedIn();
      else $("authMessage").textContent = result.message;
    });
  };
  $("staffLoginForm").onsubmit = (event) => {
    event.preventDefault();
    Notify.submit(event.target, async () => {
      await Notify.request("/auth/login", {
        method: "POST",
        body: {
          email: $("staffEmail").value,
          password: $("staffPassword").value,
        },
      });
      $("staffPassword").value = "";
      signedIn();
    });
  };
  $("teacherRegisterForm").onsubmit = (event) => {
    event.preventDefault();
    Notify.submit(event.target, async () => {
      await Notify.request("/auth/register", {
        method: "POST",
        body: {
          name: $("registerName").value,
          email: $("registerEmail").value,
          password: $("registerPassword").value,
          requestedDepartmentIds: Array.from(
            $("requestedDepartments").selectedOptions,
            (o) => o.value,
          ),
          institutionalInfo: $("institutionalInfo").value,
        },
      });
      $("registerPassword").value = "";
      signedIn();
    });
  };
  $("recoveryForm").onsubmit = (event) => {
    event.preventDefault();
    Notify.submit(event.target, async () => {
      const result = await Notify.request("/auth/reset/request", {
        method: "POST",
        body: { email: $("recoveryEmail").value },
      });
      $("authMessage").textContent = result.message;
    });
  };
  $("resetForm").onsubmit = (event) => {
    event.preventDefault();
    Notify.submit(event.target, async () => {
      const result = await Notify.request("/auth/reset/complete", {
        method: "POST",
        body: { token: recoveryToken, password: $("resetPassword").value },
      });
      recoveryToken = "";
      $("resetPassword").value = "";
      showPanel("staff");
      $("authMessage").textContent = result.message;
    });
  };
  $("passwordForm").onsubmit = (event) => {
    event.preventDefault();
    Notify.submit(event.target, async () => {
      await Notify.request("/account/password", {
        method: "POST",
        body: {
          currentPassword: $("currentPassword").value,
          newPassword: $("newPassword").value,
        },
      });
      event.target.reset();
      Notify.clear();
      signedOut();
      showPanel("staff");
      $("authMessage").textContent =
        "Password changed. Sign in with your new password.";
    });
  };
  $("profileForm").onsubmit = (event) => {
    event.preventDefault();
    Notify.submit(event.target, async () => {
      await Notify.request("/account/profile", {
        method: "PATCH",
        body: { name: $("profileName").value },
      });
      await Notify.request("/session");
      $("workspaceDialog").close();
      signedIn();
    });
  };
  document.querySelectorAll("[data-sign-out]").forEach(
    (button) =>
      (button.onclick = async () => {
        try {
          await Notify.request("/auth/logout", { method: "POST", body: {} });
          Notify.clear();
          signedOut();
        } catch (e) {
          $("accountMessage").textContent = e.message;
        }
      }),
  );
  $("checkApproval").onclick = async () => {
    try {
      await Notify.request("/session");
      signedIn();
    } catch (e) {
      if (e.status === 401)
        $("authMessage").textContent =
          "Your account may have changed. Sign in again to check your status.";
    }
  };
  window.openAccount = () => {
    const user = Notify.user;
    if (!user) return;
    $("profileName").value = user.name;
    $("accountDetails").textContent =
      `${user.email}\n${user.teacherId || user.studentId || "Administrator"}\nStatus: ${user.status}\nDepartments: ${user.departments.map((d) => d.name).join(", ") || "None assigned"}\nDepartment head: ${
        user.departments
          .filter((d) => user.headDepartmentIds.includes(d.id))
          .map((d) => d.name)
          .join(", ") || "None"
      }`;
    $("passwordForm").hidden = user.role === "STUDENT";
    $("workspaceDialog").showModal();
  };
  window.applyAccountState = () => {
    const user = Notify.user;
    if (!user) return;
    $("authScreen").hidden = true;
    const restricted = user.status !== "APPROVED" || user.mustChangePassword;
    $("appLayout").hidden = restricted;
    $("accountState").hidden = !restricted;
    $("stateTitle").textContent = user.mustChangePassword
      ? "Change your initial password"
      : user.status === "PENDING"
        ? "Registration pending approval"
        : `Account ${user.status.toLowerCase()}`;
    $("stateDescription").textContent = user.mustChangePassword
      ? "Set an individual password before accessing the dashboard."
      : user.status === "PENDING"
        ? "Your registration has been received. An administrator must verify your appointment and assign your departments before you can publish notices."
        : user.decisionReason ||
          "Contact the university administrator for help with your account.";
    $("stateTeacherId").textContent = user.teacherId
      ? `Teacher ID: ${user.teacherId}`
      : "";
    $("stateAccountButton").textContent = user.mustChangePassword
      ? "Change password"
      : "Account details";
  };
  $("stateAccountButton").onclick = window.openAccount;
  window.initializeAuth = async () => {
    signedOut();
    try {
      const [config, departments] = await Promise.all([
        Notify.request("/config"),
        Notify.request("/departments/public"),
      ]);
      $("studentLoginHelp").textContent = config.provisionalStudents
        ? "Provisional development login: ID and email are not proof of identity. Your department must already be recorded in the university directory."
        : "Enter your directory details. We will send a sign-in link to your university email. Your department is assigned by the university.";
      $("requestedDepartments").innerHTML = departments
        .map(
          (d) =>
            `<option value="${Notify.escape(d.id)}">${Notify.escape(d.name)} (${Notify.escape(d.code)})</option>`,
        )
        .join("");
      const hash = new URLSearchParams(location.hash.slice(1));
      history.replaceState(null, "", location.pathname);
      if (hash.has("reset")) {
        recoveryToken = hash.get("reset");
        showPanel("reset");
        return;
      }
      if (hash.has("verify")) {
        await Notify.request("/auth/student/verify", {
          method: "POST",
          body: { token: hash.get("verify") },
        });
        signedIn();
        return;
      }
      try {
        await Notify.request("/session");
        signedIn();
      } catch (e) {
        if (e.status !== 401) throw e;
      }
    } catch (e) {
      $("authMessage").textContent = e.message;
    }
  };
})();
