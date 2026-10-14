import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase.js'
import { DEFAULT_SITE, SECTION_IDS } from '../data/siteDefaults.js'

function isObj(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

export function mergeSite(base, over) {
  if (over === undefined || over === null) return base
  if (Array.isArray(over)) return over
  if (!isObj(over) || !isObj(base)) return over
  const next = { ...base }
  for (const key of Object.keys(over)) {
    next[key] = mergeSite(base[key], over[key])
  }
  return next
}

function normalize(raw) {
  const merged = mergeSite(DEFAULT_SITE, raw && isObj(raw) ? raw : {})
  const order = Array.isArray(merged.sectionOrder)
    ? merged.sectionOrder.filter((id) => SECTION_IDS.includes(id))
    : []
  // Una sezione nuova finisce dopo quella che la precede nell'ordine di default.
  SECTION_IDS.forEach((id, i) => {
    if (order.includes(id)) return
    const before = SECTION_IDS.slice(0, i).reverse().find((prev) => order.includes(prev))
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id)
  })
  merged.sectionOrder = order
  merged.hidden = Array.isArray(merged.hidden) ? merged.hidden.filter((id) => SECTION_IDS.includes(id)) : []
  return merged
}

let state = normalize({})
const listeners = new Set()

function emit() {
  listeners.forEach((fn) => fn(state))
}

export async function refreshSite() {
  try {
    const { data, error } = await supabase.from('site_content').select('data').eq('id', 'home').maybeSingle()
    if (error) {
      console.error(error)
      return
    }
    if (dirty || saveStatus === 'saving') return
    state = normalize(data?.data ?? {})
    emit()
  } catch (err) {
    console.error(err)
  }
}

export function getSiteState() {
  return state
}

export function subscribeSite(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let live = false
let ignoreRemoteUntil = 0

export function startSite() {
  if (live) return
  live = true
  void refreshSite()
  try {
    const existing = supabase.getChannels().find((ch) => ch.topic === 'realtime:site-live')
    if (!existing?.joinedOnce) {
      supabase
        .channel('site-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_content' }, () => {
          if (saveStatus === 'saving' || Date.now() < ignoreRemoteUntil) return
          void refreshSite()
        })
        .subscribe()
    }
  } catch (err) {
    console.error(err)
  }
}

let saveStatus = 'idle'
let dirty = false
const statusListeners = new Set()

export function subscribeSiteStatus(fn) {
  statusListeners.add(fn)
  return () => statusListeners.delete(fn)
}

export function getSiteStatus() {
  return saveStatus
}

function setStatus(next) {
  saveStatus = next
  statusListeners.forEach((fn) => fn(next))
}

export function patchSite(mutator) {
  state = normalize(mutator(structuredClone(state)))
  dirty = true
  emit()
  setStatus('dirty')
}

export async function saveSite() {
  if (saveStatus === 'saving') return
  setStatus('saving')
  const payload = state
  const { error } = await supabase
    .from('site_content')
    .upsert({ id: 'home', data: payload, updated_at: new Date().toISOString() })
  if (error) {
    console.error(error)
    setStatus('error')
    return
  }
  dirty = false
  ignoreRemoteUntil = Date.now() + 1200
  setStatus('saved')
}

export async function uploadSiteImage(file) {
  if (!file || !file.type.startsWith('image/')) return { ok: false, error: 'Scegli un’immagine.' }
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: 'Max 5 MB.' }
  const safe = String(file.name || 'img')
    .replace(/[^\w.-]+/g, '-')
    .slice(0, 80)
  const path = `${Date.now()}-${safe}`
  const { error } = await supabase.storage.from('site').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) return { ok: false, error: error.message }
  const { data } = supabase.storage.from('site').getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}

export function useSiteStore() {
  const snap = useSyncExternalStore(subscribeSite, getSiteState, getSiteState)
  useEffect(() => {
    startSite()
  }, [])
  return snap
}

export function useSiteStatus() {
  return useSyncExternalStore(subscribeSiteStatus, getSiteStatus, getSiteStatus)
}

export function extLinkProps(href) {
  if (/^https?:\/\//i.test(href || '')) {
    return { href, target: '_blank', rel: 'noopener noreferrer' }
  }
  return { href: href || '#' }
}
