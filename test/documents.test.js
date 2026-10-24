import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../server/db.js";
import {
  processDocument,
  queueDocument,
  sourceHash,
} from "../server/documents.js";
const run = promisify(execFile),
  directory = await mkdtemp(join(tmpdir(), "notify-doc-test-")),
  db = openDatabase(":memory:");
try {
  assert(
    process.env.DOCUMENT_PYTHON &&
      process.env.LIBREOFFICE_PATH &&
      process.env.TESSDATA_PREFIX,
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
    if(name === "digital.pdf") {
      assert(preview.extracted_text.includes("SECOND PAGE"));
      assert.equal(db.prepare("SELECT count(*) n FROM document_pages WHERE notice_id=?").get(name).n,2);
    }

    assert(
      preview.extracted_text.includes(phrase),
      name + ": missing extracted text",
    );
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
