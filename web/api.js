"use strict";
window.Notify = {
  user: null,
  csrf: "",
  provisional: false,
  async request(path, { method = "GET", body } = {}) {
    const multipart = body instanceof FormData;
    const response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        ...(body && !multipart ? { "Content-Type": "application/json" } : {}),
        ...(method !== "GET" ? { "X-CSRF-Token": this.csrf } : {}),
      },
      body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith("/auth/")) {
        this.clear();
        document.dispatchEvent(new Event("notify:signed-out"));
      }
      const error = new Error(
        data.error || "The request could not be completed.",
      );
      error.status = response.status;
      throw error;
    }
    if (data.user && data.csrfToken) {
      this.user = data.user;
      this.csrf = data.csrfToken;
      this.provisional = data.provisional;
    }
    return data;
  },
  clear() {
    this.user = null;
    this.csrf = "";
    this.provisional = false;
  },
  escape(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  },
  async submit(form, action) {
    const submit = form.querySelector('[type="submit"]');
    const error = form.querySelector('[role="alert"]');
    if (error) error.textContent = "";
    if (submit) submit.disabled = true;
    try {
      await action();
    } catch (e) {
      if (error) error.textContent = e.message;
      else
        document.dispatchEvent(
          new CustomEvent("notify:message", { detail: e.message }),
        );
    } finally {
      if (submit) submit.disabled = false;
    }
  },
};
