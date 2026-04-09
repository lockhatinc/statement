async function poll(url, token) {
  const h = { 'Authorization': `Bearer ${token}` };
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const d = await fetch(url, { headers: h }).then(r => r.json());
    if (d.done) return d;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Timed out polling ${url}`);
}

export async function setup(token) {
  const H = () => ({ 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' });

  const ti = await fetch(`https://www.googleapis.com/oauth2/v2/tokeninfo?access_token=${token}`).then(r => r.json());
  if (!ti.email) throw new Error(`Token invalid: ${JSON.stringify(ti).slice(0, 200)}`);
  const suffix = btoa(ti.email).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8);
  const projectId = 'gemoci-' + suffix;

  let projNum;
  const search = await fetch(`https://cloudresourcemanager.googleapis.com/v3/projects:search?query=labels.gemoci%3A1+id%3A${projectId}`, { headers: H() }).then(r => r.json());
  const found = search.projects?.find(p => p.projectId === projectId);
  if (found) {
    projNum = found.name.split('/')[1];
  } else {
    const cr = await fetch('https://cloudresourcemanager.googleapis.com/v3/projects', {
      method: 'POST', headers: H(),
      body: JSON.stringify({ projectId, displayName: 'Gemoci', labels: { gemoci: '1' } })
    });
    const cd = await cr.json();
    if (cr.status === 409) {
      const gp = await fetch(`https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`, { headers: H() }).then(r => r.json());
      if (!gp.name) throw new Error(`Project fetch failed: ${JSON.stringify(gp).slice(0, 200)}`);
      projNum = gp.name.split('/')[1];
    } else if (!cr.ok) {
      throw new Error(`Project create ${cr.status}: ${JSON.stringify(cd).slice(0, 200)}`);
    } else {
      const op = await poll(`https://cloudresourcemanager.googleapis.com/v3/${cd.name}`, token);
      projNum = op.response.name.split('/')[1];
    }
  }

  const enable = async (svc) => {
    const r = await fetch(`https://serviceusage.googleapis.com/v1/projects/${projNum}/services/${svc}:enable`, {
      method: 'POST', headers: H(), body: JSON.stringify({})
    });
    const d = await r.json();
    if (!r.ok) throw new Error(`Enable ${svc} ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
    if (!d.done) await poll(`https://serviceusage.googleapis.com/v1/${d.name}`, token);
  };
  await Promise.all([
    enable('generativelanguage.googleapis.com'),
    enable('apikeys.googleapis.com')
  ]);

  const kl = await fetch(`https://apikeys.googleapis.com/v2/projects/${projNum}/locations/global/keys`, { headers: H() }).then(r => r.json());
  const existing = kl.keys?.find(k => k.displayName === 'gemoci');
  if (existing) {
    const ks = await fetch(`https://apikeys.googleapis.com/v2/${existing.name}/keyString`, { headers: H() }).then(r => r.json());
    if (!ks.keyString) throw new Error(`getKeyString failed: ${JSON.stringify(ks).slice(0, 200)}`);
    return ks.keyString;
  }

  const kc = await fetch(`https://apikeys.googleapis.com/v2/projects/${projNum}/locations/global/keys`, {
    method: 'POST', headers: H(),
    body: JSON.stringify({ displayName: 'gemoci', restrictions: { apiTargets: [{ service: 'generativelanguage.googleapis.com' }] } })
  });
  const kd = await kc.json();
  if (!kc.ok) throw new Error(`Key create ${kc.status}: ${JSON.stringify(kd).slice(0, 200)}`);
  const kop = await poll(`https://apikeys.googleapis.com/v2/${kd.name}`, token);
  if (!kop.response?.keyString) throw new Error(`Key op missing keyString: ${JSON.stringify(kop).slice(0, 200)}`);
  return kop.response.keyString;
}
