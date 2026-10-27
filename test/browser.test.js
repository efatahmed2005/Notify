import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import http from "node:http";
import assert from "node:assert/strict";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { hashPassword } from "../server/security.js";
import { analyzeNoticeText } from "../server/notice-analysis.js";
mkdirSync(".temp/design-check", { recursive: true });
const db = openDatabase(":memory:"),
  password = "Browser test passphrase 493!";
db.prepare(
  "INSERT INTO users VALUES('admin','admin@nwu.ac.bd','Administrator','ADMIN','APPROVED',?,0,?)",
).run(await hashPassword(password), Date.now());
const server = http.createServer();
server.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const app = await createApp({
  db,
  origin,
  secret: "browser-test-only-secret-more-than-32-characters",
  provisional: true,
  analyzeDocument: async () =>
    analyzeNoticeText(
      "University will be closed from 4 October to 21 October.",
    ),
});
server.on("request", app);
const chrome =
  process.env.CHROME_EXECUTABLE ||
  (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : undefined);
const browser = await chromium
  .launch({ executablePath: chrome, headless: true })
  .catch((error) => {
    server.close();
    db.close();
    throw error;
  });
try {
  const failurePage = await browser.newPage();
  const failureErrors = [];
  failurePage.on("pageerror", (error) => failureErrors.push(error.stack));
  for (const failure of [
    {
      status: 200,
      contentType: "text/html",
      body: "<!DOCTYPE html><html>Static server</html>",
    },
    { status: 200, contentType: "application/json", body: "" },
    { status: 200, contentType: "application/json", body: "{broken" },
    { status: 200, contentType: "application/json", body: "null" },
    { status: 502, contentType: "text/html", body: "<html>Bad gateway</html>" },
  ]) {
    await failurePage.route("**/api/config", (route) => route.fulfill(failure));
    await failurePage.route("**/api/auth/login", (route) =>
      route.fulfill(failure),
    );
    await failurePage.goto(origin);
    const expected =
      failure.status >= 500
        ? "server is unavailable"
        : "Connect to the Notify backend";
    await failurePage.waitForFunction(
      (text) =>
        document.querySelector("#authMessage").textContent.includes(text),
      expected,
    );
    await failurePage.locator("[data-auth-tab=staff]").first().click();
    await failurePage.locator("#staffEmail").fill("admin@nwu.ac.bd");
    await failurePage.locator("#staffPassword").fill(password);
    await failurePage.locator("#staffLoginForm button[type=submit]").click();
    await failurePage.waitForFunction(
      (text) =>
        document
          .querySelector('#staffLoginForm [role="alert"]')
          .textContent.includes(text),
      expected,
    );
    assert.equal(
      await failurePage
        .locator("#staffLoginForm button[type=submit]")
        .isEnabled(),
      true,
    );
    await failurePage.unrouteAll({ behavior: "wait" });
  }
  await failurePage.route("**/api/config", (route) =>
    route.abort("connectionrefused"),
  );
  await failurePage.reload();
  await failurePage.waitForFunction(() =>
    document
      .querySelector("#authMessage")
      .textContent.includes("Connect to the Notify backend"),
  );
  assert.deepEqual(failureErrors, []);
  await failurePage.close();
  console.log(
    "PASS browser: HTML, empty, malformed, null, gateway, and offline API responses show usable errors without JSON crashes.",
  );
  const admin = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    errors = [];
  admin.on("pageerror", (e) => errors.push(e.message));
  await admin.goto(origin);
  await admin.locator("[data-auth-tab=staff]").first().click();
  await admin.locator("#staffEmail").fill("admin@nwu.ac.bd");
  await admin.locator("#staffPassword").fill(password);
  await admin.locator("#staffLoginForm button[type=submit]").click();
  await admin.locator("#manageButton").waitFor({ state: "visible" });
  await admin.locator("#manageButton").click();
  await admin.locator("[data-manage-tab=departments]").click();
  for (const code of ["CSE", "EEE"]) {
    const form = admin.locator("[data-action=create-department]");
    await form.locator("[name=code]").fill(code);
    await form
      .locator("[name=name]")
      .fill(code === "CSE" ? "Computer Science" : "Electrical Engineering");
    await form.locator("button[type=submit]").click();
    await admin
      .locator("form[data-action=edit-department]")
      .nth(code === "CSE" ? 0 : 1)
      .waitFor();
  }
  const departments = db
    .prepare("SELECT * FROM departments ORDER BY code")
    .all();
  await admin.locator("#manageDialog .close-dialog").click();
  const teacher = await browser.newPage({
    viewport: { width: 1100, height: 900 },
  });
  teacher.on("pageerror", (e) => errors.push(e.message));
  await teacher.goto(origin);
  await teacher.locator("[data-auth-tab=register]").click();
  await teacher.locator("#registerName").fill("Test Faculty");
  await teacher.locator("#registerEmail").fill("faculty@nwu.ac.bd");
  await teacher.locator("#registerPassword").fill(password);
  await teacher
    .locator("#requestedDepartments")
    .selectOption(departments.map((d) => d.id));
  await teacher
    .locator("#institutionalInfo")
    .fill("Staff appointment record for testing only.");
  await teacher.locator("#teacherRegisterForm button[type=submit]").click();
  await teacher.locator("#accountState").waitFor({ state: "visible" });
  assert.match(await teacher.locator("#stateTitle").innerText(), /pending/);
  await teacher.screenshot({
    path: ".temp/design-check/pending.png",
    fullPage: true,
  });
  await admin.locator("#manageButton").click();
  await admin.locator("[data-manage-tab=teachers]").click();
  await admin
    .locator("[data-action=quick-approve] button[type=submit]")
    .click();
  const assign = admin.locator("[data-action=assign-departments]");
  await assign
    .locator("[name=departmentIds]")
    .selectOption(departments.map((d) => d.id));
  await assign.locator("button[type=submit]").click();
  await admin.locator("[data-manage-tab=departments]").click();
  const head = admin.locator("[data-action=assign-head]").first();
  await head.locator("select").selectOption({ index: 1 });
  await head.locator("button[type=submit]").click();
  await admin.screenshot({
    path: ".temp/design-check/admin.png",
    fullPage: true,
  });
  await admin.locator("#manageDialog .close-dialog").click();
  await admin.locator("#groupsButton").click();
  const classForm = admin.locator('#groupsContent [data-action="create"]');
  await classForm
    .locator('[name="departmentId"]')
    .selectOption(departments[0].id);
  await classForm.locator('[name="batch"]').fill("2024");
  await classForm.locator('[name="className"]').fill("Semester 3");
  await classForm.locator('[name="section"]').fill("A");
  await classForm.locator('button[type="submit"]').click();
  await admin.locator('#groupsContent [data-action="edit"]').waitFor();
  const classId = await admin
    .locator('#groupsContent [data-action="edit"]')
    .getAttribute("data-id");
  await admin.locator("#groupsDialog .close-dialog").click();
  await teacher.reload();
  await teacher.locator("#authScreen").waitFor({ state: "visible" });
  await teacher.locator("[data-auth-tab=staff]").first().click();
  await teacher.locator("#staffEmail").fill("faculty@nwu.ac.bd");
  await teacher.locator("#staffPassword").fill(password);
  await teacher.locator("#staffLoginForm button[type=submit]").click();
  await teacher.locator("#newNotice").waitFor({ state: "visible" });
  await teacher.locator("#newNotice").click();
  await teacher.locator("#noticeStatus").selectOption("PUBLISHED");
  await teacher.locator("#noticeDepartment").selectOption(classId);
  await teacher.locator("#noticeFile").setInputFiles({
    name: "schedule.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nTest file"),
  });
  await teacher.locator("#noticeTitle").waitFor({ state: "visible" });
  await teacher.waitForFunction(() =>
    document
      .querySelector("#noticeTitle")
      .value.includes("closed from 4 October to 21 October"),
  );
  assert.match(
    await teacher.locator("#noticeContent").inputValue(),
    /closed from 4 October/,
  );
  assert.match(
    await teacher.locator("#noticeAnalysisStatus").textContent(),
    /Key information/,
  );
  await teacher.locator("#saveNotice").click();
  await teacher.locator(".notice-row").waitFor();
  const student = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  student.on("pageerror", (e) => errors.push(e.message));
  await student.goto(origin);
  await student.locator("#studentIdentifier").fill("20242024010");
  await student.locator("#studentRegistration summary").click();
  await student.locator("#studentName").fill("Test Student");
  await student.locator("#studentDepartment").selectOption(departments[0].id);
  await student.locator("#studentLoginForm button[type=submit]").click();
  await student.locator("#appLayout").waitFor({ state: "visible" });
  assert.equal(await student.locator(".notice-row").count(), 0);
  // On mobile the navigation is collapsed.
  await student.locator("#menuButton").click();
  await student.locator("#groupsButton").click();
  await student.locator('#groupsContent [data-action="join"] button').click();
  await student.locator('#groupsContent [data-action="leave"]').waitFor();
  await student.locator("#groupsDialog .close-dialog").click();
  assert.equal(
    await student.locator("#menuButton").getAttribute("aria-expanded"),
    "false",
  );
  await student.locator(".notice-row").waitFor();
  assert.equal(await student.locator("#newNotice").isVisible(), false);
  assert.equal(await student.locator("#manageButton").isVisible(), false);
  await student.screenshot({
    path: ".temp/design-check/student-mobile.png",
    fullPage: true,
  });
  await student.locator(".notice-link").click();
  const download = student.waitForEvent("download");
  await student.locator("#attachmentArea a").click();
  assert.equal((await download).suggestedFilename(), "schedule.pdf");
  await student.locator("#attachmentArea button").click();
  await student.locator("#documentDialog").waitFor({ state: "visible" });
  await student.locator("#documentDialog .close-dialog").click();
  assert.equal(await student.locator("#editNotice").isVisible(), false);
  await student.locator("#detailsDialog .close-dialog").click();
  await student.evaluate(() =>
    localStorage.setItem(
      "notify_profile_v2",
      JSON.stringify({ role: "ADMIN" }),
    ),
  );
  await student.reload();
  await student.locator(".notice-row").waitFor();
  assert.equal(await student.locator("#manageButton").isVisible(), false);
  assert.equal(
    await student.evaluate(async () => {
      const r = await fetch("/api/admin/users");
      return r.status;
    }),
    403,
  );
  assert(
    await student.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await teacher.locator(".notice-link").click();
  await teacher.locator("#editNotice").click();
  await teacher.locator("#noticeTitle").fill("Outdated title");
  await teacher.locator("#noticeContent").fill("Outdated summary");
  await teacher.locator("#reanalyzeNotice").click();
  await teacher.waitForFunction(() =>
    document
      .querySelector("#noticeTitle")
      .value.includes("closed from 4 October"),
  );
  assert.match(
    await teacher.locator("#noticeContent").inputValue(),
    /closed from 4 October/,
  );
  await teacher.locator("#noticeStatus").selectOption("ARCHIVED");
  await teacher.locator("#saveNotice").click();
  await teacher.locator("#composerDialog").waitFor({ state: "hidden" });
  await student.reload();
  await student.locator("#emptyState").waitFor({ state: "visible" });
  assert.equal(await student.locator(".notice-row").count(), 0);
  const newcomer = await browser.newPage();
  newcomer.on("pageerror", (e) => errors.push(e.message));
  await newcomer.goto(origin);
  await newcomer.locator("#studentIdentifier").fill("20242025021@nwu.ac.bd");
  await newcomer.locator("#studentRegistration summary").click();
  await newcomer.locator("#studentName").fill("New student");
  await newcomer.locator("#studentDepartment").selectOption(departments[0].id);
  await newcomer.locator("#studentLoginForm button[type=submit]").click();
  await newcomer.locator("#appLayout").waitFor({ state: "visible" });
  assert.equal(await newcomer.evaluate(() => Notify.user.role), "STUDENT");
  assert.equal(
    await newcomer.evaluate(() => Notify.user.email),
    "20242025021@nwu.ac.bd",
  );
  assert.equal(await newcomer.locator("#manageButton").isVisible(), false);
  await newcomer.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: admin departments, teacher approval, head assignment, student enrollment, class publishing, document opening, access control, and mobile layout.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  db.close();
}
