"""Convert original documents to a PDF preview and extract text locally."""
import json, os, pathlib, subprocess, sys, zipfile
import pymupdf

source, output = map(pathlib.Path, sys.argv[1:3])
output.mkdir(parents=True, exist_ok=True)
ext = source.suffix.lower()
if ext in (".docx", ".xlsx"):
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        if len(entries) > 10000 or sum(x.file_size for x in entries) > 125 * 1024 * 1024:
            raise ValueError("Document archive exceeds processing limits")
        required = "word/document.xml" if ext == ".docx" else "xl/workbook.xml"
        if required not in archive.namelist():
            raise ValueError("Invalid Office document")
pdf = source
if ext != ".pdf":
    executable = os.environ.get("LIBREOFFICE_PATH")
    if not executable:
        raise ValueError("Office conversion is not configured on this server")
    profile = output / "office-profile"
    (profile / "user").mkdir(parents=True, exist_ok=True)
    (profile / "user" / "registrymodifications.xcu").write_text(
        '<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry">'
        '<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>'
        '<item oor:path="/org.openoffice.Office.Calc/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>0</value></prop></item>'
        '</oor:items>', encoding="utf-8")
    subprocess.run([executable, '-env:UserInstallation=' + profile.resolve().as_uri(),
        '--headless', '--nologo', '--nodefault', '--norestore', '--convert-to', 'pdf', '--outdir', str(output), str(source)],
        check=True, timeout=100, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    pdf = output / (source.stem + '.pdf')
    if not pdf.exists():
        raise ValueError("Office conversion did not produce a PDF")
if pdf.stat().st_size > 25 * 1024 * 1024:
    raise ValueError("Converted document exceeds the preview size limit")
texts = []
with pymupdf.open(pdf) as document:
    if document.needs_pass or not 0 < len(document) <= 50:
        raise ValueError("Preview requires an unencrypted document of at most 50 pages")
    for number, page in enumerate(document):
        plain = page.get_text()
        texts.append(plain)
        scale = min(1.5, 1600 / max(page.rect.width, page.rect.height))
        page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False).save(output / f'page-{number + 1}.png')
    count = len(document)
(output / 'result.json').write_text(json.dumps({'pdf': str(pdf.resolve()), 'pages': count,
    'text': '\n'.join(texts)[:300000], 'warning': ''}), encoding='utf-8')
