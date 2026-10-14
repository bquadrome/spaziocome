import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Progetto from './components/Progetto.jsx'
import Offriamo from './components/Offriamo.jsx'
import Audience from './components/Audience.jsx'
import Spaces from './components/Spaces.jsx'
import MapSection from './components/MapSection.jsx'
import Footer from './components/Footer.jsx'
import Booking from './components/Booking.jsx'
import SmoothScroll from './components/SmoothScroll.jsx'
import AdminApp from './components/admin/AdminApp.jsx'
import StaffArea from './components/StaffArea.jsx'
import Ticket from './components/Ticket.jsx'
import Quote from './components/Quote.jsx'
import EventsCarousel from './components/EventsCarousel.jsx'
import EventPage from './components/EventPage.jsx'
import EventsPage from './components/EventsPage.jsx'
import EventTicket from './components/EventTicket.jsx'
import Reception from './components/Reception.jsx'
import { applySeo } from './seo.js'
import { useSiteStore } from './store/siteStore.js'

const SECTIONS = {
  hero: Hero,
  eventi: EventsCarousel,
  progetto: Progetto,
  offriamo: Offriamo,
  audience: Audience,
  spaces: Spaces,
  map: MapSection,
}

function readPath() {
  if (window.location.hash.startsWith('#admin')) {
    return `/admin${window.location.hash.slice('#admin'.length)}`
  }
  return window.location.pathname
}

function usePathname() {
  const [path, setPath] = useState(readPath)
  useEffect(() => {
    if (window.location.hash.startsWith('#admin')) {
      const next = `/admin${window.location.hash.slice('#admin'.length)}`
      window.history.replaceState(null, '', next)
      setPath(next)
    }
    const onPop = () => setPath(readPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return path
}

function AppRoutes({ path }) {
  const [bookId, setBookId] = useState(null)
  const isAdmin = path === '/admin' || path.startsWith('/admin/')
  const isStaff = path === '/staff' || path === '/staff/'
  const isReception = path === '/reception' || path === '/reception/'
  const eventSlug = path.startsWith('/eventi/') ? decodeURIComponent(path.slice('/eventi/'.length).replace(/\/$/, '')) : ''
  const isEvents = path === '/eventi' || path === '/eventi/'
  const registrationToken = path.startsWith('/iscrizione/') ? path.slice('/iscrizione/'.length).replace(/\/$/, '') : ''
  const quoteToken = path.startsWith('/preventivo/') ? path.slice('/preventivo/'.length).replace(/\/$/, '') : ''
  const ticketToken = path.startsWith('/prenotazione/') ? path.slice('/prenotazione/'.length).replace(/\/$/, '') : ''
  const site = useSiteStore()

  useEffect(() => {
    applySeo(isAdmin ? 'admin' : isStaff ? 'staff' : isReception ? 'reception' : ticketToken ? 'ticket' : quoteToken ? 'quote' : registrationToken ? 'registration' : eventSlug ? 'event' : isEvents ? 'events' : 'home')
  }, [isAdmin, isStaff, isReception, ticketToken, quoteToken, registrationToken, eventSlug, isEvents])

  if (isAdmin) {
    return (
      <MotionConfig reducedMotion="user">
        <AdminApp path={path} />
      </MotionConfig>
    )
  }

  if (isReception) {
    return (
      <MotionConfig reducedMotion="user">
        <Reception />
      </MotionConfig>
    )
  }

  if (isEvents) {
    return (
      <MotionConfig reducedMotion="user">
        <SmoothScroll />
        <EventsPage />
      </MotionConfig>
    )
  }

  if (eventSlug) {
    return (
      <MotionConfig reducedMotion="user">
        <SmoothScroll />
        <EventPage slug={eventSlug} />
      </MotionConfig>
    )
  }

  if (registrationToken) {
    return (
      <MotionConfig reducedMotion="user">
        <EventTicket token={registrationToken} />
      </MotionConfig>
    )
  }

  if (quoteToken) {
    return (
      <MotionConfig reducedMotion="user">
        <Quote token={quoteToken} />
      </MotionConfig>
    )
  }

  if (ticketToken) {
    return (
      <MotionConfig reducedMotion="user">
        <Ticket token={ticketToken} />
      </MotionConfig>
    )
  }

  if (isStaff) {
    return (
      <MotionConfig reducedMotion="user">
        <StaffArea />
      </MotionConfig>
    )
  }

  const visible = site.sectionOrder.filter((id) => !site.hidden.includes(id))

  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll />
      <div className="page">
        <Header />
        <main>
          {visible.map((id) => {
            const Comp = SECTIONS[id]
            if (!Comp) return null
            return <Comp key={id} onBook={setBookId} />
          })}
        </main>
        <Footer />
        <AnimatePresence>
          {bookId ? (
            <Booking key={bookId} initialId={bookId} onClose={() => setBookId(null)} />
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}

function isInternalLink(event) {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  const link = event.target.closest?.('a[href]')
  if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return null
  const url = new URL(link.href, window.location.href)
  if (url.origin !== window.location.origin) return null
  // Ancore nella stessa pagina: le gestisce SmoothScroll.
  if (url.pathname === window.location.pathname && url.hash) return null
  return url
}

function scrollToTarget(hash) {
  if (!hash) {
    window.scrollTo(0, 0)
    return
  }
  let tries = 0
  const seek = () => {
    const el = document.querySelector(hash)
    if (el) {
      el.scrollIntoView({ block: 'start' })
      return
    }
    if (tries++ < 30) window.setTimeout(seek, 50)
  }
  seek()
}

export default function App() {
  const path = usePathname()
  const first = useRef(true)

  // Link interni senza ricaricare la pagina: header fermo, cambio pagina immediato.
  useEffect(() => {
    function onClick(event) {
      const url = isInternalLink(event)
      if (!url) return
      event.preventDefault()
      if (url.pathname + url.search + url.hash === window.location.pathname + window.location.search + window.location.hash) return
      window.history.pushState(null, '', url.pathname + url.search + url.hash)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    scrollToTarget(window.location.hash)
  }, [path])

  const routeKey = path.startsWith('/admin') ? 'admin' : path
  return (
    <div className="route-fade" key={routeKey}>
      <AppRoutes path={path} />
    </div>
  )
}
