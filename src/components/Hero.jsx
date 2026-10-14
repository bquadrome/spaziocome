import { motion } from 'framer-motion'
import { easeOut } from '../motion.js'
import TitleLines from './TitleLines.jsx'
import { extLinkProps, useSiteStore } from '../store/siteStore.js'

export default function Hero() {
  const { hero } = useSiteStore()
  const cta = extLinkProps(hero.ctaHref)

  return (
    <section className="hero" id="top">
      <motion.img
        className="hero-bg"
        src={hero.image}
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
          <TitleLines text={hero.title} />
        </motion.h1>
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 18 },
            show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
          }}
        >
          {hero.text}
        </motion.p>
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: easeOut } },
          }}
        >
          <a className="btn btn-cyan" {...cta} data-scroll-duration="0.8">
            <img src="/assets/icon-cta.svg" alt="" width={18} height={18} />
            {hero.ctaLabel}
          </a>
        </motion.div>
      </motion.div>
    </section>
  )
}
