import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const KINDS = new Set(['request', 'quote', 'accepted', 'revision'])
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

function fill(tpl: string, vars: Record<string, string>) {
  return String(tpl ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function escapeHtml(text: string) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dateLabel(dates: string[]) {
  return (dates ?? [])
    .map((iso) => {
      const [y, m, d] = String(iso).slice(0, 10).split('-')
      return y && m && d ? `${d}/${m}/${y}` : String(iso)
    })
    .join(', ')
}

function slotLabel(slots: { id?: string; start?: string; end?: string }[], slotIds: string[]) {
  const ids = new Set((slotIds ?? []).map(String))
  const hit = (slots ?? [])
    .filter((slot) => ids.has(String(slot.id)))
    .sort((a, b) => String(a.start ?? '').localeCompare(String(b.start ?? '')))
  if (!hit.length) return 'Giornata'
  return hit.map((slot) => `${slot.start ?? ''}–${slot.end ?? ''}`).join(', ')
}

function euro(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

function textHtml(text: string) {
  return escapeHtml(text).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`).replace(/\n/g, '<br>')
}

function layout(inner: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">${inner}</div>`
}

function button(href: string, label: string, solid: boolean) {
  const style = solid
    ? 'background:#0047f8;color:#fff;border:2px solid #0047f8'
    : 'background:#fff;color:#0047f8;border:2px solid #0047f8'
  return `<a href="${href}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 20px;border-radius:10px;font-weight:700;text-decoration:none;${style}">${escapeHtml(label)}</a>`
}

async function sendResend(apiKey: string, payload: { from: string; to: string; subject: string; text: string; html?: string }) {
  if (!apiKey) throw new Error('RESEND_API_KEY mancante')
  if (!payload.to) return { skipped: true }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: payload.from,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html ?? layout(textHtml(payload.text)),
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message ?? `Resend ${res.status}`)
  return data
}

async function mailConfig(supabase: ReturnType<typeof createClient>) {
  const envKey = Deno.env.get('RESEND_API_KEY') ?? ''
  if (envKey) {
    return {
      apiKey: envKey,
      from: Deno.env.get('RESEND_FROM') || 'Spazio COME <noreply@spaziocome.it>',
      staff: Deno.env.get('STAFF_EMAIL') ?? '',
    }
  }
  const { data, error } = await supabase.rpc('get_mail_secrets')
  if (error) throw error
  const row = (data ?? {}) as { api_key?: string; from_addr?: string; staff?: string }
  return { apiKey: row.api_key ?? '', from: row.from_addr || 'Spazio COME <noreply@spaziocome.it>', staff: row.staff ?? '' }
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
    const id = String(body?.id ?? '')
    const token = String(body?.token ?? '')
    if (!KINDS.has(kind) || (!id && !token)) return json(400, { error: 'kind e id/token obbligatori' })

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const query = supabase.from('quote_requests').select('*')
    const { data: q, error: qErr } = await (token ? query.eq('token', token) : query.eq('id', id)).maybeSingle()
    if (qErr) throw qErr
    if (!q) return json(404, { error: 'Richiesta non trovata' })

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: userData } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } }
    const isStaff = !!userData?.user

    const allowed =
      isStaff ||
      (kind === 'request' && q.status === 'new' && isFresh(q.created_at)) ||
      (kind === 'accepted' && token && q.status === 'accepted' && isFresh(q.accepted_at)) ||
      (kind === 'revision' && token && q.status === 'revision' && isFresh(q.revision_at))
    if (!allowed || (kind === 'quote' && !isStaff)) return json(403, { error: 'Non autorizzato' })

    const { data: event } = await supabase.from('events').select('id, name, slots, emails').eq('id', q.event_id).maybeSingle()

    const site = siteUrl(body?.origin)
    const nome = [q.first_name, q.last_name].filter(Boolean).join(' ').trim() || 'cliente'
    const spazio = event?.name ?? q.event_id
    const date = dateLabel(q.dates ?? [])
    const slot = slotLabel(event?.slots ?? [], q.slot_ids ?? [])
    const importo = euro(q.quote_amount)
    const vars = { nome, spazio, date, slot, importo }
    const page = `${site}/preventivo/${q.token}`
    const admin = `${site}/admin/richieste`
    const details = [
      `Spazio: ${spazio}`,
      `Date: ${date}`,
      `Orari: ${slot}`,
      `Nome: ${nome}`,
      `Email: ${q.email || '—'}`,
      `Telefono: ${q.phone || '—'}`,
      ...(Array.isArray(q.custom) ? q.custom : []).map((item: { label?: string; value?: string }) => `${item.label ?? ''}: ${item.value ?? ''}`),
      q.notes ? `Note: ${q.notes}` : '',
    ].filter(Boolean)

    const cfg = await mailConfig(supabase)
    const staffTo = String((event?.emails as any)?.notify ?? '').trim() || cfg.staff
    const mails: { to: string; subject: string; text: string; html?: string; who: string }[] = []

    if (kind === 'request') {
      mails.push({
        who: 'guest',
        to: q.email,
        subject: `Richiesta ricevuta — ${spazio}`,
        text: `Ciao ${nome},\n\nabbiamo ricevuto la tua richiesta per ${spazio}.\nDate: ${date}\nOrari: ${slot}\n\nTi invieremo a breve un preventivo a questo indirizzo.\n\nSpazio COME`,
      })
      mails.push({
        who: 'staff',
        to: staffTo,
        subject: `Nuova richiesta preventivo — ${spazio} — ${nome}`,
        text: `Nuova richiesta preventivo — Spazio COME\n\n${details.join('\n')}\n\nRispondi dal pannello: ${admin}`,
      })
    }

    if (kind === 'quote') {
      const subject = fill(q.quote_subject, vars).trim() || `Preventivo ${spazio} — Spazio COME`
      const message = fill(q.quote_body, vars).trim()
      const amountLine = importo ? `\n\nImporto: ${importo}` : ''
      const text = `${message}${amountLine}\n\nAccetta il preventivo: ${page}?scelta=accetta\nRichiedi un nuovo preventivo: ${page}?scelta=modifica\n\nSpazio COME`
      const html = layout(
        `${textHtml(message)}${importo ? `<p style="margin:18px 0 0;font-size:17px"><strong>Importo: ${escapeHtml(importo)}</strong></p>` : ''}` +
          `<p style="margin:22px 0 8px">${button(`${page}?scelta=accetta`, 'Accetta il preventivo', true)}${button(`${page}?scelta=modifica`, 'Richiedi nuovo preventivo', false)}</p>` +
          `<p style="margin:14px 0 4px;color:#555">Richiesta: ${escapeHtml(spazio)} · ${escapeHtml(date)} · ${escapeHtml(slot)}</p>` +
          `<p style="margin:18px 0 0">Spazio COME</p>`,
      )
      mails.push({ who: 'guest', to: q.email, subject, text, html })
    }

    if (kind === 'accepted') {
      mails.push({
        who: 'staff',
        to: staffTo,
        subject: `Preventivo accettato — ${spazio} — ${nome}`,
        text: `Preventivo accettato — Spazio COME\n\n${importo ? `Importo: ${importo}\n` : ''}${details.join('\n')}\n\nInvia gli estremi di pagamento al cliente, poi segna il pagamento dal pannello: ${admin}`,
      })
      mails.push({
        who: 'guest',
        to: q.email,
        subject: `Preventivo accettato — ${spazio}`,
        text: `Ciao ${nome},\n\ngrazie per aver accettato il preventivo per ${spazio} (${date}).\nTi invieremo a breve via mail gli estremi per il pagamento.\n\nSpazio COME`,
      })
    }

    if (kind === 'revision') {
      mails.push({
        who: 'staff',
        to: staffTo,
        subject: `Nuovo preventivo richiesto — ${spazio} — ${q.revision_name || nome}`,
        text: `Il cliente chiede un nuovo preventivo — Spazio COME\n\nNome: ${q.revision_name}\nEmail: ${q.revision_email}\n\nMessaggio:\n${q.revision_message}\n\n---\n${details.join('\n')}\n\nRispondi dal pannello: ${admin}`,
      })
    }

    const sent: string[] = []
    const errors: string[] = []
    for (const mail of mails) {
      if (!mail.to) continue
      try {
        await sendResend(cfg.apiKey, { from: cfg.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html })
        sent.push(mail.who)
      } catch (err) {
        errors.push(`${mail.who}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return json(errors.length && !sent.length ? 500 : 200, { ok: sent.length > 0, sent, errors })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
    return json(500, { error: message })
  }
})
