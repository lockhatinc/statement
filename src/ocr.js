const MODEL = 'gemini-3.1-flash-lite-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_BYTES = 20 * 1024 * 1024;
const PROMPT = 'Extract all data from this document into a table. Return ONLY valid JSON in this exact format: {"headers": ["col1", "col2"], "rows": [["val1", "val2"]]}. The root object MUST have exactly two keys: "headers" (array of strings) and "rows" (array of arrays of strings). No other format. No nested objects. If the document has no table, use headers:[] and put each line of text as a single-element row. All values must be strings.';

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
