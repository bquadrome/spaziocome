import { motion } from 'framer-motion'
import { useRef } from 'react'
import DecoArrow from './DecoArrow.jsx'
import { fadeUp, stagger, viewport } from '../motion.js'
import { extLinkProps, useSiteStore } from '../store/siteStore.js'

export default function Progetto() {
  const { progetto } = useSiteStore()
  const cta = extLinkProps(progetto.ctaHref)
  const photo = useRef(null)

  // Inclinazione 3D che segue il mouse (solo puntatore preciso, niente con "riduci movimento").
  function tilt(event) {
    const el = photo.current
    if (!el || event.pointerType !== 'mouse') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const box = el.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width - 0.5
    const y = (event.clientY - box.top) / box.height - 0.5
    el.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`)
  }

  function untilt() {
    const el = photo.current
    if (!el) return
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '0deg')
  }

  return (
    <section className="progetto" id="progetto">
      <div className="container">
        <motion.div
          className="progetto-copy"
          initial="hidden"
          whileInView="show"
          viewport={viewport}
          variants={stagger}
        >
          <motion.p className="section-label" variants={fadeUp}>
            <img src="/assets/icon-label.svg" alt="" width={24} height={24} />
            <span>{progetto.label}</span>
          </motion.p>
          <motion.h2 variants={fadeUp}>
            {progetto.titleLead}
            <span className="rest">{progetto.titleMid}</span>
            {progetto.titleTail}
          </motion.h2>
          <motion.p variants={fadeUp}>{progetto.text1}</motion.p>
          <motion.p variants={fadeUp}>{progetto.text2}</motion.p>
          <motion.a className="btn" {...cta} variants={fadeUp}>
            <img src="/assets/icon-explore.svg" alt="" width={18} height={18} />
            {progetto.ctaLabel}
          </motion.a>
        </motion.div>
        <motion.div
          className="progetto-media"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewport}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <DecoArrow src="/assets/arrow.svg" />
          <div className="progetto-photo" ref={photo} onPointerMove={tilt} onPointerLeave={untilt}>
            <img
              src={progetto.image}
              alt={progetto.imageAlt}
              width={616}
              height={463}
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
