# Document previews and OCR

Uploads retain their original bytes. PDF pages are rendered from that PDF. Word and Excel documents are converted to PDF with LibreOffice and displayed as pages on the web and in the Android PDF reader. The original Office file remains available for download.

OCR adds searchable text; it does not reconstruct the displayed document. Scanned PDFs therefore retain their original appearance. Word/Excel conversion may differ from Microsoft Office where fonts, formulas, print areas, or layout engines differ. The original download is the exact uploaded file; a converted preview cannot promise pixel-identical Office rendering.

When an author selects a PDF or DOCX file, the editor reads its embedded text and uses OCR on scanned pages. It joins lines broken by document layout, ignores common letterheads and copy lists, and suggests a title plus a short summary of up to three distinct statements. The title uses the notice's subject and its relevant date or date range when the text provides one; a document's issue date is not treated as the event date. Dates, times, deadlines, and the notice's own subject help choose summary statements regardless of notice category. The author can edit every suggestion before saving or publishing. Existing attached documents can be reanalyzed from the notice editor; that action replaces the editor's suggested wording but never changes the saved notice until the author saves it. The analysis request alone never creates a notice. After upload, the original document remains attached; readers can open its page preview in the web or Android viewer and download the original. Excel files retain their preview and original download, but title suggestions are currently limited to PDF and DOCX.

This is extractive, rule-based summarization, not a reliable interpretation of university policy. The worker retries low-contrast scanned PDF pages using their embedded image or a cropped, contrast-adjusted render. It also rechecks table rows when a time is visible but the date is missing from full-page OCR. Table entries are shown as separate facts rather than one OCR paragraph. OCR may still misread dates or miss text, and some unusual layouts or languages may produce weak summaries. Authors must compare suggested wording with the original, especially before publishing. English category recognition is supported; Bengali OCR text is retained, but Bengali wording may need a manually entered title or summary.

Scanned PDFs do not contain reliable bold-font metadata. The summarizer uses the OCR reading order, heading structure, and nearby factual statements; it cannot promise that every visually bold phrase was recognized. It rejects copy-list recipients and other weak fragments as standalone titles. If a title or summary is missing or wrong, use the editor to correct it before saving.

## Server tools

Install the Python packages in `server/requirements-documents.txt` into a virtual environment, install LibreOffice, and provide Tesseract language data (`eng.traineddata`, `ben.traineddata`). Configure:

- `DOCUMENT_PYTHON`: the virtual environment's Python executable.
- `LIBREOFFICE_PATH`: the LibreOffice `soffice` executable.
- `TESSDATA_PREFIX`: the language-data directory.
- `OCR_LANGUAGES`: defaults to `eng`; use `eng+ben` for English and Bengali.

On this development machine the tools and language data live under the ignored `var/document-tools/` directory, with absolute paths in the ignored `.env`. Other installations must configure their own tools.

Run `npm run test:documents` to test actual PDF rendering, scanned-text recognition, Office conversion, analysis suggestions, byte preservation, and corrupt-file handling. The tests generate temporary fixtures and never write notices into the application database.

## Processing and limits

A single local worker polls persisted jobs. It uses a private temporary directory for each document and removes it afterward. A preview is pending, processing, ready, or failed. A failed preview still allows the original file to be downloaded. Authors with current management permission can retry from the web reader.

Limits: 25 MiB uploads, 50 preview pages, 25 MiB converted PDF, 100 MiB total preview artifacts, a 180-second worker timeout, and a 100-second Office conversion timeout. Text is capped at 300,000 characters per document. Office ZIP entries are bounded before conversion. Macros are disabled in the temporary LibreOffice profile. OCR may be imperfect, especially for handwriting or low-resolution scans; warnings are shown when recognition is unavailable.

Before public deployment, run converters in an isolated low-privilege service/container with no network access, scan uploads for malware, apply storage quotas/retention, and review dependencies and licenses. The local worker does not provide an operating-system sandbox. Keep converter binaries and language data out of Git.

References: [LibreOffice PDF conversion](https://help.libreoffice.org/latest/en-US/text/shared/guide/pdf_params.html) and [PyMuPDF OCR](https://pymupdf.readthedocs.io/en/latest/recipes-ocr.html).
