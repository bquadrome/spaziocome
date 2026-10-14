const TITLE = 'Spazio COME | Coworking e Hub di Innovazione a Messina'
const ADMIN_TITLE = 'Area riservata | Spazio COME'
const STAFF_TITLE = 'Area Staff | Spazio COME'
const PRIVATE_TITLES = {
  reception: 'Reception | Spazio COME',
  ticket: 'La tua prenotazione | Spazio COME',
  quote: 'Il tuo preventivo | Spazio COME',
  registration: 'Il tuo pass evento | Spazio COME',
}

function setMeta(name, content, attr = 'name') {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function applySeo(mode) {
  if (mode === 'admin' || mode === true) {
    document.title = ADMIN_TITLE
    setMeta('robots', 'noindex, nofollow')
    return
  }
  if (mode === 'staff') {
    document.title = STAFF_TITLE
    setMeta('robots', 'noindex, nofollow')
    return
  }
  if (PRIVATE_TITLES[mode]) {
    document.title = PRIVATE_TITLES[mode]
    setMeta('robots', 'noindex, nofollow')
    return
  }
  if (mode === 'events') {
    document.title = 'Eventi | Spazio COME'
    setMeta('robots', 'index, follow')
    return
  }
  if (mode === 'event') {
    setMeta('robots', 'index, follow')
    return
  }
  document.title = TITLE
  setMeta('robots', 'index, follow')
}
