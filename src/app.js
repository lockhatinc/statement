import { ocr } from './ocr.js';
import { buildOds, download } from './ods.js';

const CLIENT_ID = document.querySelector('meta[name="google-client-id"]').content;

window.__state = { token: null, email: null, file: null, phase: 'unauthed' };

function el(id) { return document.getElementById(id); }

function render() {
  const { phase, email, file } = window.__state;
  el('login-panel').hidden = phase !== 'unauthed';
  el('main-panel').hidden = phase === 'unauthed';
  el('spinner').hidden = phase !== 'processing';
  el('process-btn').disabled = phase === 'processing' || !file;
  el('error-msg').hidden = true;
  if (email) el('user-email').textContent = email;
  if (file) el('file-name').textContent = file.name;
}

function showErr(msg) {
  el('error-msg').textContent = msg;
  el('error-msg').hidden = false;
  window.__state.phase = window.__state.token ? 'authed' : 'unauthed';
  render();
}

const client = google.accounts.oauth2.initTokenClient({
  client_id: CLIENT_ID,
  scope: 'https://www.googleapis.com/auth/generative-language openid email profile',
  callback: async resp => {
    if (resp.error) { showErr(`Auth failed: ${resp.error}`); return; }
    window.__state.token = resp.access_token;
    try {
      const info = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
        headers: { Authorization: `Bearer ${resp.access_token}` }
      }).then(r => r.json());
      window.__state.email = info.email || info.name || 'Signed in';
    } catch { window.__state.email = 'Signed in'; }
    window.__state.phase = 'authed';
    render();
  }
});

el('login-btn').addEventListener('click', () => client.requestAccessToken());

el('sign-out-btn').addEventListener('click', () => {
  google.accounts.oauth2.revoke(window.__state.token, () => {});
  window.__state = { token: null, email: null, file: null, phase: 'unauthed' };
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
  const { token, file } = window.__state;
  if (!token || !file) return;
  window.__state.phase = 'processing';
  render();
  try {
    const result = await ocr(file, token);
    const blob = await buildOds(result.headers, result.rows);
    download(blob, `ocr-result-${Date.now()}.ods`);
    window.__state.phase = 'authed';
    render();
  } catch(err) {
    if (err.message.includes('401') || err.message.includes('403')) {
      window.__state.token = null;
      window.__state.phase = 'unauthed';
      showErr('Session expired. Please sign in again.');
    } else {
      showErr(err.message);
    }
  }
});

render();
