import { motion } from 'framer-motion'
import DecoArrow from './DecoArrow.jsx'
import { fadeUp, stagger, viewport } from '../motion.js'

const CARDS = [
  {
    icon: '/assets/icon-freelance.svg',
    title: 'Professionisti e Freelance',
    text: 'Molto più di una scrivania. Trova la concentrazione di cui hai bisogno e connettiti con una community di talenti pronti a ispirarti e fare rete ogni giorno.',
  },
  {
    icon: '/assets/icon-aziende.svg',
    title: 'Aziende e Startup',
    text: "L'ecosistema ideale per accelerare il tuo business. Spazi flessibili, tecnologie all'avanguardia e le connessioni giuste per far crescere il tuo team.",
  },
  {
    icon: '/assets/icon-community.svg',
    title: 'Associazioni e Community',
    text: 'Condividi valori, crea opportunità. Uno spazio accogliente e attrezzato con tutti gli strumenti necessari per dare voce e impatto ai tuoi progetti culturali.',
  },
]

export default function Audience() {
  return (
    <section className="audience" id="per-te">
      <div className="container">
        <motion.div
          className="audience-head"
          initial="hidden"
          whileInView="show"
          viewport={viewport}
          variants={stagger}
        >
          <motion.p className="section-label" variants={fadeUp}>
            <img src="/assets/icon-label.svg" alt="" width={24} height={24} />
            <span>PER CHI È PENSATO</span>
          </motion.p>
          <motion.h2 variants={fadeUp}>
            Co.Me.
            <span className="rest"> è per te.</span>
          </motion.h2>
          <motion.p variants={fadeUp}>
            Se stai cercando la concentrazione per i tuoi progetti o l’energia di un team in crescita,
            qui trovi il tuo habitat ideale.
          </motion.p>
        </motion.div>
        <motion.div
          className="audience-grid"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger}
        >
          {CARDS.map((card) => (
            <motion.article className="aud-card-shell" key={card.title} variants={fadeUp}>
              <div className="aud-card">
                <img src={card.icon} alt="" width={40} height={40} />
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>
            </motion.article>
          ))}
          <DecoArrow>
            <svg
              className="deco-arrow-mark"
              width="215"
              height="215"
              viewBox="0 0 215 215"
              fill="none"
            >
              <g clipPath="url(#audience-asterisk-clip)">
                <path
                  d="M146.517 107.437L210.26 144.26L190.77 178.048L127.027 141.225L107.537 129.962L88.0467 118.699L68.5566 107.437L88.0467 96.1738L107.537 84.991L127.027 73.7283L190.77 36.9046L210.26 70.613L146.517 107.437Z"
                  fill="#264496"
                />
                <path
                  d="M107.543 84.9898L127.033 73.727V-1.46031e-06H88.0526V73.727L24.2304 36.9035L4.74028 70.6119L68.5625 107.435L88.0526 96.1727L107.543 84.9898Z"
                  fill="#264496"
                />
                <path
                  d="M24.2304 178.05L88.0526 141.227V214.873H127.033V141.227L107.543 129.964L88.0526 118.701L68.5625 107.438L4.74028 144.262L24.2304 178.05Z"
                  fill="#264496"
                />
              </g>
              <defs>
                <clipPath id="audience-asterisk-clip">
                  <rect width="215" height="215" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </DecoArrow>
        </motion.div>
      </div>
    </section>
  )
}
