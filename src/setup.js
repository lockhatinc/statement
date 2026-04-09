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

  await fetch(`https://serviceusage.googleapis.com/v1/projects/${projNum}/services/generativelanguage.googleapis.com:enable`, {
    method: 'POST', headers: H(), body: JSON.stringify({})
  }).then(async r => {
    const d = await r.json();
    if (!r.ok) throw new Error(`Enable generativelanguage ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
    if (!d.done) await poll(`https://serviceusage.googleapis.com/v1/${d.name}`, token);
  });

  return { token, projNum };
}
