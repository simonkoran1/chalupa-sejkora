// ============================================================================
// Availability API (public — no auth)
// ============================================================================
const MONTH_MAP = {
  'Leden': 1, 'Únor': 2, 'Březen': 3, 'Duben': 4, 'Květen': 5, 'Červen': 6,
  'Červenec': 7, 'Srpen': 8, 'Září': 9, 'Říjen': 10, 'Listopad': 11, 'Prosinec': 12,
};
const pad = n => String(n).padStart(2, '0');

function parseCalendar(html) {
  const booked = [], arrivals = [], departures = [];
  let cy = null, cm = null;
  const re = /class='month-name'>([^<]+)<|<TD class='([^']+)'[^>]*>(\d+)</g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) {
      const p = m[1].trim().split(/\s+/);
      cm = MONTH_MAP[p[0]] || null;
      cy = parseInt(p[1], 10) || null;
    } else if (m[2] && cy && cm) {
      const cls = m[2];
      const day = parseInt(m[3], 10);
      if (cls.includes('day-shdw')) continue;
      const iso = `${cy}-${pad(cm)}-${pad(day)}`;
      if (cls.includes('day-full') && cls.includes('k')) departures.push(iso);
      else if (cls.includes('day-full') && cls.includes('z')) arrivals.push(iso);
      else if (cls.includes('day-full')) booked.push(iso);
    }
  }
  return { booked, arrivals, departures };
}

// ============================================================================
// CMS: constants
// ============================================================================
const GITHUB_REPO = 'simonkoran1/chalupa-sejkora';

// ============================================================================
// CMS: session cookies (HMAC-signed)
// ============================================================================
const COOKIE_NAME = 'cms_session';
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signSession(secret, exp) {
  const payload = String(exp);
  return `${payload}.${await hmac(secret, payload)}`;
}

async function verifySession(secret, token) {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  const expected = await hmac(secret, exp);
  if (sig !== expected) return false;
  return parseInt(exp, 10) > Math.floor(Date.now() / 1000);
}

function parseCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === name) return v;
  }
  return null;
}

async function requireAuth(request, env) {
  const token = parseCookie(request.headers.get('Cookie'), COOKIE_NAME);
  const ok = await verifySession(env.CMS_SESSION_SECRET, token);
  return ok;
}

function cmsEnabled(env) {
  return !!(env.CMS_PASSWORD && env.CMS_EMAIL && env.CMS_SESSION_SECRET && env.ANTHROPIC_API_KEY && env.GITHUB_TOKEN);
}

// ============================================================================
// CMS: content schema (only these paths can be edited)
// ============================================================================
const EDITABLE_SCHEMA = {
  // Vedlejší sezóna
  'pricing.vedlejsi_sezona.night_2':              { type: 'number', min: 0, max: 100000, label: 'Vedlejší sezóna — 2 noci (Kč / noc)' },
  'pricing.vedlejsi_sezona.night_3_4':            { type: 'number', min: 0, max: 100000, label: 'Vedlejší sezóna — 3–4 noci (Kč / noc)' },
  'pricing.vedlejsi_sezona.night_5_plus':         { type: 'number', min: 0, max: 100000, label: 'Vedlejší sezóna — 5+ nocí (Kč / noc)' },
  // Střední sezóna
  'pricing.stredni_sezona.night_2':               { type: 'number', min: 0, max: 100000, label: 'Střední sezóna — 2 noci (Kč / noc)' },
  'pricing.stredni_sezona.night_3_4':             { type: 'number', min: 0, max: 100000, label: 'Střední sezóna — 3–4 noci (Kč / noc)' },
  'pricing.stredni_sezona.night_5_plus':          { type: 'number', min: 0, max: 100000, label: 'Střední sezóna — 5+ nocí (Kč / noc)' },
  // Hlavní sezóna
  'pricing.hlavni_sezona.leto_zima':              { type: 'number', min: 0, max: 100000, label: 'Hlavní sezóna — Léto / Zima (Kč / noc)' },
  // Vánoce 2026
  'pricing.vanoce_2026.price_per_night':          { type: 'number', min: 0, max: 100000, label: 'Vánoce 2026 — cena / noc (Kč)' },
  'pricing.vanoce_2026.min_nights':               { type: 'number', min: 1, max: 30, label: 'Vánoce 2026 — minimální počet nocí' },
  'pricing.vanoce_2026.availability.status':      { type: 'enum', values: ['green', 'orange'], label: 'Vánoce 2026 — status obsazenosti (green=volno, orange=obsazeno)' },
  'pricing.vanoce_2026.availability.label_cs':    { type: 'string', maxLength: 40, label: 'Vánoce 2026 — text štítku (česky)' },
  'pricing.vanoce_2026.availability.label_en':    { type: 'string', maxLength: 40, label: 'Vánoce 2026 — text štítku (anglicky)' },
  // Silvestr 2026
  'pricing.silvestr_2026.price_per_night':        { type: 'number', min: 0, max: 100000, label: 'Silvestr 2026 — cena / noc (Kč)' },
  'pricing.silvestr_2026.min_nights':             { type: 'number', min: 1, max: 30, label: 'Silvestr 2026 — minimální počet nocí' },
  'pricing.silvestr_2026.availability.status':    { type: 'enum', values: ['green', 'orange'], label: 'Silvestr 2026 — status obsazenosti (green=volno, orange=obsazeno)' },
  'pricing.silvestr_2026.availability.label_cs':  { type: 'string', maxLength: 40, label: 'Silvestr 2026 — text štítku (česky)' },
  'pricing.silvestr_2026.availability.label_en':  { type: 'string', maxLength: 40, label: 'Silvestr 2026 — text štítku (anglicky)' },
  // Poplatky
  'pricing.fees.cleaning':                        { type: 'number', min: 0, max: 20000, label: 'Závěrečný úklid (Kč)' },
  'pricing.fees.tourism_tax_per_adult_per_night': { type: 'number', min: 0, max: 500, label: 'Místní poplatek / dospělý / noc (Kč)' },
};

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function validateChange(path, value) {
  const schema = EDITABLE_SCHEMA[path];
  if (!schema) return { ok: false, err: `Field "${path}" is not editable.` };
  if (schema.type === 'number') {
    const n = typeof value === 'string' ? parseFloat(value.replace(/\s/g, '')) : value;
    if (!Number.isFinite(n)) return { ok: false, err: `Value must be a number.` };
    if (n < schema.min || n > schema.max) return { ok: false, err: `Value must be between ${schema.min} and ${schema.max}.` };
    return { ok: true, value: n };
  }
  if (schema.type === 'enum') {
    if (!schema.values.includes(value)) return { ok: false, err: `Value must be one of: ${schema.values.join(', ')}.` };
    return { ok: true, value };
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return { ok: false, err: `Value must be a string.` };
    if (schema.maxLength && value.length > schema.maxLength) return { ok: false, err: `Max length ${schema.maxLength}.` };
    return { ok: true, value };
  }
  return { ok: true, value };
}

// ============================================================================
// CMS: GitHub commit
// ============================================================================
async function ghApi(env, path, init = {}) {
  const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'chalupasejkora-cms',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!resp.ok) throw new Error(`GitHub ${init.method || 'GET'} ${path}: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

async function fetchContent(env) {
  const data = await ghApi(env, `/contents/src/content/site.json?ref=main`);
  const decoded = atob(data.content.replace(/\n/g, ''));
  return { json: JSON.parse(decoded), sha: data.sha };
}

async function commitContent(env, updatedJson, sha, message) {
  const content = JSON.stringify(updatedJson, null, 2) + '\n';
  const b64 = btoa(unescape(encodeURIComponent(content)));
  return ghApi(env, `/contents/src/content/site.json`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: b64, sha, branch: 'main' }),
  });
}

// ============================================================================
// CMS: Claude chat with updateField tool
// ============================================================================
async function callClaude(env, messages, systemPrompt) {
  const tools = [{
    name: 'updateField',
    description: 'Update a single editable field on the site. Only paths listed as editable are allowed.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Dotted path of the field, e.g. "pricing.vanoce_2026.price_per_night"' },
        value: { description: 'New value. Must match the field type.' },
      },
      required: ['path', 'value'],
    },
  }];
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages,
    }),
  });
  if (!resp.ok) throw new Error(`Claude: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

// ============================================================================
// Router
// ============================================================================
function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Public: availability
    if (url.pathname === '/api/availability') {
      try {
        const resp = await fetch('https://obsazenost.e-chalupy.cz/kalendar.php?id=10684&pocetMesicu=14&jazyk=cz',
          { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await resp.text();
        const parsed = parseCalendar(html);
        return json(parsed, {
          headers: { 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' },
        });
      } catch (err) {
        return json({ booked: [], arrivals: [], departures: [], error: err.message });
      }
    }

    // CMS endpoints — 404 if not configured
    if (url.pathname.startsWith('/api/cms/')) {
      if (!cmsEnabled(env)) return new Response('Not found', { status: 404 });

      const isHttps = url.protocol === 'https:';
      const cookieFlags = `Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}`;

      if (url.pathname === '/api/cms/login' && request.method === 'POST') {
        const { email, password } = await request.json().catch(() => ({}));
        if (!email || email.trim().toLowerCase() !== env.CMS_EMAIL.trim().toLowerCase() || password !== env.CMS_PASSWORD) return json({ ok: false }, { status: 401 });
        const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
        const token = await signSession(env.CMS_SESSION_SECRET, exp);
        return json({ ok: true }, {
          headers: { 'Set-Cookie': `${COOKIE_NAME}=${token}; ${cookieFlags}; Max-Age=${SESSION_TTL_SEC}` },
        });
      }

      if (url.pathname === '/api/cms/logout' && request.method === 'POST') {
        return json({ ok: true }, {
          headers: { 'Set-Cookie': `${COOKIE_NAME}=; ${cookieFlags}; Max-Age=0` },
        });
      }

      // All other CMS endpoints require auth
      if (!(await requireAuth(request, env))) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });

      if (url.pathname === '/api/cms/session') {
        return json({ ok: true, schema: EDITABLE_SCHEMA });
      }

      if (url.pathname === '/api/cms/chat' && request.method === 'POST') {
        const { messages, selectedField, selectedStatusField } = await request.json();
        const { json: currentContent } = await fetchContent(env);
        const currentValue = selectedField ? getPath(currentContent, selectedField) : null;
        const currentStatusValue = selectedStatusField ? getPath(currentContent, selectedStatusField) : null;
        const schemaSummary = Object.entries(EDITABLE_SCHEMA).map(([k, v]) => {
          const constraints = v.type === 'number' ? `${v.min}-${v.max}` : v.type === 'enum' ? v.values.join('|') : v.type === 'string' ? `max ${v.maxLength || '∞'} chars` : '';
          return `- ${k} (${v.type}${constraints ? ', ' + constraints : ''}) — ${v.label}`;
        }).join('\n');
        const systemPrompt = `You are an editing assistant for a Czech cottage-rental website (Chalupa Sejkora).
The user speaks Czech or English. Respond in the same language as the user.
Your job: help them edit content. When they request a change to a field, call the updateField tool.
Only these fields are editable:
${schemaSummary}

Notes:
- For availability tags: the label (text like "Volné"/"Obsazeno") and the color status (green/orange) are separate fields but related. If the user says "mark as obsazeno" or "change color to orange", update BOTH the label ("Obsazeno") AND the status ("orange") in the SAME reply — call updateField twice, once for each. If they say "change label to Available" without color, just update the label. If they say "make it orange" only, just update the status.
- If the user is editing a CZ label (label_cs), you may also update the corresponding EN label (label_en) with a translation, but only when it makes semantic sense (e.g., "Volné"→"Available", "Obsazeno"→"Booked").
${selectedField ? `\nUser has selected: ${selectedField}\nCurrent value: ${JSON.stringify(currentValue)}` : ''}
${selectedStatusField ? `Related status field: ${selectedStatusField}\nCurrent status: ${JSON.stringify(currentStatusValue)}` : ''}
If the request is unclear or refers to a non-editable field, ask for clarification. Be concise.`;
        try {
          const reply = await callClaude(env, messages, systemPrompt);
          return json({ ok: true, reply });
        } catch (err) {
          return json({ ok: false, error: err.message }, { status: 500 });
        }
      }

      if (url.pathname === '/api/cms/publish' && request.method === 'POST') {
        const { changes } = await request.json(); // [{ path, value }, ...]
        if (!Array.isArray(changes) || changes.length === 0) return json({ ok: false, error: 'No changes' }, { status: 400 });
        const validated = [];
        for (const c of changes) {
          const v = validateChange(c.path, c.value);
          if (!v.ok) return json({ ok: false, error: `${c.path}: ${v.err}` }, { status: 400 });
          validated.push({ path: c.path, value: v.value });
        }
        try {
          const { json: content, sha } = await fetchContent(env);
          for (const c of validated) setPath(content, c.path, c.value);
          const summary = validated.map(c => `${c.path} → ${c.value}`).join(', ');
          const commit = await commitContent(env, content, sha, `CMS: ${summary}`);
          return json({ ok: true, commit: commit.commit?.sha });
        } catch (err) {
          return json({ ok: false, error: err.message }, { status: 500 });
        }
      }

      return new Response('Not found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
