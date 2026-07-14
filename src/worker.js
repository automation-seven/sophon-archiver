export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/trigger' && request.method === 'POST') {
      return handleTrigger(request, env);
    }
    if (url.pathname === '/api/status' && request.method === 'GET') {
      return handleStatus(env);
    }
    if (url.pathname === '/api/recordings' && request.method === 'GET') {
      return handleListRecordings(env);
    }
    if (url.pathname.startsWith('/api/watch/') && request.method === 'GET') {
      return handleWatch(request, env, url);
    }

    // Everything else falls through to static assets (the public/ folder)
    return env.ASSETS.fetch(request);
  },
};

async function handleTrigger(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.url) {
    return json({ error: 'url is required' }, 400);
  }

  const ghRes = await fetch(
    `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'live-archiver-worker',
      },
      body: JSON.stringify({
        event_type: 'record-live',
        client_payload: { url: body.url, title: body.title || '' },
      }),
    }
  );

  if (ghRes.status !== 204) {
    const text = await ghRes.text();
    return json({ error: `GitHub dispatch failed: ${ghRes.status} ${text}` }, 502);
  }

  return json({ started: true });
}

async function handleStatus(env) {
  const res = await fetch(
    `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/actions/runs?event=repository_dispatch&per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'live-archiver-worker',
      },
    }
  );
  if (!res.ok) return json({ error: 'Could not fetch run status' }, 502);
  const data = await res.json();
  const run = data.workflow_runs && data.workflow_runs[0];
  if (!run) return json({ status: 'none' });

  return json({
    status: run.status, // queued | in_progress | completed
    conclusion: run.conclusion, // success | failure | null
    htmlUrl: run.html_url,
    createdAt: run.created_at,
  });
}

async function handleListRecordings(env) {
  const listed = await env.BUCKET.list();
  const items = listed.objects
    .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
    .map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
    }));
  return json({ items });
}

async function handleWatch(request, env, url) {
  const key = decodeURIComponent(url.pathname.replace('/api/watch/', ''));
  const object = await env.BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('content-type', 'video/mp4');
  if (url.searchParams.get('download') === '1') {
    headers.set('content-disposition', `attachment; filename="${key}"`);
  }
  return new Response(object.body, { headers });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
