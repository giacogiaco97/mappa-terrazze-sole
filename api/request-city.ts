// Vercel Function (auto-detected da /api/*.ts).
// Endpoint POST /api/request-city per le richieste utente di nuove città.
//
// Privacy: l'email destinatario è SOLO server-side (env var RECIPIENT_EMAIL),
// mai esposta nel bundle client. L'utente compila un form interno, il server
// inoltra a noi via Resend SMTP.
//
// Setup env vars su Vercel (Project → Settings → Environment Variables):
//   RESEND_API_KEY        (obbligatoria) — chiave API Resend (https://resend.com)
//   RECIPIENT_EMAIL       (opzionale) — destinatario, default mascherin2797g@gmail.com
//   FROM_EMAIL            (opzionale) — mittente, default onboarding@resend.dev
//
// Rate limit in-memory: 5 req/15min per IP per evitare spam.

import { Resend } from 'resend';

const TO_EMAIL = process.env.RECIPIENT_EMAIL || 'mascherin2797g@gmail.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Terrazas al sol <onboarding@resend.dev>';
const MAX_PER_WINDOW = 5;
const WINDOW_MS = 15 * 60_000;

// Rate limit: la function reuse l'istanza tra invocazioni (Fluid Compute),
// quindi questo Map persiste finché il container è caldo. Per persistenza
// reale serve KV/Redis, ma per uso casuale è sufficiente.
const requests = new Map<string, number[]>();

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const arr = (requests.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) return false;
  arr.push(now);
  requests.set(ip, arr);
  return true;
}

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
};

type Res = {
  status: (code: number) => Res;
  json: (data: unknown) => Res;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

export default async function handler(req: Req, res: Res): Promise<void> {
  // CORS minimal (same-origin in produzione, qui per flessibilità)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const xff = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(xff) ? xff[0] : xff?.split(',')[0])?.trim() || 'unknown';
  if (!rateLimitOk(ip)) {
    res.status(429).json({ error: 'rate_limited', message: 'Troppe richieste. Riprova tra qualche minuto.' });
    return;
  }

  const body = (req.body ?? {}) as {
    city?: unknown;
    lat?: unknown;
    lng?: unknown;
    email?: unknown;
    message?: unknown;
    honeypot?: unknown; // anti-bot: campo nascosto, deve restare vuoto
  };

  // Honeypot anti-bot
  if (typeof body.honeypot === 'string' && body.honeypot.length > 0) {
    res.status(200).json({ ok: true }); // finge successo per non insegnare ai bot
    return;
  }

  // Validation
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  if (!city || city.length > 100) {
    res.status(400).json({ error: 'invalid_city' });
    return;
  }
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
  const lat = typeof body.lat === 'number' ? body.lat : null;
  const lng = typeof body.lng === 'number' ? body.lng : null;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY env var non configurata su Vercel');
    res.status(503).json({ error: 'email_service_unavailable' });
    return;
  }

  const resend = new Resend(apiKey);

  const lines = [
    `Nueva petición desde Terrazas al sol:`,
    ``,
    `Ciudad solicitada: ${city}`,
    `Posición usuario: ${lat != null && lng != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'no compartida'}`,
    `Email contacto: ${email || 'no fornita'}`,
    `Mensaje: ${message || '(nessuno)'}`,
    ``,
    `--`,
    `IP: ${ip}`,
    `User-Agent: ${req.headers['user-agent'] ?? '?'}`,
    `Timestamp: ${new Date().toISOString()}`,
  ];

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: email || undefined,
      subject: `[Terrazas al sol] Pedido nueva ciudad: ${city}`,
      text: lines.join('\n'),
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend send failed', err);
    res.status(500).json({ error: 'send_failed' });
  }
}
