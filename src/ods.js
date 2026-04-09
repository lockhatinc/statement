const MIME = 'application/vnd.oasis.opendocument.spreadsheet';

function esc(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function contentXml(headers, rows) {
  const allRows = headers.length ? [headers, ...rows] : rows;
  if (!allRows.length) return contentXml([], [['No data extracted']]);
  const tableRows = allRows.map((row, ri) => {
    const cells = row.map(cell => {
      const style = ri === 0 && headers.length ? ' table:style-name="h"' : '';
      return `<table:table-cell${style} office:value-type="string"><text:p>${esc(cell)}</text:p></table:table-cell>`;
    }).join('');
    return `<table:table-row>${cells}</table:table-row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2"><office:automatic-styles><style:style style:name="h" style:family="table-cell"><style:text-properties fo:font-weight="bold"/></style:style></office:automatic-styles><office:body><office:spreadsheet><table:table table:name="Sheet1">${tableRows}</table:table></office:spreadsheet></office:body></office:document-content>`;
}

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="${MIME}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`;

export async function buildOds(headers, rows) {
  const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js')).default;
  const zip = new JSZip();
  zip.file('mimetype', MIME, { compression: 'STORE' });
  zip.folder('META-INF').file('manifest.xml', MANIFEST);
  zip.file('content.xml', contentXml(headers, rows));
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
