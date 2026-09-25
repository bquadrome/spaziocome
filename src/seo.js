const TITLE = 'Spazio COME | Coworking e Hub di Innovazione a Messina'
const ADMIN_TITLE = 'Area riservata | Spazio COME'

function setMeta(name, content, attr = 'name') {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function applySeo(isAdmin) {
  if (isAdmin) {
    document.title = ADMIN_TITLE
    setMeta('robots', 'noindex, nofollow')
    return
  }
  document.title = TITLE
  setMeta('robots', 'index, follow')
}
