/**
 * Cloudflare Worker — Proxy Telegram + Sync R2 (TamalitosAPP)
 * ================================================================
 *
 * Endpoints:
 *   GET  /health     → {"ok":true}
 *   POST /backup     → Telegram sendDocument (multipart: document, chat_id, caption)
 *   PUT  /sync       → sube snapshot JSON a R2 (backups/<timestamp>.json + backups/latest.json)
 *   GET  /sync       → devuelve backups/latest.json
 *   GET  /sync/list  → lista snapshots (para rollback)
 *
 * ────────────────────────────────────────────────────────────────
 * SETUP (una sola vez)
 * ────────────────────────────────────────────────────────────────
 * 1. Telegram (respaldo a Telegram):
 *      @BotFather → /newbot → TOKEN.
 *      chat_id: escribir al bot → getUpdates → result[0].message.chat.id
 * 2. R2 (sincronización en la nube):
 *      Crear un bucket R2, ej. "tamalitosapp-backups" (npx wrangler r2 bucket create tamalitosapp-backups).
 * 3. Desplegar este Worker:
 *      cd telegram-worker
 *      npx wrangler login
 *      npx wrangler secret put TELEGRAM_BOT_TOKEN   # token del bot (Telegram)
 *      npx wrangler secret put TELEGRAM_CHAT_ID     # (opcional) chat por defecto
 *      npx wrangler secret put API_KEY              # (opcional) clave compartida PWA<->Worker
 *      npx wrangler deploy
 *      # Anotá la URL: https://tamalitosapp-telegram-proxy.<tu-sub>.workers.dev
 * 4. En la PWA:
 *      - Configuración → Telegram → URL del Worker + Chat ID.
 *      - Configuración → Sincronizar → URL del Worker + API key (si usás una).
 *
 * Seguridad:
 *   - El token de Telegram y el bucket R2 NUNCA se exponen: viven en el Worker.
 *   - La API key (opcional) viaja en el header X-API-Key.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── CORS ────────────────────────────────────────────────
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const allowOrigin = allowed.length === 0
      ? origin
      : (allowed.includes(origin) ? origin : 'null');
    const cors = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/health') {
      return json({ ok: true }, 200, cors);
    }

    // ── Telegram backup ─────────────────────────────────────
    if (url.pathname === '/backup') {
      if (request.method !== 'POST') {
        return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
      }
      return handleBackup(request, env, cors);
    }

    // ── Sync R2 ─────────────────────────────────────────────
    if (url.pathname === '/sync') {
      if (request.method === 'PUT') return handleSyncPut(request, env, cors);
      if (request.method === 'GET') return handleSyncGet(request, env, cors);
      return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }

    if (url.pathname === '/sync/list') {
      return handleSyncList(request, env, cors);
    }

    return json({ ok: false, error: 'not_found' }, 404, cors);
  },
};

// ══════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════

function checkAuth(request, env) {
  const apiKey = env.API_KEY;
  if (!apiKey) return true; // sin clave configurada → endpoint abierto (pruebas)
  const provided = request.headers.get('X-API-Key') || '';
  return provided === apiKey;
}

// ══════════════════════════════════════════════════════════
// TELEGRAM
// ══════════════════════════════════════════════════════════

async function handleBackup(request, env, cors) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return json({ ok: false, error: 'bot_token_missing' }, 500, cors);
  }
  if (!checkAuth(request, env)) {
    return json({ ok: false, error: 'unauthorized' }, 401, cors);
  }

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return json({ ok: false, error: 'invalid_form_data' }, 400, cors);
  }

  const document = form.get('document');
  const chatId = String(form.get('chat_id') || env.TELEGRAM_CHAT_ID || '');
  const caption = String(form.get('caption') || '');

  if (!document || typeof document === 'string') {
    return json({ ok: false, error: 'document_missing' }, 400, cors);
  }
  if (!chatId) {
    return json({ ok: false, error: 'chat_id_missing' }, 400, cors);
  }

  const tgForm = new FormData();
  tgForm.set('chat_id', chatId);
  tgForm.set('document', document);
  if (caption) tgForm.set('caption', caption);

  try {
    const tgResp = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: tgForm,
    });
    const tgBody = await tgResp.json().catch(() => ({}));

    if (!tgResp.ok || !tgBody.ok) {
      return json(
        { ok: false, error: 'telegram_error', description: tgBody.description || tgResp.statusText },
        tgResp.status,
        cors
      );
    }

    return json({ ok: true, result: { message_id: tgBody.result?.message_id } }, 200, cors);
  } catch (e) {
    return json({ ok: false, error: 'telegram_unreachable', description: e.message }, 502, cors);
  }
}

// ══════════════════════════════════════════════════════════
// SYNC R2
// ══════════════════════════════════════════════════════════

const KEY_LATEST = 'backups/latest.json';

async function handleSyncPut(request, env, cors) {
  if (!checkAuth(request, env)) {
    return json({ ok: false, error: 'unauthorized' }, 401, cors);
  }

  const body = await request.text().catch(() => null);
  if (!body) {
    return json({ ok: false, error: 'empty_body' }, 400, cors);
  }
  try {
    JSON.parse(body);
  } catch (e) {
    return json({ ok: false, error: 'invalid_json' }, 400, cors);
  }

  const ts = Date.now();
  const keyTs = `backups/${ts}.json`;

  try {
    await env.BACKUPS.put(KEY_LATEST, body, { httpMetadata: { contentType: 'application/json' } });
    await env.BACKUPS.put(keyTs, body, { httpMetadata: { contentType: 'application/json' } });
    await _limpiarSnapshots(env);
    return json({ ok: true, timestamp: ts, bytes: body.length }, 200, cors);
  } catch (e) {
    return json({ ok: false, error: 'r2_error', description: e.message }, 502, cors);
  }
}

async function handleSyncGet(request, env, cors) {
  if (!checkAuth(request, env)) {
    return json({ ok: false, error: 'unauthorized' }, 401, cors);
  }

  try {
    const obj = await env.BACKUPS.get(KEY_LATEST);
    if (!obj) {
      return json({ ok: false, error: 'no_snapshot' }, 404, cors);
    }
    const text = await obj.text();
    return new Response(text, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return json({ ok: false, error: 'r2_error', description: e.message }, 502, cors);
  }
}

async function handleSyncList(request, env, cors) {
  if (!checkAuth(request, env)) {
    return json({ ok: false, error: 'unauthorized' }, 401, cors);
  }

  try {
    const res = await env.BACKUPS.list({ prefix: 'backups/' });
    const snapshots = (res.objects || [])
      .filter(o => o.key !== KEY_LATEST)
      .map(o => ({ key: o.key, uploaded: o.uploaded, size: o.size }))
      .sort((a, b) => String(b.uploaded || '').localeCompare(String(a.uploaded || '')));
    return json({ ok: true, snapshots }, 200, cors);
  } catch (e) {
    return json({ ok: false, error: 'r2_error', description: e.message }, 502, cors);
  }
}

/**
 * Conserva solo las últimas 10 snapshots (best-effort).
 */
async function _limpiarSnapshots(env) {
  try {
    const res = await env.BACKUPS.list({ prefix: 'backups/' });
    const snaps = (res.objects || [])
      .filter(o => o.key !== KEY_LATEST)
      .sort((a, b) => String(b.uploaded || '').localeCompare(String(a.uploaded || '')));
    for (const o of snaps.slice(10)) {
      await env.BACKUPS.delete(o.key);
    }
  } catch (e) {
    // best effort
  }
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, ...JSON_HEADERS },
  });
}
