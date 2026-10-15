import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { easeOut, stagger } from '../motion.js'
import { extLinkProps, useSiteStore } from '../store/siteStore.js'

const menuItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: easeOut },
  },
}

// L'header entra in dissolvenza solo alla prima apertura del sito, non a ogni cambio pagina.
let headerShown = false

export default function Header() {
  useEffect(() => {
    headerShown = true
  }, [])
  const site = useSiteStore()
  const header = site.header
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

  function go(href) {
    if (href?.startsWith('#') && window.location.pathname !== '/') return `/${href}`
    return href
  }

  const biosProps = extLinkProps(header.biosHref)
  const onHome = window.location.pathname === '/'
  const nav = [
    { label: 'Home', href: onHome ? '#top' : '/' },
    { label: 'Chi siamo', href: go('#progetto') },
    { label: 'Eventi', href: '/eventi' },
  ]

  return (
    <>
      <motion.header
        className={`header${away && !open ? ' is-away' : ''}${open ? ' is-open' : ''}`}
        initial={headerShown ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.12, ease: easeOut }}
      >
        <nav className="nav-pill" aria-label="Principale">
          <a className="nav-logo" href={onHome ? '#top' : '/'} aria-label="Spazio Come" onClick={close}>
            <img src="/assets/logo-nav-raw.png" alt="come*" width={122} height={48} />
          </a>
          <div className="nav-links nav-desktop">
            {nav.map((link) => (
              <a key={link.label} className="nav-link" href={link.href}>
                {link.label}
              </a>
            ))}
            <a className="nav-link" {...biosProps}>
              {header.biosLabel}
            </a>
          </div>
          <div className="nav-actions nav-desktop">
            <a className="nav-btn nav-btn-fill" href={go(header.bookHref)}>
              {header.bookLabel}
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
              transition={{ duration: 0.25, ease: easeOut }}
              onClick={close}
            >
              <motion.div
                className="mobile-sheet"
                onClick={(event) => event.stopPropagation()}
                initial={{ opacity: 0, y: -14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.34, ease: easeOut }}
              >
                <motion.nav
                  className="mobile-menu-links"
                  aria-label="Sezioni"
                  initial="hidden"
                  animate="show"
                  variants={stagger}
                >
                  {nav.map((link) => (
                    <motion.a key={link.label} href={link.href} onClick={close} variants={menuItem}>
                      <span className="mm-label">{link.label}</span>
                    </motion.a>
                  ))}
                </motion.nav>
                <motion.div variants={menuItem} initial="hidden" animate="show" className="mm-foot">
                  <a className="nav-btn nav-btn-fill" href={go(header.bookHref)} onClick={close}>
                    {header.bookLabel}
                  </a>
                  <a className="mm-credit" {...biosProps} onClick={close}>
                    {header.biosLabel}
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 16 16 8M9.5 8H16v6.5" />
                    </svg>
                  </a>
                </motion.div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
