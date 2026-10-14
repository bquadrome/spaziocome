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

function clock(value: string) {
  const v = String(value ?? '').trim()
  if (!v) return ''
  if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`
  return v.slice(0, 8)
}

function day(value: string) {
  return String(value ?? '').slice(0, 10)
}

function eventRef(key: string, fallback: string) {
  const match = /^(booking|guest_event):(\d+)$/.exec(key)
  if (match) return { source_type: match[1], source_id: match[2] }
  return { source_type: fallback, source_id: key }
}

type Slot = { id?: string; start?: string; end?: string }
type Station = { id?: string; label?: string }

async function bridgeCall(url: string, secret: string, payload: Record<string, unknown>) {
  const init: RequestInit = {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json,text/plain,*/*',
    },
    body: JSON.stringify({ ...payload, secret }),
  }
  let res = await fetch(url, init)
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    if (!location) throw new Error(`Redirect Google senza destinazione (${res.status})`)
    res = await fetch(location, { headers: { Accept: 'application/json,text/plain,*/*' } })
  }
  const text = await res.text()
  let data: { success?: boolean; error?: string; google_event_id?: string }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Risposta non valida dal bridge Google (${res.status})`)
  }
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Errore bridge Google (${res.status})`)
  }
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  try {
    const body = await req.json()
    const kind = String(body?.kind ?? '')
    const id = String(body?.id ?? '')
    const action = String(body?.action ?? 'upsert')
    if (action !== 'upsert' && action !== 'delete' && action !== 'ping') {
      return json(400, { error: 'action non valida' })
    }
    if (action !== 'ping' && ((kind !== 'booking' && kind !== 'guest') || !id)) {
      return json(400, { error: 'kind (booking|guest) e id obbligatori' })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    if (action === 'delete') {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      const { data: userData, error: userErr } = await supabase.auth.getUser(token)
      if (userErr || !userData.user) return json(401, { error: 'Accesso richiesto' })
    }

    const { data: bridge, error: bridgeErr } = await supabase.rpc('get_calendar_bridge')
    if (bridgeErr) throw bridgeErr
    const url = String(bridge?.url ?? '')
    const secret = String(bridge?.secret ?? '')
    if (!url || !secret) return json(500, { error: 'Bridge Google non configurato' })

    if (action === 'ping') {
      await bridgeCall(url, secret, { action: 'ping' })
      return json(200, { ok: true })
    }

    if (kind === 'booking') {
      const result = await syncBooking(supabase, url, secret, id, action === 'delete')
      return json(200, result)
    }
    const result = await syncGuest(supabase, url, secret, id, action === 'delete')
    return json(200, result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
    return json(500, { error: message })
  }
})

async function syncBooking(
  supabase: ReturnType<typeof createClient>,
  url: string,
  secret: string,
  id: string,
  remove: boolean,
) {
  const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!booking) return { ok: false, error: 'Prenotazione non trovata' }

  const stored = (booking.google_events ?? {}) as Record<string, string>
  const { data: event } = await supabase
    .from('events')
    .select('name, slots, stations')
    .eq('id', booking.event_id)
    .maybeSingle()

  const slots = (event?.slots ?? []) as Slot[]
  const stations = (event?.stations ?? []) as Station[]
  const wanted = new Map<string, Record<string, unknown>>()

  if (!remove && booking.status === 'active') {
    const name = [booking.first_name, booking.last_name].filter(Boolean).join(' ').trim()
    const space = event?.name || booking.event_id
    const title = name ? `${space} - ${name}` : space
    const desk = stations.find((item) => item.id === booking.station_id)?.label
    const notes = String(booking.notes ?? '').trim()
    const description = [
      'Tipologia prenotazione: SOGGETTO ESTERNO',
      desk ? `Postazione: ${desk}` : '',
      '',
      'Note / Motivo:',
      notes,
    ]
      .filter((line, index, all) => line !== '' || all[index - 1] !== '')
      .join('\n')

    const dates = (booking.dates ?? []).map(day).filter(Boolean)
    const chosen = slots.filter((slot) => (booking.slot_ids ?? []).includes(slot.id))
    const used = (chosen.length ? chosen : slots).slice().sort((a, b) =>
      String(a.start ?? '').localeCompare(String(b.start ?? ''))
    )
    const legacy = Object.entries(stored).filter(([key]) => /^(booking|guest_event):\d+$/.test(key))
    if (legacy.length) {
      const first = dates[0]
      const last = dates[dates.length - 1]
      const start = clock(used[0]?.start ?? '')
      const end = clock(used[used.length - 1]?.end ?? '')
      for (const [key, eventId] of legacy) {
        const ref = eventRef(key, 'booking')
        wanted.set(key, {
          action: 'update',
          source_type: ref.source_type,
          source_id: ref.source_id,
          google_event_id: eventId,
          title,
          description,
          location: 'Spazio COME',
          all_day: !start || !end,
          start: start && first ? `${first} ${start}` : first,
          end: end && last ? `${last} ${end}` : last,
          color: 'green',
        })
      }
    } else for (const date of dates) {
      if (!used.length) {
        wanted.set(`${id}:${date}`, {
          action: 'create',
          source_type: 'booking',
          source_id: `${id}:${date}`,
          title,
          description,
          location: 'Spazio COME',
          all_day: true,
          date,
          color: 'green',
        })
        continue
      }
      for (const slot of used) {
        const key = `${id}:${date}:${slot.id}`
        const start = clock(slot.start ?? '')
        const end = clock(slot.end ?? '')
        wanted.set(key, {
          action: stored[key] ? 'update' : 'create',
          source_type: 'booking',
          source_id: key,
          title,
          description,
          location: 'Spazio COME',
          all_day: !start || !end,
          start: start ? `${date} ${start}` : date,
          end: end ? `${date} ${end}` : date,
          color: 'green',
          ...(stored[key] ? { google_event_id: stored[key] } : {}),
        })
      }
    }
  }

  const next: Record<string, string> = {}
  const errors: string[] = []

  for (const [key, eventId] of Object.entries(stored)) {
    if (wanted.has(key)) continue
    try {
      const ref = eventRef(key, 'booking')
      await bridgeCall(url, secret, {
        action: 'delete',
        source_type: ref.source_type,
        source_id: ref.source_id,
        google_event_id: eventId,
      })
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`)
      next[key] = eventId
    }
  }

  for (const [key, payload] of wanted) {
    try {
      const data = await bridgeCall(url, secret, payload)
      const eventId = String(data.google_event_id ?? stored[key] ?? '')
      if (eventId) next[key] = eventId
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`)
      if (stored[key]) next[key] = stored[key]
    }
  }

  await supabase.from('bookings').update({ google_events: next }).eq('id', id)
  return { ok: errors.length === 0, synced: Object.keys(next).length, errors }
}

async function syncGuest(
  supabase: ReturnType<typeof createClient>,
  url: string,
  secret: string,
  id: string,
  remove: boolean,
) {
  const { data: guest, error } = await supabase.from('guests').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!guest) return { ok: false, error: 'Ospite non trovato' }

  const stored = (guest.google_events ?? {}) as Record<string, string>
  const wanted = new Map<string, Record<string, unknown>>()

  if (!remove && guest.status === 'active') {
    const name = [guest.first_name, guest.last_name].filter(Boolean).join(' ').trim() || 'Ospite'
    const start = clock(guest.time_start ?? '')
    const end = clock(guest.time_end ?? '')
    const timed = Boolean(start && end)
    const notes = String(guest.notes ?? '').trim()
    const legacy = Object.entries(stored).filter(([key]) => /^(booking|guest_event):\d+$/.test(key))
    const dates = (guest.dates ?? []).map(day).filter(Boolean)
    if (legacy.length) {
      const date = dates[0]
      for (const [key, eventId] of legacy) {
        const ref = eventRef(key, 'guest_event')
        wanted.set(key, {
          action: 'update',
          source_type: ref.source_type,
          source_id: ref.source_id,
          google_event_id: eventId,
          title: `OSPITE - ${name}`,
          description: `Note / Motivo:${notes ? `\n${notes}` : ''}`,
          location: 'Spazio COME',
          all_day: !timed,
          ...(timed && date
            ? { start: `${date} ${start}`, end: `${date} ${end}` }
            : { date }),
        })
      }
    } else for (const date of dates) {
      const key = `${id}:${date}`
      wanted.set(key, {
        action: stored[key] ? 'update' : 'create',
        source_type: 'guest_event',
        source_id: key,
        title: `OSPITE - ${name}`,
        description: `Note / Motivo:${notes ? `\n${notes}` : ''}`,
        location: 'Spazio COME',
        all_day: !timed,
        ...(timed
          ? { start: `${date} ${start}`, end: `${date} ${end}` }
          : { date }),
        ...(stored[key] ? { google_event_id: stored[key] } : {}),
      })
    }
  }

  const next: Record<string, string> = {}
  const errors: string[] = []

  for (const [key, eventId] of Object.entries(stored)) {
    if (wanted.has(key)) continue
    try {
      const ref = eventRef(key, 'guest_event')
      await bridgeCall(url, secret, {
        action: 'delete',
        source_type: ref.source_type,
        source_id: ref.source_id,
        google_event_id: eventId,
      })
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`)
      next[key] = eventId
    }
  }

  for (const [key, payload] of wanted) {
    try {
      const data = await bridgeCall(url, secret, payload)
      const eventId = String(data.google_event_id ?? stored[key] ?? '')
      if (eventId) next[key] = eventId
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`)
      if (stored[key]) next[key] = stored[key]
    }
  }

  await supabase.from('guests').update({ google_events: next }).eq('id', id)
  return { ok: errors.length === 0, synced: Object.keys(next).length, errors }
}
