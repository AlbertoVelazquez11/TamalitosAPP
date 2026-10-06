/**
 * Cloudflare Worker — Proxy de respaldo a Telegram (TamalitosAPP)
 * ================================================================
 *
 * Arquitectura (análisis Engram id 20):
 *   PWA (fetch POST multipart) → este Worker → api.telegram.org/bot<TOKEN>/sendDocument
 *
 * Por qué existe este proxy:
 *   - La Bot API de Telegram NO envía cabeceras CORS, por lo que un fetch
 *     directo desde el navegador/PWA falla en el preflight.
 *   - El token del bot NUNCA debe ir en el JavaScript del cliente; vive aquí
 *     como secreto del Worker.
 *
 * ────────────────────────────────────────────────────────────────
 * SETUP (una sola vez)
 * ────────────────────────────────────────────────────────────────
 * 1. Crear el bot:
 *      Telegram → @BotFather → /newbot → copiar el TOKEN.
 * 2. Obtener el chat_id (opcional, se puede enviar desde la PWA):
 *      Escribile cualquier mensaje al bot → GET
 *      https://api.telegram.org/bot<TOKEN>/getUpdates
 *      y tomá result[0].message.chat.id
 *      (o usá un canal/grupo: agregá el bot y mandá un mensaje).
 * 3. Desplegar este Worker con wrangler:
 *      cd telegram-worker
 *      npx wrangler login
 *      npx wrangler secret put TELEGRAM_BOT_TOKEN   # pegá el token
 *      npx wrangler secret put TELEGRAM_CHAT_ID     # (opcional) chat por defecto
 *      npx wrangler secret put API_KEY              # (opcional) clave compartida
 *      npx wrangler deploy
 *      # Anotá la URL resultante, ej. https://tamalitosapp-telegram-proxy.<tu-subdominio>.workers.dev
 * 4. En la PWA (Configuración → Respaldo a Telegram):
 *      - URL del Worker: la URL del paso 3.
 *      - Chat ID: el chat.id del paso 2 (opcional).
 *      - Tocar "Enviar respaldo a Telegram".
 * ────────────────────────────────────────────────────────────────
 *
 * Endpoints:
 *   GET  /health  → {"ok":true}
 *   POST /backup  → multipart/form-data:
 *                     - document : archivo JSON del respaldo (File)
 *                     - chat_id  : destino (opcional; si no, TELEGRAM_CHAT_ID)
 *                     - caption  : texto opcional
 *                   → {"ok":true, result:{message_id}} | {"ok":false, error, description?}
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
    // Sin orígenes configurados → se permite el que venga (modo desarrollo).
    const allowOrigin = allowed.length === 0
      ? origin
      : (allowed.includes(origin) ? origin : 'null');
    const cors = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ── Health check ────────────────────────────────────────
    if (url.pathname === '/health') {
      return json({ ok: true }, 200, cors);
    }

    // ── Respaldo ────────────────────────────────────────────
    if (url.pathname === '/backup') {
      if (request.method !== 'POST') {
        return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
      }
      return handleBackup(request, env, cors);
    }

    return json({ ok: false, error: 'not_found' }, 404, cors);
  },
};

async function handleBackup(request, env, cors) {
  // 1. Token (secreto)
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return json({ ok: false, error: 'bot_token_missing' }, 500, cors);
  }

  // 2. API key compartida opcional
  const apiKey = env.API_KEY;
  if (apiKey) {
    const provided = request.headers.get('X-API-Key') || '';
    if (provided !== apiKey) {
      return json({ ok: false, error: 'unauthorized' }, 401, cors);
    }
  }

  // 3. Leer FormData
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

  // 4. Reenviar a Telegram
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

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, ...JSON_HEADERS },
  });
}
