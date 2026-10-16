import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

function fill(tpl: string, vars: Record<string, string>) {
  return String(tpl ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
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

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://spaziocome.vercel.app').replace(/\/+$/, '')
const ALLOWED_ORIGINS = new Set([SITE_URL, 'https://spaziocome.vercel.app', 'https://www.spaziocome.it', 'https://spaziocome.it', 'http://localhost:5173'])

function siteUrl(origin: unknown) {
  const value = String(origin ?? '').replace(/\/+$/, '')
  return ALLOWED_ORIGINS.has(value) ? value : SITE_URL
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function sendResend(
  apiKey: string,
  payload: { from: string; to: string; subject: string; text: string },
) {
  if (!apiKey) throw new Error('RESEND_API_KEY mancante')
  if (!payload.to) return { skipped: true }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: payload.from,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(payload.text).replace(
        /https?:\/\/[^\s<]+/g,
        (url) => `<a href="${url}">${url}</a>`,
      )}</pre>`,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message ?? `Resend ${res.status}`)
  return data
}

async function mailConfig(supabase: ReturnType<typeof createClient>) {
  const envKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const envFrom = Deno.env.get('RESEND_FROM') ?? ''
  const envStaff = Deno.env.get('STAFF_EMAIL') ?? ''
  if (envKey) {
    return {
      apiKey: envKey,
      from: envFrom || 'Spazio COME <noreply@spaziocome.it>',
      staff: envStaff,
    }
  }
  const { data, error } = await supabase.rpc('get_mail_secrets')
  if (error) throw error
  const row = (data ?? {}) as { api_key?: string; from_addr?: string; staff?: string }
  return {
    apiKey: row.api_key ?? '',
    from: row.from_addr || 'Spazio COME <noreply@spaziocome.it>',
    staff: row.staff ?? '',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const body = await req.json()
    const bookingId = String(body?.bookingId ?? '')
    const kind = String(body?.kind ?? '')
    const byGuest = body?.by === 'guest'
    if (!bookingId || (kind !== 'confirm' && kind !== 'cancel')) {
      return json(400, { error: 'bookingId e kind (confirm|cancel) obbligatori' })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()
    if (bookErr) throw bookErr
    if (!booking) return json(404, { error: 'Prenotazione non trovata' })

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: userData } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } }
    const isStaff = !!userData?.user
    const fresh = Date.now() - new Date(booking.created_at).getTime() < 15 * 60 * 1000
    const ownCancel =
      kind === 'cancel' && byGuest && booking.status === 'cancelled' && String(body?.token ?? '') === String(booking.token)
    if (!isStaff && !(kind === 'confirm' && fresh) && !ownCancel) {
      return json(403, { error: 'Non autorizzato' })
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, name, slots, emails, has_qr')
      .eq('id', booking.event_id)
      .maybeSingle()
    if (eventErr) throw eventErr

    const nome = [booking.first_name, booking.last_name].filter(Boolean).join(' ').trim() || 'ospite'
    const spazio = event?.name ?? booking.event_id
    const date = dateLabel(booking.dates ?? [])
    const slot = slotLabel(event?.slots ?? [], booking.slot_ids ?? [])
    const link = booking.token ? `${siteUrl(body?.origin)}/prenotazione/${booking.token}` : ''
    const vars = { nome, spazio, date, slot, link }

    const emails = (event?.emails ?? {}) as {
      confirm?: { subject?: string; body?: string }
      cancel?: { subject?: string; body?: string }
    }
    const tpl = kind === 'cancel' ? emails.cancel : emails.confirm
    const subject =
      tpl?.subject?.trim() ||
      (kind === 'cancel' ? 'Prenotazione annullata — Spazio COME' : 'Conferma prenotazione — Spazio COME')
    const custom = fill(tpl?.body ?? '', vars).trim()
    const linkBlock =
      kind === 'confirm' && link && !/\{\{link\}\}/.test(tpl?.body ?? '')
        ? event?.has_qr
          ? `\n\nIl tuo pass personale (QR da mostrare in reception) e il link per annullare:\n${link}`
          : `\n\nPer vedere o annullare la prenotazione:\n${link}`
        : ''
    const text =
      (custom ? custom + linkBlock : '') ||
      (kind === 'cancel'
        ? `Ciao ${nome},\n\nLa tua prenotazione per ${spazio} (${date}) è stata annullata.\n\nSpazio COME`
        : `Ciao ${nome},\n\nLa tua prenotazione per ${spazio} è confermata.\nGiorni: ${date}\nOrari: ${slot}${linkBlock}\n\nA presto,\nSpazio COME`)

    const cfg = await mailConfig(supabase)
    const from = cfg.from
    const staff = String((event?.emails as any)?.notify ?? '').trim() || cfg.staff
    const sent: string[] = []
    const errors: string[] = []

    if (booking.email) {
      try {
        await sendResend(cfg.apiKey, { from, to: booking.email, subject: fill(subject, vars), text })
        sent.push('guest')
      } catch (err) {
        errors.push(`guest: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    if ((kind === 'confirm' || byGuest) && staff) {
      const title = kind === 'confirm' ? 'Nuova prenotazione' : 'Prenotazione annullata dall’utente'
      const staffText = [
        `${title} — Spazio COME`,
        `Spazio: ${spazio}`,
        `Nome: ${nome}`,
        `Email: ${booking.email || '—'}`,
        `Telefono: ${booking.phone || '—'}`,
        `Date: ${date}`,
        `Orari: ${slot}`,
        ...(Array.isArray(booking.custom) ? booking.custom : []).map(
          (item: { label?: string; value?: string }) => `${item.label ?? ''}: ${item.value ?? ''}`,
        ),
        booking.extra ? `Extra: ${booking.extra}` : '',
        booking.notes ? `Note: ${booking.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      try {
        await sendResend(cfg.apiKey, {
          from,
          to: staff,
          subject: `${title} — ${spazio} — ${nome}`,
          text: staffText,
        })
        sent.push('staff')
      } catch (err) {
        errors.push(`staff: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return json(errors.length && !sent.length ? 500 : 200, { ok: sent.length > 0, sent, errors })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
    return json(500, { error: message })
  }
})
