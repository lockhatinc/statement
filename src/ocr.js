const MODEL = 'gemini-3.1-flash-lite-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_BYTES = 20 * 1024 * 1024;

const PROMPT = `Convert this document into a spreadsheet, one sheet per page.

Return ONLY valid JSON:
{"pages":[{"name":"Page 1","headers":[...],"rows":[[...],...]},{"name":"Page 2",...}]}

Each cell value is either a plain string OR an object:
- Plain string: just a string, e.g. "Direct Credit"
- Number/currency: {"type":"number","value":1234.56,"display":"1 234,56"}
- Formula: {"type":"formula","formula":"=C3+D3","display":"123.45"}

Rules:
- One sheet per page. Reproduce the original layout as closely as possible — preserve the visual structure, groupings, and row/column arrangement of the source document.
- Page-break row stitching: when a transaction row is split across a page break (date at bottom of page N, description/amount continues at top of page N+1), include the COMPLETE merged row on the page where the date appears; do NOT repeat it on page N+1.
- Formula detection: if a column's values are consistently derived from other columns (e.g. a running balance = previous balance ± amount, or a total row), output those cells as formula objects referencing the correct cells. Use spreadsheet-style cell references (e.g. =C3+D3).
- For bank statements, structure each page:
  - Metadata rows: Field/Value pairs — include ALL visible fields verbatim: account holder, account name, account number, account address, statement period, statement number, issued on, balance brought forward, total credits, total debits, closing balance
  - Empty separator row
  - Column headers row: ["Date","Description","Amount (R)","Balance (R)"]
  - Transaction rows:
    - Date: plain string, verbatim
    - Description: plain string, verbatim — do NOT alter or clean up any text
    - Amount: {"type":"number","value":1234.56,"display":"1 234,56"} — empty string if blank
    - Balance: {"type":"formula","formula":"=D{prev}+C{cur}","display":"1 234,56"} — running balance as formula referencing previous balance ± current amount
- All string values must be plain strings. No extra nesting.`;

async function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function coerce(cell) {
  if (typeof cell === 'string') return { t: 's', v: cell };
  if (typeof cell === 'number') return { t: 'n', v: cell, d: String(cell) };
  if (cell && typeof cell === 'object') {
    if (cell.type === 'number') return { t: 'n', v: Number(cell.value), d: cell.display || String(cell.value) };
    if (cell.type === 'formula') return { t: 'f', f: cell.formula, d: cell.display || '' };
    if (cell.type === 'string') return { t: 's', v: String(cell.value ?? '') };
  }
  return { t: 's', v: String(cell ?? '') };
}

function normalize(parsed) {
  if (parsed.pages && Array.isArray(parsed.pages)) {
    return parsed.pages.map((p, i) => ({
      name: p.name || `Page ${i + 1}`,
      headers: Array.isArray(p.headers) ? p.headers.map(h => coerce(h)) : [],
      rows: Array.isArray(p.rows) ? p.rows.map(r => (Array.isArray(r) ? r : [r]).map(coerce)) : []
    }));
  }
  if (Array.isArray(parsed.rows)) {
    return [{
      name: 'Sheet1',
      headers: Array.isArray(parsed.headers) ? parsed.headers.map(h => coerce(h)) : [],
      rows: parsed.rows.map(r => (Array.isArray(r) ? r : [r]).map(coerce))
    }];
  }
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    return [{
      name: 'Sheet1',
      headers: [coerce('Field'), coerce('Value')],
      rows: Object.entries(parsed).map(([k, v]) => [coerce(k), coerce(String(v))])
    }];
  }
  throw new Error(`Unrecognised response shape: ${JSON.stringify(parsed).slice(0, 200)}`);
}

export async function ocr(file, key) {
  if (file.size > MAX_BYTES) throw new Error(`File too large: ${(file.size/1024/1024).toFixed(1)}MB exceeds 20MB limit`);
  const data = await toBase64(file);
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: file.type, data } }, { text: PROMPT }] }],
      generation_config: { response_mime_type: 'application/json' }
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no text: ${JSON.stringify(json).slice(0, 300)}`);
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return normalize(JSON.parse(cleaned));
}
