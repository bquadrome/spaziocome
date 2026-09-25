import { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

const easeOutCubic = (t) => 1 - (1 - t) ** 3
const DEFAULT_ANCHOR_DURATION = 0.55

export default function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined

    const lenis = new Lenis({
      lerp: 0.22,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1,
      autoRaf: true,
      anchors: false,
      respectReducedMotion: true,
    })

    const onAnchorClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
      const link = event.target.closest?.('a[href^="#"]')
      if (!link) return
      const hash = link.getAttribute('href')
      if (!hash || hash === '#') return
      if (hash.startsWith('#prenota') || hash.startsWith('#admin')) return
      const target = document.querySelector(hash)
      if (!target) return

      event.preventDefault()

      const custom = Number(link.getAttribute('data-scroll-duration'))
      const duration =
        Number.isFinite(custom) && custom > 0 ? custom : DEFAULT_ANCHOR_DURATION

      document.documentElement.classList.remove('nav-open')
      lenis.start()
      lenis.scrollTo(target, {
        duration,
        easing: easeOutCubic,
        offset: 0,
        programmatic: true,
      })
    }

    document.addEventListener('click', onAnchorClick, true)

    const syncLock = () => {
      if (document.documentElement.classList.contains('nav-open')) lenis.stop()
      else lenis.start()
    }
    syncLock()
    const obs = new MutationObserver(syncLock)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      document.removeEventListener('click', onAnchorClick, true)
      obs.disconnect()
      lenis.destroy()
    }
  }, [])

  return null
}
