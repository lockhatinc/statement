import { ocr } from './ocr.js';
import { setup } from './setup.js';
import { buildOds, download } from './ods.js';

const CLIENT_ID = '873801679825-ss0jff8jhitvm1v7pj2chh4qdlg108ob.apps.googleusercontent.com';

window.__state = { phase: 'no-auth', auth: null, email: null, file: null };
window.__debug = () => window.__state;

function el(id) { return document.getElementById(id); }

function render() {
  const { phase, file, email } = window.__state;
  el('login-panel').hidden = phase !== 'no-auth';
  el('setup-panel').hidden = phase !== 'setting-up';
  el('main-panel').hidden = phase !== 'has-key' && phase !== 'processing';
  el('spinner').hidden = phase !== 'processing';
  el('process-btn').disabled = phase === 'processing' || !file;
  el('error-msg').hidden = true;
  if (email) el('user-email').textContent = email;
  if (file) el('file-name').textContent = file.name;
}

function showErr(msg) {
  window.__state.phase = window.__state.auth ? 'has-key' : 'no-auth';
  render();
  el('error-msg').textContent = msg;
  el('error-msg').hidden = false;
}

const client = google.accounts.oauth2.initTokenClient({
  client_id: CLIENT_ID,
  scope: 'email https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/generative-language',
  callback: async (resp) => {
    if (resp.error) { showErr(`Sign-in failed: ${resp.error}`); return; }
    window.__state.phase = 'setting-up';
    render();
    try {
      const auth = await setup(resp.access_token);
      const ti = await fetch(`https://www.googleapis.com/oauth2/v2/tokeninfo?access_token=${resp.access_token}`).then(r => r.json());
      window.__state.auth = auth;
      window.__state.email = ti.email;
      window.__state.phase = 'has-key';
      render();
    } catch (err) {
      showErr(err.message);
    }
  }
});

el('login-btn').addEventListener('click', () => client.requestAccessToken());

el('sign-out-btn').addEventListener('click', () => {
  window.__state = { phase: 'no-auth', auth: null, email: null, file: null };
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
  const { auth, file } = window.__state;
  if (!auth || !file) return;
  window.__state.phase = 'processing';
  render();
  try {
    const result = await ocr(file, auth);
    const blob = await buildOds(result.headers, result.rows);
    download(blob, `ocr-result-${Date.now()}.ods`);
    window.__state.phase = 'has-key';
    render();
  } catch (err) {
    showErr(err.message);
  }
});

render();
