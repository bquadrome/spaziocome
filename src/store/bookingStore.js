import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase.js'

export const EVENT_COLORS = {
  coworking: '#002ec1',
  meeting: '#0aa0c2',
  expo: '#264496',
  eu: '#0b6e4f',
  ospite: '#6b7280',
}

export const WEEKDAYS = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mer' },
  { id: 4, label: 'Gio' },
  { id: 5, label: 'Ven' },
  { id: 6, label: 'Sab' },
  { id: 0, label: 'Dom' },
]

function uid() {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function makeStations(count, prev = []) {
  const n = Math.max(0, Math.min(99, Number(count) || 0))
  const next = (prev ?? []).slice(0, n)
  while (next.length < n) {
    next.push({ id: uid(), label: `Postazione ${next.length + 1}` })
  }
  return next
}

function asISO(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function asList(value) {
  return Array.isArray(value) ? value : []
}

function asMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function eventFromRow(row) {
  const weekdays = asList(row.weekdays)
  return {
    id: row.id,
    enabled: row.enabled,
    name: row.name,
    intro: row.intro ?? '',
    slots: asList(row.slots),
    weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5],
    blockedDates: asList(row.blocked_dates).map(asISO),
    allowMultiDay: !!row.allow_multi_day,
    allowMultiSlot: !!row.allow_multi_slot,
    maxDays: row.max_days ?? 1,
    maxSlots: row.max_slots ?? 1,
    hasStations: !!row.has_stations,
    maxCapacity: row.max_capacity ?? 1,
    stations: asList(row.stations),
    fields: asMap(row.fields),
    extraMenu: asMap(row.extra_menu),
    emails: asMap(row.emails),
  }
}

function eventToRow(event) {
  return {
    enabled: event.enabled,
    name: event.name,
    intro: event.intro,
    slots: event.slots,
    weekdays: event.weekdays,
    blocked_dates: event.blockedDates,
    allow_multi_day: event.allowMultiDay,
    allow_multi_slot: event.allowMultiSlot,
    max_days: event.maxDays,
    max_slots: event.maxSlots,
    has_stations: event.hasStations,
    max_capacity: event.maxCapacity,
    stations: event.stations,
    fields: event.fields,
    extra_menu: event.extraMenu,
    emails: event.emails,
    updated_at: new Date().toISOString(),
  }
}

function bookingFromRow(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    dates: asList(row.dates).map(asISO),
    slotIds: asList(row.slot_ids),
    stationId: row.station_id ?? '',
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    notes: row.notes ?? '',
    extra: row.extra ?? '',
    status: row.status ?? 'active',
    createdAt: row.created_at,
  }
}

function guestFromRow(row) {
  return {
    id: row.id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    notes: row.notes ?? '',
    dates: asList(row.dates).map(asISO),
    timeStart: row.time_start ?? '',
    timeEnd: row.time_end ?? '',
    status: row.status ?? 'active',
    createdAt: row.created_at,
  }
}

function failMessage(error) {
  const raw = error?.message ?? 'Errore server.'
  return raw.replace(/^.*ERROR:\s*/i, '').split('\n')[0]
}

let state = { events: {}, bookings: [], occupancy: [], guests: [] }
const listeners = new Set()

function emit() {
  listeners.forEach((fn) => fn(state))
}

export async function refreshStore() {
  try {
    const { data: eventRows, error: eventErr } = await supabase.from('events').select('*')
    if (eventErr) {
      console.error(eventErr)
      return
    }
    const events = {}
    for (const row of eventRows ?? []) {
      try {
        events[row.id] = eventFromRow(row)
      } catch (err) {
        console.error(err)
      }
    }

    const { data: occRows } = await supabase
      .from('occupancy')
      .select('event_id, on_date, slot_id, seat_key, booking_id')
    const occupancy = (occRows ?? []).map((row) => ({
      eventId: row.event_id,
      date: asISO(row.on_date),
      slotId: row.slot_id,
      seatKey: row.seat_key,
      bookingId: row.booking_id,
    }))

    const { data: sessionData } = await supabase.auth.getSession()
    const authed = !!sessionData.session

    let bookings = []
    let guests = []
    if (authed) {
      const { data: bookRows } = await supabase.from('bookings').select('*').order('created_at', { ascending: false })
      bookings = (bookRows ?? []).map(bookingFromRow)
      const { data: guestRows } = await supabase.from('guests').select('*').order('created_at', { ascending: false })
      guests = (guestRows ?? []).map(guestFromRow)
    }

    state = { events, bookings, occupancy, guests }
    emit()
  } catch (err) {
    console.error(err)
  }
}

export function getBookingState() {
  return state
}

export function subscribeBooking(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let live = false

function startLive() {
  if (live) return
  live = true
  void refreshStore()
  try {
    const existing = supabase.getChannels().find((ch) => ch.topic === 'realtime:booking-live')
    if (!existing?.joinedOnce) {
      supabase
        .channel('booking-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'occupancy' }, () => {
          void refreshStore()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
          void refreshStore()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
          void refreshStore()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, () => {
          void refreshStore()
        })
        .subscribe()
    }
  } catch (err) {
    console.error(err)
  }
  supabase.auth.onAuthStateChange(() => {
    void refreshStore()
  })
}

export function useBookingStore() {
  const snap = useSyncExternalStore(subscribeBooking, getBookingState, getBookingState)
  useEffect(() => {
    startLive()
  }, [])
  return {
    events: snap?.events ?? {},
    bookings: Array.isArray(snap?.bookings) ? snap.bookings : [],
    occupancy: Array.isArray(snap?.occupancy) ? snap.occupancy : [],
    guests: Array.isArray(snap?.guests) ? snap.guests : [],
  }
}

export function getEventConfig(id) {
  return state.events[id] ?? null
}

const patchTimers = new Map()

export async function patchEvent(id, patch) {
  const current = state.events[id]
  if (!current) return
  const next = { ...current, ...patch }
  state = { ...state, events: { ...state.events, [id]: next } }
  emit()
  clearTimeout(patchTimers.get(id))
  patchTimers.set(
    id,
    setTimeout(async () => {
      const { error } = await supabase.from('events').update(eventToRow(next)).eq('id', id)
      if (error) {
        console.error(error)
        await refreshStore()
      }
    }, 400),
  )
}

function sendBookingMail(bookingId, kind) {
  if (!bookingId) return
  supabase.functions
    .invoke('send-booking-email', { body: { bookingId, kind } })
    .then(({ error }) => {
      if (error) console.error(error)
    })
}

export async function addBooking(payload) {
  const { data, error } = await supabase.rpc('place_booking', {
    p_event_id: payload.eventId,
    p_dates: payload.dates,
    p_slot_ids: payload.slotIds,
    p_station_id: payload.stationId || null,
    p_first_name: payload.firstName ?? '',
    p_last_name: payload.lastName ?? '',
    p_email: payload.email ?? '',
    p_phone: payload.phone ?? '',
    p_notes: payload.notes ?? '',
    p_extra: payload.extra ?? '',
  })
  if (error) return { ok: false, error: failMessage(error) }
  sendBookingMail(data, 'confirm')
  await refreshStore()
  return { ok: true, booking: { id: data, status: 'active', ...payload } }
}

export async function setBookingStatus(id, status) {
  const { error } = await supabase.rpc('set_booking_status', { p_id: id, p_status: status })
  if (error) return { ok: false, error: failMessage(error) }
  if (status === 'cancelled') sendBookingMail(id, 'cancel')
  await refreshStore()
  return { ok: true }
}

export async function patchBooking(id, patch) {
  const current = state.bookings.find((item) => item.id === id)
  if (!current) return { ok: false, error: 'Prenotazione non trovata.' }
  const next = { ...current, ...patch }
  const { error } = await supabase.rpc('update_booking', {
    p_id: id,
    p_event_id: next.eventId,
    p_dates: next.dates,
    p_slot_ids: next.slotIds,
    p_station_id: next.stationId || null,
    p_first_name: next.firstName ?? '',
    p_last_name: next.lastName ?? '',
    p_email: next.email ?? '',
    p_phone: next.phone ?? '',
    p_notes: next.notes ?? '',
    p_extra: next.extra ?? '',
  })
  if (error) return { ok: false, error: failMessage(error) }
  await refreshStore()
  return { ok: true, booking: next }
}

export async function addGuest(payload) {
  const { error } = await supabase.from('guests').insert({
    first_name: payload.firstName ?? '',
    last_name: payload.lastName ?? '',
    email: payload.email ?? '',
    phone: payload.phone ?? '',
    notes: payload.notes ?? '',
    dates: payload.dates ?? [],
    time_start: payload.timeStart ?? '',
    time_end: payload.timeEnd ?? '',
    status: 'active',
  })
  if (error) return { ok: false, error: failMessage(error) }
  await refreshStore()
  return { ok: true }
}

export async function patchGuest(id, patch) {
  const current = state.guests.find((item) => item.id === id)
  if (!current) return { ok: false, error: 'Ospite non trovato.' }
  const next = { ...current, ...patch }
  const { error } = await supabase
    .from('guests')
    .update({
      first_name: next.firstName ?? '',
      last_name: next.lastName ?? '',
      email: next.email ?? '',
      phone: next.phone ?? '',
      notes: next.notes ?? '',
      dates: next.dates ?? [],
      time_start: next.timeStart ?? '',
      time_end: next.timeEnd ?? '',
      status: next.status ?? current.status,
    })
    .eq('id', id)
  if (error) return { ok: false, error: failMessage(error) }
  await refreshStore()
  return { ok: true }
}

export async function setGuestStatus(id, status) {
  const { error } = await supabase.from('guests').update({ status }).eq('id', id)
  if (error) return { ok: false, error: failMessage(error) }
  await refreshStore()
  return { ok: true }
}

export function splitName(title) {
  const parts = String(title ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

export function isSlotTaken(eventId, date, slotId, ignoreId = '') {
  return slotOccupancy(eventId, date, slotId, ignoreId) > 0
}

export function slotCapacity(config) {
  if (!config) return 1
  if (config.hasStations) {
    const n = (config.stations ?? []).length
    return Math.max(1, n || Number(config.maxCapacity) || 1)
  }
  return Math.max(1, Number(config.maxCapacity) || 1)
}

export function slotOccupancy(eventId, date, slotId, ignoreId = '') {
  return state.occupancy.filter(
    (row) =>
      row.eventId === eventId &&
      row.date === date &&
      row.slotId === slotId &&
      row.bookingId !== ignoreId,
  ).length
}

export function isSlotFull(eventId, date, slotId, ignoreId = '') {
  const config = state.events[eventId]
  return slotOccupancy(eventId, date, slotId, ignoreId) >= slotCapacity(config)
}

export function isStationTaken(eventId, date, slotId, stationId, ignoreId = '') {
  if (!stationId) return false
  return state.occupancy.some(
    (row) =>
      row.eventId === eventId &&
      row.date === date &&
      row.slotId === slotId &&
      row.seatKey === stationId &&
      row.bookingId !== ignoreId,
  )
}

export function dateHasFreeSlot(eventId, iso) {
  const config = state.events[eventId]
  if (!config?.slots?.length) return false
  return config.slots.some((slot) => !isSlotFull(eventId, iso, slot.id))
}

export function bookingConflict(payload, ignoreId = '') {
  if (payload.status && payload.status !== 'active') return null
  const eventId = payload.eventId
  const dates = payload.dates ?? []
  const slotIds = payload.slotIds ?? []
  const stationId = payload.stationId ?? ''
  const config = state.events[eventId]
  if (!config) return 'Evento non trovato.'
  if (!dates.length || !slotIds.length) return 'Giorno o orario mancante.'
  if (config.hasStations && !stationId) return 'Scegli una postazione.'
  for (const date of dates) {
    for (const slotId of slotIds) {
      if (config.hasStations && isStationTaken(eventId, date, slotId, stationId, ignoreId)) {
        return 'Postazione già occupata in questo orario.'
      }
      if (isSlotFull(eventId, date, slotId, ignoreId)) {
        return 'Uno slot scelto non è più disponibile.'
      }
    }
  }
  return null
}

export function toISO(year, month, day) {
  const z = (n) => String(n).padStart(2, '0')
  return `${year}-${z(month + 1)}-${z(day)}`
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatISO(iso) {
  if (!iso) return '—'
  return parseISO(iso).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function monthCells(year, month) {
  const first = new Date(year, month, 1)
  const pad = (first.getDay() + 6) % 7
  const count = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: pad }, () => null)
  for (let day = 1; day <= count; day += 1) cells.push(toISO(year, month, day))
  return cells
}

export function monthGrid(year, month) {
  const pad = (new Date(year, month, 1).getDay() + 6) % 7
  const start = new Date(year, month, 1 - pad)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return {
      iso: toISO(d.getFullYear(), d.getMonth(), d.getDate()),
      inMonth: d.getMonth() === month,
    }
  })
}

export function datesBetween(from, to) {
  if (!from) return []
  const end = to && to >= from ? to : from
  const out = []
  let cur = parseISO(from)
  const last = parseISO(end)
  while (cur <= last) {
    out.push(toISO(cur.getFullYear(), cur.getMonth(), cur.getDate()))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function todayISO() {
  const d = new Date()
  return toISO(d.getFullYear(), d.getMonth(), d.getDate())
}

export function isDateBookable(config, iso) {
  if (!config || iso < todayISO()) return false
  const day = parseISO(iso).getDay()
  if (!asList(config.weekdays).includes(day)) return false
  if (asList(config.blockedDates).includes(iso)) return false
  return true
}

export { uid }
