import { ocr } from './ocr.js';
import { buildOds, download } from './ods.js';

window.__state = { phase: 'no-key', key: null, file: null };
window.__debug = () => window.__state;

function el(id) { return document.getElementById(id); }

function render() {
  const { phase, file } = window.__state;
  el('key-panel').hidden = phase !== 'no-key';
  el('main-panel').hidden = phase === 'no-key';
  el('spinner').hidden = phase !== 'processing';
  el('process-btn').disabled = phase === 'processing' || !file;
  el('error-msg').hidden = true;
  if (file) el('file-name').textContent = file.name;
}

function showErr(msg) {
  window.__state.phase = window.__state.key ? 'has-key' : 'no-key';
  render();
  el('error-msg').textContent = msg;
  el('error-msg').hidden = false;
}

el('key-btn').addEventListener('click', () => {
  const key = el('api-key').value.trim();
  if (!key) { showErr('Enter an API key'); return; }
  window.__state.key = key;
  window.__state.phase = 'has-key';
  render();
});

el('api-key').addEventListener('keydown', e => { if (e.key === 'Enter') el('key-btn').click(); });

el('clear-btn').addEventListener('click', () => {
  window.__state = { phase: 'no-key', key: null, file: null };
  el('api-key').value = '';
  render();
});

const dropzone = el('dropzone');
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  setFile(e.dataTransfer.files[0]);
});
el('file-input').addEventListener('change', e => setFile(e.target.files[0]));
dropzone.addEventListener('click', () => el('file-input').click());

function setFile(f) {
  if (!f) return;
  if (!f.type.startsWith('image/')) { showErr('Only image files are supported'); return; }
  window.__state.file = f;
  render();
}

el('process-btn').addEventListener('click', async () => {
  const { key, file } = window.__state;
  if (!key || !file) return;
  window.__state.phase = 'processing';
  render();
  try {
    const result = await ocr(file, key);
    const blob = await buildOds(result.headers, result.rows);
    download(blob, `ocr-result-${Date.now()}.ods`);
    window.__state.phase = 'has-key';
    render();
  } catch (err) {
    showErr(err.message);
  }
});

render();
