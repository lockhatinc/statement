const MIME = 'application/vnd.oasis.opendocument.spreadsheet';

function esc(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellXml(cell, isHeader) {
  const style = isHeader ? ' table:style-name="h"' : '';
  if (!cell || (cell.t === 's' && !cell.v)) {
    return `<table:table-cell${style}/>`;
  }
  if (cell.t === 'n') {
    return `<table:table-cell${style} office:value-type="float" office:value="${cell.v}"><text:p>${esc(cell.d ?? cell.v)}</text:p></table:table-cell>`;
  }
  if (cell.t === 'f') {
    return `<table:table-cell${style} table:formula="of:${esc(cell.f)}" office:value-type="float"><text:p>${esc(cell.d ?? '')}</text:p></table:table-cell>`;
  }
  return `<table:table-cell${style} office:value-type="string"><text:p>${esc(cell.v ?? '')}</text:p></table:table-cell>`;
}

function sheetXml(name, headers, rows) {
  const headerRow = headers.length
    ? `<table:table-row>${headers.map(c => cellXml(c, true)).join('')}</table:table-row>`
    : '';
  const dataRows = rows.map(row =>
    `<table:table-row>${row.map(c => cellXml(c, false)).join('')}</table:table-row>`
  ).join('');
  return `<table:table table:name="${esc(name)}">${headerRow}${dataRows}</table:table>`;
}

function contentXml(sheets) {
  const tables = sheets.map(s => sheetXml(s.name, s.headers, s.rows)).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2"><office:automatic-styles><style:style style:name="h" style:family="table-cell"><style:text-properties fo:font-weight="bold"/></style:style></office:automatic-styles><office:body><office:spreadsheet>${tables}</office:spreadsheet></office:body></office:document-content>`;
}

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="${MIME}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`;

export async function buildOds(sheets) {
  const zip = new window.JSZip();
  zip.file('mimetype', MIME, { compression: 'STORE' });
  zip.folder('META-INF').file('manifest.xml', MANIFEST);
  zip.file('content.xml', contentXml(sheets));
  return zip.generateAsync({ type: 'blob', mimeType: MIME });
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
