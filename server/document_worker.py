"""Convert original documents to a PDF preview and extract text locally."""
import io, json, os, pathlib, re, subprocess, sys, zipfile
import pymupdf

DATE_WORDS = r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
DATE_PATTERN = re.compile(r"\b\d{1,2}\s+" + DATE_WORDS + r"\s+\d{4}\b", re.I)
TIME_PATTERN = re.compile(r"\b\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?\b", re.I)

def recover_table_dates(page, textpage, plain, language, tessdata):
    """Read a narrow table row when full-page OCR found its time but lost its date."""
    if "following schedule" not in plain.lower():
        return plain
    attempts = 0
    for block in page.get_text("blocks", textpage=textpage):
        match = TIME_PATTERN.search(block[4])
        if not match or DATE_PATTERN.search(block[4]):
            continue
        needle = match.group(0)
        position = plain.find(needle)
        if position < 0 or DATE_PATTERN.search(plain[max(0, position - 35):position]):
            continue
        attempts += 1
        if attempts > 5:
            break
        clip = pymupdf.Rect(page.rect.x0, max(page.rect.y0, block[1] - 12),
                             page.rect.x1, min(page.rect.y1, block[3] + 5))
        try:
            pixmap = page.get_pixmap(clip=clip, dpi=250, colorspace=pymupdf.csGRAY,
                                     alpha=False)
            with pymupdf.open(stream=pixmap.tobytes("png"), filetype="png") as crop:
                section = crop[0]
                recognized = section.get_textpage_ocr(language=language, dpi=150,
                                                        full=True, tessdata=tessdata)
                recovered = section.get_text(textpage=recognized)
        except Exception:
            continue
        date = DATE_PATTERN.search(recovered)
        if date and TIME_PATTERN.search(recovered):
            plain = plain[:position] + date.group(0) + "\n" + plain[position:]
    return plain

def enhanced_ocr(page, language, tessdata):
    """Retry low-contrast scans after removing blank margins and balancing contrast."""
    from PIL import Image, ImageOps
    images = page.get_images(full=True)
    if len(images) == 1 and images[0][2] * images[0][3] <= 40_000_000:
        try:
            original = page.parent.extract_image(images[0][0])
            if len(original["image"]) > 15 * 1024 * 1024:
                raise ValueError("Embedded image exceeds OCR retry limit")
            with pymupdf.open(stream=original["image"], filetype=original["ext"]) as document:
                image_page = document[0]
                textpage = image_page.get_textpage_ocr(language=language, dpi=150,
                                                       full=True, tessdata=tessdata)
                direct = image_page.get_text(textpage=textpage)
                if len(direct.strip()) >= 40:
                    return direct
        except Exception:
            pass
    scale = min(200 / 72, 2500 / max(page.rect.width, page.rect.height))
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale),
                             colorspace=pymupdf.csGRAY, alpha=False)
    image = Image.frombytes("L", (pixmap.width, pixmap.height), pixmap.samples)
    bounds = image.point(lambda value: 255 if value < 235 else 0).getbbox()
    if bounds:
        margin = 12
        image = image.crop((max(0, bounds[0] - margin), max(0, bounds[1] - margin),
                            min(image.width, bounds[2] + margin),
                            min(image.height, bounds[3] + margin)))
    image = ImageOps.autocontrast(image, cutoff=1)
    stream = io.BytesIO()
    image.save(stream, format="PNG")
    with pymupdf.open(stream=stream.getvalue(), filetype="png") as prepared:
        candidate = prepared[0]
        textpage = candidate.get_textpage_ocr(language=language, dpi=200,
                                               full=True, tessdata=tessdata)
        return candidate.get_text(textpage=textpage)

source, output = map(pathlib.Path, sys.argv[1:3])
text_only = "--text-only" in sys.argv[3:]
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
texts, warnings = [], []
with pymupdf.open(pdf) as document:
    if document.needs_pass or not 0 < len(document) <= 50:
        raise ValueError("Preview requires an unencrypted document of at most 50 pages")
    for number, page in enumerate(document):
        plain = page.get_text()
        try:
            if page.get_images() or not plain.strip():
                language = os.environ.get("OCR_LANGUAGES", "eng")
                tessdata = os.environ.get("TESSDATA_PREFIX") or None
                recognized = page.get_textpage_ocr(
                    language=language,
                    dpi=150,
                    full=not plain.strip(),
                    tessdata=tessdata,
                )
                plain = page.get_text(textpage=recognized)
                if len(plain.strip()) < 40:
                    recovered = enhanced_ocr(page, language, tessdata)
                    if len(recovered.strip()) > len(plain.strip()):
                        plain = recovered
                elif "following schedule" in plain.lower():
                    plain = recover_table_dates(page, recognized, plain, language, tessdata)
                if not plain.strip():
                    warnings.append("No readable text was found on one or more pages. Check the original document.")
        except Exception:
            warnings.append("OCR was unavailable for one or more pages. Check those pages in the original file.")
        texts.append(plain)
        if not text_only:
            scale = min(1.5, 1600 / max(page.rect.width, page.rect.height))
            page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False).save(output / f'page-{number + 1}.png')
    count = len(document)
(output / 'result.json').write_text(json.dumps({'pdf': str(pdf.resolve()), 'pages': count,
    'text': '\n'.join(texts)[:300000], 'warning': ' '.join(sorted(set(warnings)))}), encoding='utf-8')
