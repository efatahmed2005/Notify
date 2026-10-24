"use strict";
window.Notify = {
  user: null,
  csrf: "",
  provisional: false,
  async request(path, { method = "GET", body } = {}) {
    const multipart = body instanceof FormData;
    const local =
      location.protocol === "file:" ||
      ["localhost", "127.0.0.1", "10.0.2.2", ""].includes(location.hostname);
    const connectionHelp = local
      ? "Connect to the Notify backend: run npm start on your computer and open http://localhost:8080 instead of Live Server. For Android over USB, also run adb reverse tcp:8080 tcp:8080."
      : "Could not connect to Notify. Check your connection and try again. If this continues, contact the university administrator.";
    if (!/^https?:$/.test(location.protocol)) throw new Error(connectionHelp);
    let response;
    try {
      response = await fetch(`/api${path}`, {
        method,
        credentials: "same-origin",
        redirect: "error",
        headers: {
          Accept: "application/json",
          ...(body && !multipart ? { "Content-Type": "application/json" } : {}),
          ...(method !== "GET" ? { "X-CSRF-Token": this.csrf } : {}),
        },
        body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
      });
    } catch {
      throw new Error(connectionHelp);
    }
    if (response.status === 401 && !path.startsWith("/auth/")) {
      this.clear();
      document.dispatchEvent(new Event("notify:signed-out"));
    }
    let data;
    try {
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error("Invalid content type");
      }
      data = JSON.parse(await response.text());
      if (data === null || typeof data !== "object")
        throw new Error("Invalid response");
    } catch {
      const error = new Error(
        response.status >= 500
          ? "The Notify server is unavailable. Please try again shortly."
          : connectionHelp,
      );
      error.status = response.status;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(
        typeof data.error === "string"
          ? data.error
          : "The request could not be completed.",
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
