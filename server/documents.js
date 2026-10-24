import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { transaction } from "./db.js";
const run = promisify(execFile);
export const sourceHash = (data) =>
  createHash("sha256").update(data).digest("hex");
export function queueDocument(db, id) {
  const file = db
    .prepare("SELECT data FROM attachments WHERE notice_id=?")
    .get(id);
  if (!file) return;
  db.prepare("DELETE FROM document_previews WHERE notice_id=?").run(id);
  db.prepare(
    "INSERT INTO document_previews(notice_id,source_hash,status,updated_at) VALUES(?,?,'PENDING',?)",
  ).run(id, sourceHash(file.data), Date.now());
}
export async function processDocument(db, file, env = process.env) {
  const hash = sourceHash(file.data);
  let directory;
  try {
    const repoRoot = fileURLToPath(new URL("../", import.meta.url));
    const localPython = join(repoRoot, "var/document-tools/python/Scripts/python.exe");
    const localLibreOffice = join(repoRoot, "var/document-tools/libreoffice/program/soffice.exe");
    const localTessdata = join(repoRoot, "var/document-tools/tessdata");

    const pythonBin = (env.DOCUMENT_PYTHON && existsSync(env.DOCUMENT_PYTHON))
      ? env.DOCUMENT_PYTHON
      : (existsSync(localPython) ? localPython : "python");

    const librePath = (env.LIBREOFFICE_PATH && existsSync(env.LIBREOFFICE_PATH))
      ? env.LIBREOFFICE_PATH
      : (existsSync(localLibreOffice) ? localLibreOffice : undefined);

    const tessPath = (env.TESSDATA_PREFIX && existsSync(env.TESSDATA_PREFIX))
      ? env.TESSDATA_PREFIX
      : (existsSync(localTessdata) ? localTessdata : undefined);

    const runEnv = {
      ...env,
      DOCUMENT_PYTHON: pythonBin,
      ...(librePath ? { LIBREOFFICE_PATH: librePath } : {}),
      ...(tessPath ? { TESSDATA_PREFIX: tessPath } : {}),
      OCR_LANGUAGES: env.OCR_LANGUAGES || "eng+ben",
    };

    directory = await mkdtemp(join(tmpdir(), "notify-document-"));
    const source = join(
      directory,
      "original" + extname(file.name).toLowerCase(),
    );
    await writeFile(source, file.data);
    await run(
      pythonBin,
      [
        fileURLToPath(new URL("./document_worker.py", import.meta.url)),
        source,
        directory,
      ],
      { env: runEnv, timeout: 180000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    const result = JSON.parse(
      await readFile(join(directory, "result.json"), "utf8"),
    );
    const pdf = await readFile(result.pdf),
      pages = [];
    if (
      !Number.isInteger(result.pages) ||
      result.pages < 1 ||
      result.pages > 50
    )
      throw new Error("Invalid preview");
    let bytes = pdf.length;
    for (let i = 1; i <= result.pages; i++) {
      const image = await readFile(join(directory, `page-${i}.png`));
      bytes += image.length;
      if (bytes > 100 * 1024 * 1024)
        throw new Error("Preview exceeds size limit");
      pages.push(image);
    }
    transaction(db, () => {
      const current = db
        .prepare(
          "SELECT * FROM document_previews WHERE notice_id=? AND source_hash=?",
        )
        .get(file.notice_id, hash);
      if (!current) return;
      db.prepare("DELETE FROM document_pages WHERE notice_id=?").run(
        file.notice_id,
      );
      pages.forEach((image, i) =>
        db
          .prepare("INSERT INTO document_pages VALUES(?,?,?)")
          .run(file.notice_id, i + 1, image),
      );
      db.prepare(
        "UPDATE document_previews SET status='READY',pdf=?,extracted_text=?,error=?,updated_at=? WHERE notice_id=? AND source_hash=?",
      ).run(pdf, result.text, result.warning, Date.now(), file.notice_id, hash);
    });
  } catch (error) {
    console.error("Document preview error for notice " + file.notice_id + ":", error.message);
    db.prepare(
      "UPDATE document_previews SET status='FAILED',error=?,updated_at=? WHERE notice_id=? AND source_hash=?",
    ).run(
      "Preview could not be prepared. The original file is available to download. Check conversion/OCR dependencies, document validity, and the 50-page preview limit.",
      Date.now(),
      file.notice_id,
      hash,
    );
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
export function startDocumentWorker(db) {
  let busy = false,
    stopped = false;
  db.prepare(
    "UPDATE document_previews SET status='PENDING' WHERE status='PROCESSING'",
  ).run();
  for (const row of db
    .prepare(
      "SELECT notice_id FROM attachments WHERE notice_id NOT IN (SELECT notice_id FROM document_previews)",
    )
    .all())
    queueDocument(db, row.notice_id);
  async function tick() {
    if (busy || stopped) return;
    const file = db
      .prepare(
        "SELECT a.* FROM attachments a JOIN document_previews p ON p.notice_id=a.notice_id WHERE p.status='PENDING' ORDER BY p.updated_at LIMIT 1",
      )
      .get();
    if (!file) return;
    busy = true;
    db.prepare(
      "UPDATE document_previews SET status='PROCESSING' WHERE notice_id=?",
    ).run(file.notice_id);
    try {
      await processDocument(db, file);
    } finally {
      busy = false;
    }
  }
  const timer = setInterval(() => tick().catch(() => {}), 1000);
  return async () => {
    stopped = true;
    clearInterval(timer);
    while (busy) await new Promise((r) => setTimeout(r, 100));
  };
}
