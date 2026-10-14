import { motion } from 'framer-motion'
import { fadeUp, stagger, viewport } from '../motion.js'
import { useSiteStore } from '../store/siteStore.js'

export default function Footer() {
  const { footer, header } = useSiteStore()

  return (
    <footer className="footer">
      <motion.div
        className="container footer-grid"
        initial="hidden"
        whileInView="show"
        viewport={viewport}
        variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <img
            className="footer-logo"
            src="/assets/logo-footer.svg"
            alt="SPAZIO come INNOVATION HUB"
            width={112}
            height={48}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <h3>Sede</h3>
          <p>{footer.address1}</p>
          <p>{footer.address2}</p>
          <p>{footer.address3}</p>
        </motion.div>
        <motion.div variants={fadeUp}>
          <h3>Contatti</h3>
          <a href={`mailto:${footer.email}`}>{footer.email}</a>
          <a className="footer-area" href={header.areaHref || '/staff'}>
            {header.areaLabel || 'Area riservata'}
          </a>
        </motion.div>
        <motion.div variants={fadeUp}>
          <h3>Seguici su</h3>
          <div className="socials">
            {footer.socials.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                target="_blank"
                rel="noreferrer"
              >
                <img src={social.icon} alt="" width={20} height={20} />
              </a>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </footer>
  )
}
