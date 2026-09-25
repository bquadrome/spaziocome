import { motion } from 'framer-motion'
import { easeOut } from '../motion.js'

export default function Hero() {
  return (
    <section className="hero" id="top">
      <motion.img
        className="hero-bg"
        src="/assets/hero.png"
        alt=""
        fetchPriority="high"
        width={1425}
        height={900}
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.6, ease: easeOut }}
      />
      <motion.div
        className="hero-inner"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
        }}
      >
        <motion.img
          className="hero-logo"
          src="/assets/logo-hero.svg"
          alt="SPAZIO come INNOVATION HUB"
          width={269}
          height={114}
          variants={{
            hidden: { opacity: 0, y: 18 },
            show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
          }}
        />
        <motion.h1
          variants={{
            hidden: { opacity: 0, y: 22 },
            show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: easeOut } },
          }}
        >
          Primo Hub di Innovazione
          <br />
          a Messina
        </motion.h1>
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 18 },
            show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
          }}
        >
          Un nuovo spazio dove idee, talenti e connessioni prendono forma… Come sentirsi a casa.
        </motion.p>
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: easeOut } },
          }}
        >
          <a className="btn btn-cyan" href="#progetto" data-scroll-duration="0.8">
            <img src="/assets/icon-cta.svg" alt="" width={18} height={18} />
            Scopri il progetto
          </a>
        </motion.div>
      </motion.div>
    </section>
  )
}
