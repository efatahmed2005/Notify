import pathlib, sys, zipfile
import pymupdf
root=pathlib.Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
original=pymupdf.open();page=original.new_page(width=600,height=400)
page.insert_text((40,90),'UNIVERSITY EXAM NOTICE',fontsize=24)
page.insert_text((40,150),'Section A - Room 204',fontsize=20)
image=page.get_pixmap(matrix=pymupdf.Matrix(2,2)).tobytes('png')
second=original.new_page(width=600,height=400);second.insert_text((40,90),'SECOND PAGE - Complete exam instructions',fontsize=20)
original.save(root/'digital.pdf')
scan=pymupdf.open();page=scan.new_page(width=600,height=400);page.insert_image(page.rect,stream=image);scan.save(root/'scanned.pdf');scan.close();original.close()
with zipfile.ZipFile(root/'notice.docx','w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    z.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>UNIVERSITY WORD NOTICE</w:t></w:r></w:p><w:p><w:r><w:t>Section B meeting at Room 305.</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>')
with zipfile.ZipFile(root/'schedule.xlsx','w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
    z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Class timetable" sheetId="1" r:id="rId1"/></sheets></workbook>')
    z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
    z.writestr('xl/worksheets/sheet1.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="2" width="30" customWidth="1"/></cols><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>UNIVERSITY TIMETABLE</t></is></c><c r="B1" t="inlineStr"><is><t>Room</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Section A</t></is></c><c r="B2"><v>204</v></c></row></sheetData></worksheet>')
print('Created digital PDF, scanned PDF, Word, and Excel fixtures.')
