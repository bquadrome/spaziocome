import { useEffect, useState } from 'react'
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
import { applySeo } from './seo.js'

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

export default function App() {
  const [bookId, setBookId] = useState(null)
  const path = usePathname()
  const isAdmin = path === '/admin' || path.startsWith('/admin/')

  useEffect(() => {
    applySeo(isAdmin)
  }, [isAdmin])

  if (isAdmin) {
    return (
      <MotionConfig reducedMotion="user">
        <AdminApp path={path} />
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll />
      <div className="page">
        <Header />
        <main>
          <Hero />
          <Progetto />
          <Offriamo />
          <Audience />
          <Spaces onBook={setBookId} />
          <MapSection />
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
