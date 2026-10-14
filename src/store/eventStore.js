import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase.js'

// Eventi nella sede (tabella site_events), distinti dagli spazi prenotabili.
const BUCKET = 'event-images'

function failMessage(error) {
  const raw = error?.message ?? 'Errore server.'
  return raw.replace(/^.*ERROR:\s*/i, '').split('\n')[0]
}

function isUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export function eventImageUrl(path) {
  if (!path) return ''
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

function eventFromRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title ?? '',
    summary: row.summary ?? '',
    description: row.description ?? '',
    onDate: String(row.on_date ?? '').slice(0, 10),
    timeStart: row.time_start ?? '',
    timeEnd: row.time_end ?? '',
    imagePath: row.image_path ?? '',
    published: row.published !== false,
    registrationOpen: row.registration_open !== false,
    capacity: row.capacity ?? null,
    bookingId: row.booking_id ?? null,
    createdAt: row.created_at,
  }
}

function registrationFromRow(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    status: row.status ?? 'active',
    checkedInAt: row.checked_in_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
  }
}

let state = { events: [], registrations: [], loaded: false }
const listeners = new Set()

function emit() {
  listeners.forEach((fn) => fn(state))
}

export async function refreshSiteEvents() {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      state = { events: [], registrations: [], loaded: true }
      emit()
      return
    }
    const [{ data: eventRows, error: eventErr }, { data: regRows, error: regErr }] = await Promise.all([
      supabase.from('site_events').select('*').order('on_date').order('time_start'),
      supabase.from('event_registrations').select('*').order('created_at'),
    ])
    if (eventErr) console.error(eventErr)
    if (regErr) console.error(regErr)
    state = {
      events: (eventRows ?? []).map(eventFromRow),
      registrations: (regRows ?? []).map(registrationFromRow),
      loaded: true,
    }
    emit()
  } catch (err) {
    console.error(err)
  }
}

let live = false

function startLive() {
  if (live) return
  live = true
  void refreshSiteEvents()
  try {
    supabase
      .channel('site-events-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_events' }, () => void refreshSiteEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_registrations' }, () => void refreshSiteEvents())
      .subscribe()
  } catch (err) {
    console.error(err)
  }
  supabase.auth.onAuthStateChange(() => void refreshSiteEvents())
}

function getState() {
  return state
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useSiteEvents() {
  const snap = useSyncExternalStore(subscribe, getState, getState)
  useEffect(() => {
    startLive()
  }, [])
  return snap
}

// Date e orari

export function parseDay(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function eventDay(iso, options = { weekday: 'short', day: 'numeric', month: 'long' }) {
  if (!iso) return ''
  const label = parseDay(iso).toLocaleDateString('it-IT', options)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function eventWhen(event) {
  const start = event?.timeStart ?? event?.time_start ?? ''
  const end = event?.timeEnd ?? event?.time_end ?? ''
  const day = eventDay(event?.onDate ?? event?.on_date)
  const hours = start ? `${start}${end ? `–${end}` : ''}` : ''
  return [day, hours].filter(Boolean).join(' · ')
}

// Posti: { left, full, label } a partire da capacity/taken.
export function seatsInfo(event) {
  const capacity = event?.capacity
  const taken = Number(event?.taken ?? 0)
  if (capacity === null || capacity === undefined) return { left: null, full: false, label: '' }
  const left = Math.max(0, Number(capacity) - taken)
  if (left === 0) return { left, full: true, label: 'Posti esauriti' }
  if (left <= 5) return { left, full: false, label: left === 1 ? 'Ultimo posto disponibile' : `Ultimi ${left} posti` }
  return { left, full: false, label: `${left} posti disponibili` }
}

// Admin

export async function uploadEventImage(blob) {
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `events/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) return { ok: false, error: failMessage(error) }
  return { ok: true, path }
}

export async function removeEventImage(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.error(error)
}

export async function saveSiteEvent(draft) {
  const raw = String(draft.capacity ?? '').trim()
  const capacity = raw === '' ? null : Number(raw)
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return { ok: false, error: 'I posti devono essere un numero intero maggiore di zero.' }
  }
  const { data, error } = await supabase.rpc('save_site_event', {
    p_id: draft.id || null,
    p_title: draft.title ?? '',
    p_summary: draft.summary ?? '',
    p_description: draft.description ?? '',
    p_on_date: draft.onDate || null,
    p_time_start: draft.timeStart ?? '',
    p_time_end: draft.timeEnd ?? '',
    p_image_path: draft.imagePath ?? '',
    p_published: !!draft.published,
    p_registration_open: !!draft.registrationOpen,
    p_capacity: capacity,
  })
  if (error) return { ok: false, error: failMessage(error) }
  await refreshSiteEvents()
  return { ok: true, id: data }
}

export async function deleteSiteEvent(id) {
  const { data, error } = await supabase.rpc('delete_site_event', { p_id: id })
  if (error) return { ok: false, error: failMessage(error) }
  await removeEventImage(data)
  await refreshSiteEvents()
  return { ok: true }
}

export async function setRegistrationStatus(id, status) {
  const { error } = await supabase
    .from('event_registrations')
    .update({ status, cancelled_at: status === 'cancelled' ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) return { ok: false, error: failMessage(error) }
  await refreshSiteEvents()
  return { ok: true }
}

export async function setRegistrationPresence(registration, onDate, present) {
  const { error } = await supabase.rpc('reception_checkin', {
    p_key: '',
    p_token: null,
    p_booking_id: registration.id,
    p_date: onDate,
    p_present: present,
  })
  if (error) return { ok: false, error: failMessage(error) }
  await refreshSiteEvents()
  return { ok: true }
}

// Pubblico

function sendEventMail(kind, token) {
  supabase.functions
    .invoke('send-event-email', { body: { kind, token, origin: window.location.origin } })
    .then(({ error }) => {
      if (error) console.error(error)
    })
}

let publicCache = { at: 0, items: null }

export async function fetchPublicEvents() {
  if (publicCache.items && Date.now() - publicCache.at < 60000) return publicCache.items
  const { data, error } = await supabase.rpc('public_site_events')
  if (error) {
    console.error(error)
    return publicCache.items ?? []
  }
  publicCache = { at: Date.now(), items: Array.isArray(data) ? data : [] }
  return publicCache.items
}

export async function fetchPastEvents() {
  const { data, error } = await supabase.rpc('public_past_events')
  if (error) {
    console.error(error)
    return []
  }
  return Array.isArray(data) ? data : []
}

export async function fetchPublicEvent(slug) {
  const { data, error } = await supabase.rpc('public_site_event', { p_slug: slug })
  if (error) return { ok: false, error: failMessage(error) }
  if (!data) return { ok: false, error: 'Evento non trovato.' }
  return { ok: true, event: data }
}

export async function registerForEvent(eventId, form) {
  const { data, error } = await supabase.rpc('register_site_event', {
    p_event_id: eventId,
    p_first_name: form.firstName ?? '',
    p_last_name: form.lastName ?? '',
    p_email: form.email ?? '',
    p_phone: form.phone ?? '',
  })
  if (error) return { ok: false, error: failMessage(error) }
  publicCache = { at: 0, items: null }
  if (data?.token) sendEventMail('registered', data.token)
  return { ok: true, token: data?.token }
}

export async function fetchRegistration(token) {
  if (!isUuid(token)) return { ok: false, error: 'Link non valido.' }
  const { data, error } = await supabase.rpc('event_registration_ticket', { p_token: token })
  if (error) return { ok: false, error: failMessage(error) }
  if (!data) return { ok: false, error: 'Iscrizione non trovata.' }
  return { ok: true, registration: data }
}

export async function cancelRegistration(token) {
  const { error } = await supabase.rpc('cancel_event_registration', { p_token: token })
  if (error) return { ok: false, error: failMessage(error) }
  publicCache = { at: 0, items: null }
  sendEventMail('cancelled', token)
  return { ok: true }
}
