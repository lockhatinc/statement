const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview:generateContent';
const MAX_BYTES = 15 * 1024 * 1024;
const PROMPT = 'Extract all data from this image into a JSON structure. Return ONLY valid JSON, no markdown, no explanation. Format: {"headers": ["col1", "col2"], "rows": [["val1", "val2"]]}. If no table exists, use headers:[] and put each text line as a single-element row. All values must be strings.';

async function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

export async function ocr(file, token) {
  if (file.size > MAX_BYTES) throw new Error(`File too large: ${(file.size/1024/1024).toFixed(1)}MB exceeds 15MB limit`);
  const data = await toBase64(file);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.rows)) throw new Error(`Invalid response shape: ${cleaned.slice(0, 200)}`);
  return {
    headers: Array.isArray(parsed.headers) ? parsed.headers.map(String) : [],
    rows: parsed.rows.map(r => (Array.isArray(r) ? r : [r]).map(String))
  };
}
