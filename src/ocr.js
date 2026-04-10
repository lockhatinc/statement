const MODEL = 'gemini-3.1-flash-lite-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_BYTES = 20 * 1024 * 1024;

const PROMPT_PAGEBREAKS = `This document spans multiple pages. I need to detect rows that are split across page breaks.

At each page boundary, look carefully at both sides:
- End of page N: what is the very last data row in the table? Write out every cell verbatim.
- Start of page N+1: what is the very first line of content in the table area (ignoring repeated headers)? Does it have a date in the first cell, or does it start with a description/fragment with no date?

A split row is when: the last row on page N has a date but its description is generic/truncated (e.g. just "Direct Credit" with no name), AND the first line on page N+1 is a dateless fragment that reads like a description continuation (a name, account number, or text that clearly belongs to that transaction).

Return ONLY valid JSON:
{"splits": [{"at_page": 1, "row_on_pageN": ["cell1","cell2","cell3","cell4"], "fragment_on_pageN1": "verbatim dateless first line on next page, or null if none", "merged_row": ["merged cell1","merged cell2","merged cell3","merged cell4"]}]}

If no splits exist, return {"splits": []}`;

function buildMainPrompt(splits) {
  let stitchContext = '';
  if (splits && splits.length > 0) {
    const lines = splits.map(s => {
      if (s.fragment_on_pageN1 && s.merged_row) {
        return `- Page ${s.at_page} last row: the row ${JSON.stringify(s.row_on_pageN)} is SPLIT. The fragment "${s.fragment_on_pageN1}" at the top of page ${s.at_page + 1} belongs to it. Use the merged row ${JSON.stringify(s.merged_row)} as the last row on page ${s.at_page}. Page ${s.at_page + 1} must NOT contain this fragment.`;
      }
      return null;
    }).filter(Boolean);
    if (lines.length) stitchContext = `\nKNOWN PAGE-BREAK SPLITS — apply these exactly:\n${lines.join('\n')}\n`;
  }

  return `Convert this document into an ODS spreadsheet. One sheet per page.

Return ONLY valid JSON — no markdown, no explanation:
{"pages":[{"name":"Page 1","headers":[...],"rows":[[...],...]},{"name":"Page 2",...}]}

CELL TYPES:
- String: "some text"
- Number: {"type":"number","value":1234.56,"display":"1 234,56"}
- Formula: {"type":"formula","formula":"=B2+C2","display":"1 234,56"}

LAYOUT — reproduce every visible element top-to-bottom, left-to-right, exactly as it appears:
- Read the page from top to bottom. Every element you see becomes a row.
- Header area (logo, address blocks, date ranges, reference numbers): each line → one row, text in col A
- Section headings (e.g. "Transaction history", "Account summary"): one row with that text in col A
- Label-value pairs: two-cell row — label in col A, value in col B
- Tables: header row + one data row per table row, cells aligned to table columns
- Footers and notes at the bottom of the page: each line → one row
- Blank lines between sections → blank row []
- Nothing omitted — if you can see it, it must be in the output
- All text verbatim — do not alter, correct, or normalise any text
${stitchContext}
PAGE-BREAK STITCHING — handle split rows:
- A fragment at the top of page N+1 with no date is the continuation of the last row on page N
- Merge it: complete last row on page N, remove the fragment from page N+1
- Page N+1 starts with its own first independent row (which has its own date)

NUMBERS — every pure numeric value must be a number object:
- Display string must exactly match the document — preserve the original formatting verbatim
- Do not add + or - prefixes that are not present in the source document

FORMULAS — when a cell's value is derived from other cells in the same sheet:
- Number rows in your output starting at 1 for the first row of this page
- Running balance (balance[n] = balance[n-1] + amount[n]): Seed is a number, each next row is a formula. Balance in col D, amount in col C, row 8: {"type":"formula","formula":"=D7+C8","display":"..."}
- Row numbers in formulas must match actual row indices in the JSON output (1 = first rows[] entry)
- Totals: {"type":"formula","formula":"=SUM(C2:C15)","display":"..."}
- Cross-page first row: use a number object (no cross-sheet references)`;
}

async function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function coerce(cell) {
  if (cell === null || cell === undefined) return { t: 's', v: '' };
  if (typeof cell === 'string') return { t: 's', v: cell };
  if (typeof cell === 'number') return { t: 'n', v: cell, d: String(cell) };
  if (typeof cell === 'object') {
    if (cell.type === 'number') return { t: 'n', v: Number(cell.value), d: cell.display || String(cell.value) };
    if (cell.type === 'formula') return { t: 'f', f: cell.formula, d: cell.display || '' };
    if (cell.type === 'string') return { t: 's', v: String(cell.value ?? '') };
  }
  return { t: 's', v: String(cell) };
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

async function callGemini(key, parts, jsonMode) {
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      ...(jsonMode ? { generation_config: { response_mime_type: 'application/json' } } : {})
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no text: ${JSON.stringify(json).slice(0, 300)}`);
  return text;
}

export async function ocr(file, key) {
  if (file.size > MAX_BYTES) throw new Error(`File too large: ${(file.size/1024/1024).toFixed(1)}MB exceeds 20MB limit`);
  const data = await toBase64(file);
  const inlineData = { inline_data: { mime_type: file.type, data } };

  let splits = [];
  try {
    const probeText = await callGemini(key, [inlineData, { text: PROMPT_PAGEBREAKS }], true);
    const probeClean = probeText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    splits = JSON.parse(probeClean).splits || [];
  } catch (e) {
  }

  const mainPrompt = buildMainPrompt(splits);
  const text = await callGemini(key, [inlineData, { text: mainPrompt }], true);
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return normalize(JSON.parse(cleaned));
}
