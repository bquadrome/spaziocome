import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FRESH_MS = 15 * 60 * 1000

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    return keys.default ?? Object.values(keys)[0] ?? ''
  } catch {
    return ''
  }
}

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://spaziocome.vercel.app').replace(/\/+$/, '')
const ALLOWED_ORIGINS = new Set([SITE_URL, 'https://spaziocome.vercel.app', 'https://www.spaziocome.it', 'https://spaziocome.it', 'http://localhost:5173'])

function siteUrl(origin: unknown) {
  const value = String(origin ?? '').replace(/\/+$/, '')
  return ALLOWED_ORIGINS.has(value) ? value : SITE_URL
}

function escapeHtml(text: string) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dateLabel(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return String(iso)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function layout(inner: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">${inner}</div>`
}

function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;margin:6px 0;padding:12px 20px;border-radius:10px;font-weight:700;text-decoration:none;background:#0047f8;color:#fff;border:2px solid #0047f8">${escapeHtml(label)}</a>`
}

async function sendResend(apiKey: string, payload: { from: string; to: string; subject: string; text: string; html: string }) {
  if (!apiKey) throw new Error('RESEND_API_KEY mancante')
  if (!payload.to) return { skipped: true }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: payload.from, to: [payload.to], subject: payload.subject, text: payload.text, html: payload.html }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message ?? `Resend ${res.status}`)
  return data
}

async function mailConfig(supabase: ReturnType<typeof createClient>) {
  const envKey = Deno.env.get('RESEND_API_KEY') ?? ''
  if (envKey) {
    return { apiKey: envKey, from: Deno.env.get('RESEND_FROM') || 'Spazio COME <noreply@spaziocome.it>' }
  }
  const { data, error } = await supabase.rpc('get_mail_secrets')
  if (error) throw error
  const row = (data ?? {}) as { api_key?: string; from_addr?: string }
  return { apiKey: row.api_key ?? '', from: row.from_addr || 'Spazio COME <noreply@spaziocome.it>' }
}

function isFresh(value: string | null) {
  return !!value && Date.now() - new Date(value).getTime() < FRESH_MS
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const body = await req.json()
    const kind = String(body?.kind ?? '')
    const token = String(body?.token ?? '')
    if ((kind !== 'registered' && kind !== 'cancelled') || !token) {
      return json(400, { error: 'kind (registered|cancelled) e token obbligatori' })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: reg, error: regErr } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('token', token)
      .maybeSingle()
    if (regErr) throw regErr
    if (!reg) return json(404, { error: 'Iscrizione non trovata' })

    const allowed =
      (kind === 'registered' && reg.status === 'active' && isFresh(reg.created_at)) ||
      (kind === 'cancelled' && reg.status === 'cancelled' && isFresh(reg.cancelled_at))
    if (!allowed) return json(403, { error: 'Non autorizzato' })

    const { data: event, error: eventErr } = await supabase
      .from('site_events')
      .select('title, slug, on_date, time_start, time_end')
      .eq('id', reg.event_id)
      .maybeSingle()
    if (eventErr) throw eventErr
    if (!event) return json(404, { error: 'Evento non trovato' })

    const site = siteUrl(body?.origin)
    const nome = [reg.first_name, reg.last_name].filter(Boolean).join(' ').trim() || 'ciao'
    const quando = `${dateLabel(event.on_date)}, ${event.time_start}–${event.time_end}`
    const pass = `${site}/iscrizione/${reg.token}`
    const page = `${site}/eventi/${event.slug}`

    let subject = ''
    let text = ''
    let html = ''
    if (kind === 'registered') {
      subject = `Iscrizione confermata — ${event.title}`
      text = `Ciao ${nome},\n\nla tua iscrizione a "${event.title}" è confermata.\nQuando: ${quando}\nDove: Spazio COME\n\nIl tuo pass personale (QR da mostrare all'ingresso) e il link per annullare:\n${pass}\n\nDettagli evento: ${page}\n\nA presto,\nSpazio COME`
      html = layout(
        `<p>Ciao ${escapeHtml(nome)},</p><p>la tua iscrizione a <strong>${escapeHtml(event.title)}</strong> è confermata.</p>` +
          `<p style="margin:0">Quando: <strong>${escapeHtml(quando)}</strong><br>Dove: <strong>Spazio COME</strong></p>` +
          `<p style="margin:20px 0 6px">Mostra il QR del tuo pass all'ingresso. Dallo stesso link puoi annullare l'iscrizione.</p>` +
          `<p>${button(pass, 'Apri il tuo pass')}</p>` +
          `<p style="color:#555">Dettagli evento: <a href="${page}">${page}</a></p><p>A presto,<br>Spazio COME</p>`,
      )
    } else {
      subject = `Iscrizione annullata — ${event.title}`
      text = `Ciao ${nome},\n\nla tua iscrizione a "${event.title}" (${quando}) è stata annullata.\n\nSe cambi idea puoi iscriverti di nuovo: ${page}\n\nSpazio COME`
      html = layout(
        `<p>Ciao ${escapeHtml(nome)},</p><p>la tua iscrizione a <strong>${escapeHtml(event.title)}</strong> (${escapeHtml(quando)}) è stata annullata.</p>` +
          `<p>Se cambi idea puoi iscriverti di nuovo: <a href="${page}">${page}</a></p><p>Spazio COME</p>`,
      )
    }

    const cfg = await mailConfig(supabase)
    await sendResend(cfg.apiKey, { from: cfg.from, to: reg.email, subject, text, html })
    return json(200, { ok: true, sent: ['guest'] })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
    return json(500, { error: message })
  }
})
