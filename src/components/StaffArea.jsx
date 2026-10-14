import { useEffect, useState } from 'react'
import Header from './Header.jsx'
import AdminLogin from './admin/AdminLogin.jsx'
import { supabase } from '../lib/supabase.js'

const OPPORTUNITY_HUB =
  'https://tracker-bandi-139873203886.europe-west1.run.app'
const STAFF_HUB =
  'https://script.google.com/a/macros/associazionebios.org/s/AKfycbz3vrBB12vmWV0lacy2Oq1FfGDTSA9yfuSk_AQtpHcAoDEO5m0DdMRsAg5El-L9L21ajw/exec'

const TOOLS = [
  {
    accent: 'blue',
    kicker: 'Gestione spazi',
    title: 'Gestione Spazio COME',
    text: 'Calendario, prenotazioni, impegni interni, soggetti esterni, eventi, ospiti e sincronizzazione Google Calendar.',
    cta: 'Apri gestione spazio',
    href: '/admin',
    icon: 'home',
  },
  {
    accent: 'green',
    kicker: 'EU Project Lab',
    title: 'Opportunity Hub',
    text: 'Ricerca opportunità, tracker bandi e strumenti di lavoro per la progettazione e lo sviluppo delle opportunità.',
    cta: 'Apri Opportunity Hub',
    href: OPPORTUNITY_HUB,
    external: true,
    icon: 'target',
  },
  {
    accent: 'purple',
    kicker: 'Ecosistema BIOS',
    title: 'Staff Hub',
    text: 'Presenze, assenze e strumenti operativi riservati allo staff dell’ecosistema BIOS.',
    cta: 'Apri Staff Hub',
    href: STAFF_HUB,
    external: true,
    icon: 'check',
  },
]

function ToolIcon({ name }) {
  if (name === 'target') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 12.5l4 4 8-9" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 10.5L12 4.5l7.5 6V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.2H10.2V20.5H6A1.5 1.5 0 0 1 4.5 19v-8.5z" />
    </svg>
  )
}

export default function StaffArea() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="admin">
        <p className="admin-empty">Caricamento…</p>
      </div>
    )
  }

  if (!session) return <AdminLogin />

  return (
    <div className="page">
      <Header />
      <StaffHub />
    </div>
  )
}

function StaffHub() {
  return (
    <main className="staff-area">
      <div className="staff-area-inner">
        <p className="staff-kicker">Spazio COME</p>
        <h1>Area Staff</h1>
        <p className="staff-lead">
          Tutti gli strumenti operativi di Spazio COME in un unico punto. Scegli l’area che vuoi
          utilizzare.
        </p>
        <div className="staff-grid">
          {TOOLS.map((tool) => (
            <article className={`staff-card is-${tool.accent}`} key={tool.title}>
              <span className="staff-icon">
                <ToolIcon name={tool.icon} />
              </span>
              <p className="staff-card-kicker">{tool.kicker}</p>
              <h2>{tool.title}</h2>
              <p>{tool.text}</p>
              <a
                className="staff-open"
                href={tool.href}
                {...(tool.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {tool.cta}
              </a>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
