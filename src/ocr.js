const MODEL = 'gemini-3.1-flash-lite-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_BYTES = 20 * 1024 * 1024;
const PROMPT = `Convert this document into a spreadsheet. Layout rules:
- If it is a bank statement or financial document:
  - First rows: account metadata as [Field, Value, "", "", ""] — account holder, account number, statement period, opening balance, closing balance
  - One empty separator row
  - One row with transaction column labels: ["", "", "Date", "Description", "Debit (R)", "Credit (R)", "Balance (R)"] (or equivalent currency)
  - Transaction rows: ["", "", date, description, debit or "", credit or "", balance]
  - Leave debit cell empty if credit transaction and vice versa (do not write 0,00)
  - Clean descriptions: remove only trailing OCR artifacts like isolated "R", "Rr", "Gr" at the very end, but preserve account numbers and meaningful text
- For any other document: use meaningful column headers and put each data row as a row
Return ONLY valid JSON: {"headers": ["Field","Value","Date","Description","Debit (R)","Credit (R)","Balance (R)"], "rows": [...]}.
Root must have exactly "headers" and "rows". All values strings. No nested objects.`;

async function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function normalize(parsed) {
  if (Array.isArray(parsed.rows)) {
    return {
      headers: Array.isArray(parsed.headers) ? parsed.headers.map(String) : [],
      rows: parsed.rows.map(r => (Array.isArray(r) ? r : [r]).map(String))
    };
  }
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    return {
      headers: ['Field', 'Value'],
      rows: Object.entries(parsed).map(([k, v]) => [String(k), String(v)])
    };
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
