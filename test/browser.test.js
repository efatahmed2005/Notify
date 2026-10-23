import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import http from "node:http";
import assert from "node:assert/strict";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { hashPassword } from "../server/security.js";
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
  const decision = admin.locator("[data-action=account-status]");
  await decision.locator("[name=status]").selectOption("APPROVED");
  await decision.locator("button[type=submit]").click();
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
  await admin.locator("[data-manage-tab=students]").click();
  const directory = admin.locator("[data-action=create-student]");
  await directory.locator("[name=studentId]").fill("20242024010");
  await directory.locator("[name=email]").fill("20242024010@nwu.ac.bd");
  await directory.locator("[name=name]").fill("Test Student");
  await directory
    .locator("[name=departmentId]")
    .selectOption(departments[0].id);
  await directory.locator("button[type=submit]").click();
  await admin.locator(".user-record").waitFor();
  await teacher.reload();
  await teacher.locator("#authScreen").waitFor({ state: "visible" });
  await teacher.locator("[data-auth-tab=staff]").first().click();
  await teacher.locator("#staffEmail").fill("faculty@nwu.ac.bd");
  await teacher.locator("#staffPassword").fill(password);
  await teacher.locator("#staffLoginForm button[type=submit]").click();
  await teacher.locator("#newNotice").waitFor({ state: "visible" });
  await teacher.locator("#newNotice").click();
  await teacher.locator("#noticeTitle").fill("Department schedule");
  await teacher
    .locator("#noticeContent")
    .fill("Published test notice for the assigned department.");
  await teacher.locator("#noticeStatus").selectOption("PUBLISHED");
  await teacher.locator("#noticeDepartment").selectOption(departments[0].id);
  await teacher
    .locator("#noticeFile")
    .setInputFiles({
      name: "schedule.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nTest file"),
    });
  await teacher.locator("#saveNotice").click();
  await teacher.locator(".notice-row").waitFor();
  const student = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  student.on("pageerror", (e) => errors.push(e.message));
  await student.goto(origin);
  await student.locator("#studentId").fill("20242024010");
  await student.locator("#studentEmail").fill("20242024010@nwu.ac.bd");
  await student.locator("#studentLoginForm button[type=submit]").click();
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
  await teacher.locator("#noticeStatus").selectOption("ARCHIVED");
  await teacher.locator("#saveNotice").click();
  await teacher.locator("#composerDialog").waitFor({ state: "hidden" });
  await student.reload();
  await student.locator("#emptyState").waitFor({ state: "visible" });
  assert.equal(await student.locator(".notice-row").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: admin departments, teacher registration/approval, multiple assignments, head assignment, directory provisioning, publishing/archival, authorized attachment, student isolation, storage tampering, and mobile layout.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  db.close();
}
