import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../server/db.js";
import {
  analyzeUpload,
  processDocument,
  queueDocument,
  sourceHash,
} from "../server/documents.js";
const run = promisify(execFile),
  directory = await mkdtemp(join(tmpdir(), "notify-doc-test-")),
  db = openDatabase(":memory:");
try {
  assert(
    process.env.DOCUMENT_PYTHON && process.env.LIBREOFFICE_PATH,
    "Configure document tools in .env before running document integration tests.",
  );
  await run(
    process.env.DOCUMENT_PYTHON,
    ["test/document-fixtures.py", directory],
    { windowsHide: true },
  );
  db.prepare(
    "INSERT INTO users VALUES('admin','test@nwu.ac.bd','Test admin','ADMIN','APPROVED','test-hash',0,0)",
  ).run();
  for (const [name, phrase] of [
    ["digital.pdf", "UNIVERSITY EXAM NOTICE"],
    ["scanned.pdf", "UNIVERSITY EXAM NOTICE"],
    ["notice.docx", "UNIVERSITY WORD NOTICE"],
    ["schedule.xlsx", "UNIVERSITY TIMETABLE"],
  ]) {
    const source = await readFile(join(directory, name));
    db.prepare(
      "INSERT INTO notices(id,author_id,title,content,category,status,created_at,updated_at) VALUES(?,'admin','Test','Test','EXAM','DRAFT',0,0)",
    ).run(name);
    db.prepare("INSERT INTO attachments VALUES(?,?,?,?,?)").run(
      name,
      name,
      "application/octet-stream",
      source.length,
      source,
    );
    queueDocument(db, name);
    await processDocument(
      db,
      db.prepare("SELECT * FROM attachments WHERE notice_id=?").get(name),
    );
    const preview = db
      .prepare("SELECT * FROM document_previews WHERE notice_id=?")
      .get(name);
    assert.equal(preview.status, "READY", name + ": " + preview.error);
    assert.equal(preview.error, "");
    if (name === "digital.pdf") {
      assert(preview.extracted_text.includes("SECOND PAGE"));
      assert.equal(
        db
          .prepare("SELECT count(*) n FROM document_pages WHERE notice_id=?")
          .get(name).n,
        2,
      );
    }

    assert(
      preview.extracted_text.includes(phrase),
      name + ": missing extracted or OCR text",
    );
    if (name === "scanned.pdf" || name === "notice.docx") {
      const suggestion = await analyzeUpload({
        buffer: source,
        originalname: name,
      });
      assert(suggestion.textSample.includes(phrase));
      assert(suggestion.title);
      assert.equal(suggestion.needsReview, true);
    }
    assert.equal(Buffer.from(preview.pdf).subarray(0, 5).toString(), "%PDF-");
    assert.equal(
      sourceHash(
        db.prepare("SELECT data FROM attachments WHERE notice_id=?").get(name)
          .data,
      ),
      sourceHash(source),
    );
    const page = db
      .prepare("SELECT image FROM document_pages WHERE notice_id=? AND page=1")
      .get(name);
    assert.equal(Buffer.from(page.image).subarray(1, 4).toString(), "PNG");
    console.log(
      `PASS ${name}: original bytes preserved, PDF/pages rendered, text extracted${name === "scanned.pdf" ? " with OCR" : ""}.`,
    );
  }
  const longScan = await readFile(join(directory, "long-scanned.pdf"));
  const longSuggestion = await analyzeUpload({
    buffer: longScan,
    originalname: "long-scanned.pdf",
  });
  assert.match(
    longSuggestion.title,
    /^Thesis Defense for CSE-4100 and CSE-4200 on 6 October 2026$/i,
  );
  assert(!longSuggestion.title.includes("Registrar"));
  assert(!longSuggestion.title.includes("Exam Controller"));
  assert.match(longSuggestion.summary, /6 October 2026/);
  assert.match(longSuggestion.summary, /9:45 AM/);
  assert.match(longSuggestion.summary, /Rooms 702 and 704/);
  assert.match(longSuggestion.summary, /30 September 2026/);
  console.log(
    "PASS long scanned notice: OCR summary includes the event and separate deadline.",
  );
  const admitScan = await readFile(join(directory, "admit-scanned.pdf"));
  const admitSuggestion = await analyzeUpload({
    buffer: admitScan,
    originalname: "admit-scanned.pdf",
  });
  assert.match(admitSuggestion.title, /Issue of Admit Card/);
  assert.match(admitSuggestion.title, /27, 29 and 30 June/);
  assert.match(admitSuggestion.summary, /25 June 2026/);
  assert.match(admitSuggestion.summary, /CSE, EEE and CIVIL/);
  assert(!admitSuggestion.summary.includes("prior authority consent"));
  console.log(
    "PASS scanned admit card: OCR title and department dates are readable.",
  );
  db.prepare(
    "UPDATE attachments SET data=?,size=? WHERE notice_id='notice.docx'",
  ).run(Buffer.from("bad"), 3);
  queueDocument(db, "notice.docx");
  await processDocument(
    db,
    db.prepare("SELECT * FROM attachments WHERE notice_id='notice.docx'").get(),
  );
  assert.equal(
    db
      .prepare(
        "SELECT status FROM document_previews WHERE notice_id='notice.docx'",
      )
      .get().status,
    "FAILED",
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM document_pages WHERE notice_id='notice.docx'",
      )
      .get().n,
    0,
  );
  console.log(
    "PASS corrupt replacement: clear failure state; old preview removed; original remains downloadable.",
  );
} finally {
  db.close();
  await rm(directory, { recursive: true, force: true });
}
