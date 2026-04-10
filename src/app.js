import { ocr } from './ocr.js';
import { buildOds, download } from './ods.js';

window.__state = { phase: 'no-key', key: null, file: null };
window.__debug = () => window.__state;

function el(id) { return document.getElementById(id); }

function render() {
  const { phase, file } = window.__state;
  const hasKey = phase !== 'no-key';
  el('api-key').readOnly = hasKey;
  el('api-key').classList.toggle('set', hasKey);
  el('clear-btn').hidden = !hasKey;
  el('main-panel').hidden = !hasKey;
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

function setKey(key) {
  window.__state.key = key;
  window.__state.phase = 'has-key';
  localStorage.setItem('gemoci_key', key);
  el('api-key').value = key;
  render();
}

function trySetKey() {
  const key = el('api-key').value.replace(/^["'\s]+|["'\s]+$/g, '');
  if (key) setKey(key);
}

const saved = (localStorage.getItem('gemoci_key') || '').replace(/^["'\s]+|["'\s]+$/g, '');
if (saved) setKey(saved);
else render();

el('api-key').addEventListener('keydown', e => { if (e.key === 'Enter') trySetKey(); });
el('api-key').addEventListener('blur', trySetKey);

el('clear-btn').addEventListener('click', () => {
  localStorage.removeItem('gemoci_key');
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
  if (!f.type.startsWith('image/') && f.type !== 'application/pdf') { showErr('Only image and PDF files are supported'); return; }
  window.__state.file = f;
  render();
}

el('process-btn').addEventListener('click', async () => {
  const { key, file } = window.__state;
  if (!key || !file) return;
  window.__state.phase = 'processing';
  render();
  try {
    const sheets = await ocr(file, key);
    const blob = await buildOds(sheets);
    download(blob, `ocr-result-${Date.now()}.ods`);
    window.__state.phase = 'has-key';
    render();
  } catch (err) {
    showErr(err.message);
  }
});
