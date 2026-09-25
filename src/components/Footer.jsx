import { motion } from 'framer-motion'
import { fadeUp, stagger, viewport } from '../motion.js'

export default function Footer() {
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
          <p>Via I Settembre, 15 - quarto piano</p>
          <p>Presso Residence Liberty</p>
          <p>98122 – Messina</p>
        </motion.div>
        <motion.div variants={fadeUp}>
          <h3>Contatti</h3>
          <a href="mailto:info@spaziocome.it">info@spaziocome.it</a>
        </motion.div>
        <motion.div variants={fadeUp}>
          <h3>Seguici su</h3>
          <div className="socials">
            <a
              href="https://www.facebook.com/"
              aria-label="Facebook"
              target="_blank"
              rel="noreferrer"
            >
              <img src="/assets/icon-social-1.svg" alt="" width={15} height={15} />
            </a>
            <a
              href="https://www.instagram.com/"
              aria-label="Instagram"
              target="_blank"
              rel="noreferrer"
            >
              <img src="/assets/icon-social-2.svg" alt="" width={15} height={15} />
            </a>
            <a
              href="https://www.linkedin.com/company/spazio-come-coworking-messina/"
              aria-label="LinkedIn"
              target="_blank"
              rel="noreferrer"
            >
              <img src="/assets/icon-social-3.svg" alt="" width={15} height={15} />
            </a>
          </div>
        </motion.div>
      </motion.div>
    </footer>
  )
}
