import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { easeOut, stagger } from '../motion.js'

const menuItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: easeOut },
  },
}

const PRENOTA = '#spazi'
const AREA = '/admin'
const BIOS = 'https://www.associazionebios.org/'
const LINKS = [
  { href: '#progetto', label: 'Il progetto' },
  { href: '#offriamo', label: 'Cosa offriamo' },
  { href: '#spazi', label: 'Gli spazi' },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const [away, setAway] = useState(false)

  useEffect(() => {
    let last = window.scrollY
    let ticking = false

    const apply = (y) => {
      const dy = y - last
      last = y
      if (y < 48) {
        setAway(false)
        return
      }
      if (dy > 8) setAway(true)
      else if (dy < -8) setAway(false)
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        apply(window.scrollY)
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (open) setAway(false)
    document.documentElement.classList.toggle('nav-open', open)
    return () => document.documentElement.classList.remove('nav-open')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onResize = () => {
      if (window.innerWidth > 900) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  function close() {
    setOpen(false)
  }

  return (
    <>
      <motion.header
        className={`header${away && !open ? ' is-away' : ''}${open ? ' is-open' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.12, ease: easeOut }}
      >
        <nav className="nav-pill" aria-label="Principale">
          <a className="nav-logo" href="#top" aria-label="Spazio Come" onClick={close}>
            <img src="/assets/logo-nav-raw.png" alt="come*" width={122} height={48} />
          </a>
          <div className="nav-actions nav-desktop">
            <a
              className="nav-credit"
              href={BIOS}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ideato da BIOS
            </a>
            <a className="nav-btn nav-btn-fill" href={PRENOTA}>
              Prenota il tuo spazio
            </a>
            <a className="nav-btn nav-btn-ghost" href={AREA}>
              Area Riservata
            </a>
          </div>
          <button
            className={`hamburger${open ? ' is-on' : ''}`}
            type="button"
            aria-label={open ? 'Chiudi menu' : 'Apri menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg className="hamburger-bars" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7.5h16M4 16.5h16" />
            </svg>
            <svg className="hamburger-x" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </nav>
      </motion.header>
      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              className="mobile-menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: easeOut }}
            >
              <motion.nav
                className="mobile-menu-links"
                aria-label="Sezioni"
                initial="hidden"
                animate="show"
                variants={stagger}
              >
                {LINKS.map((link) => (
                  <motion.a key={link.href} href={link.href} onClick={close} variants={menuItem}>
                    {link.label}
                  </motion.a>
                ))}
              </motion.nav>
              <a className="nav-btn nav-btn-fill" href={PRENOTA} onClick={close}>
                Prenota il tuo spazio
              </a>
              <a className="mobile-menu-quiet" href={AREA} onClick={close}>
                Area riservata
              </a>
              <a
                className="nav-credit"
                href={BIOS}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
              >
                Ideato da BIOS
              </a>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
